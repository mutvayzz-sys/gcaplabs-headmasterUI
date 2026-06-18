# Headmaster — TODO

Working backlog for upcoming sessions. Current version: **v0.1.2**.

---

## Completed (2026-06-18)

### 1. Settings page cleanup + restructure
- [x] **Removed all "Hermes" mentions** from the UI (labels, tab names, copy). Now "Runtime".
- [x] Replaced the "keep / port" comparison list with a **real runtime config settings page** (fetches from `/api/config` + `/api/config/schema`).
- [x] Moved webui/capabilities/integrations under a new **"Advanced Settings"** tab.
- [x] Removed old/dead settings entries and dead i18n keys from the comparison view.

### 2. CLI agent detection
- [x] Implemented **local CLI agent scanner** in the Electron main process (`process/agent/agentScanner.ts`).
- [x] Scans `$PATH` for `claude`, `codex`, `grok`, `hermes` binaries.
- [x] Wired `getAvailableAgents` to merge local scanner results with backend adapters.
- [x] Wired `refreshCustomAgents` to re-scan instead of being a stub.

### 3. Memory: panel should be the app, settings should be settings
- [x] The **Memory tab** (main left-nav) now embeds `memory.gcaplabs.com` directly via iframe.
- [x] The Memory entry under **Settings** renamed to **"Memory Settings"**.

### 4. Remove features
- [x] **Removed Desktop Pet** entirely (settings tab + route + sider entry).
- [x] **Skills** — confirmed merged into Capabilities (now under Advanced Settings).

### 5. Remove persistent Composer
- [x] Removed the always-on bottom Composer (`BottomComposer`).
- [x] Chat input only appears on the Chat screen now.

### 6. File / document explorer not showing
- [x] Fixed `ChatSlider` to render the workspace panel for **all conversation types** that have a workspace path (not just acp/codex/aionrs).

### 7. Gateway checker + Update checker (added 2026-06-18)
- [x] **Gateway status indicator** in the sidebar footer — polls `/api/status` every 30s, shows green/red dot, restart button.
- [x] **Headmaster update checker** — polls `/api/hermes/update/check` every 6h, shows update badge when available, triggers `POST /api/hermes/update`.

### 8. White-label audit
- [x] Grepped all renderer source for "Hermes"/"AionUi" mentions in UI strings — all replaced with "Runtime"/"Headmaster" across all locales.

---

## Still pending

- [ ] **Build + smoke test** — run `out/win-unpacked/Headmaster.exe`, verify agent detection, gateway checker, update checker, memory embed, workspace panel, and settings page all work against the live Hermes backend.
- [ ] **Task 2 refinement** — the RuntimeSettings config page may need UX polish (field grouping, descriptions, validation) based on real `/api/config/schema` output.
- [ ] **DeepWiki update** — update the DeepWiki page for the Headmaster project with the new architecture (agent scanner, gateway checker, update checker, memory embed).
- [ ] **Honcho upgrade** — upgrade Honcho server to 3.x+ to resume durable memory writes (blocked on server-side upgrade).

---

## Notes / context from this session
- 7 commits on main: settings restructure, agent scanner, BottomComposer removal, ChatSlider fix, white-label audit, RuntimeSettings rewrite, gateway+update checker, memory embed.
- All changes pass `bunx tsc --noEmit` clean.
- The RuntimeSettings page now fetches from real Hermes endpoints (`/api/config`, `/api/config/schema`, `PUT /api/config`).
- The gateway checker polls `/api/status` (public endpoint, no auth needed).
- The update checker polls `/api/hermes/update/check` (token-gated, 6h interval).
- Memory page embeds `https://memory.gcaplabs.com` via iframe.