---
'@universal-downloader/api-client': patch
'@universal-downloader/core-logic': patch
'@universal-downloader/shared-types': patch
'@universal-downloader/ui': patch
---

Bootstrap tag-triggered release workflow. Patches all publishable workspace packages so changesets produces git tags that drive the desktop binary, GHCR docker image, SBOM, and GitHub Release jobs.
