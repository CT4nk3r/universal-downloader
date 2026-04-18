# Tauri sidecar binaries

This directory contains the cross-platform fetch scripts that pull the
`yt-dlp` and `ffmpeg` binaries shipped alongside the Universal Downloader
desktop app as Tauri **sidecars**.

The scripts deposit binaries under `apps/desktop/src-tauri/binaries/`,
following Tauri's required naming convention:

```
<name>-<target-triple>[.exe]
```

`tauri.conf.json` (managed by J1.7) declares them as:

```jsonc
"bundle": {
  "externalBin": [
    "binaries/yt-dlp",
    "binaries/ffmpeg"
  ]
}
```

> **Important:** binaries are **not** committed to git. They are downloaded
> by `pnpm run sidecars:fetch` (or directly by `fetch.sh`/`fetch.ps1`) at
> dev/install/CI time. The `infra/tauri-sidecars/.cache/` and
> `apps/desktop/src-tauri/binaries/` paths are covered by `.gitignore`
> (the latter implicitly via the existing `target/` rules; add an explicit
> rule if you intend to ship pre-built binaries via release artifacts).

## Supported targets

| Target triple                  | yt-dlp asset             | ffmpeg source                                    |
|--------------------------------|--------------------------|--------------------------------------------------|
| `x86_64-pc-windows-msvc`       | `yt-dlp.exe`             | BtbN `ffmpeg-master-latest-win64-gpl.zip`        |
| `aarch64-pc-windows-msvc`      | `yt-dlp.exe`             | BtbN `ffmpeg-master-latest-winarm64-gpl.zip`     |
| `x86_64-apple-darwin`          | `yt-dlp_macos`           | evermeet.cx universal2 static build              |
| `aarch64-apple-darwin`         | `yt-dlp_macos`           | evermeet.cx universal2 static build              |
| `x86_64-unknown-linux-gnu`     | `yt-dlp_linux`           | BtbN `ffmpeg-master-latest-linux64-gpl.tar.xz`   |
| `aarch64-unknown-linux-gnu`    | `yt-dlp_linux_aarch64`   | BtbN `ffmpeg-master-latest-linuxarm64-gpl.tar.xz`|

## Usage

```bash
# All targets (good for release builds + CI matrix dispatcher)
bash infra/tauri-sidecars/fetch.sh

# Just the host machine's triple (good for local `pnpm tauri dev`)
bash infra/tauri-sidecars/fetch.sh --host

# Windows
pwsh -File infra/tauri-sidecars/fetch.ps1
pwsh -File infra/tauri-sidecars/fetch.ps1 -HostOnly
```

The scripts are **CI-safe**: any asset that fails to download triggers a
warning, but the script still exits `0`. This means a Linux CI runner can
fetch the Linux binaries without choking on, e.g., `ffmpeg-winarm64`.

## Provenance & verification

* **yt-dlp** is downloaded from
  <https://github.com/yt-dlp/yt-dlp/releases/latest> and verified against
  the release's `SHA2-256SUMS` file.
* **ffmpeg** for Windows/Linux comes from
  <https://github.com/BtbN/FFmpeg-Builds/releases/latest>. BtbN does not
  publish per-asset checksums; integrity is verified transitively via
  HTTPS + GitHub's release CDN. macOS builds come from
  <https://evermeet.cx/ffmpeg/>, a long-standing static-build mirror that
  ships universal2 binaries (covers both `x86_64` and `aarch64`).

Cached downloads live under `infra/tauri-sidecars/.cache/` and are reused
across runs when the upstream SHA matches.

## Update cadence

Both upstreams use rolling-release "latest" semantics:

* yt-dlp ships **nightly** with frequent extractor fixes. Re-run the
  fetch script before any official release of the desktop app.
* BtbN's FFmpeg-Builds rebuild from `master` daily.

A reasonable cadence is:

* **Dev**: refresh weekly or whenever yt-dlp reports an extractor failure.
* **Release**: always re-run before a tagged build, and pin the resulting
  versions in the release notes (`yt-dlp --version` / `ffmpeg -version`).

## Licensing

| Component | License                                                                 | Notes |
|-----------|--------------------------------------------------------------------------|-------|
| yt-dlp    | [Unlicense](https://github.com/yt-dlp/yt-dlp/blob/master/LICENSE) (PD)   | No restrictions. |
| ffmpeg    | LGPLv2.1+ / GPLv2+ (BtbN `-gpl` builds are GPL-linked)                   | The desktop bundle becomes GPL-derivative once it ships ffmpeg. The Universal Downloader root `LICENSE` (AGPL-3.0) is GPL-compatible, so this is fine — but **do not relicense the desktop app under a non-GPL-compatible license** while shipping GPL ffmpeg. To switch to LGPL ffmpeg, use BtbN's `-lgpl` archives instead and adjust this script. |

When publishing release artifacts, include both upstream license texts in
the bundle (Tauri can be configured to embed them via `tauri.conf.json
> bundle > resources` — out of scope for J1.8).

## Why not bundle these in git LFS?

* Binary churn is high (yt-dlp ships nightly).
* Multi-arch fan-out is ~12 binaries × ~30 MB = ~360 MB per refresh.
* Reproducibility is achieved instead via SHA verification + the
  `.cache/` layer.
