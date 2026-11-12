"""Speech-to-text behind a provider interface. faster-whisper is the self-hosted default."""

import io
import logging
import threading
from dataclasses import dataclass, field
from typing import Protocol

import av
import httpx
import numpy as np

from app.core.config import get_settings

SAMPLE_RATE = 16_000

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Transcript:
    text: str
    provider: str
    model: str
    duration_s: float
    no_speech_prob: float
    avg_logprob: float | None
    # Words the recogniser was unsure about; shown to clinicians as uncertainty.
    low_confidence_words: list[str] = field(default_factory=list)

    @property
    def is_empty(self) -> bool:
        return not self.text.strip()


def decode_audio(audio: bytes) -> np.ndarray:
    """Decode any browser recording (webm/ogg/mp4/wav) to 16 kHz mono float32, in memory."""
    resampler = av.AudioResampler(format="s16", layout="mono", rate=SAMPLE_RATE)
    pcm: list[np.ndarray] = []
    with av.open(io.BytesIO(audio), mode="r") as container:
        for frame in container.decode(audio=0):
            for out in resampler.resample(frame):
                pcm.append(out.to_ndarray().reshape(-1))
        for out in resampler.resample(None):
            pcm.append(out.to_ndarray().reshape(-1))
    if not pcm:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(pcm).astype(np.float32) / 32768.0


class SpeechProvider(Protocol):
    def transcribe(self, audio: bytes, language: str) -> Transcript: ...


class FasterWhisperProvider:
    """Settings chosen for aphasia: transcribe what was said, not what was likely meant.

    - no initial prompt and no conditioning on previous text (avoids "correcting" errors)
    - temperature 0 (deterministic), VAD to ignore silence
    - word probabilities kept so uncertain words can be flagged
    """

    name = "faster-whisper"
    LOW_CONFIDENCE = 0.5

    def __init__(self, model: str, device: str, compute_type: str) -> None:
        self.model_name = model
        self._args = (model, device, compute_type)
        self._model = None
        self._lock = threading.Lock()

    def _load(self):
        with self._lock:
            if self._model is None:
                from faster_whisper import WhisperModel

                model, device, compute_type = self._args
                log.info("loading whisper model", extra={"data": {"model": model}})
                self._model = WhisperModel(model, device=device, compute_type=compute_type)
        return self._model

    def transcribe(self, audio: bytes, language: str) -> Transcript:
        segments, info = self._load().transcribe(
            decode_audio(audio),
            language=language,
            beam_size=5,
            temperature=0.0,
            condition_on_previous_text=False,
            initial_prompt=None,
            vad_filter=True,
            word_timestamps=True,
        )
        segments = list(segments)
        words = [w for s in segments for w in (s.words or [])]
        return Transcript(
            text=" ".join(s.text.strip() for s in segments).strip(),
            provider=self.name,
            model=self.model_name,
            duration_s=round(info.duration, 2),
            no_speech_prob=round(max((s.no_speech_prob for s in segments), default=1.0), 3),
            avg_logprob=round(sum(s.avg_logprob for s in segments) / len(segments), 3)
            if segments
            else None,
            low_confidence_words=[
                w.word.strip() for w in words if w.probability < self.LOW_CONFIDENCE
            ],
        )


class GroqSpeechProvider:
    """Hosted Whisper for hosts too small to run the model. The recording leaves this
    server (see docs/privacy.md). Same stance as the local provider: no prompt and
    temperature 0, so it transcribes what was said. No per-word probabilities are
    available, so no words are flagged as low confidence."""

    name = "groq"

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        *,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        """`transport` is a test hook (httpx.MockTransport)."""
        self.model_name = model
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=30,
            transport=transport,
        )

    def _load(self) -> None:
        """Nothing to load; kept so the worker can treat providers alike."""

    @staticmethod
    def _filename(audio: bytes) -> str:
        if audio[:4] == b"RIFF":
            return "audio.wav"
        if audio[:4] == b"OggS":
            return "audio.ogg"
        if audio[4:8] == b"ftyp":
            return "audio.mp4"
        return "audio.webm"

    def transcribe(self, audio: bytes, language: str) -> Transcript:
        r = self._client.post(
            "/audio/transcriptions",
            files={"file": (self._filename(audio), audio, "application/octet-stream")},
            data={
                "model": self.model_name,
                "language": language,
                "temperature": "0",
                "response_format": "verbose_json",
            },
        )
        r.raise_for_status()
        data = r.json()
        segments = data.get("segments") or []
        return Transcript(
            text=str(data.get("text") or "").strip(),
            provider=self.name,
            model=self.model_name,
            duration_s=round(float(data.get("duration") or 0), 2),
            no_speech_prob=round(
                max((float(s.get("no_speech_prob") or 0) for s in segments), default=1.0), 3
            ),
            avg_logprob=round(
                sum(float(s.get("avg_logprob") or 0) for s in segments) / len(segments), 3
            )
            if segments
            else None,
        )


_provider: SpeechProvider | None = None


def get_speech_provider() -> SpeechProvider:
    global _provider
    if _provider is None:
        s = get_settings()
        if s.speech_provider == "groq":
            assert s.groq_api_key is not None  # guarded by settings validation
            _provider = GroqSpeechProvider(
                s.groq_base_url, s.groq_api_key.get_secret_value(), s.groq_speech_model
            )
            return _provider
        _provider = FasterWhisperProvider(s.whisper_model, s.whisper_device, s.whisper_compute_type)
    return _provider
