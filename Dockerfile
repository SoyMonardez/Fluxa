# Una sola imagen chica: la app web (React) compilada + el servidor (Python)
# que sirve la API y esos archivos.

# 1) La app web se compila una vez.
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# 2) El servidor.
FROM python:3.13-alpine
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    FRONTEND_DIST=/app/web \
    TZ=America/Argentina/Buenos_Aires
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-compile -r requirements.txt
COPY backend/app ./app
COPY backend/scripts ./scripts
COPY --from=web /web/dist ./web
RUN adduser -D -H etem
USER etem
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:8000/api/salud || exit 1
# Detrás de Caddy: las IP de los celulares llegan en X-Forwarded-For.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-server-header"]
