"""Hosted generative AI: an open-weight LLM served by Groq's OpenAI-compatible API.

For deployments too small to run Ollama (e.g. a 512 MB free instance). Unlike the local
provider, the pseudonymous prompt leaves this server: see docs/privacy.md.

One HTTP call per request, with the task's JSON Schema passed as a best-effort
`json_schema` response format. The reply is still untrusted text: every caller validates
it before use. No tools, no conversation memory, no streaming.
"""

from typing import Any

import httpx

from app.ai.provider import AIProviderError, GenerationRequest, GenerationResult


class GroqAIProvider:
    name = "groq"

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        *,
        fallback_models: tuple[str, ...] = (),
        timeout_s: float = 20,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        """`transport` is a test hook (httpx.MockTransport).

        Rate limits are per model, so when the main model answers 429 the same request
        goes to the next model in `fallback_models` instead of failing."""
        self.model = model
        self.models = (model, *fallback_models)
        self._client = httpx.AsyncClient(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout_s,
            transport=transport,
        )

    def payload(self, request: GenerationRequest, model: str | None = None) -> dict[str, Any]:
        return {
            "model": model or self.model,
            "messages": [
                {"role": "system", "content": request.system_prompt},
                {"role": "user", "content": request.user_prompt},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": request.task.replace(".", "_"),
                    "schema": request.output_schema,
                },
            },
            "temperature": 0.4,
            "top_p": 0.9,
            # Reasoning tokens count against the limit; the visible output is small.
            "reasoning_effort": "low",
            "max_completion_tokens": 1500,
            "stream": False,
        }

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        for model in self.models:
            try:
                r = await self._client.post("/chat/completions", json=self.payload(request, model))
            except httpx.HTTPError as e:
                raise AIProviderError(f"groq unreachable: {type(e).__name__}") from e
            if r.status_code != 429:
                break
        if r.status_code != 200:
            raise AIProviderError(f"groq returned HTTP {r.status_code}")
        try:
            data = r.json()
            content = data["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as e:
            raise AIProviderError("groq reply missing message content") from e
        if not isinstance(content, str) or not content.strip():
            raise AIProviderError("groq returned empty content")
        usage = data.get("usage") or {}
        return GenerationResult(
            raw_output=content,
            provider=self.name,
            model=str(data.get("model") or self.model),
            usage={
                "prompt_tokens": int(usage.get("prompt_tokens") or 0),
                "output_tokens": int(usage.get("completion_tokens") or 0),
                "total_ms": int(float(usage.get("total_time") or 0) * 1000),
            },
        )
