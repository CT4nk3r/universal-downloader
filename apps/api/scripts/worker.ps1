# Run the arq worker for Universal Downloader.
#
# Usage:
#   .\scripts\worker.ps1
#
# Environment:
#   UD_REDIS_URL       Redis DSN (default: redis://localhost:6379/0)
#   UD_DATABASE_URL    SQLModel async DSN
#   UD_MAX_CONCURRENCY Worker concurrency
$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

& arq app.services.worker.WorkerSettings @args
exit $LASTEXITCODE
