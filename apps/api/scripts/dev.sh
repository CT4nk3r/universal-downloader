#!/usr/bin/env bash
# Universal Downloader by CT4nk3r — API dev server
set -euo pipefail
cd "$(dirname "$0")/.."

export UD_ENV="${UD_ENV:-development}"
export UD_LOG_LEVEL="${UD_LOG_LEVEL:-DEBUG}"
PORT="${UD_PORT:-8787}"

exec uvicorn app.main:app \
  --host "${UD_HOST:-127.0.0.1}" \
  --port "${PORT}" \
  --reload \
  --reload-dir app
