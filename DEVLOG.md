# GCAP-Labs Dev Log

Running record of what was built, why, and what's next. Newest entries at the top.

---

## 2026-06-18 (Session 3) — v0.1.3: Hermes detection + remote gateway, aioncore/aionui rename

**What:** Implemented Task 9 (local/remote Hermes gateway selector) and Task 10 (rename all internal aioncore/aionui to Headmaster/Hermes). Bumped version to 0.1.3.

**Task 9 — Hermes detection + remote gateway:**
- `hermesBootstrap.ts` — added `isInstalled()` method
- New `process/connection/connectionConfig.ts` — stores connection mode (local/remote) and remote config (host, port, token) in `connection-config.json`
- `index.ts handleAppReady()` — branches on connection mode: remote skips local spawn, sets `__backendHost` + `__backendPort` + `__hermesSessionToken` from config
- `httpBridge.ts` — `getBaseUrl()` and `getWsUrl()` honor `__backendHost` instead of hardcoded `127.0.0.1`
- `backendUrl.ts` — `getBackendBase()` honors `__backendHost`
- New `connectionBridge.ts` — IPC handlers for reading/writing connection settings from renderer
- `backendStartup.ts` — fixed stale "aioncore" log message to "Hermes"

**Task 10 — Rename aioncore/aionui:**
- `initStorage.ts` — storage files renamed: `aionui-config.txt` → `headmaster-config.txt`, etc. + migration function for old files
- `applicationBridgeCore.ts` — `ProcessEnv.set('aionui.dir')` → `'headmaster.dir'`
- `binaryResolver.ts` — `BINARY_NAME = 'aioncore'` → `'hermes'`
- `feedback/logs.ts` — `.aioncore.log` → `.hermes.log`, `.aionrs.log` → `.hermes-agent.log`
- `builtinMcp/constants.ts` — `aionui-image-generation` → `headmaster-image-generation`
- `imageGenServer.ts` — `aionui_image_generation` → `headmaster_image_generation`
- `migrations.ts` — new migration v27: rename conversation source `aionui` → `headmaster` with CHECK constraint update
- Comments updated in `webuiBridge.ts`, `hermesBridge.ts`, `hermesBootstrap.ts`

**Commit:** `0207991` — 25 files changed, 563 insertions, 120 deletions
**Version:** 0.1.3

---

## 2026-06-18 (Session 2) — TODO backlog cleared: 16 tasks, 8 commits

**What:** Cleared the entire `todo.md` backlog. 16 tasks across 7 phases, 8 commits on `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/main`.

**Commits (oldest → newest):**
1. `32add65` — Remove global BottomComposer (chat input only on Chat screen)
2. `3463091` — Fix ChatSlider to render workspace panel for all conversation types with a workspace path
3. `441ab25` — Rename Hermes→Runtime in settings sider, add Advanced Settings tab, remove Desktop Pet, rename Memory settings entry
4. `66ab4fd` — Implement local CLI agent scanner in main process (probes $PATH for claude/codex/grok/hermes), fix agent detection
5. `f38282b` — White-label grep audit: remove all "Hermes"/"HeadmasterUI" mentions from UI strings across all 9 locales
6. `faabb36` — Replace RuntimeSettings keep/port comparison page with real config page (fetches from /api/config + /api/config/schema)
7. `c14f725` — Gateway status checker + Headmaster update checker in sidebar footer, Memory page embeds memory.gcaplabs.com
8. `8ce2485` — Doc updates (todo.md, AGENTS.md)

**New files created:**
- `packages/desktop/src/process/agent/agentScanner.ts` — local CLI binary scanner
- `packages/desktop/src/process/bridge/agentBridge.ts` — IPC bridge for agent scanner
- `packages/desktop/src/renderer/pages/settings/AdvancedSettings.tsx` — tabbed container for WebUI/Capabilities/Integrations
- `packages/desktop/src/renderer/components/layout/Sider/SiderNav/GatewayStatusIndicator.tsx` — polls /api/status every 30s
- `packages/desktop/src/renderer/components/layout/Sider/SiderNav/UpdateChecker.tsx` — polls /api/hermes/update/check every 6h

