# Tauri Icons

This directory holds the application icons referenced by `tauri.conf.json`:

```
32x32.png
128x128.png
128x128@2x.png
icon.icns      (macOS)
icon.ico       (Windows)
```

Generate them all from a single 1024x1024 source PNG with:

```bash
pnpm --filter @universal-downloader/desktop tauri icon path/to/source.png
```

Until icons are generated, `tauri build` will fail; `tauri dev` works fine
without them.
