# @ud/e2e-web

End-to-end browser tests for `apps/web`, the Universal Downloader web UI.

## Stack

- **Playwright** with three projects: `chromium`, `firefox`, `webkit`.
- **MSW** as a dependency for handler descriptors (`fixtures/api-mock.ts` exports
  `handlers` for direct MSW use), but specs install mocks via `page.route()` so
  the same setup works across all three browser engines without a service
  worker.

## Layout

```
tests/e2e-web/
  playwright.config.ts      # browsers, baseURL, retries, traces
  fixtures/
    api-mock.ts             # installApiMocks(page), seedSettings(page), MSW handlers
  specs/
    onboarding.spec.ts      # API key gate + saving a key
    queue.spec.ts           # paste → preset → enqueue → progress → done
    history.spec.ts         # search, filter, redownload
    settings.spec.ts        # endpoint URL change persists
```

## Running

```sh
# from this directory
pnpm install              # one-time, installs @playwright/test + msw
pnpm exec playwright install   # browsers
WEB_BASE_URL=http://localhost:5173 pnpm test
```

`baseURL` defaults to `http://localhost:5173` (Vite dev server). Override with
the `WEB_BASE_URL` env var to point at a deployed preview or a different port.

The dev server must already be running — this package intentionally does not
declare a `webServer` config so CI can choose how to bring the app up
(`pnpm --filter @universal-downloader/web dev`, a built preview, etc.).

## How mocking works

`installApiMocks(page, opts?)` registers a `page.route()` handler against the
configured API origin (default `http://localhost:8787`, prefix `/v1`) and
serves canned responses for:

| Method | Path                       | Notes                                     |
| ------ | -------------------------- | ----------------------------------------- |
| GET    | `/v1/healthz`              | `{ ok: true }`                            |
| GET    | `/v1/jobs`                 | In-memory list, mutable via returned API  |
| GET    | `/v1/files`                | In-memory list                            |
| POST   | `/v1/probe`                | Returns the YouTube fixture by default    |
| POST   | `/v1/jobs`                 | Creates a `queued` job, prepends to list  |
| DELETE | `/v1/jobs/:id`             | Removes from in-memory list               |
| GET    | `/v1/jobs/:id/events`      | SSE stream, configurable per job id       |

`seedSettings(page, partial?)` writes a fully populated `ud-settings` record
into `localStorage` before the app boots, satisfying the API key gate and
pointing the app at the mocked origin.

## Selectors policy & data-testid requests

Specs prefer accessible selectors (`getByRole`, `getByLabel`, visible text)
over CSS or `data-testid`, since the app already exposes good roles, labels,
and `aria-*` attributes. **No `data-testid` attributes were added to the app
during J2.3.**

If future changes make the existing selectors brittle, the following
attributes would harden the suite — consider adding them in
`apps/web/src/`:

| Component / file                                  | Suggested `data-testid`             | Why                                                    |
| ------------------------------------------------- | ----------------------------------- | ------------------------------------------------------ |
| `components/api-key-gate.tsx` (root `<div>`)      | `data-testid="api-key-gate"`        | Disambiguate when multiple alerts coexist on a page.   |
| `components/url-input.tsx` (`<form>` root)        | `data-testid="url-input-form"`      | Scope queries when multiple inputs share `type=url`.   |
| `components/queue-panel.tsx` (`<section>` root)   | `data-testid="queue-panel"`         | Easier scoping than `getByRole('region', { name })`.   |
| `components/job-row.tsx` (root `<li>`)            | `data-testid="job-row"` + `data-job-id={job.id}` | Per-row targeting without relying on text. |
| `screens/history.tsx` (root `<div>` and each row) | `data-testid="history-screen"` / `history-row` | Stable hooks for search/filter assertions.    |
| `screens/settings.tsx` (each `<section>`)         | `data-testid="settings-section-api"`, `…-defaults`, `…-appearance` | Section-scoped queries. |
| `components/format-picker.tsx` (preset chips)     | `data-testid="preset-chip"` + `data-preset={c.id}` | Click presets without relying on label text.     |
| `screens/home.tsx` ("Download" submit button)     | `data-testid="enqueue-button"`      | Distinguish from the Re-download button on History.    |

Until those are added, specs use:

- `getByRole('heading', { name: /api key required/i })` for the gate
- `getByLabel(/video url/i)` and `getByRole('button', { name: 'Probe' })`
- `getByRole('radio', { name: /1080p mp4/i })` for preset selection
- `getByRole('region', { name: /active downloads/i })` for the queue
- `getByRole('searchbox')` on History
- `getByLabel(/api base url|api key|default preset/i)` on Settings
- `getByRole('radiogroup', { name: /theme/i })` for the theme switcher

## Notes / caveats

- The "Paste" button uses the Clipboard API which is gated/permission-dependent
  in headless browsers. Specs type into the URL field directly instead.
- SSE responses are returned as a single multi-frame body. That is sufficient
  for the UI's `useJobEvents` consumer to advance progress in test runs;
  long-lived streaming is not required to assert on the "done card".
- The default mock origin is `http://localhost:8787` with prefix `/v1` to match
  `VITE_DEFAULT_API_URL` from `apps/web/src/lib/settings-store.ts`. Override
  via `installApiMocks(page, { apiOrigin, apiPrefix })` if your environment
  differs.
