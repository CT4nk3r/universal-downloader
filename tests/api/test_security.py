"""Bearer-token authentication boundary tests."""

from __future__ import annotations

from typing import Any

import pytest


# Routes that MUST require auth. Health is intentionally excluded — it is
# a public liveness probe.
PROTECTED_ROUTES: list[tuple[str, str, dict[str, Any] | None]] = [
    ("GET", "/v1/jobs", None),
    ("POST", "/v1/jobs", {"url": "https://youtu.be/x"}),
    ("GET", "/v1/jobs/00000000-0000-0000-0000-000000000000", None),
    ("DELETE", "/v1/jobs/00000000-0000-0000-0000-000000000000", None),
    ("GET", "/v1/sites", None),
]


@pytest.mark.parametrize(("method", "path", "body"), PROTECTED_ROUTES)
def test_missing_api_key_returns_401(
    client: Any, method: str, path: str, body: dict[str, Any] | None
) -> None:
    response = client.request(method, path, json=body)
    assert response.status_code == 401, f"{method} {path} → {response.status_code}"
    envelope = response.json()
    assert envelope["error"]["code"] == "unauthorized"


@pytest.mark.parametrize(("method", "path", "body"), PROTECTED_ROUTES)
def test_wrong_api_key_returns_401(
    client: Any, method: str, path: str, body: dict[str, Any] | None
) -> None:
    response = client.request(
        method, path, json=body, headers={"Authorization": "Bearer not-the-key"}
    )
    assert response.status_code == 401
    envelope = response.json()
    assert envelope["error"]["code"] == "unauthorized"


def test_malformed_authorization_header_returns_401(client: Any) -> None:
    """A non-``Bearer`` scheme (Basic, Token, just-a-string) must 401."""
    for header in ("Basic abc", "Token xyz", "definitely-not-bearer"):
        response = client.get("/v1/jobs", headers={"Authorization": header})
        assert response.status_code == 401, f"{header!r} should 401"


def test_correct_api_key_allows_request(
    client: Any, auth_headers: dict[str, str]
) -> None:
    response = client.get("/v1/jobs", headers=auth_headers)
    assert response.status_code == 200


def test_health_does_not_require_auth(client: Any) -> None:
    """Sanity guard: confirm the public path remains public."""
    response = client.get("/v1/health")
    assert response.status_code == 200
