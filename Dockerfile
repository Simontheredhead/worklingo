# WorkLingo: statische Webseite hinter nginx, ohne Root-Rechte.
# Das Basis-Image läuft als Benutzer "nginx" (UID 101) und lauscht auf Port 8080.
FROM nginxinc/nginx-unprivileged:1.28-alpine

LABEL org.opencontainers.image.title="WorkLingo" \
      org.opencontainers.image.source="https://github.com/Simontheredhead/worklingo"

# Eigene Konfiguration; das Dateisystem wird zur Laufzeit schreibgeschützt eingehängt.
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/security-headers.conf /etc/nginx/security-headers.conf

# Nur die App-Dateien ins Image (kein Git, keine Docker-Dateien).
COPY index.html app.js translator.js sw.js sw-register.js \
     content.js content-more.js content-cloud.js content-es.js \
     manifest.webmanifest icon.svg icon-192.png icon-512.png \
     /usr/share/nginx/html/

# Standard-Seite des Basis-Images entfernen, falls vorhanden.
USER root
RUN rm -f /usr/share/nginx/html/50x.html && chmod -R a=rX /usr/share/nginx/html
USER 101

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
