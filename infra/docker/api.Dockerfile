# syntax=docker/dockerfile:1.7
# Universal Downloader by CT4nk3r — API image (infra/docker variant)
# Multi-arch: linux/amd64, linux/arm64

############################
# Stage 1: builder
############################
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential \
 && rm -rf /var/lib/apt/lists/*

COPY apps/api/requirements.txt ./
RUN pip install --prefix=/install -r requirements.txt \
 && pip install --prefix=/install "yt-dlp>=2024.10.7"

############################
# Stage 2: runtime
############################
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UD_PORT=8787 \
    UD_DATA_DIR=/data \
    PATH=/usr/local/bin:$PATH

# ffmpeg + CA certs at runtime; yt-dlp is installed via pip in the builder stage.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd --create-home --uid 1000 ud

COPY --from=builder /install /usr/local

WORKDIR /app
COPY --chown=ud:ud apps/api/app ./app

RUN mkdir -p /data && chown -R ud:ud /data
USER ud

EXPOSE 8787
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${UD_PORT}/healthz" || \
        curl -fsS "http://127.0.0.1:${UD_PORT}/v1/health" || exit 1

ENTRYPOINT ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${UD_PORT}"]
