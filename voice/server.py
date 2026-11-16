"""Sprachdienst für WorkLingo (Piper, läuft auf der CPU).

POST /tts   {"lang": "en" | "es", "voice": 0 | 1, "text": "..."}  ->  WAV-Audio (16 Bit, mono)
GET  /health                                                       ->  {"ok": true, ...}

Stimme 0 ist immer weiblich, Stimme 1 immer männlich. Es werden keine Texte protokolliert.
"""
import io
import os
import threading
import wave
from functools import lru_cache
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from piper import PiperVoice, SynthesisConfig
from pydantic import BaseModel, Field

MODELS = os.environ.get("MODELS_DIR", "/models")
MAX_CHARS = int(os.environ.get("TTS_MAX_CHARS", "300"))
MAX_PARALLEL = int(os.environ.get("TTS_MAX_PARALLEL", "2"))
WAIT_SECONDS = float(os.environ.get("TTS_WAIT_SECONDS", "15"))
# Etwas langsamer als normal (1.0 = Standardtempo), damit Lernende alles verstehen.
LENGTH_SCALE = float(os.environ.get("TTS_LENGTH_SCALE", "1.1"))

# (Modelldatei, Sprecher-Nummer im Modell oder None)
VOICES = {
    "en": [("en_US-lessac-high.onnx", None), ("en_US-ryan-high.onnx", None)],
    "es": [("es_ES-sharvard-medium.onnx", 1), ("es_ES-davefx-medium.onnx", None)],   # sharvard: Sprecher 1 = weiblich
}

app = FastAPI(title="WorkLingo Stimme", docs_url=None, redoc_url=None, openapi_url=None)

_models: dict[str, PiperVoice] = {}
_load_lock = threading.Lock()
_slots = threading.BoundedSemaphore(MAX_PARALLEL)


def model(name: str) -> PiperVoice:
    """Modelle werden beim ersten Gebrauch geladen und danach behalten."""
    if name not in _models:
        with _load_lock:
            if name not in _models:
                _models[name] = PiperVoice.load(os.path.join(MODELS, name))
    return _models[name]


class Request(BaseModel):
    lang: Literal["en", "es"]
    voice: int = Field(0, ge=0, le=1)
    text: str = Field(min_length=1, max_length=MAX_CHARS)


@lru_cache(maxsize=200)
def synthesize(lang: str, voice: int, text: str) -> bytes:
    name, speaker = VOICES[lang][voice]
    cfg = SynthesisConfig(speaker_id=speaker, length_scale=LENGTH_SCALE)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        model(name).synthesize_wav(text, wav, syn_config=cfg)
    return buffer.getvalue()


@app.get("/health")
def health():
    return {"ok": True, "geladen": sorted(_models)}


@app.post("/tts")
def tts(request: Request):
    text = " ".join(request.text.split())          # Leerraum vereinheitlichen
    if not text or not any(c.isalnum() for c in text):
        raise HTTPException(status_code=400, detail="Kein Text")
    # Nur wenige Synthesen gleichzeitig; wer zu lange warten müsste, bekommt 503 (der Browser nimmt dann die eigene Stimme).
    if not _slots.acquire(timeout=WAIT_SECONDS):
        raise HTTPException(status_code=503, detail="Ausgelastet")
    try:
        audio = synthesize(request.lang, request.voice, text)
    finally:
        _slots.release()
    return Response(content=audio, media_type="audio/wav", headers={"Cache-Control": "no-store"})
