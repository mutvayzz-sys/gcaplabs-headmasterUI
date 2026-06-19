# Headmaster — TODO

Working backlog for upcoming sessions. Current version: **v0.1.5**.

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

---

## New tasks (2026-06-19 session — critical failures)

### 11. Headmaster: Inactive on launch — Hermes not starting

**Symptom:** Sidebar shows "Headmaster: Inactive", chats don't work, no backend connection.

**Likely causes (diagnose in order):**
1. `hermesBootstrap.ts` `HERMES_HOME_WIN32` path: was fixed to check `%LOCALAPPDATA%\hermes` first, but may still fail if `hermes` binary isn't on PATH or venv isn't activated.
2. `hermes dashboard` exits immediately (port conflict, missing deps, Python env issue).
3. `__backendPort` isn't being set — renderer connects to wrong port (0 or stale).

**What to do:**
- Read `%APPDATA%\Headmaster\logs\` latest log — find the hermesBootstrap startup sequence and the exact error.
- Check `hermesBootstrap.ts`: log the resolved `HERMES_HOME` path and confirm `hermes dashboard` actually spawns.
- Add explicit stdout/stderr capture from the hermes subprocess so errors surface in the Headmaster log (currently may be silently swallowed).
- If Hermes spawns but crashes: surface crash reason in the "Headmaster: Inactive" tooltip or a startup banner.

**Key files:** `process/backend/hermesBootstrap.ts`, `process/index.ts`, `electron/preload/index.ts` (port injection).

---

### 12. Chat history from existing Hermes sessions not loading

**Symptom:** App shows no previous conversations even though Hermes has been running locally and has a conversation DB.

**Likely causes:**
1. Headmaster reads from its own SQLite DB (`headmaster-backend.db`) — but Hermes stores conversations server-side in its own DB (not the same file). The app may not be fetching conversation history from `GET /api/conversations` on the Hermes backend.
2. If issue 11 (Inactive) is the root cause: no backend → no history fetch.
3. The conversation list may be fetching from the local DB which is empty (new app install), while Hermes has the real history.

**What to do:**
- Confirm: does the conversation list call `GET /api/conversations` on Hermes, or does it read the local SQLite DB?
- Check `renderer/hooks` or `renderer/store` for how conversations are loaded on startup.
- If it's reading local DB: wire it to fetch from Hermes REST instead (or on first launch, seed local DB from Hermes API).
- Hermes endpoint: `GET /api/conversations` (confirmed in recon). Returns list with `id`, `title`, `created_at`. Messages: `GET /api/conversations/{id}/messages`.

**Key files:** `renderer/pages/conversation/`, `process/bridge/acpConversationBridge.ts`, `common/adapter/ipcBridge.ts`.

---

### 13. Chat send/receive broken — messages not going through

**Symptom:** Sending a message does nothing or errors; no AI response.

**Likely causes:**
1. Depends on issue 11 — if Hermes is inactive, all chat completions fail silently.
2. `httpBridge.ts` may be sending to the wrong port (`__backendPort` = 0 or stale).
3. The WebSocket connection for streaming responses may not be established.

**What to do:**
- Fix issue 11 first — most chat failures will resolve when Hermes is running.
- After Hermes is active: open DevTools → Network, send a message, check what request fires and what the response is.
- Look for the `POST /api/conversations/{id}/chat` call (or equivalent) and its error response.
- Check `WS /ws/chat` connection — Hermes streams responses via WebSocket, not HTTP. If the WS URL uses the wrong port it silently fails.

---

### 14. App update checker broken — private repo + no auth token

**Symptoms:**
- Sidebar `AppUpdateChecker` shows nothing (silently catches 404 from GitHub API)
- About tab → "Check for updates" shows `update.errors.githubApiFailed`
- Sidebar footer correctly shows `v0.1.5 · de902b2` (that's the running build, correct)

**Root cause:** `mutvayzz-sys/gcaplabs-headmasterUI` is a **private repo**. GitHub's releases API returns 404 for unauthenticated requests against private repos. Both `ipcBridge.update.check` (GitHub REST) and `ipcBridge.autoUpdate.check` (electron-updater) hit this.

**`updateBridge.ts` already supports `HEADMASTER_GITHUB_TOKEN` / `GH_TOKEN` env vars** — the token just isn't set anywhere at runtime.

**Fix options (pick one):**
1. **(Easiest) Make GitHub releases public** — GitHub lets you keep the repo private but publish releases publicly. Go to the repo settings or just re-publish releases as public. No code change needed.
2. **(Clean) Bundle a read-only PAT** — create a fine-grained GitHub PAT with read-only access to releases on this repo, store it in `electron-builder.yml` env or a build-time `HEADMASTER_GITHUB_TOKEN` and inject it via `extraMetadata` / `extraResources`. The token only has read access so it's safe to ship.
3. **(Quick local test)** Set `GH_TOKEN=<your PAT>` as a system env var, relaunch `hm` — update checker will work immediately to validate the flow.

**Also fix:** i18n key `update.errors.githubApiFailed` — make sure this has a human-readable `defaultValue` in `en-US` so the error message is legible even if the key is missing from the locale file.

**Key files:** `process/bridge/updateBridge.ts`, `packages/desktop/src/renderer/components/layout/Sider/SiderNav/AppUpdateChecker.tsx`, locale `en-US/update.json` or `common.json`.

---

### 15. Rethink Hermes update restart flow — don't force-restart Hermes on update

**Current behaviour (`UpdateChecker.tsx`):**
After triggering `POST /api/hermes/update`, the component polls `GET /api/hermes/update/check` every 5s until `update_available` goes false, then immediately calls `window.electronAPI.restartRuntime()` — which kills Hermes, restarts it on a new port, and reloads the entire window.

**Problem:** User doesn't want the forced restart. It's disruptive — mid-conversation, the window reloads and all state is lost.

**Better flow options (pick one next session):**
- Show a "Headmaster updated — restart when ready" banner with a manual restart button. User clicks it when they're not mid-task.
- Just show a success toast "Update installed. Restart Headmaster to apply." and do nothing automatically.
- Remove the polling + auto-restart entirely. The update runs in the background; Hermes picks it up on next natural restart.

**Key file:** `packages/desktop/src/renderer/components/layout/Sider/SiderNav/UpdateChecker.tsx` — the `phase === 'polling'` → `restartRuntime()` transition.

---

### 15. Settings nav restructure (2026-06-19) — completed inline, record here

- [x] 4-group sidebar: Intelligence / Workspace / Tools / App
- [x] Renamed tabs: "Engines" (was Agents/Specialists collision), "Tools & Integrations" (was Advanced Settings), "Models & Providers" (was Model), "Memory & Context" (was Memory Settings), "Connection" (was Runtime — but then hidden)
- [x] Fixed duplicate icon bug: Model and Runtime both used LinkCloud; Model now uses Lightning
- [x] Fixed `settings.agents` i18n value: was "Specialists" (wrong), now "Engines"
- [x] "Connection" tab (`/settings/hermes`) hidden from sidebar — Headmaster always ships with local Hermes; route still accessible directly

---

## Notes / context from this session
- 7 commits on main: settings restructure, agent scanner, BottomComposer removal, ChatSlider fix, white-label audit, RuntimeSettings rewrite, gateway+update checker, memory embed.
- All changes pass `bunx tsc --noEmit` clean.
- The RuntimeSettings page now fetches from real Hermes endpoints (`/api/config`, `/api/config/schema`, `PUT /api/config`).
- The gateway checker polls `/api/status` (public endpoint, no auth needed).
- The update checker polls `/api/hermes/update/check` (token-gated, 6h interval).
- Memory page embeds `https://memory.gcaplabs.com` via iframe.