**Files deleted:**
- `packages/desktop/src/renderer/pages/settings/PetSettings.tsx` — Desktop Pet removed
- `packages/desktop/src/renderer/components/layout/BottomComposer.tsx` — global composer removed

**Endpoints now wired:**
- `GET /api/status` — gateway status (public, polled every 30s)
- `GET /api/config` — runtime config settings page
- `GET /api/config/schema` — config field schema for settings UI
- `PUT /api/config` — save config changes
- `GET /api/hermes/update/check` — update availability (polled every 6h)
- `POST /api/hermes/update` — trigger update
- `POST /api/gateway/restart` — restart gateway from sidebar footer

**Remaining:**
- Build + smoke test against live Hermes backend
- DeepWiki index (requires Devin account for private repo)
- Honcho server upgrade to 3.x+

---

## 2026-06-18 (Session 1) — Version reset, startup-check removal, white-screen guard, fresh build

**What:** Reset Headmaster to its own version line, killed the leftover "installation incomplete" startup popup, made render crashes recoverable, produced a fresh signed build, and recorded the next backlog in `todo.md`.

**Changes:**

*Versioning:*
- Root `package.json` version reset from `2.1.18` (inherited from the white-label base) to **`0.1.3`** — Headmaster's own version line.

*Removed the "installation incomplete" startup check:*
- `get-backend-startup-failure` IPC (`packages/desktop/src/index.ts`) now always returns `null`; the renderer can never receive failure info to render the dialog.
- `markBackendStartupFailed()` no longer classifies the failure; kept only the `backendStartupFailed` boolean (used for Sentry noise filtering + i18n language hint).
- Removed the now-unused `backendStartupFailureInfo` state and the `classifyBackendStartupFailure` / `BackendStartupFailureInfo` imports.
- Deleted the dead renderer component `InstallationIntegrityDialog.tsx`.

*White-screen recovery:*
- Added `AppErrorBoundary` (`packages/desktop/src/renderer/components/layout/AppErrorBoundary.tsx`) and wrapped both `<Outlet />` and the sidebar in `Layout.tsx`. A render crash now shows the actual error message + "Reload app" instead of an unrecoverable blank screen. The white screen + lingering install dialog were both traced to a stale build predating the prior session's renderer cleanup.

*Build:*
- Fresh signed `Headmaster.exe` built to `out/win-unpacked/` (had to close the running stale exe that was locking the output dir).
- Shortcut created at `GCAP-Labs/Headmaster.lnk` → the new exe.

**Why:** The packaged app the user was running was stale, so a removed dialog and an uncatchable white screen both persisted. Resetting the version, removing the check at its source, and adding an error boundary make the app self-consistent and crash-recoverable going forward.

**Files changed:**
- `package.json` — version → 0.1.3
- `packages/desktop/src/index.ts` — startup-failure check neutered
- `packages/desktop/src/renderer/components/layout/Layout.tsx` — error boundaries
- `packages/desktop/src/renderer/components/layout/AppErrorBoundary.tsx` — created

**Files deleted:**
- `packages/desktop/src/renderer/components/layout/InstallationIntegrityDialog.tsx`

**Next:** See `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/todo.md` — settings restructure (Hermes→main / others→Advanced), fix CLI agent detection, Memory panel = app + "Memory Settings" rename, remove Desktop Pet/Skills, drop persistent composer, fix missing file/document explorer.

---

## 2026-06-17 — OpenConcho UI overhaul (_support/upstream/openconcho)

**What:** Simplified and rebranded the OpenConcho web app to match Headmaster's design system and remove pages/features we don't use.

**Changes:**

