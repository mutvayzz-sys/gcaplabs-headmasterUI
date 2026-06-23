# Headmaster TODO Backlog — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Work through all six items in `todo.md` — settings restructure, agent detection fix, memory panel fix, feature removals, composer scoping, and workspace panel fix.

**Architecture:** All changes are in `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/packages/desktop/src/`. The app is Electron + Vite + React + TypeScript. Renderer code in `@renderer/`, main process in `@process/`, preload in `@preload/`. Uses Arco Design, IconPark, UnoCSS, i18n with `react-i18next`.

**Tech Stack:** Electron 30+, React 18, TypeScript, Arco Design, Vite, Vitest

**Branch state (Phase 0):**

- Branch: `main`
- Commit: `e2227bb feat(desktop): contextual BrowserPanel, remove install check, error boundary, v0.1.2`
- Working tree: clean (no uncommitted changes)
- Baseline SHA: `e2227bb`

**Critical notes for implementer:**

- Read `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/AGENTS.md` for conventions. Arco-only for interactive components (no raw `<button>` except where existing code already uses it with custom styling). i18n for all user-facing strings. `@arco-design/web-react` + `@icon-park/react`.
- "Hermes" is allowed in env vars, IPC channel names, and backend code, but NEVER in user-visible UI strings. Use "Headmaster" instead.
- The Hermes Python runtime lives at `runtime/hermes-agent/` — DO NOT edit it. All fixes are in the desktop app source.

---

## Phase 1: Settings Page Cleanup + Restructure

### Task 1: Remove "Hermes" label from settings sider

**Objective:** Replace the "Hermes" tab label with "Headmaster" (or "Runtime") in the settings sidebar.

**Files:**

- Modify: `packages/desktop/src/renderer/pages/settings/components/SettingsSider.tsx:92-97`
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json:1136`

**Step 1:** In `SettingsSider.tsx`, change the `hermes` sider item label from `t('settings.hermes')` to `t('settings.runtime', { defaultValue: 'Runtime' })` and the icon from `<LinkCloud />` to `<Speed />` (or keep LinkCloud, it's fine).

**Step 2:** In `settings.json` line 1136, change `"hermes": "Hermes"` to `"hermes": "Runtime"` (the i18n key stays `hermes` for backwards compat, the label changes).

**Step 3:** Also change `groupHeadmasterUI` value from `"HeadmasterUI"` to `"Headmaster"` on line 1137.

**Step 4:** Run `bunx tsc --noEmit` — expect pass.

**Step 5:** Commit: `fix(settings): rename Hermes tab to Runtime in settings sidebar`

### Task 2: Replace RuntimeSettings keep/port comparison page with real settings

**Objective:** Replace the keep/port comparison view (`RuntimeSettings.tsx`) with a real settings page that surfaces actual Hermes runtime configuration. The old page was a dev/status diagnostic; the new page should show editable settings sourced from Hermes `/api/config`.

**Files:**

- Rewrite: `packages/desktop/src/renderer/pages/settings/RuntimeSettings.tsx`
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json` (remove `runtime.keep.*` and `runtime.row.*` keys, add new keys for the settings page)

**Step 1:** Rewrite `RuntimeSettings.tsx` to fetch config from `GET /api/config` (already exists in Hermes backend at line 2912 of `web_server.py`) and display editable fields. Start minimal — show:

- Model provider (dropdown from `/api/model/options`)
- Default model (dropdown)
- Active profile (from `/api/profiles/active`)
- System prompt override (textarea, reads from `/api/profiles/{name}/soul`)
- Config save button (PUT `/api/config`)

**Step 2:** Remove the `buildDefaultPorting` and `buildDefaultKept` functions, `PortRow`, `KeepRow`, and `readinessTag` types. Replace with a simpler form component.

**Step 3:** Update i18n keys — remove `settings.runtime.row.*` and `settings.runtime.keep.*` sections. Add `settings.runtime.modelProvider`, `settings.runtime.defaultModel`, `settings.runtime.activeProfile`, `settings.runtime.systemPrompt`, `settings.runtime.save`.

**Step 4:** Run `bunx tsc --noEmit` — expect pass.

