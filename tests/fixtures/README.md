# Test Fixtures

This directory contains fixtures used by offline tests across the
`universal-downloader` workspace (Python and TypeScript).

## `sample.mp4` (required for some integration tests)

`sample.mp4` is **not** committed to the repository. It must be a small,
public-domain MP4 file placed here by maintainers / contributors before
running the integration test suite. Tests that depend on it will skip or
raise a clear error when it is missing (see `loaders.py` / `loaders.ts`).

A widely used public-domain option is the *Big Buck Bunny* trailer hosted
on the Internet Archive. To fetch it manually (do **not** run this in CI
or as part of automated installs):

```bash
# Run from the repo root. ~5 MB download. License: CC-BY 3.0 / public domain trailer.
curl -L -o tests/fixtures/sample.mp4 \
  "https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4"
```

If you prefer a smaller asset, any short public-domain MP4 with both an
audio and video track works (the test suite only inspects container
metadata, not content).

## Other files

| File                              | Purpose                                                   |
| --------------------------------- | --------------------------------------------------------- |
| `.gitignore`                      | Prevents accidental commits of media files.               |
| `sample.mp4.placeholder`          | Empty marker so the directory is preserved in git.        |
| `sample_metadata.json`            | Fake yt-dlp `info_dict` for offline unit tests.           |
| `loaders.py` / `loaders.ts`       | Helpers to load fixtures from Python / TS test runners.   |
| `youtube_html_snapshot.html`      | Minimal stub of a YouTube watch page.                     |
| `x_post_snapshot.json`            | Stub of an X (Twitter) post API response.                 |
| `reddit_post_snapshot.json`       | Stub of a Reddit post listing.                            |
| `facebook_post_snapshot.json`     | Stub of a Facebook post graph response.                   |

All snapshots are hand-crafted minimal stubs and contain no real user
data.
