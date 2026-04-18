# @universal-downloader/core-logic

Framework-agnostic, side-effect-free helpers shared across the web app, the
Tauri desktop client, and the React Native mobile client.

- **ESM only.** No CommonJS build.
- **No node-specific APIs.** Works in browsers, Node, the Tauri webview, and React Native.
- **Pure functions.** Every export is deterministic with no I/O.
- **TS strict, no `any`.**

## Install

```jsonc
// package.json
"dependencies": {
  "@universal-downloader/core-logic": "workspace:*"
}
```

## API surface

### `url`
- `normalizeUrl(input: string): string`
- `extractVideoId(url: string, site: SiteId): string | null`
- `isLikelyPlaylist(url: string): boolean`

### `format`
- `formatBytes(bytes: number, decimals?: number): string` — binary (KiB/MiB/…)
- `formatDuration(seconds: number): string` — `H:MM:SS` / `M:SS` / `0:SS`
- `formatSpeed(bps: number): string`
- `formatEta(seconds: number): string` — e.g. `"~3m left"`
- `formatRelativeTime(date: Date | string): string` — e.g. `"2 minutes ago"`

### `presets`
- `PRESET_LABELS: Record<QualityPreset, string>`
- `PRESET_DESCRIPTIONS: Record<QualityPreset, string>`
- `selectorForPreset(preset: QualityPreset): string` — yt-dlp `-f` selector matching the J1.3 server-side mapping; used by display code and the desktop sidecar adapter (J1.8).

### `filename`
- `sanitizeFilename(name: string, maxLen?: number): string`
- `defaultFilenameTemplate: string` — `"%(title)s [%(id)s].%(ext)s"`

### `result`
- `Result<T, E>`, `Ok<T>`, `Err<E>`
- `ok(v)`, `err(e)`, `isOk(r)`, `isErr(r)`, `unwrap(r)`, `map(r, fn)`

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Run vitest unit tests (90% coverage threshold) |
| `pnpm build` | Emit declarations + JS to `dist/` |
| `pnpm clean` | Remove `dist/` and `.turbo/` |

## Notes

- Tracking-param stripping covers `utm_*`, `fbclid`, `gclid`, `si`, `feature` (case-insensitive).
- `sanitizeFilename` truncates by **graphemes** via `Intl.Segmenter` when available, falling back to code points — so emoji/CJK never get cut mid-character.
- `selectorForPreset` is the canonical TS mirror of the server-side mapping; if you change one, change the other.
