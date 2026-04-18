# Storybook — `@ud/ui`

Component workbench for the universal-downloader design system.

## Run locally

```bash
pnpm --filter @ud/ui storybook
```

Opens at <http://localhost:6006>.

To produce a static build (same artifact CI deploys):

```bash
pnpm --filter @ud/ui build-storybook
# output: packages/ui/storybook-static/
```

## Configuration files

| File                              | Purpose                                          |
| --------------------------------- | ------------------------------------------------ |
| `.storybook/main.ts`              | Stories glob, framework, addons, TS docgen       |
| `.storybook/preview.tsx`          | Global decorators, parameters, backgrounds, CSS  |

Stories live next to source as `src/**/*.stories.{ts,tsx,mdx}`.

## Required addons

Currently enabled in `.storybook/main.ts`:

- `@storybook/addon-essentials` — bundles the standard set:
  - `actions` — log event handlers
  - `backgrounds` — light/dark canvas swap (configured in `preview.tsx`)
  - `controls` — auto-generated args UI (matchers configured for color/date)
  - `docs` — MDX + autodocs
  - `measure` — pixel ruler
  - `outline` — element outlines
  - `toolbars`
  - `viewport` — responsive presets

Framework: `@storybook/react-vite` (^8.3.5).

### Adding a new addon

1. `pnpm --filter @ud/ui add -D @storybook/addon-<name>`
2. Append the package id to the `addons` array in `.storybook/main.ts`.
3. Bump this list above and open a PR.

## Deployment

Automated via `.github/workflows/storybook.yml`. Triggers on `push` to `main`
when any file under `packages/ui/**` changes (or on manual `workflow_dispatch`).

The job:

1. Installs deps with pnpm 9 / Node 20 (frozen lockfile).
2. Runs `pnpm --filter @ud/ui build-storybook`.
3. Publishes the build to **Chromatic** (visual review + hosted snapshots)
   using the `CHROMATIC_PROJECT_TOKEN` repo secret.
4. Publishes the same `storybook-static/` to the **`gh-pages`** branch under
   the `/storybook/` subpath via `peaceiris/actions-gh-pages@v4` with
   `keep_files: true`, so it coexists with the mkdocs site (deployed by J4.1
   to the gh-pages root).

Public URLs after deploy:

- mkdocs:    `https://<org>.github.io/universal-downloader/`
- Storybook: `https://<org>.github.io/universal-downloader/storybook/`
- Chromatic: see project dashboard

The workflow uses `concurrency: gh-pages-deploy` (no cancel) so it serializes
with the mkdocs job and prevents `gh-pages` push races.

## Operational notes

- Do **not** commit `packages/ui/storybook-static/` — it is build output
  (already covered by the package `clean` script).
- For Chromatic secrets management and fork-PR caveats, see
  `infra/ci/storybook-notes.md`.
