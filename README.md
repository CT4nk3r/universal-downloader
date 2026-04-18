# Universal Downloader by CT4nk3r

A fast, API-first yt-dlp + ffmpeg wrapper for downloading videos from **YouTube, X (Twitter), Facebook, and Reddit** — available as a web app, native mobile apps (iOS + Android), and desktop apps (Windows, macOS, Linux on x64 + ARM64).

> **Status:** Early development. See [`docs/PLAN.md`](./docs/PLAN.md) for the architecture and roadmap.

## Architecture

Hybrid execution: a **FastAPI backend** runs `yt-dlp` and `ffmpeg` for web/mobile clients, while the **Tauri desktop app** bundles the binaries as sidecars and runs everything locally with the *exact same API contract*.

```
apps/
  api/         FastAPI + arq (Python 3.12)
  web/         React + Vite → Vercel
  mobile/      Bare React Native 0.74 (iOS + Android)
  desktop/     Tauri 2.0 (Win/Mac/Linux × x64/ARM64)
packages/
  api-client/  Generated TS client + React Query hooks
  ui/          Shared React components
  shared-types/ OpenAPI 3.1 spec (single source of truth)
  core-logic/  URL parsing, format helpers
tests/
  api/ e2e-web/ e2e-mobile-ios/ e2e-mobile-android/
```

## Quick Start

```bash
pnpm install
pnpm codegen      # generate TS client + Python models from OpenAPI
pnpm dev          # run all apps
```

## Supported Sites

| Site         | Video | Audio | Subtitles | Live | Notes |
|--------------|:----:|:----:|:---------:|:----:|-------|
| YouTube      |  ✓   |  ✓   |    ✓      |  ✓   | Full feature support |
| X (Twitter)  |  ✓   |  ✓   |    —      |  —   | Public posts only |
| Facebook     |  ✓   |  ✓   |    —      |  —   | Public videos only |
| Reddit       |  ✓   |  ✓   |    —      |  —   | v.redd.it + crossposts |

## License

MIT © CT4nk3r — see [LICENSE](./LICENSE).

This project is for **personal, lawful** use only. Respect each platform's Terms of Service and applicable copyright law. See [`docs/responsible-use.md`](./docs/responsible-use.md).
