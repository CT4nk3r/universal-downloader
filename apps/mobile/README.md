# @universal-downloader/mobile

React Native 0.74 (bare, **not** Expo) shell for **Universal Downloader by CT4nk3r**.

- Bundle id: `com.ct4nk3r.universaldownloader`
- Display name: `Universal Downloader by CT4nk3r`
- Deep-link scheme: `universal-downloader://`

> **Status (J1.9):** shell only — providers, navigation, theme, settings,
> keychain, and minimal native projects. The screens themselves and the
> share-intent native modules are owned by **J1.10**.

---

## Bootstrap (first time)

This package ships a **hand-written minimal native skeleton** sufficient to
typecheck and reason about. To get a fully buildable native project locally:

```bash
# From repo root
pnpm install

# iOS — install pods (macOS only)
cd apps/mobile/ios && pod install && cd -

# Run
pnpm --filter @universal-downloader/mobile ios
pnpm --filter @universal-downloader/mobile android
```

If a native subproject is missing files Android Studio / Xcode complain about
(launcher icons, MainActivity.kt, AppDelegate.mm, etc.), regenerate via:

```bash
npx @react-native-community/cli init UniversalDownloader \
  --version 0.74.5 --skip-install --directory _tmp
```

…then copy the missing native files into `apps/mobile/{ios,android}/` while
preserving the values in `Info.plist`, `AndroidManifest.xml`, and
`strings.xml` documented below.

## Scripts

| Script      | What it does                                |
|-------------|---------------------------------------------|
| `start`     | `react-native start` (Metro)                |
| `ios`       | `react-native run-ios`                      |
| `android`   | `react-native run-android`                  |
| `typecheck` | `tsc --noEmit`                              |
| `test`      | Jest (preset `react-native`)                |
| `clean`     | Remove build/cache outputs                  |

## Monorepo / Metro

`metro.config.js` follows the official Metro monorepo recipe:

- `watchFolders` includes the repo root so changes in `packages/*` rebuild.
- `nodeModulesPaths` lists the app, root, and `packages/` so Metro resolves
  workspace deps under pnpm.
- `disableHierarchicalLookup: true` to avoid pnpm symlink ambiguity.

## API base URL defaults

`src/lib/settings-store.ts` uses `Platform.select`:

- Android emulator: `http://10.0.2.2:8787/v1`
- iOS simulator:    `http://localhost:8787/v1`

The API key is **never** persisted in MMKV — it is stored in the OS keychain
via `src/lib/keychain.ts` (service `com.ct4nk3r.universaldownloader.apikey`).

---

## Interfaces J1.10 must consume / provide

### Screens

Replace the placeholders in `src/screens/` keeping these named exports and
file paths (the navigator imports them by name):

| Tab        | File                          | Export             |
|------------|-------------------------------|--------------------|
| Home       | `src/screens/home.tsx`        | `HomeScreen`       |
| Queue      | `src/screens/queue.tsx`       | `QueueScreen`      |
| History    | `src/screens/history.tsx`     | `HistoryScreen`    |
| Settings   | `src/screens/settings.tsx`    | `SettingsScreen`   |

Route names live in `RootTabParamList` (`src/navigation.tsx`). Keep
`Home | Queue | History | Settings` stable for deep-link parity.

### Hooks / providers (already wired)

- `useApi()` from `src/lib/api-context.tsx` — typed openapi-fetch client.
- `useApiContext()` — same plus `apiBaseUrl`, `hasApiKey`, `reloadApiKey()`.
  Call `reloadApiKey()` after writing a new key via `keychain.setApiKey()`.
- `useSettings()` from `src/lib/settings-store.ts` — Zustand+MMKV store.
- `useTheme()` from `src/lib/theme.ts` — palette + `isDark`.

### Native modules (J1.10 to implement)

J1.9 only wires intent filters / URL types. J1.10 must add:

| Module name           | Purpose                                             | Platforms |
|-----------------------|-----------------------------------------------------|-----------|
| `UDShareIntent`       | Read incoming `ACTION_SEND` text and `universal-downloader://` URLs; emit `UDShareIntent.shareReceived` event | iOS + Android |
| `UDClipboard`         | (Optional) Read clipboard for paste-and-go         | iOS + Android |

Recommended JS surface (placeholder, J1.10 owns the actual TS file):

```ts
// src/native/share-intent.ts (J1.10)
export interface SharedPayload { url: string; source: 'deeplink' | 'share'; }
export function getInitialShared(): Promise<SharedPayload | null>;
export function addSharedListener(cb: (p: SharedPayload) => void): () => void;
```

Android intent filters and iOS URL types are already declared in
`android/app/src/main/AndroidManifest.xml` and `ios/UniversalDownloader/Info.plist`.

## Brand

The exact display string is **`Universal Downloader by CT4nk3r`**. It appears
in:

- `app.json` `displayName`
- iOS `CFBundleDisplayName`
- Android `strings.xml` `app_name`
- In-app header (`src/components/header.tsx`)
