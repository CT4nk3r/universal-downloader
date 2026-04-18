"""Tests for liveness/readiness endpoints.

The OpenAPI contract names the liveness probe ``/v1/health``. The task
brief used the more conventional ``/healthz``/``/readyz`` names; we
resolve the ambiguity by treating ``/v1/health`` as the canonical
probe and asserting both liveness *and* a basic readiness signal
(presence of ``status: ok``) against it.
"""

from __future__ import annotations

from typing import Any


def test_healthz_returns_200_and_status_ok(client: Any) -> None:
    """``GET /v1/health`` is unauthenticated and reports ``status=ok``."""
    response = client.get("/v1/health")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body and isinstance(body["version"], str)


def test_healthz_does_not_require_auth(client: Any) -> None:
    """Health probe must work without an ``Authorization`` header."""
    response = client.get("/v1/health")
    assert response.status_code == 200


def test_readyz_returns_ready_when_engine_initialised(
    client: Any, auth_headers: dict[str, str]
) -> None:
    """Readiness check: app is ready when health succeeds and the job
    engine is wired (the conftest pre-installs a ``FakeJobEngine``)."""
    health = client.get("/v1/health")
    assert health.status_code == 200

    # Engine wiring is exercised indirectly by listing jobs (an authed
    # path that touches ``app.state.job_engine``).
    listed = client.get("/v1/jobs", headers=auth_headers)
    assert listed.status_code == 200
