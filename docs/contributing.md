# Contributing

Thanks for your interest in contributing to Universal Downloader! This page covers the
repository layout, the tools we use, and the conventions we follow.

## Monorepo layout

The project is a [pnpm](https://pnpm.io) + [Turborepo](https://turbo.build/repo) monorepo:

```
universal-downloader/
├── apps/
│   ├── api/            # Node/TypeScript HTTP API (Fastify)
│   ├── web/            # Next.js / React web client
│   ├── desktop/        # Tauri shell wrapping the web build
│   └── mobile/         # React Native (Expo) client
├── packages/
│   ├── shared-types/   # OpenAPI spec + generated TS types
│   ├── extractors/     # Pluggable site adapters
│   ├── ui/             # Cross-platform UI primitives
│   └── config/         # Shared eslint / tsconfig / prettier
├── docs/               # MkDocs source (this site)
├── .github/workflows/  # CI: per-app pipelines + release + docs
├── mkdocs.yml
└── turbo.json
```

## Toolchain

| Tool       | Version pin     | Purpose                                  |
| ---------- | --------------- | ---------------------------------------- |
| Node.js    | see `.nvmrc`    | Runtime for API and web tooling          |
| pnpm       | via Corepack    | Package manager (workspaces)             |
| Turborepo  | `turbo.json`    | Task graph + remote caching              |
| Rust       | stable          | Required for the Tauri desktop build     |
| Python     | 3.11+           | Docs site (`requirements-docs.txt`)      |

Common scripts (run from the repo root):

```bash
pnpm install              # install all workspace dependencies
pnpm dev                  # run all dev servers in parallel
pnpm --filter @ud/api dev # run a single app
pnpm lint                 # eslint across the workspace
pnpm test                 # vitest / jest across packages
pnpm build                # turbo build (respects task graph)
```

## Codegen

The OpenAPI spec at `packages/shared-types/openapi.yaml` is the single source of truth for
HTTP contracts. Whenever you change it, regenerate the TypeScript types and clients:

```bash
pnpm codegen
```

This runs:

1. `openapi-typescript` → `packages/shared-types/src/openapi.d.ts`
2. The typed fetch-client builder → `packages/shared-types/src/client.ts`

CI fails if the working tree is dirty after `pnpm codegen` runs, so always commit the
generated files alongside your spec changes.

## Conventional commits

We use [Conventional Commits](https://www.conventionalcommits.org/) to drive changelogs and
release notes. Each commit message must start with a type:

```
<type>(<optional scope>): <subject>

[optional body]

[optional footer(s)]
```

Common types:

| Type       | When to use                                           |
| ---------- | ----------------------------------------------------- |
| `feat`     | A user-visible new feature                            |
| `fix`      | A bug fix                                             |
| `docs`     | Documentation-only changes                            |
| `refactor` | Code change that neither fixes a bug nor adds a feat  |
| `perf`     | Performance improvement                               |
| `test`     | Adding or updating tests                              |
| `build`    | Build system / dependency changes                     |
| `ci`       | CI config / workflow changes                          |
| `chore`    | Routine tasks, no production code change              |

Breaking changes append `!` after the type (e.g. `feat(api)!: drop /v0 endpoints`) and
include a `BREAKING CHANGE:` footer.

## Pull requests

1. Fork the repository and create a feature branch.
2. Run `pnpm lint && pnpm test && pnpm codegen` before pushing.
3. Open a PR against `main` with a clear description and linked issue.
4. CI must be green; at least one maintainer review is required.

## Code of conduct

Be respectful. We follow the
[Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
Report issues privately to the maintainers via the security contact in the repo's
`SECURITY.md`.
