# GCAP Labs Architecture

> Single source of truth for how the Headmaster product stack is wired. Read this before touching any repo.

## Products (3)

| Product | Stack | Repo | Deploy Target | Dev Machine |
|---------|-------|------|---------------|-------------|
| **Headmaster Desktop** | Electron + Vite + React + TypeScript | `gcaplabs-headmasterUI/` | Windows/Mac/Linux desktops | Windows (Matve) |
| **Headmaster iOS** | Swift + SwiftUI | `gcaplabs-iOS/` | App Store (TestFlight) | Mac (Xcode) |
| **HermesHQ** | FastAPI + SQLAlchemy 2.0 + PostgreSQL + React 19 | `hermeshq/` (vendored in headmasterUI) | Docker on Mac Mini | Mac Mini (mattywow) |

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

| File | What it is | When to read it |
|------|-----------|----------------|
| `AGENTS.md` | Repo orientation map | First thing every session |
| `CHANGELOG.md` | What shipped in each version | Before claiming something exists |
| `todo.md` | Outstanding tasks | Before starting new work |
| `mastertodo.md` | Cross-product issue tracker | Read-only unless told to edit |
| `CLAUDE.md` (in hermeshq/) | HermesHQ-specific guidance | When editing backend |
| `packages/desktop/src/process/connection/connectionConfig.ts` | Desktop-HermesHQ connection logic | When fixing connection issues |
| `packages/desktop/src/renderer/hooks/context/AuthContext.tsx` | Auth flow, provision, token refresh | When auth is broken |
| `hermeshq/backend/hermeshq/services/desktop_runtime.py` | Provision response builder | When adding provision fields |
| `hermeshq/backend/hermeshq/routers/desktop_runtime.py` | Provision endpoint | When changing provision API |

---

## White-Label Rules

- **Hermes** = internal codename. Allowed in: env vars, Python package names, CLI commands.
- **Headmaster** = user-facing brand. Use in all UI strings, window titles, marketing.
- Never expose "Hermes Agent" or "AionUi" to users.
- Never frame as "Hermes is the engine, Headmaster is the white-label." They are the same product.

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Cannot assign to read-only property '_backendPort'" | `contextBridge.exposeInMainWorld` made property read-only | Remove exposure from preload, use `Object.defineProperty` fallback |
| "Preparing your workspace…" forever | Auto-login disabled without `setReady(true)` | Set `ready = true` in AuthContext mount effect |
| Model selector empty | `useProvidersQuery` fetches before dashboard ready | Listen for `hermes:runtime-changed` and re-fetch |
| Settings fail to load | Local runtime doesn't have config | Read from HermesHQ provision response instead |
| WS connection to 9119 fails | Fallback port, no runtime listening | Port guards in httpBridge.ts |

---

## Version

Last updated: 2026-06-26
Headmaster Desktop: v0.2.2
HermesHQ: v0.2.2
