# GCAP Labs Architecture

> Single source of truth for how the Headmaster product stack is wired. Read this before touching any repo.

## Products (3)

| Product                | Stack                                            | Repo                                   | Deploy Target              | Dev Machine         |
| ---------------------- | ------------------------------------------------ | -------------------------------------- | -------------------------- | ------------------- |
| **Headmaster Desktop** | Electron + Vite + React + TypeScript             | `gcaplabs-headmasterUI/`               | Windows/Mac/Linux desktops | Windows (Matve)     |
| **Headmaster iOS**     | Swift + SwiftUI                                  | `gcaplabs-iOS/`                        | App Store (TestFlight)     | Mac (Xcode)         |
| **HermesHQ**           | FastAPI + SQLAlchemy 2.0 + PostgreSQL + React 19 | `hermeshq/` (vendored in headmasterUI) | Docker on Mac Mini         | Mac Mini (mattywow) |

**HermesHQ lives at:** `https://hermeshq.gcaplabs.com`
**Headmaster Honcho (self-hosted):** `https://honcho-headmaster.gcaplabs.com` — separate from personal Honcho
**OpenConcho dashboard:** `https://memory.gcaplabs.com`

---

## Headmaster Desktop

### Structure

```
gcaplabs-headmasterUI/
├── packages/desktop/          # Electron app (main + renderer + preload)
│   ├── src/main/              # Electron main process (Node)
│   ├── src/renderer/          # React app (Chromium)
│   ├── src/preload/           # contextBridge APIs
│   └── src/process/           # Connection config, Hermes bootstrap
├── hermeshq/                  # Vendored backend for co-editing (no .git)
│   ├── backend/               # FastAPI + SQLAlchemy
│   └── frontend/              # React 19 admin dashboard
└── AGENTS.md                  # Repo orientation for AI agents
```

### Key Concepts

- **Provision modes:** `headmaster_local` (full local runtime), `headmaster_remote` (cloud container), `headmaster_plus_thin` (thin client)
- **Auth:** HermesHQ JWT (desktop) or cookie session (web). One account, multiple clients.
- **Runtime:** Hermes Python agent (`hermes dashboard`) spawned by Electron. Falls back to legacy `aioncore` if missing.
- **Model/Provider source:** HermesHQ's `ProviderDefinition` table → provision response → desktop model selector. NOT local `.env` keys.
- **Settings:** Local settings (system, appearance) + HermesHQ settings (model, provider, branding) unified via provision response.

### Build

```bash
bunx tsc --noEmit                          # Typecheck
bunx electron-vite build --config packages/desktop/electron.vite.config.ts
node scripts/build-with-builder.js auto --win --dir   # Portable exe
```

### Test

```bash
bun run dev                                 # Dev mode (spawns Electron + Vite)
bunx vitest run                             # Unit tests
```

---

## HermesHQ (Backend)

### Structure

```
hermeshq/
├── backend/
│   ├── hermeshq/
│   │   ├── main.py              # FastAPI app factory
│   │   ├── routers/
│   │   │   ├── desktop_runtime.py   # POST /api/desktop/provision
│   │   │   ├── settings.py          # GET/PUT /api/settings
│   │   │   ├── auth.py              # Login, refresh, MFA
│   │   │   └── ...
│   │   ├── models/
│   │   │   ├── app_settings.py      # Admin config (theme, branding, defaults)
│   │   │   ├── provider.py          # ProviderDefinition (catalog)
│   │   │   ├── agent.py             # Agent config (model, provider, system prompt)
│   │   │   └── agent_assignment.py  # Links users to agents
│   │   └── services/
│   │       ├── desktop_runtime.py   # _build_provision_response()
│   │       └── provider_catalog.py  # Provider catalog queries
│   └── alembic/                 # DB migrations
└── frontend/                    # React 19 admin dashboard (Vite)
```

### Key Endpoints

- `POST /api/desktop/provision` — Desktop client handshake. Returns: mode, user, providers[], default_model, app_settings, honcho config, runtime validation URL.
- `GET /api/settings` — Full admin settings (requires auth).
- `GET /api/settings/public` — Public branding (no auth): app_name, theme, logo.
- `GET /api/model/options` — Local runtime endpoint (legacy, only sees local .env keys).

