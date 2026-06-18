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

## New tasks (2026-06-18 session 3)

### 9. Hermes installation detection + local/remote gateway selector

**Goal:** On startup, check if a Hermes installation is present locally. If yes, use it and load previous sessions. If the user chooses "remote", connect to a Hermes instance on another machine (e.g. the Mac) and pull sessions from there.

**Current state:**
- `hermesBootstrap.ts` always tries to spawn a local `hermes dashboard` process. It resolves `HERMES_HOME` from env or `appData/hermes` (Windows) / `~/.hermes` (POSIX).
- There's no "remote" mode — the app always assumes local. `httpBridge.ts` reads `window.__backendPort` which is set by the main process after local Hermes starts.
- The `backendStartup.ts` log message still says "Failed to start aioncore" (stale naming).

**What needs to happen:**
1. **Detection** — before spawning, check if `HERMES_HOME` exists and has a venv with the `hermes` binary. If yes, proceed with local spawn (current behavior). If no, don't crash — show a "no local Hermes found" state with options.
2. **Remote mode** — add a setting (Settings → Runtime) for "Connection Mode: Local / Remote". When Remote:
   - User enters host + port + session token (or an HTTP URL like `http://192.168.x.x:9119`)
   - The app skips `hermesBootstrap.start()` entirely
   - Sets `__backendPort` and `__hermesSessionToken` from the remote config
   - All HTTP/WS calls go to the remote host instead of `127.0.0.1`
   - Sessions, config, status — everything comes from the remote Hermes
3. **Startup flow** — `index.ts` `handleAppReady` should branch: if connection mode is "remote", skip local spawn and go straight to connecting. If "local", do the existing `hermesBootstrap.start()` flow.
4. **UI** — a first-run dialog or Settings → Runtime dropdown: "Connect to local Hermes" vs "Connect to remote Hermes". Remote needs host, port, and optional token fields.

**Key files to modify:**
- `process/backend/hermesBootstrap.ts` — add `isInstalled()` check
- `process/index.ts` — branch startup based on connection mode
- `common/adapter/httpBridge.ts` — support remote host URL instead of always `127.0.0.1:{port}`
- `common/adapter/backendUrl.ts` — read remote URL from settings
- `renderer/pages/settings/RuntimeSettings.tsx` — add connection mode selector
- `process/services/database/` or `config` — store remote connection settings
- `process/startup/backendStartup.ts` — fix "aioncore" log message to "Hermes"

### 10. Rename AppData folders and internal naming from aioncore/aionui to Headmaster

**Goal:** Stop using `aioncore`/`aionui` in file paths, env vars, database names, and internal identifiers. Use `Headmaster` or `headmaster` consistently.

**Current state (found in code):**
- `%APPDATA%\Headmaster\aionui\` — subfolder with `aionui-backend.db`, conversations, builtin-skills, runtime
- `applicationBridgeCore.ts` line 31: `ProcessEnv.set('aionui.dir', ...)` — sets the working/cache/log dirs under the `aionui` key
- `binaryResolver.ts` — `BINARY_NAME = 'aioncore'`, `bundled-aioncore/` dir
- `backendStartup.ts` — log message says "Failed to start aioncore"
- `feedback/logs.ts` — `.aioncore.log`, `.aionrs.log` suffixes
- `petConfirmManager.ts` — comment references "aionui-conversation route"
- `builtinMcp/constants.ts` — `BUILTIN_IMAGE_GEN_NAME = 'aionui-image-generation'`
- `imageGenServer.ts` — `'aionui_image_generation'` tool name
- `database/migrations.ts` — `source IN ('aionui', 'telegram')` CHECK constraints, `remote_agents` table
- `webuiBridge.ts` — comments reference "aioncore"
- `hermesBridge.ts` — comments reference "aioncore"
- `hermesBootstrap.ts` — `HERMES_HOME_WIN32` uses `appData/hermes` (this one is fine — it's a Hermes runtime path, not Headmaster)

**What needs to happen:**
1. **AppData subfolder** — rename `aionui/` to `headmaster/`. Requires a migration: on first launch with the new version, move/rename the old folder. Database file `aionui-backend.db` → `headmaster-backend.db`.
2. **ProcessEnv key** — `aionui.dir` → `headmaster.dir` (check what reads this key)
3. **Binary resolver** — `BINARY_NAME = 'aioncore'` is dead code (Hermes runtime is the only path now). Either remove `binaryResolver.ts` entirely or rename to reflect Hermes. Same for `bundled-aioncore/`.
4. **Log messages** — all "aioncore" references in log/error strings → "Hermes" or "Headmaster"
5. **MCP server name** — `aionui-image-generation` → `headmaster-image-generation`
6. **Database migrations** — the `source IN ('aionui', ...)` CHECK constraints are in existing migrations. Need a new migration that either (a) adds 'headmaster' to the CHECK or (b) migrates existing rows from 'aionui' to 'headmaster' and updates the constraint. **Careful:** don't break existing user databases.
7. **Comments** — update all code comments that reference aioncore/aionui to say Hermes/Headmaster as appropriate.

**Key files to modify:**
- `process/bridge/applicationBridgeCore.ts` — `ProcessEnv.set('aionui.dir', ...)` key name
- `process/backend/binaryResolver.ts` — remove or rename
- `process/startup/backendStartup.ts` — log message
- `process/feedback/logs.ts` — log suffixes
- `process/resources/builtinMcp/constants.ts` — server name
- `process/resources/builtinMcp/imageGenServer.ts` — tool name
- `process/services/database/migrations.ts` — new migration for source rename
- `process/pet/petConfirmManager.ts` — comment (or remove if pet is gone)
- `process/bridge/webuiBridge.ts` — comments
- `process/bridge/hermesBridge.ts` — comments
- `electron-builder.yml` — check `appId`, `productName` (already Headmaster, but verify)
- `package.json` — check `name` field (currently "headmaster", good)

**Risk:** Database migration. The `aionui-backend.db` has CHECK constraints on the `source` column. Changing the allowed values requires a migration that recreates the table. Must handle existing user data carefully — test with a copy of the real DB first.

---

## Notes / context from this session
- 7 commits on main: settings restructure, agent scanner, BottomComposer removal, ChatSlider fix, white-label audit, RuntimeSettings rewrite, gateway+update checker, memory embed.
- All changes pass `bunx tsc --noEmit` clean.
- The RuntimeSettings page now fetches from real Hermes endpoints (`/api/config`, `/api/config/schema`, `PUT /api/config`).
- The gateway checker polls `/api/status` (public endpoint, no auth needed).
- The update checker polls `/api/hermes/update/check` (token-gated, 6h interval).
- Memory page embeds `https://memory.gcaplabs.com` via iframe.