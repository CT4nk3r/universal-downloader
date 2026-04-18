# Release Process

This document describes how the `release` workflow (`.github/workflows/release.yml`) cuts new versions of the Universal Downloader monorepo. The workflow runs on every push to `main` and is fully automated end-to-end — there are no manual signing steps and no per-release ceremony beyond merging the Version PR.

## Overview

```
push -> main
   |
   v
+-------------+    no changesets pending     +-------------------+
| changesets  | --------------------------> | publish to npm    |
| job (always)|                              | (packages/*)      |
+-------------+                              +-------------------+
       |                                              |
       | pending changesets                           v
       v                                  +-----------------------+
+--------------------+                    | build-desktop matrix  |
| Version PR opened  |                    | (6 target triples)    |
| (review + merge)   |                    +-----------------------+
+--------------------+                                |
                                                      v
                                          +-----------------------+
                                          | publish-docker (api)  |
                                          | + sbom job            |
                                          +-----------------------+
                                                      |
                                                      v
                                          +-----------------------+
                                          | github-release        |
                                          | (binaries + sums      |
                                          |  + SBOM)              |
                                          +-----------------------+
```

## Day-to-day flow

1. Authors land changes to `main` via PR. Any PR that affects a publishable package under `packages/*` must include a `.changeset/<name>.md` describing the bump (`patch` / `minor` / `major`).
2. On push to `main`, the `changesets` job in `release.yml` runs:
   - **If pending changesets exist:** `changesets/action` opens (or updates) a "Version PR" titled `chore(release): version packages`. This PR rolls versions, regenerates changelogs, and consumes the changeset files. Reviewers merge it when ready to ship.
   - **If no pending changesets exist** (i.e. the Version PR just landed): `changesets/action` runs `changeset publish --access public`, pushing each bumped package in `packages/*` to npm using the `NPM_TOKEN` secret.
3. When (and only when) `changesets.outputs.published == 'true'`, the downstream jobs fan out:
   - `build-desktop` — Tauri build matrix across the six target triples.
   - `publish-docker` — multi-arch (`linux/amd64`, `linux/arm64`) API image to GHCR.
   - `sbom` — CycloneDX SBOMs for the Node workspace and the Cargo workspace.
   - `github-release` — collects everything and publishes the GitHub Release.

## Build matrix (desktop)

Six target triples, each producing a Tauri bundle that is uploaded as an artifact named `desktop-<target>`:

| OS runner            | Target triple                  | Bundle outputs               |
| -------------------- | ------------------------------ | ---------------------------- |
| `macos-14`           | `x86_64-apple-darwin`          | `.dmg`, `.app.tar.gz`        |
| `macos-14`           | `aarch64-apple-darwin`         | `.dmg`, `.app.tar.gz`        |
| `windows-latest`     | `x86_64-pc-windows-msvc`       | `.msi`, `.exe`               |
| `windows-11-arm`     | `aarch64-pc-windows-msvc`      | `.msi`, `.exe`               |
| `ubuntu-22.04`       | `x86_64-unknown-linux-gnu`     | `.AppImage`, `.deb`, `.rpm`  |
| `ubuntu-22.04-arm`   | `aarch64-unknown-linux-gnu`    | `.AppImage`, `.deb`, `.rpm`  |

Each matrix leg also emits a `checksums-<target>.txt` (SHA-256) alongside its artifacts. The `github-release` job aggregates these into a single top-level `checksums.txt`.

> Note: this matrix is replicated here intentionally rather than calling `ci-desktop.yml` via `workflow_call`. Wiring `workflow_call` into `ci-desktop.yml` is out of scope for this workflow.

## Docker image

- Image: `ghcr.io/<owner>/<repo>/api`
- Tags: `{semver}`, `{major}.{minor}`, `{major}`, `latest` (via `docker/metadata-action`)
- Source semver is resolved from the most recent `api@x.y.z` (or `apps/api@x.y.z`) tag, falling back to the latest `vX.Y.Z` tag, and finally to `0.0.0-<sha>` if no tag is found.
- Auth uses the workflow's built-in `GITHUB_TOKEN` (no extra PAT needed). Permissions: `packages: write`.

## SBOM

Two CycloneDX documents are generated and attached to every release:

- `sbom-node.cdx.json` — produced by `@cyclonedx/cdxgen` over the entire pnpm workspace.
- `sbom-cargo-desktop.cdx.json` — produced by `cargo cyclonedx` against `apps/desktop/src-tauri`.

Both files are uploaded as the `sbom` artifact and re-attached to the GitHub Release.

## GitHub Release

`softprops/action-gh-release@v2` creates the release. It includes:

- All desktop binaries (`.dmg`, `.app.tar.gz`, `.msi`, `.exe`, `.AppImage`, `.deb`, `.rpm`) from every matrix leg.
- `checksums.txt` (aggregate SHA-256) and per-target `checksums-<target>.txt`.
- `sbom-node.cdx.json` and `sbom-cargo-desktop.cdx.json`.
- Auto-generated release notes (`generate_release_notes: true`).

The release tag is the most recent semver tag pointing at `HEAD` (created by `changesets/action`), falling back to the most recent `vX.Y.Z`, and finally a synthetic `v0.0.0-YYYYMMDD-<sha>` if neither is present.

## No code signing

By design this pipeline does **not** code-sign desktop binaries:

- No Apple Developer ID notarization.
- No Windows Authenticode signing.
- `TAURI_SIGNING_PRIVATE_KEY` is intentionally passed empty so Tauri's updater signing is bypassed.

End users will see the standard "unidentified developer" / SmartScreen warnings. This is acceptable for current release cadence; revisit when distribution channels demand it.

## Required secrets

| Secret           | Used by                | Purpose                                  |
| ---------------- | ---------------------- | ---------------------------------------- |
| `NPM_TOKEN`      | `changesets` job       | `npm publish --access public` for `packages/*` |
| `GITHUB_TOKEN`   | all jobs (built-in)    | Version PR, GHCR push, GitHub Release    |

No other secrets are required. `VERCEL_TOKEN` is consumed by `ci-web.yml`, not here.

## Known caveats / follow-ups

- `.changeset/config.json` currently has `"access": "restricted"`. The publish step in this workflow forces `--access public` on the CLI, but the config should be aligned (see scope notes for J3.6 — config was left untouched per instructions).
- `apps/*` packages are excluded from npm publishing via the changesets `ignore` list; the API ships as a Docker image, the desktop app as binaries, and mobile/web as their own deploy artifacts.
- The build matrix uses GitHub's hosted ARM runners (`windows-11-arm`, `ubuntu-22.04-arm`). If those runners become unavailable, fall back to cross-compilation on the x64 hosts.
- SBOMs are generated post-publish; if you need them gated _before_ publish, move the `sbom` job to run in parallel with `changesets` and have `github-release` depend on both.

## Triggering a manual release

There is no manual `workflow_dispatch` entry point — releases are always driven by merging a Version PR. To force a release without code changes, create an empty changeset:

```bash
pnpm exec changeset --empty
git add .changeset && git commit -m "chore: trigger release"
```

Push, merge the resulting Version PR, and the publish path will run.