### Deploy

```bash
# On Mac Mini (mattywow)
cd /Users/mattywow/gcaplabs-hermeshq
git pull origin main
docker compose up --build -d backend
```

### Dev (Windows)

```bash
# Edit in gcaplabs-headmasterUI/hermeshq/ (vendored copy)
# Push from original repo:
cd C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-hermeshq
git push origin main
# Then rebuild on Mac Mini
```

---

## Headmaster iOS

### Status

In development. Shares the same HermesHQ backend and Honcho memory instance.

### Key Concepts

- Same JWT auth as desktop (HermesHQ)
- Same provision response format
- Cross-device session namespace (shared conversations via `session_namespace`)
- Capability gating (admin controls which features are available per user)

---

## Data Flow

### Desktop Login → Model Selection

```
1. User logs in (admin/admin123)
2. AuthContext calls provisionDesktopSession()
3. POST /api/desktop/provision
4. HermesHQ returns:
   - user: { id, username, role }
   - providers: [ { slug, name, runtime_provider, base_url, available_models } ]
   - default_model: "kimi-k2.5"
   - default_provider: "kimi-coding"
   - app_settings: { app_name, theme_mode, logo_url }
   - honcho_base_url, honcho_api_key
5. Desktop stores on window.__hermeshqProvision
6. useModelProviderList reads providers from provision (not local /api/model/options)
7. Model selector populates with HermesHQ catalog
8. New conversations default to admin-assigned model
```

### Settings Unification

```
HermesHQ (admin sets)          Desktop (displays)
─────────────────────          ──────────────────
AppSettings.app_name     →     Window title, About page
AppSettings.theme_mode   →     Dark/light mode default
AppSettings.logo_url     →     Logo in UI
AppSettings.default_model →    Model selector default
ProviderDefinition rows  →     Available providers list
Agent.system_prompt      →     System prompt override
```

Local-only settings (desktop-specific):

- Start on boot, close to tray, GPU status
- Language (per-device override)
- Notification preferences
- Directory paths (downloads, workspace)

---

## Infrastructure

### Mac Mini (Foggy/TARS brain)

- **HermesHQ:** `https://hermeshq.gcaplabs.com` (Docker, port 3420 via nginx)
- **Headmaster Honcho:** `https://honcho-headmaster.gcaplabs.com` (Docker, port 8010)
- **OpenConcho:** `https://memory.gcaplabs.com` (Docker, port 8089)
- **Cloudflare Tunnel:** Routes `*.gcaplabs.com` to Mac Mini

### Windows (Matve)

- **Dev:** `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-headmasterUI`
- **Hermes config:** `C:\Users\Matve\AppData\Local\hermes\config.yaml`
- **Headmaster data:** `%APPDATA%\Headmaster-Dev\headmaster\`

### Honcho Memory

- **Personal:** `https://honcho.gcaplabs.com` (general use)
- **Headmaster:** `https://honcho-headmaster.gcaplabs.com` (product-specific, self-hosted)
- Both are OpenConcho instances with proxy allowlist

---

## Auth & Identity

- **One account, multiple clients.** Sign up on gcaplabs-console → admin approves → assigned to Hermes/Headmaster instance.
- **JWT for desktop:** Stored in Electron secure storage, refreshed via `/api/auth/refresh`.
- **Cookie session for web:** Standard FastAPI session.
- **Roles:** admin, school_admin, beta_user, user, student, staff.

---

## Key Files for Agents

| File                                                          | What it is                               | When to read it                  |
| ------------------------------------------------------------- | ---------------------------------------- | -------------------------------- |
| `AGENTS.md`                                                   | Repo orientation map                     | First thing every session        |
| `masterlog.md` (at `GCAP-Labs/`)                              | Chronological work log + version history | Before claiming something exists |
| `mastertodo.md` (at `GCAP-Labs/`)                             | Cross-product outstanding work           | Before starting new work         |
| `CLAUDE.md` (in hermeshq/)                                    | HermesHQ-specific guidance               | When editing backend             |
| `packages/desktop/src/process/connection/connectionConfig.ts` | Desktop-HermesHQ connection logic        | When fixing connection issues    |
| `packages/desktop/src/renderer/hooks/context/AuthContext.tsx` | Auth flow, provision, token refresh      | When auth is broken              |
| `hermeshq/backend/hermeshq/services/desktop_runtime.py`       | Provision response builder               | When adding provision fields     |
| `hermeshq/backend/hermeshq/routers/desktop_runtime.py`        | Provision endpoint                       | When changing provision API      |

