"""OpenAPI contract tests powered by Schemathesis.

Loads `packages/shared-types/openapi.yaml` (the SoT) and runs both
property-based and stateful (link-based) suites against the FastAPI app
served via Starlette's in-process `TestClient` (ASGI transport).

Endpoints with real side-effects (yt-dlp invocation, file streaming, SSE)
are skipped via a `before_call` hook so the contract tests stay hermetic
and fast. We focus on:

- Schema/spec validity
- Request validation (4xx for malformed payloads)
- Response shape conformance for endpoints that don't shell out

Run locally:

    pip install -r tests/api/contract/requirements.txt
    UD_API_KEY=test-contract-key-please-change \
        pytest tests/api/contract -q
"""

from __future__ import annotations

from pathlib import Path

import pytest
import schemathesis
from schemathesis import Case
from schemathesis.checks import (
    not_a_server_error,
    response_schema_conformance,
    status_code_conformance,
)

# ---------------------------------------------------------------------------
# Schema loading. Path is resolved from this file so cwd doesn't matter.
# ---------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).resolve().parents[3]
_SCHEMA_PATH = _REPO_ROOT / "packages" / "shared-types" / "openapi.yaml"

# `from_path` returns a BaseSchema; `base_url` is overridden per-test via the
# transport so it points at the in-process ASGI app.
schema = schemathesis.from_path(
    str(_SCHEMA_PATH),
    base_url="http://testserver/v1",
    force_schema_version="30",
)


# ---------------------------------------------------------------------------
# Hooks
#
# The hook registry is module-global in Schemathesis. Hooks below run for
# every generated `Case` produced from the loaded schema.
# ---------------------------------------------------------------------------


# Operations that perform real side-effects (yt-dlp, ffmpeg, file IO, SSE).
# We skip executing them; their request schemas are still validated by
# Schemathesis at generation time.
SIDE_EFFECT_OPERATION_IDS: frozenset[str] = frozenset(
    {
        "probeUrl",          # invokes yt-dlp to inspect a URL
        "createJob",         # enqueues a download job
        "deleteJob",         # cancels/deletes job + artifact
        "streamJobEvents",   # long-lived SSE stream
        "downloadJobFile",   # streams large binary
    }
)


@schemathesis.hook
def before_call(context, case: Case) -> None:
    """Inject the bearer API key on every request and skip side-effect ops.

    `context` exposes the active `pytest` request via `context.request` in
    newer Schemathesis releases; we read the API key from the env to keep
    this hook compatible across 3.x point releases.
    """
    import os

    op_id = getattr(case.operation, "operation_id", None)
    if op_id in SIDE_EFFECT_OPERATION_IDS:
        pytest.skip(f"Skipping side-effect operation: {op_id}")

    api_key = os.environ.get("UD_API_KEY", "")
    headers = dict(case.headers or {})
    headers.setdefault("Authorization", f"Bearer {api_key}")
    case.headers = headers


# ---------------------------------------------------------------------------
# Property-based tests: one test per (path, method) pair.
# ---------------------------------------------------------------------------


@schema.parametrize()
def test_api_conforms_to_openapi(case: Case, app) -> None:
    """For every operation, generate inputs and assert response conformance."""
    response = case.call_asgi(app=app)
    case.validate_response(
        response,
        checks=(
            not_a_server_error,
            status_code_conformance,
            response_schema_conformance,
        ),
    )


# ---------------------------------------------------------------------------
# Stateful tests: follow OpenAPI links / inferred state machine.
#
# Even with most mutating endpoints skipped via `before_call`, the stateful
# runner still exercises GET-only sequences (eg. listJobs -> getJob) and
# verifies that the schema's link definitions are internally consistent.
# ---------------------------------------------------------------------------


class TestAPIStateful(schema.as_state_machine()):  # type: ignore[misc, name-defined]
    """Hypothesis-driven state machine derived from the OpenAPI spec."""


# Pytest collects the state-machine subclass automatically; we keep it as
# a top-level class so it shows up in test reports with a stable name.
