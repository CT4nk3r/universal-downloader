#!/usr/bin/env bash
# Create a single aggregate `vX.Y.Z` git tag for the current release.
#
# Invoked by the changesets/action `publish` input after a Version PR
# is merged into main. The tag drives the downstream release jobs
# (desktop binaries, GHCR docker, SBOM, GitHub Release) via the
# `release.yml` tag trigger.
#
# Guard: only tag when HEAD actually bumped package versions so that
# ordinary main-branch pushes don't create phantom tags. This works
# across squash / rebase / merge strategies because the Version PR
# always modifies `packages/*/package.json`.
#
# The version is read from `packages/shared-types/package.json`. The
# `linked` config in `.changeset/config.json` keeps all publishable
# packages at the same version, so any of them is a valid source of
# truth.
set -euo pipefail

if ! git diff-tree --no-commit-id --name-only -r HEAD \
  | grep -qE '^packages/.*/package\.json$'; then
  echo "HEAD did not modify packages/*/package.json; skipping tag."
  exit 0
fi

version=$(node -p "require('./packages/shared-types/package.json').version")
tag="v${version}"

if git rev-parse "refs/tags/${tag}" >/dev/null 2>&1; then
  echo "Tag ${tag} already exists, nothing to do."
  exit 0
fi

git tag -a "${tag}" -m "Release ${tag}"
echo "Created tag ${tag}"