*Structure:*
- Replaced the sidebar nav with a slim top `Header` bar. Keeps instance switcher, health dot, theme/demo/metadata toggles, and a gear icon linking to Settings.
- Removed the Seed Kits section entirely (route + 3 component files).
- `/workspaces` list route now redirects to `/` — the Dashboard (which already shows all workspaces in a table with metrics) is the single main screen.
- Workspace detail routes (`/workspaces/$workspaceId/...`) kept intact for drill-in.
- Settings still accessible via gear icon in the header; the auto-redirect for first-run (no config → /settings) kept.

*Design (Headmaster brand alignment):*
- All CSS accent tokens repointed from indigo (`#6366f1`) to Headmaster's green (`#8fd5a8` dark / `#1f5a3d` light).
- Dark/light background palette aligned to Headmaster tokens (`#0e0e0e` / `#ffffff` base).
- Status colors updated to Headmaster semantic values (success `#23c343`, warning `#ff9a2e`, destructive `#f76560`).
- Font changed from DM Sans to Headmaster's system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI'...`). Font imports removed.
- Skeleton animation vars added (were missing from original CSS).

**Why:** OpenConcho is embedded in the Headmaster flow via the Memory page — it needs to feel native, not like a separate app. The sidebar added navigation overhead when there's only one real screen (workspaces). Seed Kits are a feature of the open-source tool, not something we use.

**Files changed:**
- `packages/web/src/index.css` — full theme retheme + font swap
- `packages/web/src/lib/constants.ts` — status + accent comment updated
- `packages/web/src/components/layout/Header.tsx` — created (replaces Sidebar)
- `packages/web/src/routes/__root.tsx` — column layout, Header replaces Sidebar
- `packages/web/src/routes/workspaces.tsx` — redirects to `/`
- `packages/web/src/routeTree.gen.ts` — seed-kits entries removed

**Files deleted:**
- `packages/web/src/components/layout/Sidebar.tsx`
- `packages/web/src/routes/seed-kits.tsx`
- `packages/web/src/components/seed-kits/SeedKitsView.tsx`
- `packages/web/src/components/seed-kits/SeedKitForm.tsx`
- `packages/web/src/components/seed-kits/ApplyKitDialog.tsx`

---

## 2026-06-17 — Settings restructure & Kanban wiring (gcaplabs-headmaster/repo/gcaplabs-headmasterUI)

**What:** Restructured the Settings page and wired the Kanban page to the real Hermes Kanban plugin.

*Settings:*
- Hermes is now the first tab in Settings (was buried). Group headers added: AI Core, HeadmasterUI, Memory, About.
- Integrations moved from standalone sidebar item into Settings as a proper tab.
- Skills (Capabilities) remains in Settings.
- `/integrations` redirects to `/settings/integrations`.
- Removed the Aion Core / Adonis Core startup check popup (`RuntimeFailureDialogs` + all supporting code in `main.tsx`).

*Kanban:*
- `useKanban.ts` rewritten to call real Hermes Kanban API (`GET /api/plugins/kanban/board`, `PATCH /api/plugins/kanban/tasks/{id}`) with Bearer token from `useDashboardStatus()`.
- Status mapping: backlog↔triage, todo↔ready, in_progress↔running, review↔blocked, done↔done.

**Files changed:**
- `SettingsSider.tsx`, `Router.tsx`, `Phase2Nav.tsx`, `main.tsx`, `useKanban.ts`

---

## 2026-06-17 — BrowserPanel (gcaplabs-headmaster/repo/gcaplabs-headmasterUI)

**What:** Added a contextual browser view panel to the Headmaster desktop app. When the Hermes agent uses browser tools (Camofox with `ENABLE_VNC=1`), a panel automatically slides in between the chat and workspace showing the live noVNC interface at `http://localhost:6080`. Panel closes itself 2.5s after the agent finishes.

**Why:** Needed to see what the agent is browsing without leaving the app. Rejected a permanent tab — it should appear only when in use, like an IDE terminal panel.

