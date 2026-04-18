# Universal Downloader by CT4nk3r — API dev server (Windows)
$ErrorActionPreference = 'Stop'
Set-Location -Path (Join-Path $PSScriptRoot '..')

if (-not $env:UD_ENV)       { $env:UD_ENV = 'development' }
if (-not $env:UD_LOG_LEVEL) { $env:UD_LOG_LEVEL = 'DEBUG' }
$port = if ($env:UD_PORT) { $env:UD_PORT } else { '8787' }
$host_ = if ($env:UD_HOST) { $env:UD_HOST } else { '127.0.0.1' }

uvicorn app.main:app `
  --host $host_ `
  --port $port `
  --reload `
  --reload-dir app
