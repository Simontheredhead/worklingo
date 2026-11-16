# Sprachausgabe für WorkLingo: Piper (offline, CPU) mit je zwei Stimmen für Englisch und Spanisch.
# Die Modelle werden beim Bauen aus einer festen Version des Stimmen-Repositories geladen und per MD5 geprüft;
# zur Laufzeit braucht der Dienst kein Internet.
FROM python:3.12-slim

# Feste Version des Repos rhasspy/piper-voices (Stand 2026-11-15), damit der Build reproduzierbar bleibt.
ARG REV=e9ab671f2a0e50a701b34361136ba3e6a3a9eb0c
ARG BASE=https://huggingface.co/rhasspy/piper-voices/resolve/${REV}

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Englisch (US): lessac = weiblich, ryan = männlich. Spanisch (Spanien): sharvard (zwei Sprecher in einem Modell).
ADD ${BASE}/en/en_US/lessac/medium/en_US-lessac-medium.onnx      /models/
ADD ${BASE}/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json /models/
ADD ${BASE}/en/en_US/ryan/medium/en_US-ryan-medium.onnx          /models/
ADD ${BASE}/en/en_US/ryan/medium/en_US-ryan-medium.onnx.json     /models/
ADD ${BASE}/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx      /models/
ADD ${BASE}/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx.json /models/

# Prüfsummen laut voices.json des Repos; der Build bricht ab, wenn eine Datei nicht stimmt.
RUN cd /models && printf '%s\n' \
  "2fc642b535197b6305c7c8f92dc8b24f  en_US-lessac-medium.onnx" \
  "c1f2b7bddefe113f3255ff9ef234cfd3  en_US-lessac-medium.onnx.json" \
  "6431a4a167687c60044d9768a47befa3  en_US-ryan-medium.onnx" \
  "c0699416f4aa54504ce768ffb0a8b96a  en_US-ryan-medium.onnx.json" \
  "f1c228def498dbfefe3b946369510748  es_ES-sharvard-medium.onnx" \
  "695ad6a14e8d98dff56a04276ced7b4c  es_ES-sharvard-medium.onnx.json" \
  | md5sum -c - \
  && chmod 644 /models/*

COPY server.py .
# Kein Root: numerische Benutzer-ID (ein Eintrag in /etc/passwd ist dafür nicht nötig).
USER 10001:10001
ENV HOME=/tmp PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 5000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "5000", "--no-access-log"]
