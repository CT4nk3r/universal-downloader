# Contributing to Universal Downloader

Thanks for your interest in contributing! This document covers everything you need to get a working dev environment, follow our conventions, and ship a good PR.

## Development Environment

You will need:

| Tool      | Version          | Notes                                      |
|-----------|------------------|--------------------------------------------|
| Node.js   | **20.x** (LTS)   | Pinned via `.nvmrc`. Use `nvm`/`fnm`.      |
| pnpm      | **9.x**          | `corepack enable && corepack prepare pnpm@9 --activate` |
| Python    | **3.12**         | For `apps/api`. Use `pyenv` or system pkg. |
| Rust      | **stable**       | For `apps/desktop` (Tauri). Pinned in `rust-toolchain.toml`. |
| ffmpeg    | latest stable    | Required at runtime by `apps/api` and the desktop sidecar. |

Optional but recommended: Docker (for self-hosted API testing), Xcode (iOS), Android Studio (Android).

### First-time setup

```bash
git clone https://github.com/CT4nk3r/universal-downloader.git
cd universal-downloader
pnpm install
pnpm codegen          # generate TS client + Python models from OpenAPI
```

For the Python API:
```bash
cd apps/api
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

For the desktop app:
```bash
cd apps/desktop
pnpm tauri dev
```

## Monorepo Layout

| Path                       | Purpose                                          |
|----------------------------|--------------------------------------------------|
| `apps/api/`                | FastAPI + arq (Python 3.12)                      |
| `apps/web/`                | React + Vite                                     |
| `apps/mobile/`             | Bare React Native 0.74                           |
| `apps/desktop/`            | Tauri 2.0                                        |
| `packages/api-client/`     | Generated TS client + React Query hooks          |
| `packages/ui/`             | Shared React components                          |
| `packages/shared-types/`   | OpenAPI 3.1 spec (source of truth)               |
| `packages/core-logic/`     | URL parsing, format helpers                      |
| `tests/`                   | API + e2e suites                                 |
| `infra/`                   | Docker, deployment configs                       |
| `docs/`                    | MkDocs documentation site                        |

## Codegen

The OpenAPI spec at `packages/shared-types/openapi.yaml` is the **single source of truth**. After editing it (or any generator template), always run:

```bash
pnpm codegen
```

This regenerates:

- `packages/api-client/src/generated/**` — TypeScript client + React Query hooks
- `apps/api/app/models/generated/**` — Pydantic models

Commit the generated artifacts. CI will fail if `pnpm codegen` produces a diff.

## Branches, Commits, PRs

### Branches
- `main` — protected, always green, deployable.
- Feature branches: `feat/<scope>-<short-desc>`, e.g. `feat/api-cookies-upload`.
- Fixes: `fix/<scope>-<short-desc>`. Docs: `docs/<topic>`. Chores: `chore/<topic>`.

### Commits
Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]
[optional footer(s)]
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
Scopes typically map to package/app names: `api`, `web`, `mobile`, `desktop`, `ui`, `api-client`, `core-logic`, `shared-types`, `infra`, `docs`, `repo`.

Example: `feat(api): add /jobs/{id}/cancel endpoint`

### Pull Requests
- One logical change per PR; keep them small.
- Fill out the PR template fully.
- Add a [changeset](https://github.com/changesets/changesets): `pnpm changeset`.
- Update docs and tests in the same PR.
- All CI checks must be green before merge.
- Squash-merge is the default; the PR title becomes the commit message.

## Running Tests

| Target              | Command                                     |
|---------------------|---------------------------------------------|
| Everything          | `pnpm test`                                 |
| Web app (Vitest)    | `pnpm --filter web test`                    |
| Desktop (Vitest)    | `pnpm --filter desktop test`                |
| Shared packages     | `pnpm --filter "./packages/*" test`         |
| API (pytest)        | `cd apps/api && pytest`                     |
| API integration     | `cd tests/api && pytest`                    |
| Mobile unit (Jest)  | `pnpm --filter mobile test`                 |
| E2E web (Playwright)| `pnpm --filter @uvd/e2e-web test`           |
| E2E iOS (Detox)     | `pnpm --filter @uvd/e2e-mobile-ios test`    |
| E2E Android (Detox) | `pnpm --filter @uvd/e2e-mobile-android test`|
| Rust (desktop)      | `cd apps/desktop/src-tauri && cargo test`   |

Lint/format before pushing:
```bash
pnpm lint
pnpm format
```

## Agent-style Workflow Note

This project is built and maintained with help from a swarm of focused AI coding agents (each owns a tight scope, e.g. "J4.4: repo meta files"). If you're contributing as a human alongside agents:

- **Respect scope boundaries.** If a directory has an active agent owner noted in `docs/PLAN.md` or in a top-level `OWNERS` comment, coordinate first.
- **Keep changes surgical** — single-purpose PRs, no drive-by reformatting outside the touched files.
- **Prefer regenerating over hand-editing** anything under a `generated/` folder.
- **Always update the changeset and docs** in the same PR; agents downstream rely on those signals.

Welcome aboard.