**Decision trail:**
- Bottom drawer (VS Code-style) vs right-side panel → chose **right panel** (Option B) — chat stays full height, panel fills the slot the old Preview panel used to occupy
- No tab bar — panel has a simple header (live dot + "Browser" label + close button) and nothing else
- Fixed VNC URL (`localhost:6080`) — Camofox always uses this port, no need to parse it from tool output

**Files added:**
- `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/packages/desktop/src/renderer/pages/conversation/BrowserPanel/` (3 files)
- `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/packages/desktop/src/renderer/hooks/chat/useBrowserSessionWatch.ts`

**Files changed:**
- `ChatLayout/index.tsx` — BrowserPanel replaces PreviewPanel in the right panel slot
- `main.tsx` — BrowserPanelProvider added to provider chain
- `conversation/index.tsx` — useBrowserSessionWatch(id) wired in
- All 9 `locales/*/conversation.json` — `browser.title` and `browser.close` keys added

**Still to do:**
- Remove old PreviewPanel tab system (PreviewPanel, PreviewProvider, PreviewContext) — user confirmed this is planned
- Run `bun run i18n:types` to regenerate i18n TypeScript types
- Test detection logic in `useBrowserSessionWatch` against real Camofox session

---

## 2026-06-17 — Sidebar reduction & Integrations → Settings

**What:** Cut the sidebar from 12 items down to 7. Moved Integrations into Settings as a proper tab. Renamed Assets → Deliverables.

**Final sidebar (in order):** Chat, Memory, Agents, Automations, Kanban, Deliverables, Settings (cog)

**Removed from sidebar:** Dashboard, Activity, Documents, Skills/Workflows, Integrations, Browser

**Why:**
- Dashboard: Chat can be the landing page; stats are not a primary destination
- Activity: sub-view, not a nav destination
- Documents: accessible from chat; the OfficeCLI/Preview-panel document explorer is upstream AionUI functionality, not wired in Headmaster
- Skills/Workflows: already exists as "Capabilities" tab in Settings — no need to duplicate in sidebar
- Integrations: moved to Settings → Integrations tab (channels, MCP servers, webhooks). Old `/integrations` route redirects to `/settings/integrations`
- Browser: BrowserPanel now auto-appears in chat when agent uses browser tools — standalone page is redundant

**Deliverables (was Assets):** Maps to "Artifacts" in the hermes-desktop GUI. Kept as own sidebar item.

**Files changed:**
- `Phase2Nav.tsx` — NAV_ITEMS reduced to 7, unused icon imports removed
- `SettingsSider.tsx` — `integrations` added to BUILTIN_TAB_IDS + builtinMap, after `capabilities` in AI Core group
- `Router.tsx` — `/settings/integrations` route added; `/integrations` now redirects there
- All 9 `locales/*/common.json` — `sidebar.deliverables` key added
- All 9 `locales/*/settings.json` — `settings.integrations` key added

**Memory / Honcho note:** Honcho is already running and connected to the user's Hermes instance. The `/memory` page just needs to surface that existing connection — OpenChoncho (the UI layer) should point at the same Honcho endpoint Hermes is already using. No new infrastructure needed.

---

## 2026-06-17 — Research: Hermes browser feature

**What:** Read through Hermes agent browser docs (`runtime/hermes-agent/website/docs/user-guide/features/browser.md`) and mapped what's available for embedding in the desktop app.

**Key findings:**
- Camofox (Firefox-based, local) exposes noVNC at port 6080 when `ENABLE_VNC=1` — this is the live view mechanism
- Cloud providers (Browserbase, Browser Use, Firecrawl) don't expose VNC — screenshots via `browser_vision` only
- `WebviewHost` component already exists in the app and can embed any URL as an Electron webview
- `PreviewContentType` already includes `'url'` — the plumbing was already there

---

_Add new entries above this line. Format: `## YYYY-MM-DD — Title (app)`_
