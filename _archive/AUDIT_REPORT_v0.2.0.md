# Headmaster Desktop v0.2.0 — Comprehensive Smoke Test & Audit Report

**Date:** 2026-06-20 (current session)  
**Branch:** `codex/headmaster-v0.2.0`  
**Version:** `0.2.0`  
**Scope:** Static analysis of adapters, settings, routes, white-label, tests, build, and feature completeness  
**Method:** 5 parallel specialist agents audited 5 domains; findings cross-validated and deduplicated here.

---

## 1. Executive Summary

| Category | P0 (Ship Blocker) | P1 (High Priority) | P2 (Polish) |
|----------|-------------------|--------------------|-------------|
| **Adapters / Chat** | 4 | 9 | 5 |
| **Settings / Routes** | 1 | 6 | 8 |
| **White-Label** | 10 | 9 | 14 |
| **Tests / Build** | 3 | 6 | 6 |
| **Features / Screens** | 2 | 5 | 5 |
| **TOTAL** | **20** | **35** | **38** |

**Top 5 P0 Blockers (must fix before v0.2.0 ships):**

1. **Profile launch crash** — `params.model` can be `undefined`, causing `Cannot read properties of undefined (reading 'model')` in downstream UI. (`hermesChatAdapter.ts:605`)
2. **Stuck user message on prompt failure** — `message.userCreated` is broadcast before `prompt.submit` succeeds; if submit fails, the user sees a ghost message with no retry. (`hermesChatAdapter.ts:651`)
3. **Unmigrated `conversation.get` IPC bridge** — still calls the removed legacy backend; any code path using it hangs. (`ipcBridge.ts:400`)
4. **Broken `/council` redirect** — navigates to literal string `/team/:id`, breaking the Council alias. (`Router.tsx:135`)
5. **10 user-facing white-label leaks** — "Hermes Python installation", "Hermes Runtime Detected", "Hermes dashboard", etc., still visible in runtime detection modal, OS dialogs, and bootstrap errors.

**Screen Implementation Status:**

| # | Screen | Status | Route |
|---|--------|--------|-------|
| 1 | Dashboard | ⚠️ Partial (real data, invisible — not in sidebar) | `/dashboard` |
| 2 | Chat | ✅ Real | `/conversation/:id` |
| 3 | Workflows | ⚠️ Partial | `/workflows` |
| 4 | Kanban | ⚠️ Partial | `/kanban` |
| 5 | Runs | ⚠️ Partial | `/activity` |
| 6 | Approvals | ❌ Stub (unrouted) | — |
| 7 | Documents | ⚠️ Partial | `/documents` |
| 8 | Memory | ⚠️ Partial | `/memory` |
| 9 | Automations | ✅ Real | `/scheduled` |
| 10 | Agents | ⚠️ Partial | `/agents` |
| 11 | Integrations | ✅ Real | `/settings/integrations` |
| 12 | Channels | ✅ Real | `/settings/channels` |
| 13 | Analytics | ❌ Missing | — |
| 14 | Settings | ✅ Real | `/settings/*` |

---

## 2. P0 Release Blockers (Must Fix)

### 2.1 Chat / Adapter Layer

| # | Issue | File | Line | Why It Matters | Suggested Fix |
|---|-------|------|------|----------------|---------------|
| 2.1.1 | `params.model` can be `undefined` → downstream UI crash | `hermesChatAdapter.ts` | 605 | Profile launch crash: `conversation.model.platform` throws | Add defensive fallback: `model: params.model ?? { id: '', platform: '', name: '', use_model: '', base_url: '', api_key: '' }` |
| 2.1.2 | `message.userCreated` broadcast before `prompt.submit` success | `hermesChatAdapter.ts` | 651 | Ghost message on submit failure; no retry affordance | Defer broadcast until submit succeeds, or emit rollback on failure |
| 2.1.3 | `conversation.get` still uses legacy IPC bridge | `ipcBridge.ts` | 400 | Removed backend → hangs or rejects | Replace with `getHermesConversation` wrapper |
| 2.1.4 | `conversation.warmup` still uses legacy IPC bridge | `ipcBridge.ts` | 446 | Same as above | Remove or implement no-op Hermes equivalent |

