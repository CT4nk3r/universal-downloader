<div align="center">

# Universal Downloader by CT4nk3r

**A fast, API-first yt-dlp + ffmpeg wrapper — web, mobile, and desktop, one contract.**

[![CI](https://github.com/CT4nk3r/universal-downloader/actions/workflows/ci.yml/badge.svg)](https://github.com/CT4nk3r/universal-downloader/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Release](https://img.shields.io/github/v/release/CT4nk3r/universal-downloader?include_prereleases&sort=semver)](https://github.com/CT4nk3r/universal-downloader/releases)
[![Container](https://img.shields.io/badge/ghcr.io-universal--downloader-blue?logo=docker)](https://ghcr.io/ct4nk3r/universal-downloader)

</div>

> Download videos from **YouTube, X (Twitter), Facebook, and Reddit** through a single OpenAPI 3.1 contract — served by a FastAPI backend for web/mobile and bundled as Tauri sidecars for fully-local desktop use.

> **Status:** Early development. See [`docs/PLAN.md`](./docs/PLAN.md) for architecture and roadmap.

---

## Supported Sites

| Site         | Video | Audio | Subtitles | Live | Notes                       |
|--------------|:-----:|:-----:|:---------:|:----:|-----------------------------|
| YouTube      |   ✓   |   ✓   |     ✓     |  ✓   | Full feature support        |
| X (Twitter)  |   ✓   |   ✓   |     —     |  —   | Public posts only           |
| Facebook     |   ✓   |   ✓   |     —     |  —   | Public videos only          |
| Reddit       |   ✓   |   ✓   |     —     |  —   | v.redd.it + crossposts      |

## Quick Install

### Web
Hosted at **https://downloader.example.invalid** (placeholder). Or run locally:
```bash
pnpm install && pnpm codegen && pnpm dev --filter web
```

### Desktop
Download the latest installer for your platform from the [Releases page](https://github.com/CT4nk3r/universal-downloader/releases) — Windows (x64/ARM64), macOS (Intel/Apple Silicon), Linux (x64/ARM64 AppImage + deb).

### Mobile
- **Android:** sideload the APK from [Releases](https://github.com/CT4nk3r/universal-downloader/releases) or build from `apps/mobile`.
- **iOS:** TestFlight link TBD; build from source via Xcode in `apps/mobile/ios`.

### Docker (self-host the API)
```bash
docker run -p 8000:8000 ghcr.io/ct4nk3r/universal-downloader-api:latest
```

## Screenshots

> _Coming soon — see [`docs/screenshots/`](./docs/screenshots/) once populated._

| Web | Desktop | Mobile |
|-----|---------|--------|
| ![web placeholder](./docs/screenshots/web.png) | ![desktop placeholder](./docs/screenshots/desktop.png) | ![mobile placeholder](./docs/screenshots/mobile.png) |

## Architecture

Hybrid execution: a **FastAPI backend** runs `yt-dlp` and `ffmpeg` for web/mobile clients, while the **Tauri desktop app** bundles the binaries as sidecars and runs everything locally with the *exact same API contract*.

## Monorepo Layout

| Path                       | Purpose                                                  |
|----------------------------|----------------------------------------------------------|
| `apps/api/`                | FastAPI + arq workers (Python 3.12)                      |
| `apps/web/`                | React + Vite, deployed to Vercel                         |
| `apps/mobile/`             | Bare React Native 0.74 (iOS + Android)                   |
| `apps/desktop/`            | Tauri 2.0 (Win/Mac/Linux × x64/ARM64)                    |
| `packages/api-client/`     | Generated TS client + React Query hooks                  |
| `packages/ui/`             | Shared React components                                  |
| `packages/shared-types/`   | OpenAPI 3.1 spec — single source of truth                |
| `packages/core-logic/`     | URL parsing, format helpers                              |
| `tests/`                   | API + e2e (web, iOS, Android)                            |
| `infra/`                   | Docker, deploy manifests                                 |
| `docs/`                    | MkDocs-built documentation site                          |

## Quick Start (development)

```bash
pnpm install
pnpm codegen      # generate TS client + Python models from OpenAPI
pnpm dev          # run all apps
```

## Documentation

Full docs are published at **https://ct4nk3r.github.io/universal-downloader/** (placeholder) and live in [`docs/`](./docs/). See also:

- [Architecture & roadmap](./docs/PLAN.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [**Responsible use**](./docs/responsible-use.md)

## License

MIT © CT4nk3r — see [LICENSE](./LICENSE).

This project is for **personal, lawful** use only. Respect each platform's Terms of Service and applicable copyright law.
