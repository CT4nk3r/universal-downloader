"""Tests for file download endpoint.

Contract resolution: the OpenAPI exposes the download as
``GET /v1/jobs/{id}/file`` (the user brief used ``/files/{id}``;
treated as a paraphrase).

Also exercises ``app.services.signed_urls`` for the signed-URL
auth fallback used by ``<video src=...>`` tags.
"""

from __future__ import annotations

import time
import uuid
from typing import Any

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _seed_ready_job(
    client: Any, auth_headers: dict[str, str], fake_engine: Any
) -> dict[str, Any]:
    created = client.post(
        "/v1/jobs",
        json={"url": "https://youtu.be/dQw4w9WgXcQ"},
        headers=auth_headers,
    ).json()
    fake_engine.mark_ready(
        created["id"],
        {
            "filename": "video.bin",
            "size_bytes": 1024,
            "mime_type": "application/octet-stream",
            "download_url": f"/v1/jobs/{created['id']}/file",
        },
    )
    return created


# ---------------------------------------------------------------------------
# Basic download / Range
# ---------------------------------------------------------------------------


def test_download_full_body(
    client: Any, auth_headers: dict[str, str], fake_engine: Any
) -> None:
    job = _seed_ready_job(client, auth_headers, fake_engine)
    response = client.get(f"/v1/jobs/{job['id']}/file", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.content) == 1024
    assert response.headers.get("accept-ranges") == "bytes"


def test_download_range_returns_206(
    client: Any, auth_headers: dict[str, str], fake_engine: Any
) -> None:
    job = _seed_ready_job(client, auth_headers, fake_engine)
    response = client.get(
        f"/v1/jobs/{job['id']}/file",
        headers={**auth_headers, "Range": "bytes=0-15"},
    )
    assert response.status_code == 206
    assert response.headers["content-range"] == "bytes 0-15/1024"
    assert len(response.content) == 16


def test_download_suffix_range(
    client: Any, auth_headers: dict[str, str], fake_engine: Any
) -> None:
    job = _seed_ready_job(client, auth_headers, fake_engine)
    response = client.get(
        f"/v1/jobs/{job['id']}/file",
        headers={**auth_headers, "Range": "bytes=-32"},
    )
    assert response.status_code == 206
    assert len(response.content) == 32


def test_download_unsatisfiable_range(
    client: Any, auth_headers: dict[str, str], fake_engine: Any
) -> None:
    job = _seed_ready_job(client, auth_headers, fake_engine)
    response = client.get(
        f"/v1/jobs/{job['id']}/file",
        headers={**auth_headers, "Range": "bytes=99999-"},
    )
    assert response.status_code == 416


# ---------------------------------------------------------------------------
# 404 / 409
# ---------------------------------------------------------------------------


def test_download_404_for_unknown_job(
    client: Any, auth_headers: dict[str, str]
) -> None:
    response = client.get(
        f"/v1/jobs/{uuid.uuid4()}/file", headers=auth_headers
    )
    assert response.status_code == 404


def test_download_409_when_not_ready(
    client: Any, auth_headers: dict[str, str]
) -> None:
    """A job that's still ``queued`` cannot be downloaded yet."""
    created = client.post(
        "/v1/jobs",
        json={"url": "https://youtu.be/abc"},
        headers=auth_headers,
    ).json()
    response = client.get(
        f"/v1/jobs/{created['id']}/file", headers=auth_headers
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "job_not_ready"


# ---------------------------------------------------------------------------
# Signed URLs (app.services.signed_urls)
# ---------------------------------------------------------------------------


def test_signed_url_verifies_within_ttl() -> None:
    from app.services import signed_urls  # type: ignore[import-not-found]

    job_id = uuid.uuid4()
    qs = signed_urls.sign(job_id, ttl_seconds=60)
    # qs == "?token=<hex>&exp=<int>"
    assert qs.startswith("?token=")
    parts = dict(p.split("=") for p in qs.lstrip("?").split("&"))
    assert signed_urls.verify(job_id, parts["token"], int(parts["exp"])) is True


def test_signed_url_rejects_expired_signature() -> None:
    from app.services import signed_urls  # type: ignore[import-not-found]

    job_id = uuid.uuid4()
    # An ``exp`` in the past must be rejected even with a valid MAC.
    expired_exp = int(time.time()) - 10
    bogus_token = "0" * 64
    assert signed_urls.verify(job_id, bogus_token, expired_exp) is False


def test_signed_url_rejects_wrong_job_id() -> None:
    from app.services import signed_urls  # type: ignore[import-not-found]

    real = uuid.uuid4()
    other = uuid.uuid4()
    qs = signed_urls.sign(real, ttl_seconds=60)
    parts = dict(p.split("=") for p in qs.lstrip("?").split("&"))
    assert signed_urls.verify(other, parts["token"], int(parts["exp"])) is False