### 2.2 Settings / Routes

| # | Issue | File | Line | Why It Matters | Suggested Fix |
|---|-------|------|------|----------------|---------------|
| 2.2.1 | `/council` → `/team/:id` uses literal `:id` | `Router.tsx` | 135 | Navigates to `/team/:id` string; backend fetch fails | Replace with `/team/default` or remove alias |

### 2.3 White-Label (User-Facing Leaks)

| # | Issue | File | Line | Suggested Fix |
|---|-------|------|------|---------------|
| 2.3.1 | `"Checking for Hermes Python installation..."` | `RuntimeDetectionModal.tsx` | 86 | `"Checking for runtime…"` |
| 2.3.2 | `"Hermes Runtime Detected"` | `RuntimeDetectionModal.tsx` | 106 | `"Runtime Detected"` |
| 2.3.3 | Dialog title: `"Hermes Runtime Not Found"` | `runtimeDetectionBridge.ts` | 36 | `"Runtime Not Found"` |
| 2.3.4 | Dialog message: `"Headmaster requires the Hermes Python runtime…"` | `runtimeDetectionBridge.ts` | 37 | `"Headmaster requires the Python runtime…"` |
| 2.3.5 | Dialog detail: `"Hermes Python was not detected…"` / `"install Hermes"` | `runtimeDetectionBridge.ts` | 39–43 | `"The Python runtime was not detected…"` / `"install the runtime"` |
| 2.3.6 | Dialog title: `"Select Hermes Installation Directory"` | `runtimeDetectionBridge.ts` | 52 | `"Select Runtime Installation Directory"` |
| 2.3.7 | Dialog message: `"Select the directory containing your Hermes installation"` | `runtimeDetectionBridge.ts` | 54 | `"Select the directory containing your runtime installation"` |
| 2.3.8 | Toolsets subtitle: `"Enable and configure Hermes tool backends…"` | `ToolsetsPanel.tsx` | 133 | `"Enable and configure Headmaster tool backends…"` |
| 2.3.9 | Kanban unavailable message: `"Enable the kanban plugin in your Hermes dashboard…"` | `pages/kanban/index.tsx` | 70 | `"Enable the kanban plugin in your runtime dashboard…"` |
| 2.3.10 | Bootstrap error: `Hermes Python runtime not found…` + NousResearch GitHub URL | `hermesBootstrap.ts` | 256 | `"Python runtime not found…"` + remove NousResearch URL |

### 2.4 Build / Packaging

| # | Issue | File | Line | Suggested Fix |
|---|-------|------|------|---------------|
| 2.4.1 | `win.legalTrademarks` missing | `electron-builder.yml` | 124 | Add `legalTrademarks: Copyright © 2026 GCAP Labs` |
| 2.4.2 | `electronRebuild.electronVersion` lags actual `electron` | `package.json` | 272 | Sync to `^37.10.3` |
| 2.4.3 | `scripts/build-with-builder.js` does not clean `out/` | `build-with-builder.js` | 270–305 | Add `fs.rmSync(outDir, { recursive: true, force: true })` before Vite build |

### 2.5 Features / Screens

| # | Issue | File | Line | Suggested Fix |
|---|-------|------|------|---------------|
| 2.5.1 | Dashboard is invisible — not in sidebar | `Phase2Nav.tsx` (or sider) | — | Add `/dashboard` to sidebar navigation |
| 2.5.2 | Approvals is a stub and not routed | `pages/approvals/index.tsx` | — | Either implement and route it, or remove the stub |

---

## 3. P1 High Priority Items (Should Fix)

### 3.1 Chat / Adapter Layer

