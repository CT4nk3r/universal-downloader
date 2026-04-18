# Self-hosting

This guide walks through running Universal Downloader on your own
infrastructure. It targets a single-host docker-compose deployment behind
a reverse proxy; the same containers scale horizontally if you add a
shared Redis and shared file store.

---

## 1. Prerequisites

* Docker 24+ and the Compose plugin (or Podman 4+ with `podman compose`).
* A domain name pointing at the host (recommended for HTTPS).
* `ffmpeg` is bundled into the worker image — no host install required.
* A 32+ character random string for `UD_API_KEY`. Generate with:

  ```sh
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```

---

## 2. Quickstart

```sh
git clone https://github.com/anomalyco/universal-downloader.git
cd universal-downloader
cp infra/docker/.env.example .env
# edit .env and set UD_API_KEY (mandatory) + UD_SIGNED_URL_SECRET
docker compose -f infra/docker/compose.yml up -d
```

The API is now reachable on `http://localhost:8787`. Smoke test:

```sh
curl -H "Authorization: Bearer $UD_API_KEY" http://localhost:8787/v1/health
```

A minimal `compose.yml` looks like this:

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes: ["redis-data:/data"]

  api:
    image: ghcr.io/anomalyco/ud-api:latest
    restart: unless-stopped
    env_file: .env
    ports: ["8787:8787"]
    volumes: ["data:/data"]
    depends_on: [redis]

  worker:
    image: ghcr.io/anomalyco/ud-worker:latest
    restart: unless-stopped
    env_file: .env
    volumes: ["data:/data"]
    depends_on: [redis]

volumes:
  redis-data:
  data:
