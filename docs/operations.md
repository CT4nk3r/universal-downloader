# Operations

This document is for operators running Universal Downloader in
production. It covers what to watch, how to plan capacity, how to throttle
abuse, and how to keep the disk from filling up.

---

## 1. Observability

### 1.1 Structured logs

The API and worker emit JSON logs to stdout (configured in
[`apps/api/app/logging_config.py`](../apps/api/app/logging_config.py)).
Each line includes:

| Field         | Notes                                                     |
|---------------|-----------------------------------------------------------|
| `ts`          | ISO-8601 UTC timestamp.                                   |
| `level`       | `DEBUG` … `ERROR`. Controlled by `UD_LOG_LEVEL`.          |
| `logger`      | Module path, e.g. `app.routers.jobs`.                     |
| `event`       | Stable machine-readable name (`job.enqueued`, `job.failed`, `auth.denied`, `signed_url.invalid`). |
| `request_id`  | Correlates API request → worker job (propagated via `X-Request-ID`). |
| `job_id`      | Present on all worker log lines.                          |
| `latency_ms`  | Wall-clock for the operation.                             |
| `error.type`  | Exception class on failure.                               |

Ship to your aggregator of choice (Loki, Datadog, CloudWatch). A useful
starter alert is:

```
rate({app="ud-api"} | json | level="ERROR" [5m]) > 1
```

### 1.2 Metrics

If a `/metrics` endpoint is exposed (Prometheus text format), scrape it
from the API container. Recommended SLIs:

| Metric                                | Type      | Meaning |
|---------------------------------------|-----------|---------|
| `ud_http_requests_total`              | counter   | Per-route, per-status. |
| `ud_http_request_duration_seconds`    | histogram | Latency distribution. |
| `ud_jobs_enqueued_total`              | counter   | New jobs accepted. |
| `ud_jobs_completed_total{status=...}` | counter   | Terminal-state transitions. |
| `ud_job_duration_seconds`             | histogram | End-to-end download time. |
| `ud_queue_depth`                      | gauge     | Pending arq jobs. |
| `ud_worker_busy`                      | gauge     | Active workers (0 .. `UD_MAX_CONCURRENCY`). |
| `ud_disk_free_bytes`                  | gauge     | `UD_DATA_DIR` free space. |

If `/metrics` is not yet present in your build, derive equivalents from
structured logs.

### 1.3 Health checks

* `GET /v1/health` and `GET /health` (both unauthenticated by design;
  see `PUBLIC_PATHS` in `apps/api/app/security.py:13`).
* Use as Docker healthcheck and load-balancer probe.
* For deep health, run `GET /v1/health?deep=1` (when implemented) which
  pings Redis and the DB.

---

## 2. Capacity planning

### 2.1 Sizing rules of thumb

| Resource | Driver                                       | Guideline |
|----------|----------------------------------------------|-----------|
| CPU      | ffmpeg transcodes                            | 1 vCPU per concurrent job for audio-only; 2 vCPU per concurrent video transcode at 1080p. |
| RAM      | yt-dlp + ffmpeg buffers                      | ~512 MB per concurrent job (1 GB if 4K). |
| Disk     | `UD_DATA_DIR`                                | `peak_concurrent_jobs × avg_artifact_size × 2` (×2 covers in-flight + finished-not-yet-collected). |
| Network  | Egress to source + ingress to client         | Provision egress = 2 × peak download throughput. |
| Redis    | Job metadata only                            | 64 MB is plenty for thousands of jobs/day. |

### 2.2 Tuning `UD_MAX_CONCURRENCY`

Start at `min(vCPUs, 4)`. Watch `ud_worker_busy` and `ud_queue_depth`:

* Sustained `worker_busy == MAX_CONCURRENCY` and growing `queue_depth`
  → scale workers horizontally before raising concurrency.
* Raising concurrency on one host past CPU count buys nothing because
  ffmpeg is CPU-bound.

### 2.3 Horizontal scaling

* The API tier is stateless — put N replicas behind the proxy.
* Workers consume from the same Redis; add replicas freely.
* `UD_DATA_DIR` must be a shared volume (NFS, EFS, S3-FUSE) if more
  than one host serves downloads. Otherwise pin a job's serving API to
  the host that produced the artifact via session affinity.
* The DB must be a real DB (Postgres) — SQLite is single-host only.

---

## 3. Rate limiting

The application enforces auth but does **not** itself implement
per-client rate limits in the default build. Apply them at the edge.

### 3.1 Caddy

```caddyfile
ud.example.com {
    rate_limit {
        zone per_ip {
            key {remote_host}
            events 60
            window 1m
        }
        zone post_jobs {
            match {
                method POST
                path /v1/jobs*
            }
            key {remote_host}
            events 10
            window 1m
        }
    }
    reverse_proxy localhost:8787
}
```

(Requires the [`caddy-ratelimit`](https://github.com/mholt/caddy-ratelimit)
module.)

### 3.2 nginx

```nginx
limit_req_zone $binary_remote_addr zone=ud_general:10m rate=60r/m;
limit_req_zone $binary_remote_addr zone=ud_jobs:10m    rate=10r/m;

server {
    # ...
    location /v1/jobs {
        limit_req zone=ud_jobs burst=5 nodelay;
        proxy_pass http://127.0.0.1:8787;
    }
    location / {
        limit_req zone=ud_general burst=20 nodelay;
        proxy_pass http://127.0.0.1:8787;
    }
}
```

### 3.3 Recommended limits

| Endpoint            | Limit                  | Rationale |
|---------------------|------------------------|-----------|
| `POST /v1/jobs`     | 10/min/IP, 100/hour/IP | Protect worker pool. |
| `GET /v1/jobs/*`    | 120/min/IP             | Polling is cheap. |
| `GET /v1/files/*`   | 30/min/IP              | Bandwidth-protective. |
| Everything else     | 60/min/IP              | Default. |

---

## 4. Disk pressure handling

### 4.1 Monitoring

Alert when `ud_disk_free_bytes / total < 0.15`. Page when `< 0.05`.

### 4.2 Automatic mitigations (built in)

1. **Janitor (hourly cron, arq):** deletes jobs whose
   `created_at + UD_JOB_TTL_HOURS < now`, then their files.
2. **Orphan sweep:** any directory under `UD_DATA_DIR/` not present in
   the DB is deleted.
3. **Admission control:** when free space < 10%, `POST /v1/jobs`
   returns `503 Service Unavailable` with `Retry-After: 300` and the
   janitor runs immediately.

### 4.3 Manual recovery

```sh
# What's eating the disk?
du -sh /data/* | sort -rh | head -20

# Force the janitor immediately
docker compose exec api python -m app.tasks.janitor --now

# Last-resort: drop everything older than 1 hour
docker compose exec api python -m app.tasks.janitor --max-age 1h
```

Lower `UD_JOB_TTL_HOURS` and restart if pressure is sustained — clients
must download artifacts faster than they expire.

### 4.4 Inode exhaustion

yt-dlp can produce many small fragment files transiently. If `df -i`
shows inode exhaustion before bytes, switch the volume to a filesystem
with dynamic inodes (XFS, btrfs) or grow it.