**Step 5:** Commit: `refactor(settings): replace keep/port comparison with real runtime config page`

### Task 3: Move ported features under "Advanced Settings" tab

**Objective:** Create a new "Advanced Settings" tab that holds the settings that were ported from Hermes but don't belong in the main Settings category. Move webui, integrations, and capabilities there.

**Files:**

- Modify: `packages/desktop/src/renderer/pages/settings/components/SettingsSider.tsx:29-42` (BUILTIN_TAB_IDS array)
- Create: `packages/desktop/src/renderer/pages/settings/AdvancedSettings.tsx`
- Modify: `packages/desktop/src/renderer/components/layout/Router.tsx`
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json`

**Step 1:** Create `AdvancedSettings.tsx` as a tabbed container that renders the existing WebuiSettings, CapabilitiesSettings, and IntegrationsPage as sub-tabs.

**Step 2:** In `SettingsSider.tsx`, add `'advanced'` to `BUILTIN_TAB_IDS` after `'system'`. Remove `'webui'`, `'capabilities'`, `'integrations'` from the array. Add the `advanced` item to the `builtinMap` with icon `<Settings />` or `<Tool />`.

**Step 3:** In `Router.tsx`, add route `/settings/advanced` → `AdvancedSettings`. Add redirects: `/settings/webui` → `/settings/advanced`, `/settings/capabilities` → `/settings/advanced`, `/settings/integrations` → `/settings/advanced`.

**Step 4:** In `settings.json`, add `"advanced": "Advanced Settings"` (key already exists at line 304, just verify it's used as the label).

**Step 5:** Run `bunx tsc --noEmit` — expect pass.

**Step 6:** Commit: `feat(settings): add Advanced Settings tab, move webui/capabilities/integrations under it`

### Task 4: Remove old/dead settings entries

**Objective:** Clean up i18n keys and dead code from the white-label base. Remove `runtime.keep.*`, `runtime.row.*`, and any settings entries that are no longer referenced.

**Files:**

- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json`

**Step 1:** Search for all i18n keys that are no longer referenced in source code (grep for `settings.runtime.keep`, `settings.runtime.row`, `settings.runtime.status`, `settings.runtime.keptHeading`, `settings.runtime.portingHeading`, `settings.runtime.footerTitle`, `settings.runtime.footerBody`). Remove the dead ones.

**Step 2:** Run `bun run i18n:types && node scripts/check-i18n.js` if those scripts exist, or `bunx tsc --noEmit`.

**Step 3:** Commit: `chore(settings): remove dead i18n keys from runtime comparison view`

---

## Phase 2: CLI Agent Detection Fix

### Task 5: Implement local CLI agent scanner in main process

**Objective:** The Hermes backend has no `/api/agents` endpoint and no `/api/extensions/acp-adapters` endpoint. The current `getAvailableAgents.invoke()` tries both and gets empty results. Fix by implementing a local scanner in the Electron main process that probes `$PATH` for known CLI agent binaries.

**Files:**

- Create: `packages/desktop/src/process/agent/agentScanner.ts`
- Modify: `packages/desktop/src/process/bridge/index.ts` (register new bridge)
- Modify: `packages/desktop/src/common/adapter/ipcBridge.ts:914-970` (rewrite `getAvailableAgents`)

**Step 1:** Create `agentScanner.ts` in the process layer. It should:

- Define a catalog of known CLI agents: `claude` (Claude Code), `codex` (OpenAI Codex), `grok` (Grok CLI), `hermes` (Hermes Agent), `kimi` (if installed)
- For each, check if the binary exists on `$PATH` using `which`/`where` (Windows) or `execSync`
- Return `AgentMetadata[]` with `agent_source: 'builtin'`, `agent_type: 'acp'`, `available: true` for each found binary
- Include the binary path and version if obtainable

