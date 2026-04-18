# Mobile CI — Secrets & Keys

This document describes the (intentionally minimal) secret surface for the
`ci-mobile` workflow. Per project spec, **no code signing is performed in CI**.

## Current posture: no signing

- iOS jobs build and test with `CODE_SIGNING_ALLOWED=NO` against an iOS
  Simulator destination. No Apple Developer account, no provisioning
  profiles, no `.p12`, no App Store Connect API key, and no Fastlane
  Match credentials are required or consumed.
- Android jobs build the `debug` variant only (`assembleDebug`,
  `assembleAndroidTest`, `connectedDebugAndroidTest`). The debug build
  is signed with the AOSP debug keystore generated locally by the
  Android Gradle Plugin. **No release keystore secrets are required.**

As a result, the workflow does **not** read any repository or
organization secrets today. Forked-PR builds are safe by construction.

## Secrets explicitly NOT used (and why)

| Secret | Purpose if used | Status |
| --- | --- | --- |
| `APPLE_API_KEY_ID` / `APPLE_API_ISSUER_ID` / `APPLE_API_KEY_P8` | App Store Connect API auth for upload/notarization | Not used — no release pipeline here |
| `MATCH_PASSWORD` / `MATCH_GIT_BASIC_AUTHORIZATION` | Fastlane Match cert sync | Not used — no signing |
| `IOS_DIST_CERT_P12` / `IOS_DIST_CERT_PASSWORD` | Manual distribution signing | Not used |
| `IOS_PROVISIONING_PROFILE` | Manual provisioning | Not used |
| `ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` | Release APK/AAB signing | Not used — debug only |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Play Console upload | Not used |
| `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` | Symbol upload | Not used |

## When release signing is added later

If/when a release pipeline is introduced, follow these rules:

1. Store all credentials as **GitHub Encrypted Secrets** at the repository
   or environment level. Never commit keystores, `.p12`, `.mobileprovision`,
   `.p8`, or service-account JSON.
2. Gate signing jobs on `github.event_name != 'pull_request'` **and**
   `github.repository == '<owner>/<repo>'` to prevent fork PRs from
   accessing secrets.
3. Use a dedicated GitHub **Environment** (e.g. `release-mobile`) with
   required reviewers for any job that consumes signing material.
4. For iOS, prefer Fastlane Match with a private cert repo, or the
   `apple-actions/import-codesign-certs` action; decode the `.p12` from
   a base64 secret into a temporary keychain and delete it in `always()`.
5. For Android, decode `ANDROID_KEYSTORE_BASE64` to a path under
   `$RUNNER_TEMP`, pass it via Gradle properties (`-Pandroid.injected.signing.*`),
   and ensure the file is removed at job end.
6. Never `echo` secret values. Mask any derived values with
   `::add-mask::` if they must be computed in-workflow.

## Local developer notes

- The CI iOS job pins Xcode via `DEVELOPER_DIR=/Applications/Xcode_15.4.app/...`.
  Bump this when GitHub-hosted `macos-14` images rotate the default Xcode.
- The Android emulator job uses `reactivecircus/android-emulator-runner` with
  API 33 / `google_apis` / `x86_64`. KVM is enabled on the runner for HW accel.
- Caches: CocoaPods (`Pods`, `~/Library/Caches/CocoaPods`, `~/.cocoapods`)
  keyed on `Podfile.lock`; Gradle (`~/.gradle/caches`, `~/.gradle/wrapper`)
  keyed on Gradle files. No secret material is ever cached.
