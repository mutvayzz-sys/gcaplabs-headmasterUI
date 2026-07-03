# Headmaster architecture

Last updated: 2026-07-03
Desktop version: 0.2.26

This file is the current architecture note for the Headmaster desktop repo. Older notes in this repo may still mention HermesHQ as the backend; treat those as historical unless this file or source code says otherwise.

## Current product stack

| Product | Repo | Role |
|---|---|---|
| Headmaster Desktop | `gcaplabs-headmasterUI/` | Electron desktop client. Talks to Agent37 Cloud when provisioned; keeps a local Headmaster runtime path for app/dev/local fallback. |
| Headmaster Console | `gcaplabs-console/` | Next.js + Supabase front door and BFF. Owns user auth and desktop/iOS provisioning routes. |
| Headmaster iOS | `gcaplabs-ios/` | Swift companion client. Uses the same Agent37 runtime contract. |
| Legacy HermesHQ | `gcaplabs-hermeshq/` and vendored `hermeshq/` | Historical control plane. Do not build new backend work here unless explicitly asked. |

## Backend/runtime model

Headmaster now has one primary backend path:

1. User signs in through the Console/BFF flow.
2. Console provisions or resolves the user's existing Agent37 runtime instance.
3. Desktop receives a provision snapshot with:
   - Agent37 instance endpoint
   - bearer/forward-auth token
   - model/provider defaults
   - app settings
4. Desktop sends chat/files/session traffic to the Agent37 instance over `/v1`.

The local Headmaster runtime is intentionally retained for the app. It is not the primary cloud backend, but it remains useful for local/dev/offline/fallback work and for product surfaces that still depend on local process capabilities. Do not delete `hermesBootstrap.ts`, `applyProvisionToRuntime.ts`, or local-runtime UI just because the cloud path exists.

## Agent37 runtime contract

Agent37 instance URL shape:

```text
https://{instanceId}.agent37.app/v1/*
```

Core endpoints used by desktop:

```text
POST   /v1/responses
POST   /v1/responses/{id}/cancel
GET    /v1/responses/{id}/stream
GET    /v1/sessions
GET    /v1/sessions/{id}
PATCH  /v1/sessions/{id}
DELETE /v1/sessions/{id}
GET    /v1/files
GET    /v1/files/content?path=...
PUT    /v1/files/content?path=...
GET    /v1/health
GET    /v1/models
```

The streaming contract is the Agent37 8-event SSE shape:

```text
response.created
response.output_text.delta
response.reasoning.delta
response.tool_call.started
response.tool_call.completed
response.tool_call.failed
response.completed
response.failed
```

There is no Agent37 mid-turn interactive endpoint. If a future gateway surfaces an approval/clarify request, desktop handles it by:

1. `POST /v1/responses/{id}/cancel`
2. `POST /v1/responses` again on the same `session_id`
3. send the human decision as the new `input`

Sudo/secret prompts must not be sent as session text because Agent37 persists session history.

## Local Headmaster runtime

Local runtime is kept for the app.

Important files:

```text
packages/desktop/src/process/backend/hermesBootstrap.ts
packages/desktop/src/process/services/applyProvisionToRuntime.ts
packages/desktop/src/common/adapter/hermesChatAdapter.ts
packages/desktop/src/common/adapter/backendUrl.ts
packages/desktop/src/process/connection/connectionConfig.ts
```

Rules:

- Headmaster owns its isolated runtime under `%LOCALAPPDATA%\Headmaster\runtime`.
- The desktop should not require `hermes` on the user's PATH.
- `applyProvisionToRuntime.ts` is still valid for the local runtime path. It writes local runtime config/env/system prompt files only; it is not an Agent37 post-provision customization API.
- Agent37 per-user customization should be handled by Agent37 templates or future Agent37 features, not by pretending local file writes affect cloud instances.

## Desktop source map

```text
gcaplabs-headmasterUI/
├── packages/desktop/          # Electron main, preload, renderer, adapters
├── packages/web-cli/          # web CLI package
├── packages/web-host/         # web host package
├── hermeshq/                  # vendored legacy backend; historical/manual cleanup only
├── mastertodo.md              # current desktop todo log
├── masterlog.md               # chronological desktop work log
└── veeplan.md                 # historical beta-readiness plan; newer status notes supersede it
```

## Main desktop paths

| Path | Purpose |
|---|---|
| `packages/desktop/src/common/adapter/httpBridge.ts` | Agent37 `/v1` HTTP/SSE/files/session bridge. |
| `packages/desktop/src/common/adapter/hermesChatAdapter.ts` | Conversation adapter that maps Agent37/local runtime events into existing UI events. |
| `packages/desktop/src/common/adapter/backendUrl.ts` | Single source of truth for backend URL/runtime-mode resolution and STT availability. |
| `packages/desktop/src/process/services/agent37ProvisionService.ts` | Console/BFF provision client. |
| `packages/desktop/src/process/connection/connectionConfig.ts` | Stored Agent37/local runtime config and provision snapshot. |
| `packages/desktop/src/renderer/hooks/context/AuthContext.tsx` | Login, provision refresh, globals, bearer/token wiring. |
| `packages/desktop/src/process/backend/hermesBootstrap.ts` | Local runtime bootstrap. Kept. |
| `packages/desktop/src/process/services/applyProvisionToRuntime.ts` | Local runtime config writer. Kept for local runtime only. |

## Build and verification

```bash
bunx tsc --noEmit
bun run test
bunx electron-vite build --config packages/desktop/electron.vite.config.ts
node scripts/build-with-builder.js auto --win --dir
```

For dev/live UI testing, use:

```bash
bun run dev
```

## Current open items

- End-to-end desktop smoke against the existing provisioned Agent37 runtime. Do not create a new runtime unless explicitly asked.
- Push/release the rebased local desktop and console commits.
- Keep local runtime path, but document it as app/local fallback instead of primary cloud backend.
- Keep `applyProvisionToRuntime.ts` for local runtime only.
- Clean up vendored HermesHQ/manual historical baggage later if the owner asks.
- Future STT support remains a product/API todo; `isSttAvailable()` stays false until a real runtime endpoint exists.

## White-label rules

- User-facing product name: Headmaster.
- Internal runtime terms like `HERMES_HOME`, `hermes dashboard`, and `hermes` package names are allowed in code/env/runtime docs.
- Do not expose HermesHQ as an active backend in user-facing copy.
- Do not reintroduce AionUi/AionCore user-visible naming. GCAPCore/HeadmasterCore local sidecar concepts are allowed when they refer to actual local app capability.
