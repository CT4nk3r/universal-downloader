# Desktop CI notes (J3.4)

Companion to `.github/workflows/ci-desktop.yml`. Documents the
non-obvious system dependencies, runner choices, and cross-compilation
caveats for the Tauri 2 desktop matrix.

## Matrix overview

| Label             | Runner            | Rust target                  | Bundle formats           | Cross? |
|-------------------|-------------------|------------------------------|--------------------------|--------|
| windows-x86_64    | `windows-latest`  | `x86_64-pc-windows-msvc`     | MSI, NSIS                | no     |
| windows-aarch64   | `windows-11-arm`  | `aarch64-pc-windows-msvc`    | MSI, NSIS                | no\*   |
| macos-universal   | `macos-14`        | `universal-apple-darwin`     | DMG, `.app.tar.gz`       | no     |
| linux-x86_64      | `ubuntu-22.04`    | `x86_64-unknown-linux-gnu`   | AppImage, deb, rpm       | no     |
| linux-aarch64     | `ubuntu-22.04`    | `aarch64-unknown-linux-gnu`  | deb (+ AppImage best-effort) | yes (cross-rs) |

The macOS row covers both `x86_64-apple-darwin` and `aarch64-apple-darwin`
(Tauri's `universal-apple-darwin` performs the `lipo` merge), giving a
total of **6 architectures across 5 jobs**.

\* If the org/repo does not have access to the `windows-11-arm` GitHub-hosted
runner SKU, change the matrix entry to `runner: windows-latest` and set
`use_cross: true` — Rust can cross-compile to `aarch64-pc-windows-msvc`
from x64 Windows once the target is added (`rustup target add
aarch64-pc-windows-msvc`). Bundles will only contain the Rust binary;
NSIS/MSI bundling for ARM64 requires a native ARM Windows host or
WiX 4 with explicit arch overrides.

## Linux build dependencies

Tauri 2 on Linux requires WebKitGTK 4.1 (the `libsoup-3.0` line). The
4.0 packages (`libwebkit2gtk-4.0-dev`, `libsoup2.4-dev`) used by Tauri 1
will **not** work and must not be installed alongside.

Install snippet (Debian/Ubuntu — what the workflow runs):

```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev \
  libgtk-3-dev \
  librsvg2-dev \
  libayatana-appindicator3-dev \
  libssl-dev \
  patchelf \
  file \
  wget \
  xdg-utils \
  build-essential \
  pkg-config
```

Notes:

* `libayatana-appindicator3-dev` is the modern fork; the legacy
  `libappindicator3-dev` package is gone in Ubuntu 22.04+.
* `patchelf` is required by `tauri-bundler` for AppImage RPATH fixups.
* `librsvg2-dev` is required for the bundled icon pipeline.
* `file` and `xdg-utils` are runtime deps that `tauri-bundler` shells
  out to during AppImage assembly.
* For Fedora/RHEL CI (not used here), the equivalents are
  `webkit2gtk4.1-devel`, `gtk3-devel`, `libsoup3-devel`,
  `libappindicator-gtk3-devel`, `librsvg2-devel`.

## Cross compilation (Linux aarch64)

The `linux-aarch64` job uses [cross-rs](https://github.com/cross-rs/cross)
to compile the Rust binary inside a multi-arch container that already
contains an aarch64 sysroot + GCC linker.

* Install: `cargo install cross --git https://github.com/cross-rs/cross --locked`
  (the `--locked` flag pins to the committed `Cargo.lock`).
* Tauri is invoked with `--runner cross`, so `tauri build` calls
  `cross build` instead of `cargo build`.
* The container image used by `cross` for `aarch64-unknown-linux-gnu`
  ships `libwebkit2gtk-4.1-dev` from the Ubuntu 22.04 ports archive.
  If a new `cross` release ever drops it, pin via a top-level
  `Cross.toml` in `apps/desktop/src-tauri/`:

  ```toml
  [target.aarch64-unknown-linux-gnu]
  pre-build = [
    "dpkg --add-architecture arm64",
    "apt-get update",
    "apt-get install -y libwebkit2gtk-4.1-dev:arm64 libsoup-3.0-dev:arm64 libgtk-3-dev:arm64 librsvg2-dev:arm64 libayatana-appindicator3-dev:arm64",
  ]
  ```

* AppImage cross-bundling is fragile (`appimagetool` is x86_64-only and
  requires `qemu-user-static` + `binfmt_misc` on the host). The workflow
  treats AppImage as best-effort; deb/rpm are the reliable artifacts
  for ARM64 Linux.

## macOS universal builds

* `macos-14` is Apple Silicon (`arm64`). Building an `x86_64-apple-darwin`
  slice requires the `x86_64-apple-darwin` rustup target and Xcode CLT
  (pre-installed on GitHub-hosted runners).
* The workflow pre-installs both targets via the `dtolnay/rust-toolchain`
  step's `targets:` field; Tauri's `universal-apple-darwin` orchestrates
  `lipo`.
* No notarization or codesigning is performed in this matrix — see the
  "code signing" note below.

## Windows ARM64

* `windows-11-arm` is a GitHub-hosted ARM64 Windows runner. It is the
  cleanest path: native build, native bundling, no cross-toolchain
  weirdness. As of writing, the runner image ships MSVC ARM64 build
  tools and WiX 3.
* If the runner is unavailable to the repo, fall back to cross-compile
  on `windows-latest`. Bundling is the catch — see the matrix note.

## Sidecars

The build assumes `infra/tauri-sidecars/fetch.{ps1,sh}` populates
`apps/desktop/src-tauri/binaries/` with `yt-dlp-<triple>[.exe]` and
`ffmpeg-<triple>[.exe]` in Tauri's required naming convention. See
`infra/tauri-sidecars/README.md` for the upstream sources, supported
triples, and verification approach (yt-dlp via SHA2-256SUMS; ffmpeg via
HTTPS + GitHub release CDN).

The CI scripts are designed to be **non-fatal on per-asset failure** so
that a Linux runner doesn't choke on a missing Windows-ARM ffmpeg
archive when only the host triple is needed.

## Code signing

**Out of scope for J3.4.** The workflow:

* Never passes `--sign` to `tauri build`.
* Explicitly clears `TAURI_SIGNING_PRIVATE_KEY` and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in the job env to ensure a
  Tauri updater key, if leaked into the environment, doesn't trigger
  signing attempts.
* Does not configure macOS notarization (`APPLE_ID`,
  `APPLE_PASSWORD`, `APPLE_TEAM_ID`) or Windows Authenticode
  (`WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`).
* MSI/NSIS/DMG/deb/AppImage artifacts produced here are **unsigned**
  and intended for CI verification only; do not promote them to a
  public release without first running through a signing pipeline
  (tracked separately).

## Caching

* Node modules: `actions/setup-node@v4` with `cache: pnpm`.
* Rust target dirs: `Swatinem/rust-cache@v2`, keyed per target triple.
* Sidecars: cached on disk under `infra/tauri-sidecars/.cache/` by the
  fetch scripts themselves; not currently uploaded to the GitHub Actions
  cache (low payoff vs. complexity — assets are pulled directly from
  GitHub release CDN).

## Triggers

* `push` to `main` and any `pull_request` touching:
  * `apps/desktop/**`
  * `packages/{ui,shared-types,api-client,core-logic}/**`
  * `infra/tauri-sidecars/**`
  * `rust-toolchain.toml`
  * `.github/workflows/ci-desktop.yml`
* Manual `workflow_dispatch` for ad-hoc full-matrix runs.

## Known follow-ups (not in J3.4 scope)

* Wire up `tauri signer generate` + secrets for the Tauri updater
  signing key.
* Add macOS notarization via `tauri-action`'s `APPLE_*` inputs.
* Add Windows Authenticode via Azure Trusted Signing or a HSM-backed
  cert.
* Promote artifacts to GitHub Releases on tag push (separate workflow
  `release-desktop.yml`).
* Add an end-to-end smoke test (boot the bundled app headlessly, hit
  the embedded Tauri command surface).