---

## White-Label Rules

- **Hermes** = internal codename. Allowed in: env vars, Python package names, CLI commands.
- **Headmaster** = user-facing brand. Use in all UI strings, window titles, marketing.
- Never expose "Hermes Agent" or "AionUi" to users.
- Never frame as "Hermes is the engine, Headmaster is the white-label." They are the same product.

---

## Common Issues

| Issue                                                 | Cause                                                     | Fix                                                                |
| ----------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------ |
| "Cannot assign to read-only property '\_backendPort'" | `contextBridge.exposeInMainWorld` made property read-only | Remove exposure from preload, use `Object.defineProperty` fallback |
| "Preparing your workspace…" forever                   | Auto-login disabled without `setReady(true)`              | Set `ready = true` in AuthContext mount effect                     |
| Model selector empty                                  | `useProvidersQuery` fetches before dashboard ready        | Listen for `hermes:runtime-changed` and re-fetch                   |
| Settings fail to load                                 | Local runtime doesn't have config                         | Read from HermesHQ provision response instead                      |
| WS connection to 9119 fails                           | Fallback port, no runtime listening                       | Port guards in httpBridge.ts                                       |

---

## Version

Last updated: 2026-06-26
Headmaster Desktop: v0.2.2
HermesHQ: v0.2.2

---

## Findings from Hermes Official Docs

> Read 2026-06-26. Sources listed at the end of this section. These directly inform how Headmaster Desktop wires to the Hermes runtime.

### 1. API Server (port 8642) — OpenAI-compatible HTTP endpoint

Hermes exposes a full OpenAI-compatible HTTP API when `API_SERVER_ENABLED=true`. This is **distinct from the dashboard (9119)** and is what Open WebUI, LobeChat, etc. connect to.

```
API_SERVER_ENABLED=true          # in .env
API_SERVER_KEY=<bearer-token>    # required
API_SERVER_HOST=127.0.0.1        # or 0.0.0.0 for remote access
API_SERVER_PORT=8642             # default
```

Key endpoints:

- `POST /v1/chat/completions` — OpenAI-compatible, stateless, full conversation per request
- `POST /v1/responses` — Stateful via `previous_response_id` or named `conversation`
- `POST /v1/runs` → `GET /v1/runs/{id}/events` — Async SSE streaming (create run, poll events)
- `GET /v1/models` — Lists model as profile name or `API_SERVER_MODEL_NAME`
- `GET /v1/capabilities` — Machine-readable API surface
- `GET /api/sessions/{id}/chat/stream` — SSE per-session chat with `assistant.delta`, `tool.started`, `tool.completed` events
- `X-Hermes-Session-Key` header — Long-term memory scope independent of transcript

**Relevant for Headmaster:** The desktop currently calls the **gateway WebSocket** (port 9119 `/api/ws`). An alternative is calling the **API server** directly over HTTP/SSE at port 8642 — simpler, no WebSocket state management, and the Runs API gives async event streaming that maps cleanly onto the existing `responseStream` pattern.

### 2. Proxy Mode — GATEWAY_PROXY_URL (most important finding for chat fix)

**Any** platform adapter can run in proxy mode. Set `GATEWAY_PROXY_URL` on the local gateway and it forwards all messages to a remote agent API server instead of running a local agent. This is **not limited to Matrix**.

```bash
# On the Headmaster isolated runtime (.env):
GATEWAY_PROXY_URL=https://hermeshq.gcaplabs.com/hermes-api   # or wherever the remote agent runs
GATEWAY_PROXY_KEY=<api_server_key>

# On the remote agent host (the Mac Mini or HermesHQ server):
API_SERVER_ENABLED=true
API_SERVER_KEY=<api_server_key>
API_SERVER_HOST=0.0.0.0
```