| # | Issue | File | Line | Suggested Fix |
|---|-------|------|------|---------------|
| 3.1.1 | Timeout closure captures `liveSessionId` by reference — can finish wrong turn after resume | `hermesChatAdapter.ts` | 632–679 | Clear and recreate timeout on session resume |
| 3.1.2 | `gateway.disconnected` aborts all turns immediately — no grace period | `hermesChatAdapter.ts` | 430–440 | Implement soft disconnect grace period (~5s) |
| 3.1.3 | `listHermesConversations` uses `min_messages: 1` — hides zero-message sessions | `hermesSessionAdapter.ts` | 378 | Remove filter or inject locally-open zero-message sessions |
| 3.1.4 | `profilesByStored` / `sessionProfiles` in-memory only — lost on reload | `hermesChatAdapter.ts:83`, `hermesSessionAdapter.ts:66` | — | Persist to `localStorage` or config store |
| 3.1.5 | No handling for `tool.error`, `message.error`, `session.expired` | `hermesChatAdapter.ts` | 448–547 | Add explicit switch cases |
| 3.1.6 | `conversation.reset` has no Hermes fallback | `ipcBridge.ts` | 445 | Wrap with fallback or implement Hermes equivalent |
| 3.1.7 | `useRuntimeConnectionState` probe uses `/api/status` which may not exist | `useRuntimeConnectionState.ts` | 43 | Use known Hermes endpoint or RPC probe only |
| 3.1.8 | `connectRpcWs` has no reconnect backoff / limit | `httpBridge.ts` | 464–541 | Add exponential backoff and attempt limit |
| 3.1.9 | `getAssociateConversation` caps at 200 | `ipcBridge.ts` | 403–415 | Fetch all pages in loop |

### 3.2 Settings / Routes

| # | Issue | File | Line | Suggested Fix |
|---|-------|------|------|---------------|
| 3.2.1 | `/settings/assistants` redirect drops query params and state | `Router.tsx` | 89–90 | Use route component that preserves search/state, or navigate directly to `/agents` |
| 3.2.2 | `/settings/agent` redirect drops query params; `tab=local` goes to wrong tab | `Router.tsx` | 92 | Update `AgentPillBar` to navigate to correct tab; fix redirect |
| 3.2.3 | Ghost `agent` tab in SettingsModal — in type and render but not in menu | `SettingsModal/index.tsx` | 60, 317–318 | Add to `builtinItems` or remove from type/render |
| 3.2.4 | SettingsModal missing: skills-hub, integrations, channels, appearance | `SettingsModal/index.tsx` | 194–232 | Add to `builtinItems` or document intentional exclusion |
| 3.2.5 | `SystemSettings` is a dual-purpose hack (About + System) | `pages/settings/SystemSettings.tsx` | — | Split into `AboutSettings` and `SystemSettings`; update Router |
| 3.2.6 | Duplicate `LinkCloud` icon for hermes/integrations/channels | `SettingsSider.tsx` | 95–136 | Assign unique icons |

### 3.3 White-Label

| # | Issue | File | Line | Suggested Fix |
|---|-------|------|------|---------------|
| 3.3.1 | Hardcoded English strings in `RuntimeDetectionModal.tsx` (no `t()`) | `RuntimeDetectionModal.tsx` | 86, 106, 109 | Extract to i18n keys |
| 3.3.2 | Hardcoded English strings in `HermesStatusBar.tsx` | `HermesStatusBar.tsx` | 38–43, 62, 72 | Extract to i18n keys |
| 3.3.3 | Asset filename `cowork.svg` | `assets/icons/cowork.svg` | — | Rename to `work-along.svg`; update `usePresetAssistantInfo.ts` |
| 3.3.4 | `localStorage` key: `aionui.emoji.recent` | `EmojiPicker.tsx` | 432 | Rename to `headmaster.emoji.recent` |
| 3.3.5 | `localStorage` key: `aionui:recent-workspaces` | `recentWorkspaces.ts` | 7 | Rename to `headmaster:recent-workspaces` |
| 3.3.6 | `localStorage` key: `aionui_workspace_update_time` | `workspaceHistory.ts` | 7 | Rename to `headmaster_workspace_update_time` |
| 3.3.7 | Custom event names: `aionui-workspace-*` | `workspaceEvents.ts` | 1–3 | Rename to `headmaster-workspace-*` |
| 3.3.8 | `localStorage` key: `aionui.sttStreamUnsupported` | `speechStreamPolicy.ts` | 12 | Rename to `headmaster.sttStreamUnsupported` |
| 3.3.9 | Custom event name: `aionui:speech-to-text-config-changed` | `SpeechToTextService.ts` | 11 | Rename to `headmaster:speech-to-text-config-changed` |
| 3.3.10 | Custom event name: `aionui-chat-message-jump` | `chatMinimapEvents.ts` | 1 | Rename to `headmaster-chat-message-jump` |

