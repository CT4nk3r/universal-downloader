# CI E2E — Required Services & Secrets

This document enumerates the runtime services, system packages, and GitHub
secrets required by `.github/workflows/ci-e2e.yml`. The workflow runs nightly
(`17 3 * * *` UTC) and on `workflow_dispatch`.

## Jobs overview

| Job                    | Runner            | Purpose                                  |
| ---------------------- | ----------------- | ---------------------------------------- |
| `web-e2e`              | `ubuntu-latest`   | Playwright against built web preview     |
| `desktop-e2e-windows`  | `windows-latest`  | Tauri WebDriver E2E via Edge WebDriver   |
| `desktop-e2e-linux`    | `ubuntu-22.04`    | Tauri WebDriver E2E via webkit2gtk-driver|

## Required services

### web-e2e
- **Docker Compose stack** at `infra/docker/compose.yml`. The workflow brings
  up the `api` service (and any of its dependencies — postgres, redis, object
  store, etc.) with `docker compose up -d --wait api`.
  - The `api` service MUST expose a `/healthz` endpoint on `localhost:8080`.
  - The `api` service MUST declare a `healthcheck` in compose so `--wait` works.
  - Any heavy external dependencies (S3, OAuth providers) should be mocked or
    stubbed within the compose file (e.g. `minio`, `mockoauth`).
- **Web preview server**: started via `vite preview` on `127.0.0.1:4173`.
- **Playwright browsers**: installed with `playwright install --with-deps`
  (chromium, firefox, webkit). Cached under `${{ github.workspace }}/.pw-browsers`.

### desktop-e2e-windows
- **Rust stable toolchain** (via `dtolnay/rust-toolchain@stable`).
- **Edge WebDriver** (`msedgedriver.exe`) — version pinned to the Edge build
  preinstalled on `windows-latest`. Detected from registry at runtime.
- **`tauri-driver`** installed via `cargo install tauri-driver --locked`.
- WebView2 runtime is preinstalled on `windows-latest`; no extra step needed.

### desktop-e2e-linux
- **Rust stable toolchain**.
- **`tauri-driver`** installed via cargo.
- APT packages (Tauri v2 + WebKit driver):
  - `libwebkit2gtk-4.1-dev`
  - `webkit2gtk-driver` (provides `WebKitWebDriver`)
  - `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`,
    `libsoup-3.0-dev`
  - `xvfb` + `at-spi2-core` for headless display
- Tests run under `xvfb-run` (`1280x800x24`).
- Pinned to `ubuntu-22.04` because `webkit2gtk-driver` packaging differs on
  24.04 (currently ships only `libwebkit2gtk-6.0`); revisit when Tauri/Driver
  support stabilises on 24.04.

## Required GitHub secrets

The workflow as written does not assume any repo secrets, but the following
are likely needed once tests cover real flows. Add them under
`Settings → Secrets and variables → Actions` and wire them into the relevant
job `env:` block.

| Secret                       | Used by              | Purpose                                  |
| ---------------------------- | -------------------- | ---------------------------------------- |
| `E2E_TEST_USER_EMAIL`        | all jobs             | Seed account for login flows             |
| `E2E_TEST_USER_PASSWORD`     | all jobs             | Password for seed account                |
| `E2E_API_TOKEN`              | all jobs             | Pre-issued bearer token for API calls    |
| `E2E_OAUTH_CLIENT_ID`        | web-e2e              | OAuth client for sign-in tests           |
| `E2E_OAUTH_CLIENT_SECRET`    | web-e2e              | OAuth client secret                      |
| `E2E_S3_ACCESS_KEY`          | web-e2e (api compose)| If api requires real S3 instead of minio |
| `E2E_S3_SECRET_KEY`          | web-e2e (api compose)| ditto                                    |
| `TAURI_SIGNING_PRIVATE_KEY`  | desktop jobs         | Only if signed debug build is required   |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | desktop jobs | ditto                                    |

> Pass secrets to compose via an `--env-file` or explicit `-e` flags; never
> bake them into images.

## Required repo files / packages

- `infra/docker/compose.yml` with at minimum an `api` service exposing
  `8080:8080` and a healthcheck on `/healthz`.
- pnpm workspaces:
  - `@ud/web` — buildable with `pnpm --filter @ud/web build`, previewable
    with `vite preview --port 4173`.
  - `@ud/desktop` — Tauri app, buildable with
    `pnpm --filter @ud/desktop tauri build --debug`.
  - `@ud/e2e-web` — Playwright project; expects `WEB_BASE_URL` and
    `API_BASE_URL` from env.
  - `@ud/e2e-desktop` — WebDriver-based suite (WebdriverIO recommended);
    expects `WEBDRIVER_URL` and the path to the built desktop binary
    (resolve via convention under `apps/desktop/src-tauri/target/debug/`).

## Artifacts

Each job uploads on `if: always()`:
- `web-e2e-traces` — Playwright HTML report, traces, preview log.
- `desktop-e2e-windows` / `desktop-e2e-linux` — test results, screenshots,
  driver logs.

Retention: 14 days.

## Local reproduction

```bash
# web
docker compose -f infra/docker/compose.yml up -d --wait api
pnpm install
pnpm --filter @ud/web build
pnpm --filter @ud/web exec vite preview --port 4173 &
pnpm --filter @ud/e2e-web exec playwright test

# desktop (linux)
cargo install tauri-driver --locked
pnpm --filter @ud/desktop tauri build --debug
xvfb-run -a pnpm --filter @ud/e2e-desktop test
```

## Open questions / TODO

- Confirm `infra/docker/compose.yml` `api` service name + healthcheck path.
- Decide whether to matrix the web-e2e across browsers vs run all three in a
  single Playwright invocation (current: single invocation, project matrix
  inside Playwright config).
- Add Slack/issue notification step on nightly failure (separate workflow
  `notify-on-failure.yml` recommended to keep this file focused).