```typescript
// agentScanner.ts — skeleton
import { execSync } from 'child_process';
import type { AgentMetadata } from '@/common/adapter/ipcBridge';

const KNOWN_AGENTS = [
  { id: 'claude', name: 'Claude Code', command: 'claude', backend: 'claude' },
  { id: 'codex', name: 'OpenAI Codex', command: 'codex', backend: 'codex' },
  { id: 'grok', name: 'Grok CLI', command: 'grok', backend: 'grok' },
  { id: 'hermes', name: 'Hermes Agent', command: 'hermes', backend: 'hermes' },
];

export function scanForAgents(): AgentMetadata[] {
  const found: AgentMetadata[] = [];
  for (const agent of KNOWN_AGENTS) {
    try {
      const cmd = process.platform === 'win32' ? 'where' : 'which';
      const path = execSync(`${cmd} ${agent.command}`, { encoding: 'utf-8', timeout: 3000 }).trim().split('\n')[0];
      if (path) {
        found.push({
          id: agent.id,
          name: agent.name,
          backend: agent.backend,
          agent_type: 'acp',
          agent_source: 'builtin',
          enabled: true,
          available: true,
          command: agent.command,
        });
      }
    } catch {
      // binary not found — skip
    }
  }
  return found;
}
```

**Step 2:** Register an IPC handler in the process bridge that calls `scanForAgents()`. Wire it through `packages/desktop/src/process/bridge/index.ts`.

**Step 3:** Rewrite `getAvailableAgents` in `ipcBridge.ts` (lines 914-970) to:

1. First try the local scanner via IPC (fast, always works)
2. Then merge with any custom agents from `GET /api/agents/custom` (if the backend supports it)
3. Then merge with any ACP adapters from `/api/extensions/acp-adapters` (if available)
4. Return the combined list

**Step 4:** Run `bunx tsc --noEmit` — expect pass.

**Step 5:** Commit: `feat(agents): implement local CLI agent scanner in main process`

### Task 6: Wire refreshCustomAgents to actually work

**Objective:** The `refreshCustomAgents` IPC channel is currently a stub (`stubProvider`). Wire it to re-scan agents and re-fetch custom agents from the backend.

**Files:**

- Modify: `packages/desktop/src/common/adapter/ipcBridge.ts:971`

**Step 1:** Replace the `stubProvider` for `refreshCustomAgents` with a real implementation that calls the local scanner + backend fetch, then returns void (the SWR revalidation handles the UI update).

**Step 2:** Run `bunx tsc --noEmit` — expect pass.

**Step 3:** Commit: `fix(agents): wire refreshCustomAgents to re-scan instead of stub`

### Task 7: Verify agent detection works end-to-end

**Objective:** Confirm that after the fix, the Agent Settings page shows detected CLI agents.

**Files:** None (verification only)

**Step 1:** Run `bunx electron-vite build --config packages/desktop/electron.vite.config.ts` and launch `out/win-unpacked/Headmaster.exe`.

**Step 2:** Navigate to Settings → Agents. Verify that Claude, Codex, Grok, and/or Hermes appear in the "Detected Agents" section if they're installed on PATH.

**Step 3:** If agents don't appear, check `%APPDATA%\Headmaster\logs\` for errors from the scanner.

---

## Phase 3: Memory Panel = App, Settings = Settings

### Task 8: Make Memory left-nav render the Memory app page

**Objective:** The Memory tab in the left nav should render the Memory app directly (the `MemoryPage` at `/memory`), not a placeholder. The current `MemoryPage` at `packages/desktop/src/renderer/pages/memory/index.tsx` is real — it shows memory providers with enable/disable toggles. Verify it's rendering properly and not behind a placeholder.

**Files:**

- Verify: `packages/desktop/src/renderer/components/layout/Sider/SiderNav/Phase2Nav.tsx:30` (Memory nav entry points to `/memory`)
- Verify: `packages/desktop/src/renderer/pages/memory/index.tsx` (the Memory page)
- Verify: `packages/desktop/src/renderer/pages/memory/useMemory.ts` (the data hook)

**Step 1:** Check that `MemoryPage` is actually rendering content (not just an empty state because the backend `/api/memory` endpoint returns empty). If the backend memory endpoint isn't available, the page should still show with an "No memory provider configured" empty state — that's fine, it's the real app UI.

**Step 2:** If `MemoryPage` is a shallow launcher for an external web app (OpenConcho/Honcho), replace the external-link approach with an embedded view. The page should render the memory management UI inline, not redirect to an external URL.