### 3.4 Tests / Build

| # | Issue | File | Suggested Fix |
|---|-------|------|---------------|
| 3.4.1 | Zero tests for `useRuntimeConnectionState.ts` | — | Add unit tests for state machine and `safeReason` redaction |
| 3.4.2 | Zero tests for `useDashboardStatus.ts` | — | Mock `ipcBridge.hermes.getDashboardStatus` and verify window globals |
| 3.4.3 | Zero tests for `GatewayStatusIndicator.tsx` | — | Add UI component tests |
| 3.4.4 | Zero tests for `UpdateChecker.tsx` | — | Add UI component tests |
| 3.4.5 | `electron.vite.config.ts` `buildCommit` fails in shallow CI | `electron.vite.config.ts` | 20–28 | Use `GITHUB_SHA?.slice(0,7)` as fallback before `dev` |
| 3.4.6 | `CHANGELOG.md` stale — no `0.2.0` section | `CHANGELOG.md` | — | Add v0.2.0 section summarizing Hermes pivot, settings restructure, update proxy |

### 3.5 Features / Screens

| # | Issue | File | Suggested Fix |
|---|-------|------|---------------|
| 3.5.1 | Persistent chat composer is completely missing | — | Implement shared bottom composer with 4 quick chips; render on all non-chat routes |
| 3.5.2 | Analytics screen doesn't exist | — | Create `/analytics` route and page, or cut from spec |
| 3.5.3 | Dashboard not in sidebar | `Phase2Nav.tsx` / sider | Add Dashboard nav item |
| 3.5.4 | `SkillsHubSettings` read/write endpoint mismatch | `SkillsHubSettings.tsx` | 126–136 | Unify to `httpGet('/api/skills')` for reads |
| 3.5.5 | Memory settings page has no iframe | `MemorySettings.tsx` | — | Embed `memory.gcaplabs.com` via iframe as per todo.md |

---

## 4. P2 Polish Items (Nice-to-Have)

### 4.1 Chat / Adapter

| # | Issue | File | Suggested Fix |
|---|-------|------|---------------|
| 4.1.1 | `TURN_TIMEOUT_MS` = 180s is too long for UX | `hermesChatAdapter.ts` | 85 | Reduce to 60–90s or make configurable |
| 4.1.2 | Unsafe `as TChatConversation` casts | `hermesChatAdapter.ts`, `hermesSessionAdapter.ts` | 612, 217 | Use explicit construction or `satisfies` |
| 4.1.3 | `fromHermesMessage` uses unstable array-index IDs | `hermesSessionAdapter.ts` | 253 | Use stable backend IDs |
| 4.1.4 | `fromHermesMessage` marks tool-call requests as `status: 'Success'` | `hermesSessionAdapter.ts` | 306 | Use `'Executing'` or `'Pending'` |
| 4.1.5 | `isTrackedHermesSession` async but does no I/O; redundant logic | `hermesSessionAdapter.ts` | 170–174 | Make sync; remove redundant check |

### 4.2 Settings / Routes

