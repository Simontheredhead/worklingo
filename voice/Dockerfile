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

# Englisch: alba (GB) = weiblich, ryan (US, Qualität high) = männlich. Spanisch (Spanien): sharvard (zwei Sprecher in einem Modell).
ADD ${BASE}/en/en_GB/alba/medium/en_GB-alba-medium.onnx      /models/
ADD ${BASE}/en/en_GB/alba/medium/en_GB-alba-medium.onnx.json /models/
ADD ${BASE}/en/en_US/ryan/high/en_US-ryan-high.onnx          /models/
ADD ${BASE}/en/en_US/ryan/high/en_US-ryan-high.onnx.json     /models/
ADD ${BASE}/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx      /models/
ADD ${BASE}/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx.json /models/

# Prüfsummen laut voices.json des Repos; der Build bricht ab, wenn eine Datei nicht stimmt.
RUN cd /models && printf '%s\n' \
  "b802b4229cf62bb98d53a617dfd8fd4c  en_GB-alba-medium.onnx" \
  "87dc160c21fa57bb0a70b13a2751d9a7  en_GB-alba-medium.onnx.json" \
  "5d879a17bddf5007f76655b445ba78b4  en_US-ryan-high.onnx" \
  "444ff9d6c17218a0eb1d12a20559d869  en_US-ryan-high.onnx.json" \
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
