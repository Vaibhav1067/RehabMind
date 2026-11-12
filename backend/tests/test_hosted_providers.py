"""Hosted providers and the file audio store, used by small single-container deployments."""

import asyncio
import json

import httpx
import pytest

from app.ai.groq import GroqAIProvider
from app.ai.provider import AIProviderError, GenerationRequest
from app.speech.provider import GroqSpeechProvider
from app.storage.audio import EphemeralAudioStore, FileObjectStore

REQUEST = GenerationRequest(
    task="picture_naming.personalize",
    prompt_version="v2",
    system_prompt="system",
    user_prompt="user",
    input={},
    output_schema={"type": "object", "properties": {"hint": {"type": "string"}}},
)


def _ai(handler) -> GroqAIProvider:
    return GroqAIProvider(
        "https://groq.test/openai/v1", "k" * 20, "m", transport=httpx.MockTransport(handler)
    )


def test_groq_ai_sends_schema_and_key_and_returns_content():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "model": "m-1",
                "choices": [{"message": {"content": '{"hint": "It is a fruit."}'}}],
                "usage": {"prompt_tokens": 12, "completion_tokens": 7, "total_time": 0.25},
            },
        )

    result = asyncio.run(_ai(handler).generate(REQUEST))

    assert seen["url"] == "https://groq.test/openai/v1/chat/completions"
    assert seen["auth"] == "Bearer " + "k" * 20
    fmt = seen["body"]["response_format"]
    assert fmt["type"] == "json_schema"
    assert fmt["json_schema"]["schema"] == REQUEST.output_schema
    assert fmt["json_schema"]["name"] == "picture_naming_personalize"
    assert result.raw_output == '{"hint": "It is a fruit."}'
    assert (result.provider, result.model) == ("groq", "m-1")
    assert result.usage == {"prompt_tokens": 12, "output_tokens": 7, "total_ms": 250}


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(429, json={"error": "rate limit"}),
        httpx.Response(200, json={"choices": []}),
        httpx.Response(200, json={"choices": [{"message": {"content": "  "}}]}),
        httpx.Response(200, text="not json"),
    ],
)
def test_groq_ai_failures_are_recoverable_provider_errors(response):
    with pytest.raises(AIProviderError):
        asyncio.run(_ai(lambda _: response).generate(REQUEST))


def test_groq_ai_network_error_is_a_provider_error():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(AIProviderError):
        asyncio.run(_ai(handler).generate(REQUEST))


def test_groq_speech_uploads_audio_and_maps_the_transcript():
    seen: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["body"] = request.content
        return httpx.Response(
            200,
            json={
                "text": " a red apple ",
                "duration": 2.345,
                "segments": [
                    {"no_speech_prob": 0.02, "avg_logprob": -0.2},
                    {"no_speech_prob": 0.4, "avg_logprob": -0.4},
                ],
            },
        )

    provider = GroqSpeechProvider(
        "https://groq.test/openai/v1", "k" * 20, "whisper-x", transport=httpx.MockTransport(handler)
    )
    t = provider.transcribe(b"OggS" + b"\x00" * 16, "en")

    assert seen["url"] == "https://groq.test/openai/v1/audio/transcriptions"
    assert b'filename="audio.ogg"' in seen["body"]
    assert b"whisper-x" in seen["body"] and b"verbose_json" in seen["body"]
    assert (t.text, t.provider, t.model) == ("a red apple", "groq", "whisper-x")
    assert (t.duration_s, t.no_speech_prob, t.avg_logprob) == (2.35, 0.4, -0.3)
    assert t.low_confidence_words == []


def test_groq_speech_without_segments_counts_as_no_speech():
    provider = GroqSpeechProvider(
        "https://groq.test",
        "k" * 20,
        "whisper-x",
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"text": ""})),
    )
    t = provider.transcribe(b"\x1aE\xdf\xa3", "en")
    assert t.is_empty and t.no_speech_prob == 1.0 and t.avg_logprob is None


def test_groq_speech_http_error_raises():
    provider = GroqSpeechProvider(
        "https://groq.test",
        "k" * 20,
        "whisper-x",
        transport=httpx.MockTransport(lambda _: httpx.Response(500)),
    )
    with pytest.raises(httpx.HTTPStatusError):
        provider.transcribe(b"RIFF", "en")


def test_file_store_round_trip_delete_and_no_path_escape(tmp_path):
    root = tmp_path / "audio"
    store = FileObjectStore(str(root))

    store.put("audio/abc", b"blob")
    assert store.exists("audio/abc") and store.get("audio/abc") == b"blob"
    store.delete("audio/abc")
    store.delete("audio/abc")  # deleting twice is not an error
    assert not store.exists("audio/abc")

    store.put("../../outside", b"x")
    assert (root / "outside").is_file() and not (tmp_path.parent / "outside").exists()


def test_file_store_holds_only_ciphertext(tmp_path):
    audio = EphemeralAudioStore(FileObjectStore(str(tmp_path)), b"\x01" * 32)

    async def run() -> None:
        key = await audio.put(b"spoken words")
        (blob,) = [p.read_bytes() for p in tmp_path.iterdir()]
        assert b"spoken words" not in blob
        assert await audio.get(key) == b"spoken words"
        await audio.delete(key)
        assert not await audio.exists(key)

    asyncio.run(run())


def test_hosted_model_id_fits_the_generator_version_column():
    from app.ai.prompts import EXERCISE_PROMPT_VERSION
    from app.core.config import Settings
    from app.exercises.models import Exercise

    model = Settings.model_fields["groq_model"].default
    stored = f"{model}:{EXERCISE_PROMPT_VERSION}"
    assert len(stored) <= Exercise.__table__.c.generator_version.type.length
