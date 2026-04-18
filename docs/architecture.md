# Architecture

This document describes the Universal Downloader system: the components, how
data flows through them, the lifecycle of a download job, and the security
model that protects both the API and the artifacts it produces.

> **Env name note.** This document uses the `UD_*` variables as defined in
> [`apps/api/app/settings.py`](../apps/api/app/settings.py). Where the ops
> spec referenced names like `UD_DOWNLOAD_DIR` or `UD_FILE_TTL_HOURS`, the
> actual variables are `UD_DATA_DIR` and `UD_JOB_TTL_HOURS`. `UD_SIGNED_URL_SECRET`
> is reserved for the signed-URL feature and falls back to a value derived
> from `UD_API_KEY` via HKDF when not explicitly set.

---

## 1. Components

```mermaid
flowchart LR
    subgraph Clients
        WEB[Web app<br/>Next.js]
        MOB[Mobile app<br/>Expo / RN]
        DESK[Desktop app<br/>Tauri shell]
    end

    subgraph Edge
        PROXY[Reverse proxy<br/>Caddy / nginx<br/>TLS, rate limit]
    end

    subgraph API_Tier[API tier]
        API[FastAPI<br/>apps/api]
    end

    subgraph Workers[Worker tier]
        ARQ[arq worker pool<br/>UD_MAX_CONCURRENCY]
        YT[yt-dlp]
        FF[ffmpeg]
    end

    subgraph State
        REDIS[(Redis<br/>arq queue + locks)]
        DB[(SQL store<br/>SQLModel)]
        FS[(File store<br/>UD_DATA_DIR)]
    end

    SIDE[Tauri sidecar<br/>embedded FastAPI + arq]

    WEB --> PROXY
    MOB --> PROXY
    PROXY --> API
    DESK --> SIDE

    API <--> REDIS
    API <--> DB
    ARQ <--> REDIS
    ARQ --> YT
    ARQ --> FF
    YT --> FS
    FF --> FS
    API -->|signed URL| FS

    SIDE -. same OpenAPI contract .-> API
```

### Tier breakdown

| Tier      | Component                       | Responsibility |
|-----------|---------------------------------|----------------|
| Client    | Web (Next.js), Mobile (Expo), Desktop (Tauri) | Submit URLs, poll job status, download artifacts via signed URLs. |
| Edge      | Caddy or nginx                  | TLS termination, HTTP/2, rate limiting, optional auth header injection. |
| API       | FastAPI (`apps/api/app/main.py`) | REST endpoints under `/v1/*`, bearer auth, enqueues jobs, signs URLs. |
| Worker    | arq workers + yt-dlp + ffmpeg   | Long-running download/transcode tasks; concurrency controlled by `UD_MAX_CONCURRENCY`. |
| State     | Redis, SQL DB, file store       | Queue/coordination, metadata, artifact bytes. |
| Desktop   | Tauri sidecar                   | Runs the same FastAPI + arq binary in-process for offline/local-first use; speaks the same OpenAPI contract so the web client code is reusable. |

---

## 2. Data flow

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant P as Proxy
    participant A as FastAPI
    participant R as Redis (arq)
    participant W as Worker
    participant S as File store

    C->>P: POST /v1/jobs {url, format} + Bearer
    P->>A: forward (TLS terminated)
    A->>A: auth (constant-time compare)
    A->>R: enqueue job(id)
    A-->>C: 202 {job_id, status: queued}
    W->>R: pull job
    W->>W: yt-dlp -> ffmpeg -> file
    W->>S: write artifact under UD_DATA_DIR/<job_id>/
    W->>R: status: succeeded
    C->>A: GET /v1/jobs/{id}
    A-->>C: {status: succeeded, artifact_url: signed}
    C->>A: GET /v1/files/{id}?sig=...&exp=...
    A->>A: verify HMAC + expiry
    A-->>C: 200 (stream from S)
```

---

## 3. Job state machine

```mermaid
stateDiagram-v2
    [*] --> queued: POST /v1/jobs
    queued --> running: worker picks up
    running --> succeeded: artifact written + checksum ok
    running --> failed: yt-dlp/ffmpeg non-zero, timeout, or disk full
    queued --> cancelled: DELETE /v1/jobs/{id}
    running --> cancelled: cooperative cancel (SIGTERM to subprocess)
    succeeded --> expired: TTL elapsed (UD_JOB_TTL_HOURS)
    failed --> expired: TTL elapsed
    cancelled --> expired: TTL elapsed
    expired --> [*]: janitor sweep deletes row + files
```

States are persisted in the SQL store. Transitions are append-only via a
single `update_status(job_id, new_state)` helper to keep the audit trail
consistent.

---

## 4. Security model

### 4.1 API key

* Single shared bearer token in `UD_API_KEY`, required at startup
  (the app refuses to boot without it — see `settings.py:22`).
* Verified in `apps/api/app/security.py` using `hmac.compare_digest` to
  defeat timing oracles.
* Public, no-auth paths are explicitly enumerated in `PUBLIC_PATHS`
  (`/v1/health`, `/openapi.json`, `/docs`, `/redoc`). Every other route
  requires a valid bearer.

### 4.2 Signed file URLs (HKDF)

Direct artifact downloads do **not** require the bearer; instead the API
issues short-lived signed URLs of the form:

```
GET /v1/files/{job_id}/{filename}?exp=<unix_ts>&sig=<hex>
```

* A per-deployment signing key is derived with **HKDF-SHA256**:
  ```
  HKDF(ikm=UD_SIGNED_URL_SECRET || HKDF(UD_API_KEY, "ud-fallback"),
       salt="ud/signed-url/v1",
       info="file-download")
  ```
* `sig = HMAC-SHA256(key, f"{job_id}\n{filename}\n{exp}")`, hex-encoded.
* Verification: constant-time compare and `exp > now`.
* Default expiry: 5 minutes (configurable per-issue, hard cap = `UD_JOB_TTL_HOURS`).

### 4.3 No auth-bypass policy

* Auth is enforced as a FastAPI dependency at the router level, not via
  middleware that can be reordered accidentally.
* `PUBLIC_PATHS` is a `frozenset` and reviewed in code review.
* Adding a route requires either (a) including the `require_api_key`
  dependency, or (b) explicit signed-URL verification. There is no
  third option.

---

## 5. TTL and cleanup

| Concern          | Mechanism                                                  |
|------------------|------------------------------------------------------------|
| Artifact TTL     | `UD_JOB_TTL_HOURS` (default 24). Janitor task runs hourly. |
| Janitor          | arq cron job: scans DB for `created_at < now - TTL`, deletes files under `UD_DATA_DIR/<job_id>/`, then deletes the row. |
| Orphan files     | Secondary sweep: list `UD_DATA_DIR/*`, for each dir id not in DB, delete. |
| Redis            | arq job results TTL aligned with `UD_JOB_TTL_HOURS`.       |
| Disk pressure    | If free space < 10%, new `POST /v1/jobs` returns `503` and the janitor runs immediately. |
| Crash safety     | Deletes are best-effort; the next sweep retries.           |

Cleanup is idempotent. Stopping the worker mid-sweep is safe.
