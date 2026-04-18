"""Pytest fixtures for OpenAPI contract tests.

Boots the FastAPI app from `apps/api/app/main.py` and exposes:
- `app`: the ASGI application
- `base_url`: the URL prefix used by Schemathesis when constructing requests
- `api_key`: the bearer token injected into every request via the
  Schemathesis `before_call` hook in `test_schemathesis.py`

The app's `Settings` requires `UD_API_KEY`; we set a deterministic value via
the environment before importing the module so the import does not fail.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Make `apps/api` importable so `from app.main import create_app` works
# regardless of the cwd pytest is invoked from.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_API_PKG = _REPO_ROOT / "apps" / "api"
if str(_API_PKG) not in sys.path:
    sys.path.insert(0, str(_API_PKG))

# Deterministic test key; must be set before `Settings` is instantiated.
TEST_API_KEY = "test-contract-key-please-change"
os.environ.setdefault("UD_API_KEY", TEST_API_KEY)
os.environ.setdefault("UD_ENV", "development")


@pytest.fixture(scope="session")
def api_key() -> str:
    """Bearer token injected into every Schemathesis request."""
    return os.environ["UD_API_KEY"]


@pytest.fixture(scope="session")
def app():
    """Build the FastAPI application once per session."""
    # Imported lazily so the `UD_API_KEY` env var above is honored.
    from app.main import create_app  # type: ignore[import-not-found]

    return create_app()


@pytest.fixture(scope="session")
def base_url() -> str:
    """Base URL used by the Schemathesis ASGI transport.

    The OpenAPI document declares servers under `/v1`; routes in the FastAPI
    app are also mounted under `/v1`, so we point Schemathesis at the host
    root and let the spec's `servers[0].url` provide the prefix.
    """
    return "http://testserver"
