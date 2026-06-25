# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

Use **bun** exclusively. Never use npm, yarn, or pnpm.

## Commands

```bash
bun run dev               # Electron dev server with Vite HMR
bun run test              # Run all Vitest tests
bun run test:e2e          # Playwright E2E tests (Electron)
bun run lint              # oxlint check
bun run lint:fix          # oxlint auto-fix
bun run format            # oxfmt format all files
bun run format:check      # oxfmt dry-run check
bunx tsc --noEmit         # TypeScript type check (no emit)
just push                 # Full pipeline: lint → format → tsc → test → push
```

Single test: `bunx vitest run tests/unit/path/to/file.test.ts`

Quick portable build: `node scripts/build-with-builder.js auto --win --dir`
Full release build: `node scripts/build-with-builder.js auto --win`

## Monorepo Structure

`packages/desktop/` is the only real application package. The root workspace holds shared config (tsconfig, vitest, uno). New code goes under `packages/desktop/src/`, not the root.

```
packages/desktop/src/
  renderer/   # React UI — no Node.js, no Electron APIs
  process/    # Electron main process, services, IPC handlers
  preload/    # IPC bridge / context bridge
  common/     # Shared cross-process types and utilities
```

`packages/desktop/package.json` is a placeholder (version always `0.0.0`). The authoritative version is in the root `package.json`.

## Process Boundary Rules

- **Renderer** (`src/renderer/`) cannot import `fs`, `path`, or any Electron API directly — use IPC via preload
- **Main process** (`src/process/`) cannot use DOM APIs
- All IPC goes through explicit handlers registered in `process/bridge/`

## Import Aliases

```ts
@/*          → packages/desktop/src/
@process/*   → packages/desktop/src/process/
@renderer/*  → packages/desktop/src/renderer/
@worker/*    → packages/desktop/src/worker/
```

## Testing

Tests split by environment:

- `*.test.ts` — Node environment (default Vitest project)
- `*.dom.test.ts` — jsdom environment

E2E tests share a single Electron instance: do not increase worker count above 1.

## Code Style

- **Prettier config**: printWidth 120, 2-space indent, single quotes, trailing commas (es5), semicolons, LF line endings, JSX single quotes
- **Lint rule**: `no-floating-promises` is an error — always `await` or handle promises
- **Imports**: use `import type` for type-only imports (`consistent-type-imports` is enforced)
- `_`-prefixed variables are exempt from `no-unused-vars`

## Branding

This is the **Headmaster** white-label of AionUi. Never ship these names in UI-facing strings:

| Banned                 | Use instead                                       |
| ---------------------- | ------------------------------------------------- |
| Hermes                 | (runtime only — CLI/env vars keep `hermes` names) |
| AionUi / Nous / Cowork | —                                                 |
| Team                   | The Council / Specialists                         |
| Agents                 | Specialists                                       |

Do **not** rename: env vars (`HERMES_HOME`, `HERMES_DESKTOP_*`), the `hermes-media://` protocol, gateway ports, or CLI commands like `hermes dashboard`. See `docs/white-label/` for the full audit.