| # | Issue | File | Suggested Fix |
|---|-------|------|---------------|
| 4.2.1 | `/settings/hermes` vs `/settings/runtime` naming confusion | `Router.tsx` | 93–94 | Rename route to `/settings/runtime` and make canonical |
| 4.2.2 | `AgentSettings` page is dead code (never imported in Router) | `pages/settings/AgentSettings/index.tsx` | — | Delete or merge into `AgentsPage` |
| 4.2.3 | `AgentModalContent` only has `local` tab; redirects `remote` to `local` | `contents/AgentModalContent.tsx` | — | Sync tabs with `AgentsPage` or remove modal agent tab |
| 4.2.4 | `ExtensionSettingsPage` does not handle extension crash/reload | `ExtensionSettingsPage.tsx` | — | Add error boundary and reload button |
| 4.2.5 | `ChannelsSettingsPage` embeds `WebuiModalContent` — unrelated concepts bundled | `ChannelsSettingsPage.tsx` | — | Split into separate pages or tabs |
| 4.2.6 | `SettingsPageWrapper` duplicates nav logic from `SettingsSider` | `SettingsPageWrapper.tsx`, `SettingsSider.tsx` | — | Extract shared `SETTINGS_NAV_DEFINITION` |
| 4.2.7 | Missing settings pages: Profile, Connections, Library (PIN-gated) | — | Create `/settings/profile`, `/settings/connections`, `/settings/library` |
| 4.2.8 | `Integrations` page only shows webhooks — confusing name | `IntegrationsSettingsPage.tsx` | — | Rename to "Webhooks" or add MCP servers here |

### 4.3 White-Label

| # | Issue | File | Suggested Fix |
|---|-------|------|---------------|
| 4.3.1 | 30 copyright headers read `AionUi` in `Preview/` files | `pages/conversation/Preview/**/*.ts` | — | Change to `Headmaster` |
| 4.3.2 | Internal file names contain `Hermes` (safe but untidy) | `HermesStatusBar.tsx`, `hermesChatAdapter.ts`, etc. | — | Optional rename |
| 4.3.3 | Console log prefixes `[hermes-bootstrap]`, `[hermes]`, `[hermes:err]` | `hermesBootstrap.ts` | — | Optional: `[headmaster-bootstrap]` |

### 4.4 Tests / Build

| # | Issue | File | Suggested Fix |
|---|-------|------|---------------|
| 4.4.1 | Unused `jest` and `ts-node` in `devDependencies` | `package.json` | — | Remove |
| 4.4.2 | `better-sqlite3`, `sharp`, `node-pty` native build risks | `package.json` | — | Verify CI rebuild succeeds |
| 4.4.3 | `types.d.ts` is minimal — missing window globals | `types.d.ts` | — | Centralize `__backendPort`, `__hermesSessionToken`, etc. |
| 4.4.4 | `any` types in `thinkTagFilter.ts`, `ModalHOC.tsx`, `WebviewHost.tsx` | — | — | Add proper types |
| 4.4.5 | Vitest coverage thresholds are all 0 | `vitest.config.ts` | 86–91 | Raise incrementally (e.g., 30% statements) |
| 4.4.6 | `buildMcpServersPlugin` only runs in dev | `electron.vite.config.ts` | 130–135 | Unify dev/prod MCP build strategy |

### 4.5 Features / Screens

| # | Issue | Suggested Fix |
|---|-------|---------------|
| 4.5.1 | No workspace switcher in sidebar | Add workspace switcher component |
| 4.5.2 | No user profile section in sidebar | Add user profile avatar/name dropdown |
| 4.5.3 | No notification bell with badge | Add notification component |
| 4.5.4 | No cmd+K search bar | Add global search modal |
| 4.5.5 | No "+ New Task" primary CTA | Add global quick-action button |

---

## 5. Screen Implementation Matrix (Detailed)

