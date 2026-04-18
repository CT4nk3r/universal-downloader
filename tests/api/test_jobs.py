"""Tests for the /v1/jobs CRUD endpoints.

Covers:

* ``POST /v1/jobs``     — auth, validation, presets, idempotency
* ``GET  /v1/jobs/{id}`` — happy path + 404
* ``DELETE /v1/jobs/{id}`` — happy path + 404
* ``GET  /v1/jobs``     — list and filter by status
"""

from __future__ import annotations

from typing import Any


# ---------------------------------------------------------------------------
# POST /v1/jobs
# ---------------------------------------------------------------------------


def test_create_job_requires_auth(client: Any) -> None:
    response = client.post("/v1/jobs", json={"url": "https://youtube.com/watch?v=x"})
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "unauthorized"


def test_create_job_rejects_missing_url(client: Any, auth_headers: dict[str, str]) -> None:
    response = client.post("/v1/jobs", json={}, headers=auth_headers)
    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "bad_request"


def test_create_job_rejects_unsupported_site(
    client: Any, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/jobs",
        json={"url": "https://example.com/video"},
        headers=auth_headers,
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "unsupported_site"


def test_create_job_accepts_youtube_url(
    client: Any, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/jobs",
        json={"url": "https://youtube.com/watch?v=dQw4w9WgXcQ"},
        headers=auth_headers,
    )
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["status"] == "queued"
    assert body["site"] == "youtube"
    assert body["url"].endswith("dQw4w9WgXcQ")
    assert "id" in body


def test_create_job_with_quality_preset(
    client: Any, auth_headers: dict[str, str]
) -> None:
    """Server accepts a known QualityPreset and round-trips it on the job."""
    response = client.post(
        "/v1/jobs",
        json={
            "url": "https://youtu.be/dQw4w9WgXcQ",
            "preset": "p1080",
            "audio_only": False,
        },
        headers=auth_headers,
    )
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["request"]["preset"] == "p1080"


def test_create_job_with_audio_preset(
    client: Any, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/jobs",
        json={"url": "https://youtu.be/abc", "preset": "audio_mp3"},
        headers=auth_headers,
    )
    assert response.status_code == 202
    assert response.json()["request"]["preset"] == "audio_mp3"


def test_create_job_rejects_unknown_preset(
    client: Any, auth_headers: dict[str, str]
) -> None:
    response = client.post(
        "/v1/jobs",
        json={"url": "https://youtu.be/abc", "preset": "ultrahd"},
        headers=auth_headers,
    )
    assert response.status_code == 400


def test_create_job_idempotency_collapses_duplicates(
    client: Any,
    auth_headers: dict[str, str],
    fake_engine: Any,
) -> None:
    """Two creates with identical ``Idempotency-Key`` headers should
    return the same job id.

    The router does not yet propagate ``Idempotency-Key`` to the engine
    (the spec/router are silent on this). We exercise the engine
    directly to assert the contract that the *engine* honours
    idempotency once the router begins forwarding the header.
    """
    import asyncio

    from app.models import CreateJobRequest  # type: ignore[import-not-found]

    payload = CreateJobRequest(url="https://youtu.be/dQw4w9WgXcQ")

    async def _run() -> tuple[Any, Any]:
        a = await fake_engine.create_job(payload, idempotency_key="key-1")
        b = await fake_engine.create_job(payload, idempotency_key="key-1")
        return a, b

    a, b = asyncio.get_event_loop().run_until_complete(_run())
    assert a.id == b.id


# ---------------------------------------------------------------------------
# GET /v1/jobs/{id}
# ---------------------------------------------------------------------------


def test_get_job_returns_404_for_unknown(
    client: Any, auth_headers: dict[str, str]
) -> None:
    response = client.get("/v1/jobs/00000000-0000-0000-0000-000000000000", headers=auth_headers)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "job_not_found"


def test_get_job_returns_existing(
    client: Any, auth_headers: dict[str, str]
) -> None:
    created = client.post(
        "/v1/jobs",
        json={"url": "https://youtube.com/watch?v=abc"},
        headers=auth_headers,
    ).json()
    fetched = client.get(f"/v1/jobs/{created['id']}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["id"] == created["id"]


# ---------------------------------------------------------------------------
# DELETE /v1/jobs/{id}
# ---------------------------------------------------------------------------


def test_delete_job_204(client: Any, auth_headers: dict[str, str]) -> None:
    created = client.post(
        "/v1/jobs",
        json={"url": "https://youtu.be/x"},
        headers=auth_headers,
    ).json()
    response = client.delete(f"/v1/jobs/{created['id']}", headers=auth_headers)
    assert response.status_code == 204
    # Subsequent GET should now 404.
    again = client.get(f"/v1/jobs/{created['id']}", headers=auth_headers)
    assert again.status_code == 404


def test_delete_unknown_job_404(
    client: Any, auth_headers: dict[str, str]
) -> None:
    response = client.delete(
        "/v1/jobs/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /v1/jobs (list + filter)
# ---------------------------------------------------------------------------


def test_list_jobs_returns_envelope(
    client: Any, auth_headers: dict[str, str]
) -> None:
    response = client.get("/v1/jobs", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert "items" in body and isinstance(body["items"], list)


def test_list_jobs_filters_by_status(
    client: Any, auth_headers: dict[str, str], fake_engine: Any
) -> None:
    # Seed two queued and one ready job.
    a = client.post(
        "/v1/jobs", json={"url": "https://youtu.be/a"}, headers=auth_headers
    ).json()
    client.post(
        "/v1/jobs", json={"url": "https://youtu.be/b"}, headers=auth_headers
    ).json()
    fake_engine.mark_ready(
        a["id"],
        {"filename": "a.mp4", "size_bytes": 10, "download_url": "https://x/a"},
    )

    queued = client.get("/v1/jobs?status=queued", headers=auth_headers).json()
    ready = client.get("/v1/jobs?status=ready", headers=auth_headers).json()
    assert all(j["status"] == "queued" for j in queued["items"])
    assert all(j["status"] == "ready" for j in ready["items"])
    assert {j["id"] for j in ready["items"]} == {a["id"]}


def test_list_jobs_respects_limit(
    client: Any, auth_headers: dict[str, str]
) -> None:
    for i in range(3):
        client.post(
            "/v1/jobs",
            json={"url": f"https://youtu.be/{i}"},
            headers=auth_headers,
        )
    body = client.get("/v1/jobs?limit=2", headers=auth_headers).json()
    assert len(body["items"]) <= 2
