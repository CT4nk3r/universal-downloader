# Security

This document describes the threat model, the controls that mitigate
each threat, and the operational policies that keep the system safe.
For self-hosting setup, see [`self-host.md`](./self-host.md). For the
high-level architecture, see [`architecture.md`](./architecture.md).

---

## 1. Threat model

### 1.1 Assets

| Asset                       | Why it matters |
|-----------------------------|----------------|
| `UD_API_KEY`                | Grants full API access. Compromise = full takeover. |
| `UD_SIGNED_URL_SECRET`      | Forges download URLs. Compromise = unauthenticated artifact reads. |
| Downloaded artifacts        | May be copyrighted; user-attributable. |
| Job metadata (DB)           | Reveals what a user downloaded and when. |
| Host filesystem (`UD_DATA_DIR`) | Code-execution beachhead if a writer escapes its sandbox. |

### 1.2 Actors

* **External anonymous user** — no credentials, can hit only public
  paths and signed URLs.
* **External authenticated client** — holds `UD_API_KEY`. Trusted to
  enqueue jobs, not trusted to bypass quotas.
* **Operator** — has shell on the host. Fully trusted.
* **Upstream content host** — may serve hostile bytes (malformed
  containers aimed at ffmpeg, oversize manifests aimed at yt-dlp).

### 1.3 Threats and mitigations

| # | Threat                                                       | Mitigation |
|---|--------------------------------------------------------------|------------|
| T1 | Brute force on `UD_API_KEY`                                 | Long random key required at boot; constant-time compare (`apps/api/app/security.py:46`); rate limit at proxy (see [`operations.md`](./operations.md#3-rate-limiting)). |
| T2 | Bearer leak via plaintext HTTP                              | TLS terminated at proxy; HSTS recommended; never log `Authorization` header. |
| T3 | Replay of signed URLs after intent expired                  | Short `exp` (default 5 min); HMAC over `(job_id, filename, exp)`; constant-time verify. |
| T4 | Forged signed URL                                           | HKDF-SHA256-derived key from `UD_SIGNED_URL_SECRET`; secret never leaves the server. |
| T5 | Arbitrary URL scheme injection (`file://`, `gopher://`)     | Allowlist `http`/`https` only at the API layer before enqueue. |
| T6 | SSRF via yt-dlp resolving internal hosts                    | Workers run in their own container with no route to the host's metadata IP (`169.254.169.254`) and no route to the management VPC; egress firewall recommended. |
| T7 | Path traversal via crafted filename                         | All paths joined with `Path.resolve()` and verified to be inside `UD_DATA_DIR`. |
| T8 | Hostile media exploits ffmpeg                               | Worker runs as non-root in a minimal container; no host volumes besides `UD_DATA_DIR`; restart policy contains crashes. |
| T9 | DoS via huge files                                          | Per-IP rate limits; `UD_MAX_CONCURRENCY` caps concurrent work; admission control on disk pressure. |
| T10 | Information disclosure via verbose errors                  | `UD_ENV=production` strips stack traces from responses; full detail stays in server logs. |
| T11 | Insider snooping on job history                            | Operator-trusted, but logs avoid recording full URLs at INFO level (only host + path hash). |
| T12 | Auth bypass via new route added without `require_api_key`  | `PUBLIC_PATHS` is a `frozenset` and reviewed; CI lint asserts every router includes the auth dependency. |

---

## 2. API key rotation

`UD_API_KEY` should be rotated:

* On any suspected leak.
* When an operator with access to the secret store leaves.
* On a routine 90-day cadence.

### Procedure

1. Generate a new key: `python -c "import secrets; print(secrets.token_urlsafe(48))"`
2. Distribute it to all legitimate clients out-of-band.
3. Update `.env` on the host and restart:
   ```sh
   docker compose restart api worker
   ```
4. Rejected clients will see `401`. Investigate any unexpected client
   that still has the old key.

> **Heads up.** If `UD_SIGNED_URL_SECRET` is *not* set explicitly, the
> signing key is derived from `UD_API_KEY`, so rotating the key
> invalidates every outstanding signed URL. Set `UD_SIGNED_URL_SECRET`
> explicitly in production to decouple the two rotation cadences.

### Rotating `UD_SIGNED_URL_SECRET`

Same procedure, but be aware that all outstanding download links
become invalid the moment the worker/API restart. If you need overlap:

1. Add `UD_SIGNED_URL_SECRET_NEXT` (when this feature lands) — both old
   and new are accepted on verify; only new is used on issue.
2. Wait `UD_JOB_TTL_HOURS` for old links to expire naturally.
3. Promote `_NEXT` to the primary and remove the old.

Until the dual-secret feature ships, schedule rotations during a
maintenance window.

---

## 3. Signed URL expiry

* **Default issue TTL:** 5 minutes.
* **Hard upper bound:** `UD_JOB_TTL_HOURS` — the URL cannot outlive its
  artifact.
* `exp` is a Unix timestamp embedded in the URL and re-checked on every
  request, including resumed range reads.
* The HMAC covers `job_id`, `filename`, and `exp`; you cannot extend
  expiry by editing the query string.
* Time skew tolerance: 30 seconds. Clients with worse skew should
  request a fresh URL (cheap — same auth as job status polling).

---

## 4. No-auth-bypass policy

This is a non-negotiable invariant of the codebase:

1. **Every** route that touches a job, a file path, or any state is
   either gated by `require_api_key` (`apps/api/app/security.py:35`)
   **or** verifies a signed URL.
2. The only paths exempt from auth are listed explicitly in
   `PUBLIC_PATHS`. They are restricted to:
   * Liveness/health (`/v1/health`, `/health`).
   * OpenAPI/docs surfaces (`/openapi.json`, `/docs`, `/redoc`,
     `/docs/oauth2-redirect`).
3. Adding a route to `PUBLIC_PATHS` requires explicit reviewer sign-off
   in PR description.
4. There is no "internal" or "admin" trust tier that bypasses auth.
   Operator access is via shell, not via the API.
5. Auth is enforced as a **dependency**, not a middleware, so route
   ordering cannot accidentally skip it.

If you believe you have found an auth-bypass, treat it as a security
incident — see §6.

---

## 5. Secrets handling

* `.env` on the host is `chmod 600`, owned by the user that runs Docker.
* `UD_API_KEY` and `UD_SIGNED_URL_SECRET` are never logged, never
  echoed in error responses, never sent to telemetry.
* Container images do not bake secrets; they are injected at runtime
  via `env_file:`.
* Backups of the DB and `UD_DATA_DIR` should be encrypted at rest. The
  DB does not contain secrets, but does contain user-attributable URLs.

---

## 6. Responsible disclosure

If you find a vulnerability, please **do not** open a public GitHub
issue. Instead, email:

> **security@example.com** *(placeholder — replace with the project's
> real contact before publishing)*

Include:

* A description of the issue and its impact.
* Reproduction steps or a proof-of-concept.
* The version / commit hash you tested against.
* Any suggested mitigations.

We will acknowledge within 3 business days, provide a triage update
within 7 days, and aim to ship a fix within 30 days for high-severity
issues. We are happy to credit reporters in the release notes if
desired.

We do not currently run a paid bounty program.
