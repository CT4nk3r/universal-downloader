#!/usr/bin/env bash
# Run the arq worker for Universal Downloader.
#
# Usage:
#   ./scripts/worker.sh
#
# Environment:
#   UD_REDIS_URL      Redis DSN (default: redis://localhost:6379/0)
#   UD_DATABASE_URL   SQLModel async DSN
#   UD_MAX_CONCURRENCY  Worker concurrency
set -euo pipefail

cd "$(dirname "$0")/.."

exec arq app.services.worker.WorkerSettings "$@"
