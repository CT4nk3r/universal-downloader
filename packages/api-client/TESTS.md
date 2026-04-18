# api-client package — test harness

This document lists the `package.json` deltas required to run the tests
under `src/__tests__/` and the new `vitest.config.ts`. **Not applied
automatically** — agent J2.7 is forbidden from modifying `package.json`.

## Scripts

Replace the placeholder `test` script:

```jsonc
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

(Currently it is `"echo \"(no tests)\""`.)

## devDependencies to add

```jsonc
{
  "devDependencies": {
    "vitest": "^2.1.2"
  }
}
```

No DOM/jsdom deps needed — the api-client suite runs under the `node`
Vitest environment (see `vitest.config.ts`). `openapi-fetch` is already a
runtime `dependency`.

## Test layout

```
packages/api-client/
  vitest.config.ts                      # node env
  src/__tests__/
    client.test.ts                      # mock fetch; verify openapi-fetch wiring + Bearer auth
    sse.test.ts                         # ReadableStream mock; verify JobEvent oneOf parsing
```

## What the tests cover

`client.test.ts`
- `createApiClient` returns a usable `openapi-fetch` client (GET/POST/DELETE/use).
- Every request hits `${baseUrl}${path}` exactly.
- The auth middleware sets `Authorization: Bearer <apiKey>` on GET and POST.
- Non-2xx responses surface as `{ error }` (not throws).
- Falls back to `globalThis.fetch` when `opts.fetch` is omitted.

`sse.test.ts`
- Calls `${baseUrl}/jobs/{id}/events` with `Authorization` + `Accept: text/event-stream`.
- Strips a single trailing slash from `baseUrl`.
- Decodes each `JobEvent` discriminator (`progress`, `status`, `done`, `error`),
  including chunks split mid-frame.
- Ignores non-`data:` lines (e.g. `event:` and `:` comments).
- Reports JSON parse failures via `onError` without throwing.
- Reports HTTP failure (status != ok / no body) via `onError`.
- The unsubscribe function aborts the underlying request via `AbortController`.

## Note on generated types

Tests call client verbs through `as any` casts to avoid coupling to whichever
revision of `src/generated/schema.ts` is checked in. The runtime contract
(URL composition + headers + response shape) is what we assert.
