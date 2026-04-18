# @universal-downloader/api

FastAPI backend for **Universal Downloader by CT4nk3r**. Wraps `yt-dlp` and
`ffmpeg` behind the OpenAPI 3.1 contract defined in
[`packages/shared-types/openapi.yaml`](../../packages/shared-types/openapi.yaml).

## Layout

```
app/
  main.py            FastAPI factory, CORS, lifespan
  settings.py        pydantic-settings (env: UD_*)
  security.py        Bearer token auth
  logging_config.py  structlog (JSON in prod, pretty in dev)
  errors.py          Error envelope + custom exceptions
  routers/
    meta.py          /health, /sites
    probe.py         /probe
    jobs.py          /jobs lifecycle (+ SSE, file)
  services/          (filled by sibling Wave 1 jobs)
    job_engine.py    J1.2 — arq queue + SQLModel persistence
    ytdlp_adapter.py J1.3 — yt-dlp probe/download wrapper
    file_store.py    J1.4 — artifact storage + range serving
  models/
    api_models.py    Hand-written stub of OpenAPI schemas
    generated.py     Produced by `pnpm codegen` (datamodel-code-generator)
  utils/
    site_detection.py  Port of detectSite() from shared-types
```

## Configuration

All settings come from environment variables prefixed with `UD_`. See
[`app/settings.py`](./app/settings.py).

| Variable             | Default                              | Description                        |
|----------------------|--------------------------------------|------------------------------------|
| `UD_API_KEY`         | *(required)*                         | Bearer token, fail-fast if missing |
| `UD_REDIS_URL`       | `redis://localhost:6379/0`           | arq queue backend                  |
| `UD_DATABASE_URL`    | `sqlite+aiosqlite:///./ud.db`        | SQLModel metadata store            |
| `UD_DATA_DIR`        | `./data`                             | Artifact directory                 |
| `UD_PORT`            | `8787`                               | uvicorn port                       |
| `UD_JOB_TTL_HOURS`   | `24`                                 | Artifact TTL                       |
| `UD_MAX_CONCURRENCY` | `3`                                  | Concurrent download workers        |
| `UD_LOG_LEVEL`       | `INFO`                               | structlog level                    |
| `UD_CORS_ORIGINS`    | `["*"]`                              | JSON list of CORS origins          |

## Develop

```bash
pip install -r requirements-dev.txt
export UD_API_KEY=devkey
pnpm --filter @universal-downloader/api dev
```

API listens on <http://localhost:8787/v1>. OpenAPI JSON at
<http://localhost:8787/openapi.json>.

## Codegen

```bash
pnpm --filter @universal-downloader/api codegen
```

Produces `app/models/generated.py` from the canonical OpenAPI spec. Until
codegen is run, the app falls back to the hand-written `app/models/api_models.py`
stub so it can boot in a fresh checkout.

## Docker

```bash
docker build -t ud-api apps/api
docker run --rm -p 8787:8787 -e UD_API_KEY=devkey ud-api
```