With this setup, the local Headmaster Hermes runtime needs **zero model configuration** — it has no API keys, no `config.yaml` model section. It's a thin proxy. All LLM calls, tool execution, memory, and session state live on the remote agent. This completely bypasses the "local runtime doesn't have API keys" problem.

**Architecture with proxy mode:**

```
Headmaster Desktop (Electron)
  ↓ WS 9119
Local Hermes Gateway (Headmaster runtime, no LLM config needed)
  ↓ HTTP GATEWAY_PROXY_URL
Remote Hermes API Server (Mac Mini or dedicated host)
  ↓
AIAgent + LLM credentials + memory + skills
```

**To implement:** Write `GATEWAY_PROXY_URL` and `GATEWAY_PROXY_KEY` into `%LOCALAPPDATA%\Headmaster\runtime\.env` from `applyProvisionToRuntime` when provision returns a `hermes_api_url` field (needs new HermesHQ field). OR add as a static admin config in `HERMES_DESKTOP_REMOTE_URL`.

### 3. Dashboard Architecture (port 9119)

`hermes dashboard` is a FastAPI + React app at `http://127.0.0.1:9119`. It is where:

- The gateway is started/stopped
- The WebSocket `/api/ws` lives (what `hermesChatAdapter.ts` connects to)
- The `/api/pty` WebSocket runs embedded TUI chat via xterm.js
- Profile-scoped API calls use `?profile=<name>` query param

The dashboard frontend is built from `hermes_cli/web_dist/`. It runs the full agent via a pseudo-terminal for the embedded chat view.

**Auth for non-loopback:** Supports Nous OAuth, username/password (bcrypt), or OIDC. The `HERMES_DESKTOP_REMOTE_URL` env var lets Electron attach to a **remote** dashboard instead of spawning a local one.

### 4. Platform Adapter Plugin System

New messaging platforms can be added as plugins in `~/.hermes/plugins/<name>/` without touching core code. Two files: `plugin.yaml` (metadata + env var declarations) + `adapter.py` (implements `BasePlatformAdapter`).

The adapter must implement `connect()`, `disconnect()`, `send()`. Inbound messages call `self.handle_message(event)`. Cron delivery, user allowlists, token locking, and auto-config from env vars are all handled automatically by registering via `ctx.register_platform()`.

**Relevant for Headmaster:** A native Headmaster platform adapter plugin could be shipped alongside the desktop app, giving tighter integration (typing indicators, read receipts, rich formatting) vs. the current generic gateway WebSocket approach.

### 5. Dashboard UI Plugin System

The dashboard supports three customization layers without forking:

- **Themes** — YAML files in `~/.hermes/dashboard-themes/`: palette, typography, layout, component chrome, raw CSS
- **UI Plugins** — IIFE JS bundles in `~/.hermes/plugins/<name>/dashboard/`: add tabs, inject into shell slots (header, sidebar, footer), replace built-in pages. Access React + shadcn/ui components via `window.__HERMES_PLUGIN_SDK__`
- **Backend Plugins** — `plugin_api.py` in the plugin folder mounts FastAPI routes at `/api/plugins/<name>/`

Shell slots: `backdrop`, `header-left`, `header-right`, `header-banner`, `sidebar`, `pre-main`, `post-main`, `footer-left`, `footer-right`, `overlay`. Page slots: `sessions:top/bottom`, `analytics:top/bottom`, `config:top/bottom`, etc.

**Relevant for Headmaster:** White-label the dashboard UI via a theme + slot-only plugin (header-left crest, header-right branding). Ship the plugin as part of `applyProvisionToRuntime` — write `~/.hermes/plugins/headmaster-branding/` on provision.

### 6. Open WebUI Integration

Open WebUI connects to Hermes via the API server (`/v1/chat/completions`). The Hermes side creates a full `AIAgent` per request — tool execution happens server-side. No CORS config needed for server-to-server.

```bash
OPENAI_API_BASE_URL=http://host.docker.internal:8642/v1
OPENAI_API_KEY=<api_server_key>
ENABLE_OLLAMA_API=false
```

The Headmaster desktop chat view is essentially a first-party Open WebUI equivalent — it talks the same protocol, but embedded in Electron.

### 7. Configuration Precedence

```
CLI flags > config.yaml > .env > built-in defaults
```

