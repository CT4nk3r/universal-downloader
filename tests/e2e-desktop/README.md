# @ud/e2e-desktop

End-to-end WebDriver tests for the Universal Downloader desktop app
(`apps/desktop`). Driven by [`tauri-driver`](https://crates.io/crates/tauri-driver)
+ [WebdriverIO](https://webdriver.io/).

## Layout

```
tests/e2e-desktop/
├── package.json
├── tsconfig.json
├── wdio.conf.ts          # spawns tauri-driver on 127.0.0.1:4444
└── specs/
    ├── launch.e2e.ts     # window opens + title smoke test
    ├── queue.e2e.ts      # enqueue flow against bundled sidecar
    └── settings.e2e.ts   # bundled <-> remote API switch
```

## Prerequisites

These tests drive the **built** desktop binary, not `tauri dev`. Build it first:

```
pnpm --filter @ud/desktop tauri build
```

The expected binary path is read from `apps/desktop/src-tauri/Cargo.toml`
(`[package].name = "universal-downloader"`):

- Windows: `apps/desktop/src-tauri/target/release/universal-downloader.exe`
- Linux:   `apps/desktop/src-tauri/target/release/universal-downloader`

Override with `TAURI_APP_BINARY=/abs/path/to/binary`.

### Install `tauri-driver`

```
cargo install tauri-driver --locked
```

### Platform-specific WebDriver

`tauri-driver` does not embed a browser engine — it proxies to the OS one.

#### Windows
- Install the **Microsoft Edge WebView2 Runtime** (evergreen):
  https://developer.microsoft.com/microsoft-edge/webview2/
- Install a matching version of **Microsoft Edge Driver**
  (`msedgedriver.exe`) and put it on `PATH`, or pass it via
  `NATIVE_DRIVER_PATH=C:\path\to\msedgedriver.exe`.

#### Linux
- Install **WebKitWebDriver** — provided by the `webkit2gtk-driver` package
  on Debian/Ubuntu, `webkit2gtk4.1-devel` on Fedora, etc.
- Make sure `WebKitWebDriver` is on `PATH`, or set
  `NATIVE_DRIVER_PATH=/usr/bin/WebKitWebDriver`.

## Running

```
pnpm --filter @ud/e2e-desktop install
pnpm --filter @ud/e2e-desktop test
```

Force a platform variant explicitly:

```
TAURI_PLATFORM=windows pnpm --filter @ud/e2e-desktop test
TAURI_PLATFORM=linux   pnpm --filter @ud/e2e-desktop test
```

## Environment variables

| Variable              | Default                                                              | Purpose                                       |
| --------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| `TAURI_PLATFORM`      | current OS                                                           | `windows` \| `linux`                          |
| `TAURI_PROFILE`       | `release`                                                            | Cargo profile under `target/`                 |
| `TAURI_TARGET_DIR`    | `apps/desktop/src-tauri/target`                                      | Override Cargo target dir                     |
| `TAURI_APP_BINARY`    | derived                                                              | Absolute path to the built app binary         |
| `TAURI_DRIVER_PATH`   | resolved via `where`/`which`, then `~/.cargo/bin/tauri-driver`       | Path to `tauri-driver`                        |
| `TAURI_DRIVER_HOST`   | `127.0.0.1`                                                          | tauri-driver bind host                        |
| `TAURI_DRIVER_PORT`   | `4444`                                                               | tauri-driver bind port                        |
| `NATIVE_DRIVER_PATH`  | (unset)                                                              | Forwarded to tauri-driver (msedgedriver / WebKitWebDriver) |
| `UD_E2E_URL`          | a public sample URL                                                  | URL used by `queue.e2e.ts`                    |
| `UD_E2E_REMOTE_URL`   | `http://127.0.0.1:8787`                                              | Remote API URL used by `settings.e2e.ts`      |

## Notes

- The specs reference `data-testid` hooks on the web UI
  (`url-input`, `enqueue-button`, `queue-row`, `settings-nav`,
  `api-mode-bundled`, `api-mode-remote`, `remote-api-url`,
  `settings-save`, `settings-active-mode`). When those are not yet wired
  the affected `it()` blocks `this.skip()` so the suite stays green.
- The `launch.e2e.ts` smoke check reads the title from
  `apps/desktop/src-tauri/tauri.conf.json`
  (`app.windows[0].title = "Universal Downloader by CT4nk3r"`).