| # | Screen | Route | Status | Key File | What's Implemented | What's Missing |
|---|--------|-------|--------|----------|-------------------|----------------|
| 1 | **Dashboard** | `/dashboard` | ⚠️ Partial | `pages/dashboard/index.tsx` | 4 KPI cards + 6 panels with real data hooks | **Not in sidebar** — users can't navigate to it |
| 2 | **Chat** | `/conversation/:id` | ✅ Real | `pages/conversation/index.tsx` | Streaming, files, tools, approvals, reasoning, history | P0 bugs in adapter (see §2.1) |
| 3 | **Workflows** | `/workflows` | ⚠️ Partial | `pages/workflows/index.tsx` | Skill templates list, basic UI | Runnable flows, workflow editor, execution |
| 4 | **Kanban** | `/kanban` | ⚠️ Partial | `pages/kanban/index.tsx` | Board view, columns | Drag-and-drop, task creation, persistence |
| 5 | **Runs** | `/activity` | ⚠️ Partial | `pages/activity/index.tsx` | Execution history list | Status pills, output logs, detail view |
| 6 | **Approvals** | — | ❌ Stub | `pages/approvals/index.tsx` | "Coming Soon" placeholder | Not routed; entire queue UI missing |
| 7 | **Documents** | `/documents` | ⚠️ Partial | `pages/documents/index.tsx` | File browser, knowledge base | File preview (10+ formats), search |
| 8 | **Memory** | `/memory` | ⚠️ Partial | `pages/memory/index.tsx` | Memory entries list | Categories, provider config, iframe vs native |
| 9 | **Automations** | `/scheduled` | ✅ Real | `pages/cron/ScheduledTasksPage.tsx` | Cron jobs, schedules, on/off toggles | Advanced scheduling UI |
| 10 | **Agents** | `/agents` | ⚠️ Partial | `pages/agents/index.tsx` | Roster, tabs: engines, specialists, automations | Engine assignment, profile editing, status indicators |
| 11 | **Integrations** | `/settings/integrations` | ✅ Real | `pages/settings/IntegrationsSettingsPage.tsx` | MCP servers, webhooks | Unified connection overview |
| 12 | **Channels** | `/settings/channels` | ✅ Real | `pages/settings/ChannelsSettingsPage.tsx` | Hermes gateway channels, connection status | Telegram/Discord/Slack deep config |
| 13 | **Analytics** | — | ❌ Missing | — | Nothing | Entire screen: 4-panel metrics + 5 status indicators |
| 14 | **Settings** | `/settings/*` | ✅ Real | `pages/settings/*` | All 10+ settings pages | Modal/page parity, PIN gating, Profile page |

---

## 6. Test Coverage Summary

| Area | Tests Exist? | Count | Notes |
|------|-------------|-------|-------|
| `hermesChatAdapter.ts` | ✅ | 17 | Creation, streaming, resume, edge cases |
| `hermesSessionAdapter.ts` | ✅ | 10 | Mapping, pagination, tool groups |
| `httpBridge.ts` | ✅ | 48 | Excellent coverage |
| `hermesRouteFallback.ts` | ✅ | 4 | — |
| `RuntimeSettings.tsx` | ✅ | 8 | DOM tests for schema rendering |
| `useRuntimeConnectionState.ts` | ❌ | 0 | **Gates all chat functionality** |
| `useDashboardStatus.ts` | ❌ | 0 | **Sets window globals for all HTTP** |
| `GatewayStatusIndicator.tsx` | ❌ | 0 | User-visible connection status |
| `UpdateChecker.tsx` | ❌ | 0 | User-visible update badge |
| Router / navigation | ❌ | 0 | No route-level tests |
| Settings pages (other than Runtime) | ❌ | 0 | No dedicated tests |
| **Total unit tests** | ✅ | **1,296 passed, 3 skipped** | 162 files |
| **Integration tests** | ⚠️ | 3 skipped | Live backend gate |
| **E2E tests** | ⚠️ | ~40 files | Many `test.skip` for missing CLI agents |

---

## 7. Dropped Features Verification (from Workspace)

| Feature | Expected | Status | Evidence |
|---------|----------|--------|----------|
| 3D Office scene | Dropped | ✅ Absent | Not in `pages/`, not in `components/` |
| Greek god avatars (apollo, artemis, hermes, iris, nike, pan) | Dropped | ✅ Absent | Not in `public/`, `assets/` |
| Claude assets (claude-avatar, logo, caduceus, banner) | Dropped | ✅ Absent | Not in `public/`, `assets/` |
| Conductor name | Renamed to "Orchestrator" / "Council" | ✅ Verified | No "Conductor" references in renderer |
| PostHog tracking | Dropped | ✅ Absent | Not in `package.json` |
| $HD token / bankr.bot | Dropped | ✅ Absent | Not in `package.json` or source |
| Atlas Cloud sponsor | Dropped | ✅ Absent | Not in `package.json` or source |
| RAZSOC codename | Dropped | ✅ Absent | Not in source |
| gbrain, gstack-for-hermes skills | Dropped | ✅ Absent | Not in `swarm.yaml` |

