# Universal Downloader — Plan

> **Branding:** Universal Downloader by CT4nk3r · code: `universal-downloader` · bundle id: `com.ct4nk3r.universaldownloader`

## Architecture

Hybrid execution. A FastAPI backend runs `yt-dlp` + `ffmpeg` for web/mobile clients. The Tauri desktop app bundles the same binaries as **sidecars** and runs them locally with the *exact same API contract* (`packages/shared-types/openapi.yaml`).

```
              ┌──────────── OpenAPI 3.1 spec (single source of truth) ────────────┐
              │           → openapi-typescript → packages/api-client (TS)        │
              │           → datamodel-code-generator → apps/api/.../generated.py │
              └──────────────────────────────────────────────────────────────────┘
                          │                │                │                │
                     ┌────▼───┐        ┌───▼───┐        ┌───▼────┐      ┌────▼────┐
                     │  Web   │        │ Mobile│        │Desktop │      │  API    │
                     │ React  │        │  RN   │        │ Tauri  │      │FastAPI  │
                     │ Vercel │        │ iOS+A │        │ 6 tgts │      │ + arq   │
                     └────────┘        └───────┘        └────────┘      └─────────┘
```

## Stack

| Layer    | Choice                                                                       |
|----------|------------------------------------------------------------------------------|
| API      | Python 3.12, FastAPI, arq (Redis), SQLModel/SQLite, structlog                 |
| Web      | React 18, Vite, TS, Tailwind, shadcn/ui, TanStack Router/Query, zustand      |
| Mobile   | React Native 0.74 (bare), TS, react-navigation, react-native-keychain         |
| Desktop  | Tauri 2.0, Rust stable, sidecar yt-dlp + ffmpeg per target triple             |
| Shared   | OpenAPI 3.1 → openapi-typescript + datamodel-code-generator                  |
| Tests    | pytest, schemathesis, Playwright, XCTest, Espresso, tauri-driver, vitest     |
| Tooling  | pnpm 9, Turborepo 2, Node 20 LTS, Rust stable, Changesets                    |

## Defaults

- Auth: `UD_API_KEY` env var, fail-fast if missing
- Download dir (desktop): `~/Downloads/Universal Downloader/`
- Job artifact TTL: 24h
- Concurrent downloads: 3
- API port: 8787
- No code signing — GitHub Releases only

## Repo Layout

```
apps/        api/  web/  mobile/  desktop/
packages/    api-client/  ui/  shared-types/  core-logic/
tests/       api/  e2e-web/  e2e-mobile-ios/  e2e-mobile-android/  fixtures/
infra/       docker/  tauri-sidecars/
.github/     workflows/
scripts/     codegen/
```

## Execution Phases

1. **Wave 0** (sequential): bootstrap, OpenAPI spec, codegen wiring. ✅
2. **Wave 1** (12 parallel agents): API ×4, Web ×2, Desktop ×2, Mobile ×2, UI lib, API client.
3. **Waves 2 + 3** (14 parallel agents): 8 test suites + 6 CI workflows.
4. **Wave 4** (4 parallel agents): docs.

See sections below for per-job briefs.
