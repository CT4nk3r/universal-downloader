# GitHub Workflows — Universal Downloader by CT4nk3r

Append-only registry of CI workflows. Add a row when introducing a new workflow; do not edit/remove existing rows in the same PR.

| Workflow | File | Triggers (paths) | Purpose |
| --- | --- | --- | --- |
| ci-api | `.github/workflows/ci-api.yml` | `apps/api/**`, `packages/shared-types/**`, `tests/api/**` | Lint (ruff, mypy), pytest matrix (py3.12 + Redis service), schemathesis contract tests, multi-arch (linux/amd64+linux/arm64) Docker build & push to `ghcr.io/ct4nk3r/universal-downloader-api` on `main` and tags. |