**Step 3:** If the `useMemory` hook is fetching from a non-existent backend endpoint, make it resilient — show the empty state gracefully rather than an error.

**Step 4:** Commit (if changes needed): `fix(memory): ensure Memory left-nav renders the memory app inline`

### Task 9: Rename Memory settings entry to "Memory Settings"

**Objective:** The Memory entry under Settings (`/settings/memory` → `MemorySettings.tsx`) should be renamed to "Memory Settings" to distinguish it from the main Memory app.

**Files:**

- Modify: `packages/desktop/src/renderer/pages/settings/components/SettingsSider.tsx:131-136`
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json`

**Step 1:** In `SettingsSider.tsx`, change the memory sider item label from `t('settings.memory.menuLabel')` to `t('settings.memorySettings', { defaultValue: 'Memory Settings' })`.

**Step 2:** In `settings.json`, add `"memorySettings": "Memory Settings"` at the top level.

**Step 3:** Run `bunx tsc --noEmit` — expect pass.

**Step 4:** Commit: `fix(settings): rename Memory settings entry to 'Memory Settings'`

---

## Phase 4: Remove Features

### Task 10: Remove Desktop Pet entirely

**Objective:** Remove the Desktop Pet settings tab and all pet-related functionality.

**Files:**

- Delete: `packages/desktop/src/renderer/pages/settings/PetSettings.tsx`
- Modify: `packages/desktop/src/renderer/components/layout/Router.tsx:15,88` (remove PetSettings import and route)
- Modify: `packages/desktop/src/renderer/pages/settings/components/SettingsSider.tsx:130` (remove pet from BUILTIN_TAB_IDS and builtinMap)
- Modify: `packages/desktop/src/process/bridge/index.ts` (unregister systemSettingsBridge pet handlers, or leave them — they're harmless)
- Delete or leave: `packages/desktop/src/process/pet/petManager.ts` (can leave in place, just not reachable from UI)
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json` (remove `pet.*` keys if desired, or leave for now)

**Step 1:** In `SettingsSider.tsx`, remove `'pet'` from `BUILTIN_TAB_IDS` array (line 38) and remove the `pet` entry from `builtinMap` (line 130).

**Step 2:** In `Router.tsx`, remove the `PetSettings` import (line 15) and the route `/settings/pet` (line 88).

**Step 3:** Delete `PetSettings.tsx`.

**Step 4:** In `process/bridge/index.ts`, comment out or remove the pet-related bridge registrations if they cause import errors. If `petManager.ts` is imported there, remove the import.

**Step 5:** Run `bunx tsc --noEmit` — expect pass (fix any dangling imports).

**Step 6:** Commit: `refactor: remove Desktop Pet feature entirely`

### Task 11: Remove Skills feature entirely

**Objective:** Remove the Skills settings tab and the Workflows page that consumes skills.

**Files:**