`hermes config set KEY VALUE` auto-routes: API keys → `.env`, everything else → `config.yaml`.

`model.provider` = `"auto"` means auto-detect from credentials in `.env`. If no matching API key env var is set, the provider call fails silently. This is why chat broke: the Headmaster runtime had `provider: auto` with no API keys in `.env`.

The fix: write explicit `provider` + `base_url` from provision (done in `applyProvisionToRuntime`), OR use proxy mode to skip local LLM config entirely.

### 8. Session Storage

SQLite with FTS5. Sessions persist in `~/.hermes/sessions/`. Gateway uses `X-Hermes-Session-Id` header to track sessions across turns. `X-Hermes-Session-Key` scopes long-term Honcho memory per channel/user independently of transcript rotation.

---

### 9. Upstream hermes-desktop v0.5.9 — Transport Architecture

Read from `C:\Users\Matve\Desktop\GCAP-Labs\_support\upstream\hermes-desktop` (commit `a60b518`). Key differences from current Headmaster implementation:

**Capability probe on startup** — upstream hits `GET /v1/capabilities` before every chat session to choose transport:

```typescript
const caps = await getApiCapabilities(profile);
if (supportsHermesRunsTransport(caps)) {
  // Use Runs API (preferred)
  POST /v1/runs → SSE GET /v1/runs/{run_id}/events
} else {
  // Fallback: gateway WebSocket JSON-RPC
  ws://localhost:{port}/api/ws  (port range 9120-9199, NOT 9119)
}
```

`supportsHermesRunsTransport()` requires: `run_submission`, `run_events_sse`, `run_stop`, `run_approval_response`, `tool_progress_events` all true AND endpoint paths match.

**Runs API SSE events** (from `run-stream.ts`):

- `event: tool.started` / `tool.completed` / `tool.failed` — tool progress with `tool`, `preview` fields
- `event: reasoning.available` — reasoning/thinking text with `text`/`delta` fields
- `event: run.completed` — with `usage.input_tokens`, `usage.output_tokens`
- `event: assistant.delta` — token stream chunks
- Error handled via `event: run.error`

**Gateway WS JSON-RPC** (from `tui-gateway-stream.ts`, same protocol our `hermesChatAdapter.ts` uses):

- Send: `{id, jsonrpc: "2.0", method: "session.create"|"session.resume"|"prompt.submit", params}`
- Receive: events via `params` field of incoming frames

**Dashboard gateway port:** 9120–9199 range (NOT 9119 — 9119 is the dashboard HTTP server itself). The WS path is `ws://127.0.0.1:{port}/api/ws`. **This matters**: Headmaster may be connecting to the wrong port.

**Current Headmaster gap:** `hermesChatAdapter.ts` always uses gateway WS (no capability probe, no Runs API fallback). The Runs API path is cleaner for Headmaster since it's pure HTTP/SSE with no persistent WS state.

---

### 10. Nous Portal — Models + Tools (Best Implementation)

**What it covers:** 300+ inference models via the Nous Portal inference API, plus the Tool Gateway (web search via Firecrawl, image generation, TTS, cloud browser). A single `NOUS_API_KEY` covers both.

**Non-interactive setup** (no `hermes setup --portal` wizard needed):

```bash
# .env
NOUS_API_KEY=<your-portal-api-key>

# config.yaml
model:
  provider: nous-api
  default: <preferred-model>
  base_url: https://inference-api.nousresearch.com/v1

web:
  use_gateway: true        # routes web search through Tool Gateway
image_gen:
  use_gateway: true        # routes image gen through Tool Gateway
```

The `NOUS_API_KEY` is the only credential needed — it authenticates both inference API calls and Tool Gateway tool calls.

**Best implementation for Headmaster (admin subscription covers all users):**

HermesHQ injects the admin's `NOUS_API_KEY` into every Hermes container it spawns. One key, all users. Cost visible on admin's Nous account. Per-user tracking available via the `X-Hermes-Session-Key` header which is already passed through.

**Changes needed:**

1. **HermesHQ settings** — add `NOUS_API_KEY` as an admin secret (stored in org settings table, encrypted at rest)