```

---

## 3. Environment variables

All variables are read with the prefix `UD_` (see
[`apps/api/app/settings.py`](../apps/api/app/settings.py)).

| Variable                | Default                             | Required | Description |
|-------------------------|-------------------------------------|----------|-------------|
| `UD_API_KEY`            | —                                   | **yes**  | Bearer token for `/v1/*`. App refuses to boot without it. |
| `UD_DATABASE_URL`       | `sqlite+aiosqlite:///./ud.db`       | no       | SQLAlchemy async URL. Use `postgresql+asyncpg://...` in production. |
| `UD_REDIS_URL`          | `redis://localhost:6379/0`          | no       | Redis URL for the arq queue. |
| `UD_DATA_DIR`           | `./data`                            | no       | Where artifacts are written. *(Spec sometimes calls this `UD_DOWNLOAD_DIR`; the actual var is `UD_DATA_DIR`.)* |
| `UD_JOB_TTL_HOURS`      | `24`                                | no       | TTL for jobs and their files. *(Spec name: `UD_FILE_TTL_HOURS`.)* |
| `UD_MAX_CONCURRENCY`    | `3`                                 | no       | Worker concurrency (1–64). |
| `UD_PORT`               | `8787`                              | no       | API listen port. |
| `UD_SIGNED_URL_SECRET`  | derived from `UD_API_KEY` via HKDF  | no       | Per-deployment secret for signed download URLs. **Set explicitly in production** so rotating the API key doesn't invalidate active links. |
| `UD_LOG_LEVEL`          | `INFO`                              | no       | `DEBUG`/`INFO`/`WARNING`/`ERROR`. |
| `UD_CORS_ORIGINS`       | `["*"]`                             | no       | JSON list of allowed origins. Tighten in production. |
| `UD_ENV`                | `development`                       | no       | `development` enables verbose errors. Set to `production` when public. |

Example `.env`:

```env
UD_API_KEY=replace-me-with-a-48-char-token
UD_SIGNED_URL_SECRET=replace-me-with-an-independent-random-string
UD_DATABASE_URL=postgresql+asyncpg://ud:ud@db:5432/ud
UD_REDIS_URL=redis://redis:6379/0
UD_DATA_DIR=/data
UD_JOB_TTL_HOURS=24
UD_MAX_CONCURRENCY=4
UD_PORT=8787
UD_ENV=production
UD_CORS_ORIGINS=["https://app.example.com"]
```

---

## 4. Reverse proxy

### 4.1 Caddy (recommended — automatic HTTPS)

```caddyfile
ud.example.com {
    encode zstd gzip
    reverse_proxy localhost:8787 {
        header_up X-Real-IP {remote_host}
    }
    # Generous limit for large file downloads
    request_body {
        max_size 5GB
    }
}
```

### 4.2 nginx

```nginx
server {
    listen 443 ssl http2;
    server_name ud.example.com;

    ssl_certificate     /etc/letsencrypt/live/ud.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ud.example.com/privkey.pem;

    client_max_body_size 5G;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

### 4.3 HTTPS notes

* **Always** terminate TLS at the proxy. The bearer token is sent on
  every request; plaintext exposes it.
* HSTS: `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
* If you must run behind a load balancer that re-terminates TLS, ensure
  `X-Forwarded-Proto` is set so the API generates `https://` signed URLs.

---

## 5. Backup

| Item                | What to back up                      | How |
|---------------------|--------------------------------------|-----|
| Database            | `UD_DATABASE_URL` contents (jobs, metadata) | `pg_dump` for Postgres; copy `ud.db` for SQLite (stop API first or use SQLite `.backup`). |
| Artifacts           | `UD_DATA_DIR` tree                   | `restic`, `rclone`, or `rsync`. Files are short-lived (TTL) so backup is optional unless you raised the TTL. |
| Secrets             | `.env` (`UD_API_KEY`, `UD_SIGNED_URL_SECRET`) | Store offline / in a password manager. |
| Redis               | Not required to back up — it only holds in-flight jobs. Losing it requeues nothing; clients must retry. |

Recommended cadence: daily DB dump, hourly artifact rsync only if you
disabled TTL cleanup.

---

## 6. Upgrades

```sh
cd universal-downloader
git pull
docker compose -f infra/docker/compose.yml pull
docker compose -f infra/docker/compose.yml up -d
```

Migration policy:

* Schema changes ship as Alembic migrations and run on API startup.
* Always back up the DB before upgrading across a minor version.
* Read `CHANGELOG.md` for breaking env-var renames.

To upgrade `yt-dlp` without rebuilding the image:

```sh
docker compose exec worker pip install -U yt-dlp
docker compose restart worker
```

(Pin the version in your image once you confirm it works.)

---

## 7. Troubleshooting

### "ffmpeg: not found" in worker logs

The official `ud-worker` image bundles ffmpeg. If you built a slimmer
image, install it:

```Dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
 && rm -rf /var/lib/apt/lists/*
```

Verify with `docker compose exec worker ffmpeg -version`.

### Redis unreachable / `ConnectionRefusedError`

* Check `UD_REDIS_URL` matches the service name in compose
  (`redis://redis:6379/0`, not `localhost`).
* `docker compose logs redis` — make sure it's actually running.
* If you use a managed Redis, allow the egress IP and use `rediss://` for TLS.

### yt-dlp fails on a previously working site

Sites change. Update yt-dlp:

```sh
docker compose exec worker pip install -U yt-dlp
docker compose restart worker
```

If failures persist, check
[yt-dlp issues](https://github.com/yt-dlp/yt-dlp/issues) for the site
name. Capture the worker log (`docker compose logs worker`) when filing
a bug here.

### 401 Unauthorized on every request

* `Authorization: Bearer <token>` header missing or misspelled.
* Token has trailing whitespace — `docker compose exec api env | grep UD_API_KEY`.
* You rotated `UD_API_KEY` but forgot to restart: `docker compose restart api worker`.

### Signed URLs return 403 immediately

* Clock skew between client and server > the URL's expiry window.
  Sync NTP on both ends.
* You changed `UD_SIGNED_URL_SECRET` (or `UD_API_KEY`, when no explicit
  secret was set). Old links are now invalid by design — issue new ones.

### Disk fills up

* Lower `UD_JOB_TTL_HOURS`.
* The janitor only runs hourly; trigger it manually:
  `docker compose exec api python -m app.tasks.janitor --now`.
* Confirm orphan sweep is enabled (default yes).
