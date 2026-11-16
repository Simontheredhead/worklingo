# Sprachausgabe für WorkLingo: Piper (offline, CPU) mit je zwei Stimmen für Englisch, Spanisch und Französisch.
# Die Modelle werden beim Bauen aus einer festen Version des Stimmen-Repositories geladen und per MD5 geprüft;
# zur Laufzeit braucht der Dienst kein Internet.
FROM python:3.12-slim

# Feste Version des Repos rhasspy/piper-voices (Stand 2026-11-15), damit der Build reproduzierbar bleibt.
ARG REV=e9ab671f2a0e50a701b34361136ba3e6a3a9eb0c
ARG BASE=https://huggingface.co/rhasspy/piper-voices/resolve/${REV}

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Englisch (US, Qualität high): lessac = weiblich, ryan = männlich. Spanisch (Spanien): sharvard Sprecherin = weiblich, davefx = männlich.
ADD ${BASE}/en/en_US/lessac/high/en_US-lessac-high.onnx      /models/
ADD ${BASE}/en/en_US/lessac/high/en_US-lessac-high.onnx.json /models/
ADD ${BASE}/en/en_US/ryan/high/en_US-ryan-high.onnx          /models/
ADD ${BASE}/en/en_US/ryan/high/en_US-ryan-high.onnx.json     /models/
ADD ${BASE}/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx      /models/
ADD ${BASE}/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx.json /models/
ADD ${BASE}/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx          /models/
ADD ${BASE}/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json     /models/
# Französisch: siwis = weiblich, tom = männlich
ADD ${BASE}/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx      /models/
ADD ${BASE}/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json /models/
ADD ${BASE}/fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx          /models/
ADD ${BASE}/fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx.json     /models/

# Prüfsummen laut voices.json des Repos; der Build bricht ab, wenn eine Datei nicht stimmt.
RUN cd /models && printf '%s\n' \
  "99d1f6181a7f5ccbe3f117ba8ce63c93  en_US-lessac-high.onnx" \
  "02e8e364c86b5d3b75e81704b0369856  en_US-lessac-high.onnx.json" \
  "5d879a17bddf5007f76655b445ba78b4  en_US-ryan-high.onnx" \
  "444ff9d6c17218a0eb1d12a20559d869  en_US-ryan-high.onnx.json" \
  "f1c228def498dbfefe3b946369510748  es_ES-sharvard-medium.onnx" \
  "695ad6a14e8d98dff56a04276ced7b4c  es_ES-sharvard-medium.onnx.json" \
  "0e0aa6d60c4cf692f86c27ee31801e01  es_ES-davefx-medium.onnx" \
  "4e342be16f44d8f1bc3625322c0c82af  es_ES-davefx-medium.onnx.json" \
  "bb8456dcd54ce8143ee62c19bf2d4b41  fr_FR-siwis-medium.onnx" \
  "1ab0f73eb813ff70b6228d03ff9aed94  fr_FR-siwis-medium.onnx.json" \
  "5b460c2394a871e675f5c798af149412  fr_FR-tom-medium.onnx" \
  "964d58602df7adf76c2401b070f68ea2  fr_FR-tom-medium.onnx.json" \
  | md5sum -c - \
  && chmod 644 /models/*

COPY server.py .
# Kein Root: numerische Benutzer-ID (ein Eintrag in /etc/passwd ist dafür nicht nötig).
USER 10001:10001
ENV HOME=/tmp PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 5000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5000", "--no-access-log"]