- Check if Skills is already merged into Capabilities (it is — `SkillsHubSettings` was merged into `CapabilitiesSettings` with redirect from `/settings/skills-hub` → `/settings/capabilities?tab=skills`). If so, this may be partially done.
- Modify: `packages/desktop/src/renderer/pages/settings/components/SettingsSider.tsx` (if there's a skills entry, remove it)
- Check: `packages/desktop/src/renderer/pages/workflows/index.tsx` and `useSkills.ts` — if these are Phase 2 stubs, remove or stub them differently.

**Step 1:** Search for all references to "Skills" in the settings sider and routes. If Skills is already merged into Capabilities (confirmed by the redirect on Router.tsx line 83), the main work is ensuring no standalone Skills tab remains in the sidebar.

**Step 2:** If `WorkflowsPage` (`/workflows`) is a stub that lists skills, either remove it from the left nav or replace with a "coming soon" placeholder. Check `Phase2Nav.tsx` — if `/workflows` isn't in the nav items, no change needed.

**Step 3:** Remove `SkillsHubSettings.tsx` if it still exists as a standalone file (it may have been replaced by `CapabilitiesSettings`).

**Step 4:** Run `bunx tsc --noEmit` — expect pass.

**Step 5:** Commit: `refactor: remove standalone Skills feature (merged into Capabilities)`

### Task 12: Clean up Appearance settings

**Objective:** Review the Appearance settings page and remove old/unused items from the white-label base.

**Files:**

- Review: `packages/desktop/src/renderer/components/settings/SettingsModal/contents/AppearanceModalContent.tsx`
- Review: `packages/desktop/src/renderer/pages/settings/AppearanceSettings/` directory

**Step 1:** Read `AppearanceModalContent.tsx`. Current contents: theme gallery (CssThemeSettings), font sizes (chat/markdown/code), scale control. These all look legitimate.

**Step 2:** Check if there are any dead CSS theme presets that don't load or are unused. Review `presets.ts` and the `presets/` directory. Remove any that are broken or not referenced.

**Step 3:** If everything looks clean, mark this task as done with no changes needed. The appearance settings are minimal and functional.

**Step 4:** Commit (if changes needed): `chore(settings): clean up appearance settings, remove unused presets`

---

## Phase 5: Remove Persistent Composer

### Task 13: Remove BottomComposer from global layout

**Objective:** The `BottomComposer` is rendered on every screen in `Layout.tsx:428`. Remove it from the global layout so the chat input only appears on the Chat screen.

**Files:**

- Modify: `packages/desktop/src/renderer/components/layout/Layout.tsx:21,428`
- Delete (optional): `packages/desktop/src/renderer/components/layout/BottomComposer.tsx`

**Step 1:** In `Layout.tsx`, remove the import of `BottomComposer` (line 21) and the `<BottomComposer />` render (line 428).

**Step 2:** Delete `BottomComposer.tsx` if no other references exist (search confirms it's only imported in `Layout.tsx`).

**Step 3:** Verify that the Chat/Guid page has its own chat input. Check `packages/desktop/src/renderer/pages/guid/` for an existing composer/input component. The conversation page should have its own input that renders only on that page.

**Step 4:** Run `bunx tsc --noEmit` — expect pass.

**Step 5:** Commit: `refactor: remove global BottomComposer, chat input only on chat screen`

---

## Phase 6: File/Document Explorer Not Showing

### Task 14: Fix ChatSlider workspace panel conditions

**Objective:** The workspace panel (`ChatWorkspace`) only renders when `conversation.extra.workspace` exists AND `conversation.type` is one of `acp`, `codex`, or `aionrs`. If the conversation type doesn't match or there's no workspace path, it returns an empty `<div>`. Fix so the workspace panel shows for all conversation types that have a workspace path.

**Files:**

- Modify: `packages/desktop/src/renderer/pages/conversation/components/ChatSlider.tsx`

**Step 1:** Rewrite `ChatSlider.tsx` to check for workspace presence regardless of conversation type. Instead of three separate `if` blocks for `acp`/`codex`/`aionrs`, use a single check:

```typescript
const ChatSlider: React.FC<{ conversation?: TChatConversation }> = ({ conversation }) => {
  const [messageApi, messageContext] = Message.useMessage({ maxCount: 1 });

  const workspace = conversation?.extra?.workspace;
  const conversationType = conversation?.type ?? 'acp';
  const isTempWorkspace = (conversation?.extra as { is_temporary_workspace?: boolean } | undefined)?.is_temporary_workspace;

  let workspaceNode: React.ReactNode = null;
  if (workspace && conversationType) {
    workspaceNode = (
      <ChatWorkspace
        conversation_id={conversation!.id}
        workspace={workspace}
        isTemporaryWorkspace={isTempWorkspace}
        eventPrefix={conversationType}
        messageApi={messageApi}
      />
    );
  }

  if (!workspaceNode) {
    return <div></div>;
  }

  return (
    <>
      {messageContext}
      {workspaceNode}
    </>
  );
};
```

**Step 2:** Also check that `workspaceEnabled` is being passed correctly to `ChatLayout`. Search for where `ChatLayout` is instantiated and verify the `workspaceEnabled` prop isn't hardcoded to `false`.

**Step 3:** Run `bunx tsc --noEmit` — expect pass.

**Step 4:** Commit: `fix(workspace): render file explorer for all conversation types with workspace path`

### Task 15: Verify workspace panel renders in running app

**Objective:** Confirm the file explorer shows next to chat when a conversation has a workspace.

**Files:** None (verification only)

**Step 1:** Build and launch the app. Start a conversation with a workspace path (e.g., an ACP conversation with Claude Code that has a workspace directory).

**Step 2:** Verify the file explorer panel appears on the right side of the chat.

**Step 3:** If it still doesn't appear, check:

- `ChatLayout` receives `workspaceEnabled={true}` (not `false`)
- `rightSiderCollapsed` isn't stuck at `true` (check `useWorkspaceCollapse` hook default)
- The conversation actually has `extra.workspace` set in the database

---

## Phase 7: White-Label Grep Audit

### Task 16: Grep audit for upstream fingerprints

**Objective:** Ensure no "Hermes" or other upstream product names appear in user-visible UI strings.

**Files:** All renderer source files.

**Step 1:** Run a grep for user-visible strings containing "Hermes", "AionUi", "aionui", "aionrs", "Cowork" in the renderer source:

```bash
grep -rn '"Hermes\|"AionUi\|"aionui\|"aionrs\|"Cowork' packages/desktop/src/renderer/ --include="*.tsx" --include="*.ts" --include="*.json"
```

**Step 2:** For each hit, determine if it's:

- User-visible UI string → replace with "Headmaster"
- Env var / IPC channel / internal identifier → leave as-is (allowed per WHITE-LABEL-AUDIT.md)
- i18n key name → leave as-is (internal)

**Step 3:** Fix all user-visible occurrences. The main known ones from the settings page:

- `settings.json:1136` — `"hermes": "Hermes"` → `"hermes": "Runtime"` (done in Task 1)
- `settings.json:1137` — `"groupHeadmasterUI": "HeadmasterUI"` → `"groupHeadmasterUI": "Headmaster"` (done in Task 1)
- `settings.json:229` — runtime subtitle mentions "Hermes" → update
- `settings.json:234` — footerBody mentions "Hermes" → remove (page is being rewritten)
- `settings.json:237` — portingHeading "Porting from Hermes" → remove
- `settings.json:246,248,252,274` — various subtitles mentioning "Hermes" → remove

**Step 4:** Commit: `chore(white-label): remove remaining Hermes mentions from UI strings`

---

## Open Questions

1. **DEFAULT: RuntimeSettings rewrite scope** — The todo says "port over ALL Hermes settings." The Hermes backend exposes config via `GET /api/config` and `GET /api/config/schema`. The plan rewrites RuntimeSettings to use those endpoints. If the intent was instead to surface every Hermes config.yaml key in the UI, that's a bigger surface — start with the minimal set (model, profile, system prompt) and expand later. Overridable.

2. **DEFAULT: Advanced Settings tab contents** — Moving webui, capabilities, and integrations under "Advanced Settings." If some of these should stay as top-level settings tabs (e.g., capabilities might be important enough to keep visible), adjust. Overridable.

3. **DEFAULT: Skills removal** — Skills appears to already be merged into Capabilities (redirect exists). If there's a standalone Skills feature elsewhere (the Workflows page), it may need separate removal. The plan assumes Skills = the old SkillsHubSettings which is already merged. Overridable.

4. **DEFAULT: Agent scanner agent list** — The plan scans for `claude`, `codex`, `grok`, `hermes`. If there are other CLI agents to detect (kimi, xai, etc.), add them to the catalog. Per memory: "No local kimi/xai CLIs" — so the current 4 are correct. Overridable.

5. **DEFAULT: Pet manager process code** — The plan removes the Pet UI but leaves `petManager.ts` in the process layer (unreachable, harmless). If full removal is desired, also delete `petManager.ts` and unregister all pet IPC handlers. Overridable.

---

## Execution

Plan complete and saved. Two execution modes available:

1. **Autonomous (default)** — subagent-driven-development. Fresh subagent per task, two-stage review. Hands-off.
2. **Checkpointed** — I execute in my own context and stop after each task for your "continue." Slower, but you can course-correct between tasks.

Which mode?
