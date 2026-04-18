# syntax=docker/dockerfile:1.7
# Universal Downloader by CT4nk3r — API image
# Multi-arch friendly (linux/amd64, linux/arm64). No arch-specific binaries.

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

COPY requirements.txt ./
RUN pip install --prefix=/install -r requirements.txt

############################
# Stage 2: runtime
############################
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UD_PORT=8787 \
    UD_DATA_DIR=/data

# ffmpeg is the only system runtime dep we need.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd --create-home --uid 1000 ud

COPY --from=builder /install /usr/local
WORKDIR /app
COPY --chown=ud:ud app ./app

RUN mkdir -p /data && chown -R ud:ud /data
USER ud

EXPOSE 8787
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request,sys; \
        sys.exit(0 if urllib.request.urlopen(f'http://127.0.0.1:{__import__(\"os\").environ.get(\"UD_PORT\",\"8787\")}/v1/health',timeout=3).status==200 else 1)"

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${UD_PORT}"]