2. **`container_supervisor.py`** — inject into container env:

   ```python
   env_vars = {
       "HERMES_MODE": "headmaster_remote",
       "HERMES_HQ_URL": hq_url,
       "USER_ID": container.user_id,
       "NOUS_API_KEY": settings.nous_api_key or "",      # ← add
       "NOUS_TOOL_GATEWAY": "true",                       # ← add
   }
   ```

3. **`applyProvisionToRuntime.ts`** — write to Headmaster runtime `.env` when provision returns `nous_api_key`:

   ```typescript
   if (provision.nous_api_key) {
     patchEnvFile(join(hermesHome, '.env'), {
       NOUS_API_KEY: provision.nous_api_key,
     });
   }
   ```

   And write to `config.yaml`:

   ```yaml
   web:
     use_gateway: true
   image_gen:
     use_gateway: true
   ```

4. **HermesHQ provision response** — add `nous_api_key` field (only if admin has configured it; omit/null otherwise)

5. **`connectionConfig.ts`** — add `nous_api_key?: string | null` to `HermeshqProvisionSnapshot`

**Result:** After admin sets `NOUS_API_KEY` in HermesHQ settings, every user's Hermes runtime (local and cloud container) automatically gets:

- 300+ models available under `model.provider: nous-api`
- Web search, image gen, TTS, browser tools via Tool Gateway — no separate API keys for any of these

---

### 11. HermesHQ Container Architecture (headmaster_remote mode)

From `hermeshq/backend/hermeshq/services/container_supervisor.py`:

- Each user gets one Docker container: `hermes-{user_id[:8]}-{uuid[:8]}`
- Image: `hermes:latest` (needs to be built with API server enabled)
- Container port 8080 → ephemeral host port (Docker assigns)
- `health_check_url` = `http://localhost:{ephemeral_port}/health` — this IS the API server endpoint
- Desktop provision response includes `cloud_container_config.endpoint_url` pointing at this port
- Desktop connects to endpoint URL in "remote" mode (Bearer token auth, no local process)

**Current gaps in container setup:**

- Only 3 env vars injected: `HERMES_MODE`, `HERMES_HQ_URL`, `USER_ID`
- Missing: `API_SERVER_ENABLED=true`, `API_SERVER_KEY`, `NOUS_API_KEY`, model config
- The container image needs `[web,pty]` extras installed
- `API_SERVER_HOST=0.0.0.0` required inside container (default is loopback-only)

**Minimum viable container env:**

```python
env_vars = {
    "HERMES_MODE": "headmaster_remote",
    "HERMES_HQ_URL": hq_url,
    "USER_ID": container.user_id,
    "API_SERVER_ENABLED": "true",
    "API_SERVER_KEY": generate_per_container_secret(),
    "API_SERVER_HOST": "0.0.0.0",
    "API_SERVER_PORT": "8080",
    "NOUS_API_KEY": settings.nous_api_key,
}
```

The `API_SERVER_KEY` must be returned to the desktop in the provision response so it can auth against the container's API server.

---

### Doc Sources

| URL                                                                                             | What it covers                                                        |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| https://hermes-agent.nousresearch.com/docs/developer-guide/adding-platform-adapters             | Plugin-based platform adapter system, how to write adapters           |
| https://hermes-agent.nousresearch.com/docs/user-guide/configuration#docker-backend              | Config file structure, docker backend, model config, precedence       |
| https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard                    | Dashboard (port 9119), all REST endpoints, auth, profile scoping      |
| https://hermes-agent.nousresearch.com/docs/user-guide/features/extending-the-dashboard          | Theme + UI plugin + backend plugin system                             |
| https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server                       | API server (port 8642), OpenAI-compat endpoints, Runs API, proxy mode |
| https://hermes-agent.nousresearch.com/docs/user-guide/messaging/matrix#proxy-mode-e2ee-on-macos | GATEWAY_PROXY_URL — works for ANY adapter, not just Matrix            |
| https://hermes-agent.nousresearch.com/docs/user-guide/messaging/open-webui                      | Open WebUI ↔ Hermes API server integration                            |
| https://hermes-agent.nousresearch.com/docs/developer-guide/architecture                         | Three-tier entry point: CLI / Gateway / ACP → shared AIAgent core     |
