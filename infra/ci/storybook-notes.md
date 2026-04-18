# CI notes — Storybook / Chromatic

Workflow: `.github/workflows/storybook.yml`
Owner agent: J4.2

## Required repository secrets

| Secret name                 | Where to set                          | Used by                    |
| --------------------------- | ------------------------------------- | -------------------------- |
| `CHROMATIC_PROJECT_TOKEN`   | Settings → Secrets and variables → Actions → *Repository secrets* | `chromaui/action@v11` step in `storybook.yml` |
| `GITHUB_TOKEN`              | Provided automatically by Actions     | `peaceiris/actions-gh-pages@v4` |

To obtain the Chromatic token:

1. Sign in at <https://www.chromatic.com/> with the repo's GitHub org.
2. Create / link a project for `universal-downloader`.
3. Copy **Project token** from *Manage → Configure*.
4. Save as `CHROMATIC_PROJECT_TOKEN` (repo secret, not env).

> Project tokens are write-only credentials scoped to a single Chromatic
> project. They are safe to expose to trusted workflow contexts but **must
> not** be used in `pull_request` runs from forks (see below).

## Fork-PR caveat

The current workflow only runs on `push: branches: [main]` and
`workflow_dispatch`, so fork PRs do **not** trigger it — this is intentional:

- GitHub does **not** expose secrets (`CHROMATIC_PROJECT_TOKEN`, write-scoped
  `GITHUB_TOKEN`) to workflows triggered by `pull_request` from forks. A
  Chromatic step in such a context would either fail to authenticate or run
  with no token and skip publishing.
- Granting fork PRs access via `pull_request_target` is **not safe** here
  because the job checks out and builds untrusted code (`packages/ui/**`),
  which would let a fork exfiltrate the token or push to `gh-pages`.

### If/when fork-PR visual review is needed

Recommended pattern (do **not** enable without review):

1. Add a separate workflow that runs the build with `pull_request` (no
   secrets) and uploads `storybook-static/` as an artifact.
2. Add a second workflow on `workflow_run: completed` of the first, which
   downloads the artifact and runs Chromatic with the project token. This
   second workflow runs in the base repo's trusted context.
3. Gate the Chromatic publish with `pull_request_review` or a labeled
   trigger (`if: contains(github.event.pull_request.labels.*.name, 'chromatic-ok')`)
   so a maintainer must opt-in per PR.

Until that pattern is in place, fork contributors will see Chromatic
diffs only after a maintainer pushes the branch into the base repo.

## gh-pages coexistence with mkdocs (J4.1)

- Both workflows publish to the `gh-pages` branch.
- `storybook.yml` uses `destination_dir: storybook` + `keep_files: true`,
  so it writes only under `/storybook/` and preserves mkdocs files at the
  root.
- A shared `concurrency: gh-pages-deploy` group (cancel-in-progress: false)
  serializes the two jobs to avoid `git push` races on `gh-pages`. J4.1's
  workflow should adopt the same group name; if it does not, races are
  rare but possible — re-run the losing job to recover.

## Local reproduction

```bash
pnpm install --frozen-lockfile
pnpm --filter @ud/ui build-storybook
# Optional: publish to Chromatic from a maintainer machine
CHROMATIC_PROJECT_TOKEN=xxxx \
  pnpm --filter @ud/ui dlx chromatic --project-token=$CHROMATIC_PROJECT_TOKEN
```
