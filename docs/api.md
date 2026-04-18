# API Reference

Universal Downloader exposes a versioned HTTP API described by an OpenAPI 3.1 specification.
The canonical source of truth lives in the monorepo at:

```
packages/shared-types/openapi.yaml
```

That file is consumed by the API server, the typed client SDK, and this documentation site.
Whenever the spec changes, the generated TypeScript types are regenerated via `pnpm codegen`
(see [Contributing](contributing.md)).

## Interactive explorer

The full schema is rendered below using Swagger UI. You can authorize with your API key via
the **Authorize** button and try requests directly against your configured endpoint.

<swagger-ui src="https://raw.githubusercontent.com/CT4nk3r/universal-downloader/main/packages/shared-types/openapi.yaml"/>

!!! tip "Self-hosters"
    If you are running the docs site alongside your own API, edit the `src` attribute above
    (or override this page) to point at your own `openapi.yaml`.

## Raw spec

- View the spec on GitHub:
  [`packages/shared-types/openapi.yaml`](https://github.com/CT4nk3r/universal-downloader/blob/main/packages/shared-types/openapi.yaml)
- Download the latest released spec from the
  [Releases](https://github.com/CT4nk3r/universal-downloader/releases) page.

## Versioning

The API follows semantic versioning at the path prefix level (`/v1`, `/v2`, …). Breaking
changes always bump the major prefix; non-breaking additions are released under the same
major version and reflected in the spec's `info.version`.

## Authentication

All endpoints (except `/healthz` and `/v1/extractors`) require a bearer token:

```http
Authorization: Bearer ud_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

See [Getting Started → API key setup](getting-started.md#3-api-key-setup) for how to create one.
