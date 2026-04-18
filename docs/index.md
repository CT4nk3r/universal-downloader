# Universal Downloader

> A unified, cross-platform media download client by **CT4nk3r**.

Universal Downloader is an open-source toolkit for fetching publicly available media from a wide
range of sources through a single, consistent interface. It exposes a clean HTTP API, a desktop
GUI, a mobile app, and a web frontend — all backed by a shared monorepo of typed contracts.

## What it is

- **One API, many clients.** A single TypeScript backend powers the web, desktop (Tauri), and
  mobile (React Native) experiences.
- **Pluggable extractors.** Site-specific adapters live behind a stable interface so new sources
  can be added without changing client code.
- **Self-hostable.** Runs as a single container or behind your reverse proxy of choice.
- **Privacy-respecting.** No telemetry by default; downloads stream directly to your device or
  storage backend.

## Supported sites

The extractor layer ships with adapters for popular public-media platforms. The full,
up-to-date list is enumerated by the API at `/v1/extractors` and documented in the
[API Reference](api.md). Only content you are legally permitted to download should be retrieved —
see [Responsible Use](responsible-use.md).

## Install / Get the clients

| Surface       | How to get it                                                     |
| ------------- | ----------------------------------------------------------------- |
| Web           | Hosted demo (link TBD) or run locally via `pnpm dev`              |
| Desktop       | Download the latest installer from the [GitHub Releases](https://github.com/CT4nk3r/universal-downloader/releases) page (Windows, macOS, Linux) |
| Mobile        | Sideload the latest APK from Releases; iOS via TestFlight (TBD)   |
| API / Docker  | `docker pull ghcr.io/ct4nk3r/universal-downloader-api:latest`     |

## Next steps

- New here? Start with the [Getting Started](getting-started.md) guide.
- Integrators: jump to the [API Reference](api.md).
- Operators: see [Self-Hosting](self-hosting.md).
- Contributors: read the [Contributing](contributing.md) guide.
