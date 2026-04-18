# @universal-downloader/desktop

Tauri 2.0 desktop shell for **Universal Downloader by CT4nk3r**.

- **Bundle id:** `com.ct4nk3r.universaldownloader`
- **Product name:** `Universal Downloader`
- **Window title:** `Universal Downloader by CT4nk3r`
- **Deep link scheme:** `universal-downloader://`

## Develop

```bash
# from the repo root
pnpm install
pnpm --filter @universal-downloader/desktop dev
```

`tauri dev` launches Vite on a fixed port (`1420`) and then starts the
native window. The frontend reuses the same `react`/`react-router`/`react-query`
stack as `apps/web`.

### API selection

The desktop app implements the same `ApiClient` contract as the web app, but
can route calls **locally** (in-process) or **remotely** (HTTP).

- `useLocalSidecars: true`  (default) — calls a Tauri-command-backed adapter
  (`src/lib/sidecar-client.ts`) which J1.8 will wire to `yt-dlp` / `ffmpeg`
  sidecars via `invoke()`.
- `useLocalSidecars: false` — uses `createApiClient({ baseUrl, apiKey })` from
  `@universal-downloader/api-client` to hit the remote `apps/api` server.

Toggle from **Settings → Use local sidecars**.

## Sidecars

`tauri.conf.json` declares two external binaries:

```
src-tauri/binaries/yt-dlp[-<target-triple>][.exe]
src-tauri/binaries/ffmpeg[-<target-triple>][.exe]
```

The J1.8 deliverable adds a `pnpm fetch:sidecars` script that downloads the
correct platform-specific binaries into `src-tauri/binaries/` before
`tauri build`. The directory is `.gitignored`.

## Build

```bash
pnpm --filter @universal-downloader/desktop build
```

Bundle targets: `msi`, `nsis` (Windows), `app`, `dmg` (macOS),
`deb`, `rpm`, `appimage` (Linux).

## Updates

The updater plugin is configured against
`https://github.com/CT4nk3r/universal-downloader/releases/latest/download/latest.json`.
**`pubkey` is intentionally empty in `tauri.conf.json` — updates are unsigned
during early development.** Generate a key pair with
`pnpm tauri signer generate` before shipping a public release.

## Icons

See `src-tauri/icons/README.md`. Run `pnpm tauri icon <source.png>` to
generate the required set; without them `tauri build` will fail (`tauri dev`
is fine).

## Tauri command surface

Implemented in J1.7 (`src-tauri/src/commands.rs`):

| Command                 | Args                | Returns           |
| ----------------------- | ------------------- | ----------------- |
| `open_in_folder`        | `{ path: string }`  | `void`            |
| `pick_download_folder`  | _none_              | `string` (path)   |
| `quit_app`              | _none_              | `void`            |

To be implemented in J1.8 (`src-tauri/src/sidecar.rs`):

| Command              | Args                                   | Returns             |
| -------------------- | -------------------------------------- | ------------------- |
| `sidecar_probe`      | _none_                                 | `SidecarVersions`   |
| `sidecar_download`   | `{ url, preset, dest, options }`       | `JobId` (string)    |
| `sidecar_cancel`     | `{ id: JobId }`                        | `void`              |
| `sidecar_list_jobs`  | _none_                                 | `JobSnapshot[]`     |
| `sidecar_job`        | `{ id: JobId }`                        | `JobSnapshot \| null` |

Job progress is streamed via Tauri events on `sidecar://job/{id}`.
