# API Contract Tests

OpenAPI contract tests for the Universal Downloader API. The single source
of truth is `packages/shared-types/openapi.yaml`; these tests load that
document with [Schemathesis](https://schemathesis.readthedocs.io/) and
exercise the FastAPI app from `apps/api/app/main.py` in-process via an
ASGI transport (no network, no Redis, no yt-dlp).

## What runs

- **Property tests** (`test_api_conforms_to_openapi`): for every operation
  declared in the spec, Hypothesis generates request payloads and the
  response is validated against:
  - `not_a_server_error` — no 5xx
  - `status_code_conformance` — status code is documented in the spec
  - `response_schema_conformance` — body matches the declared schema
- **Stateful tests** (`TestAPIStateful`): a Hypothesis state machine
  derived from OpenAPI links exercises multi-step flows.

Endpoints with real side effects (yt-dlp probing, job creation/cancel,
SSE streaming, file download) are skipped by a `before_call` hook in
`test_schemathesis.py` — see `SIDE_EFFECT_OPERATION_IDS`. Their request
schemas are still validated at generation time.

## Auth

A `before_call` hook injects `Authorization: Bearer $UD_API_KEY` on every
generated request. The fixture in `conftest.py` sets a deterministic
default (`test-contract-key-please-change`) so the suite runs out of the
box.

## Running locally

From the repo root:

```bash
python -m venv .venv
. .venv/bin/activate            # PowerShell: .venv\Scripts\Activate.ps1
pip install -r apps/api/requirements.txt
pip install -r tests/api/contract/requirements.txt

# UD_API_KEY is auto-defaulted by conftest.py, but you can override:
pytest tests/api/contract -q
```

To re-run a single failing example with verbose Hypothesis output:

```bash
pytest tests/api/contract -q --hypothesis-seed=0 -k test_api_conforms_to_openapi
```

## Files

- `test_schemathesis.py` — schema load + property + stateful suites + hooks
- `conftest.py` — `app`, `base_url`, `api_key` fixtures
- `requirements.txt` — `schemathesis ~3.x`, `hypothesis`, `pytest`