---

## 8. Recommended Sprint Plan

### Week 1 — P0 Blockers (Ship-Critical)

- [ ] Fix `params.model` fallback in `hermesChatAdapter.ts`
- [ ] Fix `message.userCreated` broadcast timing (or add rollback)
- [ ] Migrate `conversation.get` and `conversation.warmup` from IPC
- [ ] Fix `/council` redirect to `/team/default` or remove alias
- [ ] Fix all 10 white-label user-facing leaks (runtime detection, toolsets, kanban, bootstrap)
- [ ] Add `win.legalTrademarks` to `electron-builder.yml`
- [ ] Sync `electronRebuild.electronVersion`
- [ ] Clean `out/` before build in `scripts/build-with-builder.js`
- [ ] Add Dashboard to sidebar
- [ ] Decide on Approvals: implement or delete stub

### Week 2 — P1 High Priority

- [ ] Fix session resume timeout capture bug
- [ ] Fix `gateway.disconnected` hard abort — add grace period
- [ ] Remove `min_messages: 1` or inject local zero-message sessions
- [ ] Persist `profilesByStored` across reloads
- [ ] Add missing gateway event handlers (`tool.error`, `message.error`, `session.expired`)
- [ ] Fix `useRuntimeConnectionState` probe endpoint
- [ ] Add RPC WS reconnect backoff
- [ ] Fix settings redirects (`/settings/assistants`, `/settings/agent`)
- [ ] Add missing SettingsModal tabs or document exclusion
- [ ] Split `SystemSettings` into About + System
- [ ] Add i18n keys for hardcoded English strings
- [ ] Rename `aionui*` localStorage keys and event names
- [ ] Rename `cowork.svg` → `work-along.svg`
- [ ] Add tests for `useRuntimeConnectionState`, `useDashboardStatus`, `GatewayStatusIndicator`, `UpdateChecker`
- [ ] Add `CHANGELOG.md` v0.2.0 section
- [ ] Implement persistent chat composer (or scope to v0.3.0)
- [ ] Create `/analytics` or cut from spec
- [ ] Unify `SkillsHubSettings` read endpoint
- [ ] Add Memory iframe

### Week 3 — P2 Polish & Release

- [ ] Reduce `TURN_TIMEOUT_MS` to 60–90s
- [ ] Fix unsafe `as` casts in adapters
- [ ] Use stable message IDs
- [ ] Clean up 30 `AionUi` copyright headers
- [ ] Remove unused `jest` and `ts-node`
- [ ] Add `dmg.title` to `electron-builder.yml`
- [ ] Centralize window globals in `types.d.ts`
- [ ] Raise Vitest coverage thresholds
- [ ] Unify MCP build strategy
- [ ] Run final white-label grep (`WHITE-LABEL-AUDIT.md §6`)
- [ ] Build, sign, and smoke-test packaged app
- [ ] Commit intentionally and push branch
- [ ] Mark v0.2.0 release complete

---

## 9. Cross-Referenced Findings

The following issues were found by **multiple agents** and are confirmed:

| Issue | Found By | Section |
|-------|----------|---------|
| `/council` redirect broken | Audit_Settings, Audit_Features | 2.2.1, 2.5.2 |
| Dashboard invisible in sidebar | Audit_Features | 2.5.1, 3.5.3 |
| Persistent chat composer missing | Audit_Features | 3.5.1 |
| Analytics screen missing | Audit_Features | 3.5.2 |
| `conversation.get` unmigrated | Audit_Adapters | 2.1.3 |
| `profilesByStored` in-memory only | Audit_Adapters | 3.1.4 |
| `min_messages: 1` hides sessions | Audit_Adapters | 3.1.3 |
| Runtime detection white-label leaks | Audit_WhiteLabel | 2.3.1–2.3.10 |
| `win.legalTrademarks` missing | Audit_Tests | 2.4.1 |
| `CHANGELOG.md` stale | Audit_Tests | 3.4.6 |

---

*End of report. For questions or clarifications on any finding, reference the file path and line number.*
