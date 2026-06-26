# Changelog

All notable changes to HeadmasterUI will be documented in this file.

## v0.2.3 — 2026-06-26

### Added

- **In-app install progress screen** — First-run runtime installation now shows a full-screen dark UI with a live stage checklist (✓/spinner/✗), progress bar, scrollable log output, and error/retry state. No native OS dialog popups.
- **F12 DevTools shortcut** — Toggles Electron DevTools in both dev and packaged builds.
- **HermesHQ login** — CORS headers injected for `hermeshq.gcaplabs.com` so login works from the Electron renderer. `VITE_HERMESHQ_URL` baked into the bundle via `.env.production`.

### Fixed

- **Runtime never installed on first launch** — `installIfMissing` was hardcoded `false`; now `true`. The installer runs automatically on first launch.
- **Window frozen during install** — `createWindow()` now runs before `hermesBootstrap.start()`. The app window appears immediately; installation runs in the background.
- **Runtime not isolated** — `HERMES_HOME` is now always `%LOCALAPPDATA%\Headmaster\runtime` on Windows (no env-var override, no fallback to existing Hermes install). `resolveHermesBin` only checks venv paths — no PATH lookup. Hermes never appears on the user's PATH.
- **uv installing to wrong location** — `UV_INSTALL_DIR` now passed explicitly in the install stage spawn env so uv lands in the isolated Headmaster bin dir, not `~/.local/bin`.
- **Login "server error" / "Connection failed"** — `VITE_HERMESHQ_URL` baked at build time via `.env.production`; hardcoded fallback in `AuthContext`; CORS OPTIONS preflight fixed by overriding `statusLine` to `200 OK` in `onHeadersReceived`.
- **Backend port 0 / ERR_UNSAFE_PORT** — `getBackendPort()` fallback now guards `> 0` (was `??` which let `0` through, causing Chrome to reject all local runtime requests on startup).
- **Hermes dashboard exits code=1 on first run** — `--skip-build` flag now only passed when `web_dist` already exists; omitted on first run so Hermes builds its web UI automatically.
- **Login hangs for 15+ seconds then fails** — Removed the `/api/desktop/provision` call entirely (endpoint returns 500 server-side). Auth now uses `GET /api/auth/me` with the bearer JWT to complete the session — faster, simpler, and confirmed working.
- **Install stage stderr swallowed** — stderr from each install.ps1 stage is now captured and forwarded to the renderer log view.
- **"Cannot assign to read only property '_backendPort'"** — `contextBridge.exposeInMainWorld` creates read-only window properties; `useDashboardStatus` tried to write the real port and threw, leaving the port stuck at 0. Removed `__backendPort` and `__hermesSessionToken` from preload exposure; the renderer hook now owns these as writable globals with `Object.defineProperty` fallback for resilience against stale descriptors.
- **HTTP/WS error spam during startup** — `httpBridge` now short-circuits HTTP and WebSocket requests when backend port is 0 (dashboard not ready) instead of hitting the 9119 fallback port and generating `ERR_CONNECTION_REFUSED` storms.

### Changed

- `runtimeDetectionBridge` — native `dialog.showMessageBox` removed entirely; replaced by event-driven in-app UI.
- `RuntimeDetectionModal` — simplified to an immediate pass-through (detection is now event-driven via `install:progress` IPC).
- Install stage progress emitted as structured IPC events (`install:progress`) from `hermesBootstrap` to all renderer windows.
- `hermeshqProvisionService` — provision flow replaced with direct `GET /api/auth/me`; no external provision endpoint dependency.

---

## v0.2.2 — 2026-06-25

### Added

- **Multi-tenant provision modes** — `headmaster_local` (full local Hermes), `headmaster_remote` (cloud container bridge), `headmaster_plus_thin` (student/basic role)
- **HermesHQ provision client** — Full-stack desktop provision: login → `/api/desktop/provision` → IPC bridge → runtime state injection
- **Cloud container auto-switch** — Desktop auto-detects `cloud_container_config` from provision response and switches to remote mode
- **Remote runtime bridge** — HTTP/WS bridge to cloud container endpoints with token auth
- **Capability gating** — `useCapabilities()` hook for role/mode/capability-aware UI (sidebar items, feature gates, admin views)
- **Bootstrap preparing screen** — Post-login "preparing your workspace" state while provision resolves
- **System prompt override** — Server-controlled system prompt injection per organization
- **Phase 2 navigation** — New sidebar nav structure with capability-gated sections
- **i18n coverage** — 9 new locale modules (activity, agents, browser, documents, integrations, kanban, memory, sidebar, workflows) + 39 keys in 9 new modules (plus updates to existing modules)
- **SWR dependency** — For HQ frontend data fetching

### Fixed

- **Frozen lockfile CI failure** — Regenerated `bun.lock` after react-query addition
- **i18n validation** — 319 missing keys resolved, type definitions regenerated
- **TypeScript type errors** — `Phase2Nav` icon types, `useCapabilities` role access, `AuthContext` cloud_container_config property
- **AGENTS.md stale paths** — Removed deprecated `gcaplabs-headmaster/repo/` prefix from all paths

### Changed

- **Version** — 0.2.1 → 0.2.2
- **Branch** — `codex/headmaster-v0.2.0` merged into `main`
- **GitHub workflows** — Removed `aioncore` references, updated `iOfficeAI` → `GCAP-Labs`

### Security

- **Local Hermes loopback bind** — Backend only accessible via 127.0.0.1
- **JWT keychain storage** — Access tokens stored in OS keychain instead of localStorage
- **Runtime validation** — Privileged actions require active provision validation
- **MFA**: Multi-factor authentication is not yet supported in the desktop app. MFA-enabled accounts will see an unsupported account message.

---

## v0.2.1 — 2026-06-23

### Added

- Initial HeadmasterUI release
- Electron desktop app with React renderer
- Settings navigation restructure

---

## v0.1.6 — 2026-06-19

### Added

- Settings nav restructure
