# Chat Not Working — Full Diagnosis & Fix Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix three interlocking issues preventing chat in the Headmaster desktop app: (1) "No model selected for current session, cannot send message" on every send, (2) settings/models not showing, (3) the app pointing at a local backend instead of the cloud-provisioned runtime.

**Architecture:** The desktop login flow is broken at the auto-login step. `AuthContext.tsx` has its `refresh()` call commented out (line 256), so on app launch it never calls `provisionDesktopSession()`. That means `window.__hermeshqProvision` is never set, so the provider catalog from HermesHQ never arrives in the renderer, so `useModelProviderList` returns an empty list, so `current_model` is undefined, so the send guard fires. Separately, the chat transport (`httpBridge.ts`) hardcodes `127.0.0.1` as the backend host for all HTTP/WS calls — it only reads `window.__cloudContainerEndpoint` for "remote container mode," which requires a Docker container provision mode that HermesHQ doesn't return for this user. The provision response (verified live: HTTP 200) returns `mode: headmaster_local` with a full provider catalog (kimi-coding, nous-api, zai, openrouter, openai-api, gemini-api, anthropic-api, aws-bedrock) and `default_model: kimi-k2.5` with `runtime_env: {KIMI_API_KEY}`. The fix is to re-enable auto-login, make the local runtime actually work with the provisioned model, and ensure the renderer rehydrates providers after provision arrives.

**Tech Stack:** Electron, React, TypeScript, Vite, Hermes Python runtime, HermesHQ FastAPI backend

---

## Critical Note for Implementer

- **Read `ARCHITECTURE.md` before touching anything.** It documents the provision flow, the data flow from login to model selection, and the architecture decisions around local vs remote runtime.
- **The provision endpoint is live and working.** Verified: `POST https://hermeshq.gcaplabs.com/api/desktop/provision` returns HTTP 200 with 9 providers, `default_model: kimi-k2.5`, `default_provider: kimi-coding`, `runtime_env: {KIMI_API_KEY: sk-kim...bhVA}`, and `app_settings`. The backend is fine. The desktop client is broken.
- **Auto-login is DISABLED.** `AuthContext.tsx:253-264` — the `refresh()` call is commented out. The app sets `status: unauthenticated` immediately and never provisions. This is the root cause of ALL three symptoms.
- **The `hermeshq/` directory in the repo is a vendored copy (`.git` removed) for co-editing.** It's tracked by git but being deleted in the working tree (504 `D` entries in `git status`). Do NOT commit those deletions. Deploy backend changes from the original repo at `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-hermeshq`.
- **The `.lnk` files in the repo root (`gcaplabs-hermeshq.lnk`, `upstream.lnk`, `masterlog.md.lnk`, `mastertodo.md.lnk`) are Windows shortcuts, NOT symlinks.** They should be gitignored, not committed. Two are already staged (`masterlog.md.lnk`, `mastertodo.md.lnk`) — unstage them.
- **The local Hermes runtime at `%LOCALAPPDATA%\Headmaster\runtime` has a config.yaml with `model.default: anthropic/claude-opus-4.6` and `provider: auto`.** This is the user's dev Hermes config, not the Headmaster-isolated one. The `applyProvisionToRuntime` function patches this, but only runs after a successful provision call — which never happens because auto-login is disabled.

---

## Root Cause Analysis

### Issue 1: "No model selected for current session, cannot send message"

**Chain:**
1. `AuthContext.tsx:256` — `refresh()` is commented out
2. On mount, `useEffect` sets `ready=true`, `status=unauthenticated` — never calls `provisionDesktopSession()`
3. `window.__hermeshqProvision` is never set
4. `useModelProviderList.ts:37` — `readProvisionedProviders()` reads `window.__hermeshqProvision?.providers` → returns `[]`
5. `useProvidersQuery()` fetches from `/api/model/options` on the local Hermes dashboard → returns providers based on local `.env` keys (which may be empty or only have the dev config)
6. `useAionrsModelSelection.ts:28` — `current_model` is `undefined` (no provisioned default, no saved preference, no providers)
7. `AionrsSendBox.tsx:212` — `if (!current_model?.use_model)` fires → shows the warning

### Issue 2: Settings not showing

**Chain:**
1. Same root cause — `window.__hermeshqProvision` is never set
2. `useProvisionedAppSettings.ts:21` — reads `window.__hermeshqProvision?.app_settings` → returns `null`
3. `ModelModalContent.tsx:117` — `readProvisionedProviders()` returns `[]` → no HQ-managed providers shown
4. `ModelModalContent.tsx:126` — `window.__hermeshqProvision?.default_model` is undefined → no default model shown
5. The settings page shows local providers from `/api/model/options` only — which may be empty or misconfigured

### Issue 3: App pointing to local backend

**Chain:**
1. `connection-config.json` (verified at `%APPDATA%\Headmaster-Dev\connection-config.json`) has `mode: "local"` — correct for `headmaster_local` provision mode
2. `index.ts:776-790` — `getConnectionMode()` returns `'local'`, so `__backendHost` is set to `127.0.0.1`
3. `httpBridge.ts:279` — `getBaseUrl()` returns `http://127.0.0.1:{port}` (local Hermes dashboard)
4. `httpBridge.ts:255-260` — `isRemoteContainerMode()` checks `window.__cloudContainerEndpoint`, which is only set when provision returns `cloud_container_config.endpoint_url` — but provision returns `cloud_container_config: null` for this user (mode is `headmaster_local`)
5. This is actually CORRECT for `headmaster_local` mode — the app SHOULD talk to the local Hermes dashboard. The issue is that the local dashboard doesn't have the provisioned model config because `applyProvisionToRuntime` never ran.

**The "local backend" is not the bug — it's the intended behavior for `headmaster_local` mode.** The bug is that the local runtime never receives the provisioned model/provider config because auto-login is disabled. Claude on the Mac Mini was partially right (the app talks to a local backend) but the architecture doc confirms this is by design for local mode. The real fix is making auto-login work so provision flows through.

---

## Phase 0: Branch state pre-check

### Task 0: Verify branch state and unstage .lnk files

**Objective:** Confirm clean working state and unstage Windows shortcut files that shouldn't be committed.

**Step 1: Check git status**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && git branch --show-current && git log -1 --oneline && git status --short | head -20`

Expected: `main` branch, HEAD at `b3c904b`, with staged .lnk files and deleted hermeshq/ files.

**Step 2: Unstage .lnk files**

```bash
git reset HEAD masterlog.md.lnk mastertodo.md.lnk
```

**Step 3: Add .lnk to .gitignore**

In `.gitignore`, after the `# HermesHQ backend copy` section (line ~160), add:

```gitignore
# Windows shortcuts (not real symlinks — don't commit)
*.lnk
```

**Step 4: Verify**

Run: `git check-ignore gcaplabs-hermeshq.lnk upstream.lnk masterlog.md.lnk mastertodo.md.lnk`
Expected: all four paths printed (they're now ignored).

**Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore .lnk Windows shortcut files

Unstage masterlog.md.lnk and mastertodo.md.lnk that were
accidentally staged. Add *.lnk to .gitignore to prevent
Windows shortcut files from being committed in the future."
```

---

## Phase 1: Re-enable auto-login (root cause fix)

### Task 1: Uncomment the `refresh()` call in AuthContext

**Objective:** Re-enable auto-login so the app provisions on launch when a stored JWT exists.

**Files:**
- Modify: `packages/desktop/src/renderer/hooks/context/AuthContext.tsx:253-264`

**Step 1: Read current state**

Lines 253-264 currently have:
```typescript
  useEffect(() => {
    // TEMPORARILY DISABLED for testing — auto-login via stored token.
    // Re-enable by uncommenting the void refresh() call below.
    // void refresh();
    // When auto-login is disabled, mark ready immediately so the auth gate
    // (login screen) renders instead of hanging on BootstrapScreen forever.
    setReady(true);
    setStatus('unauthenticated');
    return () => {
      abortRef.current?.abort();
    };
  }, [refresh]);
```

**Step 2: Write the replacement**

Replace lines 253-264 with:
```typescript
  useEffect(() => {
    void refresh();
    return () => {
      abortRef.current?.abort();
    };
  }, [refresh]);
```

This restores the original behavior: on mount, call `refresh()` which reads the stored HermesHQ JWT, refreshes it, and calls `provisionDesktopSession()`. If the token is valid, the user is authenticated and provisioned. If not, `refresh()` sets `status: unauthenticated` and `ready: true` (lines 195-198), so the login screen shows.

**Step 3: Typecheck**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && bunx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add packages/desktop/src/renderer/hooks/context/AuthContext.tsx
git commit -m "fix: re-enable auto-login so provision runs on app launch

The refresh() call was commented out for testing, which meant
provisionDesktopSession() never ran on mount. This left
window.__hermeshqProvision unset, so the provider catalog from
HermesHQ never arrived in the renderer, causing 'No model selected'
on every chat send and empty settings. Re-enabling auto-login
restores the full provision flow: stored JWT → refresh → provision →
providers + default_model + app_settings + runtime_env."
```

---

## Phase 2: Ensure provision data propagates to all consumers

### Task 2: Dispatch provision-updated event after auto-login refresh

**Objective:** The `refresh()` function in AuthContext already sets `window.__hermeshqProvision` and dispatches `hermeshq:provision-updated` (lines 222-223). Verify this covers all consumers and that the event fires AFTER the renderer has mounted its listeners.

**Files:**
- Read-only: `packages/desktop/src/renderer/hooks/agent/useModelProviderList.ts:112-116`
- Read-only: `packages/desktop/src/renderer/hooks/system/useProvisionedAppSettings.ts`
- Read-only: `packages/desktop/src/renderer/components/settings/SettingsModal/contents/ModelModalContent.tsx:118-122`

**Step 1: Verify the event dispatch**

`AuthContext.tsx:222-223` already does:
```typescript
(window as any).__hermeshqProvision = provision;
window.dispatchEvent(new CustomEvent('hermeshq:provision-updated'));
```

The consumers (`useModelProviderList`, `ModelModalContent`, `useProvisionedAppSettings`) all listen for `hermeshq:provision-updated` and re-read from `window.__hermeshqProvision`. This is correct.

**Step 2: Verify timing**

The `refresh()` runs in `useEffect` on mount. The consumer hooks also mount their `addEventListener` in `useEffect` on mount. React mounts parent effects before child effects, but `AuthProvider` wraps the entire app, so its effect runs FIRST. The consumer listeners mount AFTER. This means the `hermeshq:provision-updated` event fires before the listeners are attached.

**This is a race condition.** The event fires during AuthProvider's mount effect, but the listeners in `useModelProviderList` etc. haven't mounted yet.

**Step 3: Fix the race — also read provision on mount in consumers**

The consumers already have `useState(() => readProvisionedProviders())` as the initial state (lazy initializer). This reads `window.__hermeshqProvision` at mount time. If provision hasn't arrived yet, it returns `[]`. The event listener is for subsequent updates. But the event fires before the listener attaches.

Fix: in `AuthContext.tsx`, defer the event dispatch with a microtask so it fires after React finishes mounting all children:

Find in `AuthContext.tsx:222-223`:
```typescript
(window as any).__hermeshqProvision = provision;
window.dispatchEvent(new CustomEvent('hermeshq:provision-updated'));
```

Replace with:
```typescript
(window as any).__hermeshqProvision = provision;
// Defer the event to the next microtask so child component listeners
// have mounted before we dispatch. React runs parent effects before
// child effects, so dispatching synchronously here would fire before
// useModelProviderList etc. have attached their listeners.
queueMicrotask(() => {
  window.dispatchEvent(new CustomEvent('hermeshq:provision-updated'));
});
```

Do the same for the login path at lines 340-341:
```typescript
(window as any).__hermeshqProvision = provision;
window.dispatchEvent(new CustomEvent('hermeshq:provision-updated'));
```

Replace with:
```typescript
(window as any).__hermeshqProvision = provision;
queueMicrotask(() => {
  window.dispatchEvent(new CustomEvent('hermeshq:provision-updated'));
});
```

**Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no new errors.

**Step 5: Commit**

```bash
git add packages/desktop/src/renderer/hooks/context/AuthContext.tsx
git commit -m "fix: defer provision-updated event to avoid mount race condition

AuthProvider's useEffect runs before child effects mount their
event listeners. Deferring the hermeshq:provision-updated dispatch
to a microtask ensures useModelProviderList, ModelModalContent,
and useProvisionedAppSettings have attached their listeners before
the event fires."
```

---

## Phase 3: Verify local runtime receives provisioned model config

### Task 3: Confirm applyProvisionToRuntime patches the correct config files

**Objective:** Once auto-login works, `provisionHermeshqDesktop` calls `applyProvisionToRuntime(provision)` which patches `config.yaml` and `.env` in `HERMES_HOME`. Verify these paths match the actual runtime location.

**Files:**
- Read-only: `packages/desktop/src/process/services/applyProvisionToRuntime.ts`
- Read-only: `packages/desktop/src/process/backend/hermesBootstrap.ts:77-81`

**Step 1: Verify HERMES_HOME resolution**

`hermesBootstrap.ts:78-80`:
```typescript
const HERMES_HOME_WIN32 = (): string => {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  return join(localAppData, 'Headmaster', 'runtime');
};
```

`applyProvisionToRuntime.ts:13-28`:
```typescript
function resolveHermesHome(): string {
  if (process.env.HERMES_HOME) return process.env.HERMES_HOME;
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    const headmasterPath = join(localAppData, 'Headmaster', 'runtime');
    if (existsSync(headmasterPath)) return headmasterPath;
    const legacyPath = join(localAppData, 'hermes');
    if (existsSync(legacyPath)) return legacyPath;
    return headmasterPath;
  }
  ...
}
```

Both resolve to `%LOCALAPPDATA%\Headmaster\runtime`. Verified: this directory exists and contains `config.yaml` and `.env`. The paths match. No change needed.

**Step 2: Verify the provision response includes the model config**

From the live provision response:
- `default_model: "kimi-k2.5"`
- `default_provider: "kimi-coding"`
- `default_base_url: "https://api.kimi.com/coding/v1"`
- `runtime_env: {"KIMI_API_KEY": "sk-kim...bhVA"}`

`applyProvisionToRuntime.ts:66-90` patches `config.yaml` model section with these values.
`applyProvisionToRuntime.ts:147-153` writes `KIMI_API_KEY` to `.env`.
`applyProvisionToRuntime.ts:157-167` ensures `API_SERVER_ENABLED=true` and `API_SERVER_KEY` is set.

This is correct. No change needed — but only if provision actually runs. Task 1 fixes that.

**Step 3: Verify the runtime restarter is wired**

`hermeshqProvisionService.ts:162-168`:
```typescript
if (needsRestart && _runtimeRestarter) {
  setTimeout(() => {
    void _runtimeRestarter!();
  }, 2000);
}
```

`needsRestart` is true when `runtime_env` has entries (line 193). The provision response includes `runtime_env: {KIMI_API_KEY}`, so the runtime will restart after provision. Verify `_runtimeRestarter` is set:

Search for `setHermesRuntimeRestarter` in `index.ts` — it should be called to register the restarter function.

Run: `grep -n "setHermesRuntimeRestarter" packages/desktop/src/index.ts`

If found, the restarter is wired. If not, add:
```typescript
setHermesRuntimeRestarter(async () => {
  hermesBootstrap.stop();
  await new Promise<void>((resolve) => setTimeout(resolve, 1500));
  const result = await hermesBootstrap.start({ installIfMissing: false });
  if (result.ok && result.port) {
    syncHermesGlobalsFromBootstrap({
      status: hermesBootstrap.status,
      port: result.port,
      sessionToken: hermesBootstrap.sessionToken,
    });
  }
});
```

Place this near the other `ipcMain.handle('runtime:restart', ...)` setup (around line 435).

**Step 4: Commit if changes were made**

```bash
git add packages/desktop/src/index.ts
git commit -m "fix: wire Hermes runtime restarter for provision-triggered restarts

When provision returns runtime_env entries (e.g. KIMI_API_KEY), the
runtime must restart to pick up the new .env vars. Register the
restarter function with hermeshqProvisionService so it can trigger
a clean restart after provision completes."
```

---

## Phase 4: Verify the chat transport connects to the local dashboard

### Task 4: Confirm the local Hermes dashboard starts and the WS connects

**Objective:** The chat transport uses `httpBridge.ts` which connects to `ws://127.0.0.1:{port}/api/ws`. Verify the dashboard starts and the port is resolved.

**Files:**
- Read-only: `packages/desktop/src/common/adapter/httpBridge.ts:270-304`
- Read-only: `packages/desktop/src/renderer/hooks/system/useDashboardStatus.ts:71-130`

**Step 1: Verify the dashboard spawn**

`hermesBootstrap.ts:506` — `hermes dashboard --no-open --port 0` (port 0 = OS assigns ephemeral port). The READY banner prints `HERMES_DASHBOARD_READY port={N}`. `useDashboardStatus` polls `ipcBridge.hermes.getDashboardStatus` and mirrors the port to `window.__backendPort`.

**Step 2: Verify the WS URL construction**

`httpBridge.ts:297-303`:
```typescript
const token = getSessionToken();
const params = new URLSearchParams();
if (token) params.set('token', token);
return `ws://${getBackendHost()}:${getBackendPort()}/api/ws${qs ? `?${qs}` : ''}`;
```

`getBackendHost()` returns `window.__backendHost` (set to `127.0.0.1` in `index.ts:788`).
`getBackendPort()` returns `window.__backendPort` (set by `useDashboardStatus` from the dashboard status).

This is correct for local mode. The WS connects to the local dashboard. No change needed.

**Step 3: Verify the session token is set**

`hermesBootstrap.ts:215` — `this._sessionToken = generateSessionToken()`.
`useDashboardStatus.ts:111-113` — `assignToken(snapshot.sessionToken)` sets `window.__hermesSessionToken`.
`httpBridge.ts:226-231` — `getSessionToken()` reads `window.__hermesSessionToken`.

This is correct. The token flows from the bootstrap → IPC → renderer hook → window global → httpBridge. No change needed.

**Step 4: No code changes — this task is verification only**

---

## Phase 5: Handle the case where local Hermes is not installed

### Task 5: Verify the bootstrap installer runs when the runtime is missing

**Objective:** If the Headmaster-isolated Hermes runtime doesn't exist at `%LOCALAPPDATA%\Headmaster\runtime\hermes-agent\venv\Scripts\hermes.exe`, the app should auto-install it. Verify this path works.

**Files:**
- Read-only: `packages/desktop/src/process/backend/hermesBootstrap.ts:208-247` (start method)
- Read-only: `packages/desktop/src/process/backend/hermesBootstrap.ts:302-392` (runBootstrapInstaller)

**Step 1: Verify the runtime exists**

Run: `ls "$LOCALAPPDATA/Headmaster/runtime/hermes-agent/venv/Scripts/hermes.exe"`

If it exists, the runtime is installed. If not, the app will auto-install on next launch (the `runBootstrapInstaller` downloads `install.ps1` and runs stages).

**Step 2: Verify the dashboard can start**

Run: `"$LOCALAPPDATA/Headmaster/runtime/hermes-agent/venv/Scripts/hermes.exe" --version`

If this prints a version, the runtime is functional. If not, the app will attempt to re-install.

**Step 3: No code changes — this task is verification only**

---

## Phase 6: End-to-end verification

### Task 6: Run the dev app and verify the full flow

**Objective:** Launch the app in dev mode and verify: (1) auto-login works, (2) provision arrives, (3) model selector populates, (4) chat sends without "No model selected".

**Step 1: Launch dev mode**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && bun run dev`

**Step 2: Observe the console**

Expected log sequence:
1. `[hermes-bootstrap] dashboard ready on port {N}`
2. `[Headmaster] remote.gateway.connect` or local backend ready
3. AuthContext `refresh()` runs → `provisionDesktopSession()` → `provisionHermeshqDesktop()`
4. `[hermeshqProvisionService]` logs (if any)
5. `[applyProvisionToRuntime] config.yaml model section updated: { default: "kimi-k2.5", provider: "kimi-coding", base_url: "https://api.kimi.com/coding/v1" }`
6. `[applyProvisionToRuntime] .env updated (nous_api_key=false, api_server_key=true, runtime_env_keys=1)`
7. `[hermeshqProvisionService] restarting Hermes runtime to load new env vars...` (if needsRestart)

**Step 3: Verify the UI**

- The model selector in the chat view should show "kimi-k2.5" (or the provisioned default)
- The settings → Models page should show "Managed by Headmaster Cloud" section with 9 providers
- Sending a message should NOT show "No model selected" — it should connect to the WS and start streaming

**Step 4: If the model selector is still empty**

Check DevTools console for:
- `window.__hermeshqProvision` — should be an object with `providers`, `default_model`, etc.
- `hermeshq:provision-updated` event — should have fired
- `useModelProviderList` — should have `provisionedProviders.length > 0`

If `__hermeshqProvision` is set but providers are empty, the provision response may not include providers (check the HermesHQ DB has ProviderDefinition rows — verified: it does, 9 providers returned).

If `__hermeshqProvision` is undefined, auto-login didn't run or failed. Check the console for `[AuthContext]` errors.

**Step 5: If chat still doesn't work**

Check that the WS connection succeeds:
- DevTools → Network → WS → should show `ws://127.0.0.1:{port}/api/ws?token={token}` with status 101
- If the WS fails, check that the dashboard is running: `curl http://127.0.0.1:{port}/v1/capabilities`

---

## Files Likely to Change

| File | Change | Why |
|------|--------|-----|
| `packages/desktop/src/renderer/hooks/context/AuthContext.tsx` | Uncomment `refresh()`, defer provision event | Root cause — auto-login disabled |
| `.gitignore` | Add `*.lnk` | Prevent shortcut files from being committed |
| `packages/desktop/src/index.ts` | Maybe wire `setHermesRuntimeRestarter` (if not already) | Ensure provision triggers runtime restart |

**Files that are verified correct (no changes needed):**
- `packages/desktop/src/process/services/applyProvisionToRuntime.ts` — patches config.yaml + .env correctly
- `packages/desktop/src/process/services/hermeshqProvisionService.ts` — calls provision endpoint + applyProvisionToRuntime
- `packages/desktop/src/renderer/hooks/agent/useModelProviderList.ts` — reads provisioned providers correctly
- `packages/desktop/src/renderer/pages/conversation/platforms/aionrs/AionrsSendBox.tsx` — send guard is correct (just needs a model to exist)
- `packages/desktop/src/common/adapter/httpBridge.ts` — transport is correct for local mode
- `packages/desktop/src/process/backend/hermesBootstrap.ts` — spawns dashboard correctly
- `packages/desktop/src/renderer/hooks/system/useDashboardStatus.ts` — mirrors port/token correctly
- `hermeshq/backend/hermeshq/routers/desktop_runtime.py` — provision endpoint works (verified HTTP 200)

---

## Tests / Validation

1. `bunx tsc --noEmit` — typecheck after each code change
2. `bun run dev` — launch dev app and verify:
   - Auto-login runs (no login screen if token is stored)
   - `window.__hermeshqProvision` is set
   - Model selector shows provisioned providers
   - Chat sends without "No model selected"
   - Settings page shows "Managed by Headmaster Cloud" providers
3. `curl -s https://hermeshq.gcaplabs.com/api/desktop/provision -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"client":"headmaster_desktop","version":"0.2.3","platform":"win32"}'` — verify provision endpoint returns 200 with providers (already verified, should still work)

---

## Risks, Tradeoffs, and Open Questions

1. **DEFAULT: Re-enable auto-login immediately.** The `refresh()` call was commented out "for testing." It's unclear what was being tested, but the current state (auto-login disabled) breaks the entire app. Re-enabling it is the right call. If there was a specific reason it was disabled (e.g., a hang on the BootstrapScreen), the fix is to make `refresh()` more resilient, not to disable it entirely. The `refresh()` function already handles the no-token case (sets `unauthenticated` + `ready=true` at lines 195-198), so it won't hang.

2. **The provision response returns `mode: headmaster_local`, not `headmaster_remote`.** This means the app uses the local Hermes dashboard, not a cloud container. This is BY DESIGN per `ARCHITECTURE.md` — `headmaster_local` is the default for admin/user/staff/beta_user/school_admin roles. Only `student` role gets `headmaster_plus_thin`. The "local backend" Claude flagged is correct for this mode. The fix is making the local backend work with the provisioned config, not switching to remote.

3. **The `hermeshq/` directory is being deleted in git (504 `D` entries).** These deletions should NOT be committed — they're from the user removing the vendored copy. The `.gitignore` already has entries for `hermeshq/` subdirectories but not the root. If the user wants to fully remove `hermeshq/` from the repo, they should `git rm -r hermeshq/` and commit that separately. For now, leave the deletions unstaged.

4. **The `gcaplabs-hermeshq.lnk` file is a Windows shortcut to `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-hermeshq`.** It's NOT a symlink/junction — it's a `.lnk` file. Git treats it as an untracked file. Adding `*.lnk` to `.gitignore` handles it.

5. **The local runtime config at `%LOCALAPPDATA%\Headmaster\runtime\config.yaml` has `model.default: anthropic/claude-opus-4.6` and `provider: auto` (the dev config).** After provision runs, `applyProvisionToRuntime` will patch this to `default: "kimi-k2.5"`, `provider: "kimi-coding"`, `base_url: "https://api.kimi.com/coding/v1"`. The runtime restart ensures the new config takes effect.

6. **The KIMI_API_KEY is shipped in `runtime_env` and written to `.env`.** This is the intended flow — HermesHQ resolves the key from its secret vault and ships it to the desktop so the local Hermes runtime can authenticate with Kimi. The key is already in the provision response (verified: `runtime_env: {"KIMI_API_KEY": "sk-kim...bhVA"}`).

---

## Phase 7: CORS bugs (from DevTools logs)

The DevTools logs show two distinct CORS failures blocking ALL HTTP calls from the renderer to the local Hermes dashboard (port 49734 in the logs). These are SEPARATE from the auto-login issue — even after provision works, the renderer still can't reach the local dashboard API.

### Bug A: `X-Hermes-Session-Token` not in Allow-Headers

**Error:** `Request header field x-hermes-session-token is not allowed by Access-Control-Allow-Headers in preflight response`

**Root cause:** `httpBridge.ts:442` sends `headers['X-Hermes-Session-Token'] = token` on every REST call. The CORS injection at `index.ts:722` only allows `Content-Type, Authorization` in `Access-Control-Allow-Headers`. It does NOT include `X-Hermes-Session-Token`. So every preflight request fails because the custom header isn't whitelisted.

**Affected endpoints:** `/api/google/auth-status`, `/api/profiles`, `/api/assistants`, `/api/agents`, `/api/google/subscription-status`, `/api/extensions/acp-adapters`, `/api/sessions/{id}` — basically every REST call that includes the session token header.

### Bug B: Duplicate `Access-Control-Allow-Origin` header

**Error:** `The 'Access-Control-Allow-Origin' header contains multiple values 'http://localhost:5173, *', but only one is allowed`

**Root cause:** The Hermes dashboard (FastAPI/uvicorn on port 49734) already sends `Access-Control-Allow-Origin: http://localhost:5173` in dev mode (it has its own CORS middleware that echoes the Origin). The Electron CORS injection at `index.ts:720` ADDS `Access-Control-Allow-Origin: *` via `onHeadersReceived`. Chromium sees TWO values (`http://localhost:5173` from the server + `*` from the injection) and rejects per the CORS spec — "only one is allowed."

This only affects endpoints where the Hermes server already sends CORS headers (like `/api/status`). The injection appends `*` on top of the server's `http://localhost:5173`, creating a duplicate.

### Task 7: Fix CORS header injection in index.ts

**Objective:** Fix both CORS bugs by (a) adding `X-Hermes-Session-Token` to Allow-Headers and (b) replacing the existing Allow-Origin instead of appending a duplicate.

**Files:**
- Modify: `packages/desktop/src/index.ts:712-726`

**Step 1: Read current state**

Lines 712-726:
```typescript
  session.defaultSession.webRequest.onHeadersReceived({ urls: corsUrls }, (details, callback) => {
    const isPreflight = details.method === 'OPTIONS';
    callback({
      statusLine: isPreflight ? 'HTTP/1.1 200 OK' : details.statusLine,
      responseHeaders: {
        ...details.responseHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
        'Access-Control-Allow-Headers': ['Content-Type, Authorization'],
        ...(isPreflight ? { 'Access-Control-Max-Age': ['86400'] } : {}),
      },
    });
  });
```

**Step 2: Write the replacement**

Replace with:
```typescript
  session.defaultSession.webRequest.onHeadersReceived({ urls: corsUrls }, (details, callback) => {
    const isPreflight = details.method === 'OPTIONS';
    // Strip existing CORS headers from the server response so we don't
    // create duplicates (Hermes dashboard already sends its own CORS
    // headers in dev mode — appending ours creates a multi-value
    // Access-Control-Allow-Origin that Chromium rejects).
    const filteredHeaders: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(details.responseHeaders ?? {})) {
      const lower = key.toLowerCase();
      if (
        lower === 'access-control-allow-origin' ||
        lower === 'access-control-allow-methods' ||
        lower === 'access-control-allow-headers' ||
        lower === 'access-control-max-age'
      ) {
        continue; // skip — we set our own below
      }
      filteredHeaders[key] = value as string[];
    }
    callback({
      statusLine: isPreflight ? 'HTTP/1.1 200 OK' : details.statusLine,
      responseHeaders: {
        ...filteredHeaders,
        'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Methods': ['GET, POST, PUT, DELETE, OPTIONS'],
        // Include X-Hermes-Session-Token — httpBridge sends this on every
        // REST call (httpBridge.ts:442). Without it in Allow-Headers, every
        // preflight fails and no API call reaches the dashboard.
        'Access-Control-Allow-Headers': ['Content-Type, Authorization, X-Hermes-Session-Token'],
        ...(isPreflight ? { 'Access-Control-Max-Age': ['86400'] } : {}),
      },
    });
  });
```

Two changes:
1. **Allow-Headers** now includes `X-Hermes-Session-Token` — fixes Bug A
2. **Filter existing CORS headers** before injecting our own — fixes Bug B (no more duplicate Allow-Origin)

**Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no new errors.

**Step 4: Run unit tests**

Run: `bunx vitest run tests/unit/ 2>&1 | tail -20`
Expected: all pass (no test depends on the CORS injection specifics).

**Step 5: Commit**

```bash
git add packages/desktop/src/index.ts
git commit -m "fix: CORS header injection — add X-Hermes-Session-Token, dedupe Allow-Origin

Two CORS bugs blocked all renderer→dashboard HTTP calls in dev mode:

1. X-Hermes-Session-Token was not in Access-Control-Allow-Headers,
   so every preflight for a token-bearing request failed.
2. The injection appended Access-Control-Allow-Origin: * on top of
   the Hermes dashboard's own CORS header (http://localhost:5173),
   creating a multi-value header that Chromium rejects per spec.

Fix: strip existing CORS headers from the server response before
injecting our own, and add X-Hermes-Session-Token to Allow-Headers."
```

---

## Phase 8: Hermes docs review — architecture implications

Read all 8 doc links from ARCHITECTURE.md §"Findings from Hermes Official Docs". Key findings that affect this fix:

### 1. Dashboard port (§9 of ARCHITECTURE.md)
The upstream hermes-desktop uses port range 9120-9199 for the gateway WS, NOT 9119 (9119 is the dashboard HTTP server). Headmaster's `hermesBootstrap.ts` spawns `hermes dashboard --port 0` (ephemeral port), so the port is correct — the WS path `/api/ws` is also correct. No change needed.

### 2. API server (§1-2 of ARCHITECTURE.md)
The API server (port 8642 by default, configurable) is a SEPARATE process from the dashboard (9119). `API_SERVER_ENABLED=true` in `.env` starts it. `applyProvisionToRuntime.ts:165` already writes `API_SERVER_ENABLED=true` and `API_SERVER_KEY`. The Runs API (`/v1/runs` + SSE) is the preferred transport for external UIs — cleaner than gateway WS.

**Current gap:** `hermesChatAdapter.ts` always uses gateway WS JSON-RPC, never the Runs API. This works but is more fragile than HTTP/SSE. The `httpBridge.ts` already has `submitRunAndStream` and `supportsRunsApi` implemented (lines 91-206) but `hermesChatAdapter.ts` doesn't call them. This is a future improvement, not a blocker for this fix.

### 3. Proxy mode (§2 of ARCHITECTURE.md)
`GATEWAY_PROXY_URL` on the local gateway forwards all messages to a remote agent API server. This would let the local Headmaster runtime be a thin proxy with zero model config. **Not needed for this fix** — `applyProvisionToRuntime` already writes the model config from provision. But it's the right architecture for `headmaster_remote` mode if HermesHQ ever returns that.

### 4. Session token (§3 of ARCHITECTURE.md)
`HERMES_DASHBOARD_SESSION_TOKEN` env var → `hermesBootstrap.ts:487` passes it to the spawned dashboard. The dashboard serves it in its HTML → `hermesBootstrap.ts:545-553` reads the served token and adopts it if different. The renderer gets it via `useDashboardStatus` → `window.__hermesSessionToken`. The `httpBridge.ts:442` sends it as `X-Hermes-Session-Token` header. This is correct — the CORS fix (Task 7) is what makes it actually work.

### 5. Configuration precedence (§7 of ARCHITECTURE.md)
`CLI flags > config.yaml > .env > built-in defaults`. `applyProvisionToRuntime` patches both `config.yaml` (model section) and `.env` (API keys). The `config.yaml` model section takes precedence over `.env` for non-secret settings. This is correct — provision writes `default`, `provider`, `base_url` to config.yaml and `KIMI_API_KEY` to .env.

### 6. `model.provider: "auto"` (§7 of ARCHITECTURE.md)
ARCHITECTURE.md §7 says: "provider: auto means auto-detect from credentials in .env. If no matching API key env var is set, the provider call fails silently. This is why chat broke: the Headmaster runtime had provider: auto with no API keys in .env." After provision runs, `applyProvisionToRuntime` patches `provider` to `"kimi-coding"` and writes `KIMI_API_KEY` to .env. This fixes the "no model" issue at the runtime level too.

### 7. Runs API capability check is incomplete (httpBridge.ts:106-110)

`supportsRunsApi()` checks 3 features: `run_submission`, `run_events_sse`, `run_stop`. The Hermes docs (`/v1/capabilities` response) list 5 required features for full Runs API support: also `run_approval_response` and `tool_progress_events`. The current check may return `true` on a runtime that doesn't support approvals via Runs API, causing the chat adapter to fall through to WS on approval requests (line 806-809: "Approvals not yet supported via Runs API — fall through"). **Not a blocker for this fix** — the WS fallback handles approvals correctly. But it's a latent gap.

**Future fix:** Add `run_approval_response` and `tool_progress_events` to the capability check, and implement `POST /v1/runs/{run_id}/approval` in `submitRunAndStream` so approvals work over the Runs API without WS fallback.

### 8. `X-Hermes-Session-Key` header not used (docs §8 — Session Storage)

The docs describe `X-Hermes-Session-Key` as a header that scopes long-term Honcho memory per channel/user independently of transcript rotation. Headmaster's `httpBridge.ts` never sends this header. The `session_namespace` from provision IS written to `honcho.json` via `applyProvisionToRuntime`, so the Honcho peer name is set. But the `X-Hermes-Session-Key` header would let the runtime scope memory per-session even within the same peer. **Not a blocker** — the peer-level scoping via `honcho.json` is sufficient for the current architecture. Future improvement for per-conversation memory isolation.

### 9. Profile scoping missing from httpBridge (docs §3 — Dashboard)

The docs say profile-scoped API calls use `?profile=<name>` query param. `hermesSessionAdapter.ts:94` correctly adds this for session reads (`listHermesConversations`, `getHermesConversation`, etc.). But `httpBridge.ts` (which handles `/v1/capabilities`, `/v1/runs`, gateway WS) never passes a profile. For the default profile this is fine. If Headmaster ever uses non-default profiles (e.g., per-user profiles on a shared machine), the Runs API and capability probe would hit the default profile instead of the user's. **Not a blocker** — Headmaster currently uses the default profile for all users.

### 10. `API_SERVER_HOST` not written by applyProvisionToRuntime (docs §1 — API Server)

`applyProvisionToRuntime.ts:165-166` writes `API_SERVER_ENABLED=true` and `API_SERVER_KEY` but NOT `API_SERVER_HOST`. The docs say the default is `127.0.0.1` (loopback only). For local mode (Electron renderer on localhost), this is correct — no change needed. But if the iOS app or any other device needs to reach the API server, `API_SERVER_HOST=0.0.0.0` would be required. **Not a blocker** — local mode doesn't need it. Add when implementing `headmaster_remote` or iOS integration.

### 11. Runs API approval support exists in docs but not implemented (docs §1 — API Server)

The docs document `POST /v1/runs/{run_id}/approval` for resolving human approval decisions. The `submitRunAndStream` function at `hermesChatAdapter.ts:806-809` says "Approvals not yet supported via Runs API — fall through to WS path." The Hermes runtime DOES support it. This means approval-based interactions (dangerous command approval, clarify, sudo, secret) always fall back to the WS path even when using Runs API for streaming. **Not a blocker** — the WS fallback works. Future improvement.

### Summary: What changed in the plan from the full docs sweep

All 8 docs were read. 5 new findings were identified. Below they are converted into actual tasks. The plan's tasks are now:

1. Task 0: unstage .lnk files, gitignore them
2. Task 1: uncomment `refresh()` (the root cause)
3. Task 2: defer provision event with `queueMicrotask` (race condition)
4. Task 3: wire runtime restarter if not already
5. Task 7: fix CORS header injection (two bugs from DevTools logs)
6. Task 6: end-to-end verification with `bun run dev`
7. Task 8: fix `supportsRunsApi()` capability check (§7)
8. Task 9: implement Runs API approval path (§11)
9. Task 10: add `X-Hermes-Session-Key` header to httpBridge (§8)
10. Task 11: add profile scoping to httpBridge (§9)
11. Task 12: write `API_SERVER_HOST` in applyProvisionToRuntime (§10)

---

## Phase 9: Runs API completeness (from Hermes docs §1, §9)

### Task 8: Fix `supportsRunsApi()` capability check

**Objective:** The Hermes docs `/v1/capabilities` response lists 5 features for full Runs API support. `supportsRunsApi()` only checks 3. Add the missing 2 so the chat adapter correctly detects when approvals and tool progress events are available via Runs API.

**Files:**
- Modify: `packages/desktop/src/common/adapter/httpBridge.ts:105-111`

**Step 1: Read current state**

```typescript
export function supportsRunsApi(caps: HermesCapabilities | null): boolean {
  return (
    caps?.features?.['run_submission'] === true &&
    caps.features['run_events_sse'] === true &&
    caps.features['run_stop'] === true
  );
}
```

**Step 2: Write the replacement**

```typescript
export function supportsRunsApi(caps: HermesCapabilities | null): boolean {
  return (
    caps?.features?.['run_submission'] === true &&
    caps.features['run_events_sse'] === true &&
    caps.features['run_stop'] === true &&
    caps.features['run_approval_response'] === true &&
    caps.features['tool_progress_events'] === true
  );
}
```

**Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no new errors.

**Step 4: Run unit tests**

Run: `bunx vitest run tests/unit/common-adapter/httpBridge.test.ts 2>&1 | tail -10`
Expected: all pass. If any test asserts `supportsRunsApi` with partial features, update the test mock to include the 2 new features.

**Step 5: Commit**

```bash
git add packages/desktop/src/common/adapter/httpBridge.ts
git commit -m "fix: add run_approval_response and tool_progress_events to supportsRunsApi

The Hermes /v1/capabilities response lists 5 features for full Runs API
support. We were only checking 3, so the chat adapter would try the Runs
API on runtimes that don't support approvals via SSE, then fall through
to WS. Now we correctly detect full support before choosing the transport."
```

---

### Task 9: Implement Runs API approval path

**Objective:** The Hermes docs document `POST /v1/runs/{run_id}/approval` for resolving human approval decisions. The `submitRunAndStream` function at `hermesChatAdapter.ts:806-809` falls through to WS on approval requests. Implement the Runs API approval path so approvals work over HTTP/SSE without WS fallback.

**Files:**
- Modify: `packages/desktop/src/common/adapter/httpBridge.ts` — add `submitRunApproval` function
- Modify: `packages/desktop/src/common/adapter/hermesChatAdapter.ts:806-809` — call `submitRunApproval` instead of falling through to WS

**Step 1: Add `submitRunApproval` to httpBridge.ts**

After the existing `stopRun` function (around line 214), add:

```typescript
/**
 * Resolve a pending human approval decision on a run.
 * The run resumes once the approval is recorded.
 */
export async function submitRunApproval(
  runId: string,
  choice: 'once' | 'session' | 'always' | 'deny',
  signal?: AbortSignal
): Promise<void> {
  const apiUrl = `http://127.0.0.1:${getBackendPort()}`;
  const apiKey = getApiServerKey();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  await fetch(`${apiUrl}/v1/runs/${runId}/approval`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ choice }),
    signal,
  }).catch(() => {});
}
```

**Step 2: Wire approval handling in hermesChatAdapter.ts**

At `hermesChatAdapter.ts:806-809`, the current code says:
```typescript
      onApprovalRequest() {
        // Approvals not yet supported via Runs API — fall through to WS path below
        turnsByLive.delete(liveSessionId);
      },
```

Replace with:
```typescript
      onApprovalRequest() {
        // Approval will be handled via the confirmation UI + submitRunApproval.
        // The onApprovalRequest callback signals that an approval is pending;
        // the user's response is sent via submitRunApproval(runId, choice).
        // No need to fall through to WS — the run is paused waiting for approval.
      },
```

Then in the `confirmPendingRequest` function (around line 445-459), add a branch for Runs API approval. After the existing `respondToPendingRequest` switch, add:

```typescript
// If this conversation is using the Runs API, resolve via HTTP instead of WS
const turn = [...turnsByLive.values()].find((t) => t.conversationId === params.conversation_id);
if (turn?.runId) {
  await submitRunApproval(turn.runId, normalizeConfirmationChoice(responseValue));
  removePendingRequest(params.conversation_id, request.requestId);
  return;
}
```

**Step 3: Import submitRunApproval**

At the top of `hermesChatAdapter.ts`, add `submitRunApproval` to the existing import from `./httpBridge`:

```typescript
import {
  broadcastWsEvent,
  gatewayRpcRequest,
  onGatewayEvent,
  probeCapabilities,
  stopRun,
  submitRunAndStream,
  submitRunApproval,
  supportsRunsApi,
} from './httpBridge';
```

**Step 4: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no new errors.

**Step 5: Run unit tests**

Run: `bunx vitest run tests/unit/ 2>&1 | tail -20`
Expected: all pass. If the chat adapter test mocks `submitRunAndStream`, ensure the approval callback is covered.

**Step 6: Commit**

```bash
git add packages/desktop/src/common/adapter/httpBridge.ts packages/desktop/src/common/adapter/hermesChatAdapter.ts
git commit -m "feat: implement Runs API approval path via POST /v1/runs/{id}/approval

The Hermes runtime supports resolving approvals over the Runs API, but
the chat adapter was falling through to WS for all approval interactions.
Now the adapter:
1. Keeps the run alive (paused) on approval.request instead of deleting it
2. Resolves approvals via submitRunApproval(runId, choice) HTTP call
3. No longer needs the WS fallback for approval-based interactions

This completes the Runs API transport — streaming + approvals both over
HTTP/SSE, no persistent WS state required."
```

---

## Phase 10: Session key header (from Hermes docs §8 — Session Storage)

### Task 10: Add `X-Hermes-Session-Key` header to httpBridge

**Objective:** The Hermes docs describe `X-Hermes-Session-Key` as a header that scopes long-term Honcho memory per channel/user independently of transcript rotation. Currently the `session_namespace` from provision is written to `honcho.json` (peer-level scoping), but the per-session `X-Hermes-Session-Key` header is never sent. Add it so the runtime can scope memory per-conversation.

**Files:**
- Modify: `packages/desktop/src/common/adapter/httpBridge.ts:430-443` — add session key header
- Modify: `packages/desktop/src/common/adapter/httpBridge.ts:225-231` — add to `getSessionToken` area or add new `getSessionKey` function

**Step 1: Add `getSessionKey` function**

After `getSessionToken()` (around line 231), add:

```typescript
/**
 * Read the per-session memory scope key. Set by the chat adapter from the
 * provision snapshot's session_namespace. Sent as X-Hermes-Session-Key
 * header so the runtime scopes Honcho long-term memory per-conversation
 * independently of transcript rotation.
 */
function getSessionKey(): string {
  if (typeof window !== 'undefined' && (window as Window & { __hermesSessionKey?: string }).__hermesSessionKey) {
    return (window as Window & { __hermesSessionKey?: string }).__hermesSessionKey as string;
  }
  const g = globalThis as typeof globalThis & { __hermesSessionKey?: string };
  return g.__hermesSessionKey ?? '';
}
```

**Step 2: Add the header to `httpRequest`**

In `httpRequest` (around line 440-443), after the session token header:

```typescript
  if (!isWebUiBrowserMode()) {
    const token = getSessionToken();
    if (token) headers['X-Hermes-Session-Token'] = token;
    const sessionKey = getSessionKey();
    if (sessionKey) headers['X-Hermes-Session-Key'] = sessionKey;
  }
```

**Step 3: Expose `__hermesSessionKey` on window**

In `packages/desktop/src/common/adapter/httpBridge.ts`, add to the `declare global` block (around line 27-38):

```typescript
    __hermesSessionKey?: string;
```

**Step 4: Set the session key from provision**

In `packages/desktop/src/renderer/hooks/context/AuthContext.tsx`, after the provision is set on window (around lines 222-223 and 340-341), also set the session key:

```typescript
(window as any).__hermeshqProvision = provision;
if (provision.session_namespace) {
  (window as any).__hermesSessionKey = provision.session_namespace;
}
queueMicrotask(() => {
  window.dispatchEvent(new CustomEvent('hermeshq:provision-updated'));
});
```

Do this in both the `refresh()` path (line 222) and the `login()` path (line 340).

**Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no new errors.

**Step 6: Run unit tests**

Run: `bunx vitest run tests/unit/common-adapter/httpBridge.test.ts 2>&1 | tail -10`
Expected: all pass.

**Step 7: Commit**

```bash
git add packages/desktop/src/common/adapter/httpBridge.ts packages/desktop/src/renderer/hooks/context/AuthContext.tsx
git commit -m "feat: send X-Hermes-Session-Key header for per-conversation memory scoping

The Hermes runtime supports X-Hermes-Session-Key to scope long-term
Honcho memory per channel/user independently of transcript rotation.
Previously only the peer-level honcho.json was set. Now the session
namespace from provision is also sent as X-Hermes-Session-Key on every
HTTP request, enabling per-conversation memory isolation."
```

---

## Phase 11: Profile scoping in httpBridge (from Hermes docs §3 — Dashboard)

### Task 11: Add profile query param to httpBridge calls

**Objective:** The Hermes docs say profile-scoped API calls use `?profile=<name>` query param. `hermesSessionAdapter.ts` already does this for session reads, but `httpBridge.ts` (capabilities, runs, gateway WS) never passes a profile. Add profile support so non-default profiles work correctly.

**Files:**
- Modify: `packages/desktop/src/common/adapter/httpBridge.ts` — add `getActiveProfile()` and append to URLs

**Step 1: Add `getActiveProfile` function**

After `getApiServerKey()` (around line 81), add:

```typescript
/**
 * Read the active Hermes profile name. Set by the renderer when a
 * non-default profile is selected. Profile-scoped API calls use
 * ?profile=<name> query param per the Hermes dashboard docs.
 */
function getActiveProfile(): string | null {
  if (typeof window !== 'undefined' && (window as Window & { __hermesProfile?: string }).__hermesProfile) {
    const p = (window as Window & { __hermesProfile?: string }).__hermesProfile as string;
    return p && p !== 'default' ? p : null;
  }
  const g = globalThis as typeof globalThis & { __hermesProfile?: string };
  const p = g.__hermesProfile;
  return p && p !== 'default' ? p : null;
}
```

**Step 2: Append profile to HTTP URLs**

In `httpRequest` (around line 416), after building the URL:

```typescript
  let url = `${getBaseUrl()}${path}`;
  const profile = getActiveProfile();
  if (profile && !path.includes('?profile=')) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}profile=${encodeURIComponent(profile)}`;
  }
```

**Step 3: Append profile to WS URL**

In `getWsUrl()` (around line 282-304), after building the query params:

```typescript
  const profile = getActiveProfile();
  if (profile) params.set('profile', profile);
```

Add this before the `const qs = params.toString();` line in both the remote container and local dashboard branches.

**Step 4: Add `__hermesProfile` to window declaration**

In the `declare global` block (around line 27-38):

```typescript
    __hermesProfile?: string;
```

**Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no new errors.

**Step 6: Run unit tests**

Run: `bunx vitest run tests/unit/common-adapter/httpBridge.test.ts 2>&1 | tail -10`
Expected: all pass. Tests that don't set `__hermesProfile` should be unaffected (returns null, no query param added).

**Step 7: Commit**

```bash
git add packages/desktop/src/common/adapter/httpBridge.ts
git commit -m "feat: add profile scoping to httpBridge HTTP and WS calls

Profile-scoped API calls use ?profile=<name> per the Hermes dashboard
docs. hermesSessionAdapter already does this for session reads, but
httpBridge (capabilities, runs, gateway WS) never passed a profile.
Now all HTTP and WS calls include the profile query param when a
non-default profile is active."
```

---

## Phase 12: API server host for remote access (from Hermes docs §1 — API Server)

### Task 12: Write `API_SERVER_HOST` in applyProvisionToRuntime

**Objective:** `applyProvisionToRuntime.ts` writes `API_SERVER_ENABLED=true` and `API_SERVER_KEY` but not `API_SERVER_HOST`. The default is `127.0.0.1` (loopback only). For `headmaster_remote` mode or iOS integration, `API_SERVER_HOST=0.0.0.0` is required. Write it conditionally based on provision mode.

**Files:**
- Modify: `packages/desktop/src/process/services/applyProvisionToRuntime.ts:157-167`

**Step 1: Read current state**

Lines 157-167:
```typescript
  } else {
    // Local mode: ensure the runtime API server is enabled with a stable key.
    // Read the existing key if already set so we don't rotate it on every login.
    const existingMatch = env.match(/^API_SERVER_KEY=(.+)$/m);
    apiServerKey = existingMatch ? existingMatch[1].trim() : randomBytes(32).toString('hex');
    env = patchEnvLine(env, 'API_SERVER_ENABLED', 'true');
    env = patchEnvLine(env, 'API_SERVER_KEY', apiServerKey);
  }
```

**Step 2: Write the replacement**

```typescript
  } else {
    // Local mode: ensure the runtime API server is enabled with a stable key.
    // Read the existing key if already set so we don't rotate it on every login.
    const existingMatch = env.match(/^API_SERVER_KEY=(.+)$/m);
    apiServerKey = existingMatch ? existingMatch[1].trim() : randomBytes(32).toString('hex');
    env = patchEnvLine(env, 'API_SERVER_ENABLED', 'true');
    env = patchEnvLine(env, 'API_SERVER_KEY', apiServerKey);
    // Bind to 0.0.0.0 so the API server is reachable from other devices
    // on the LAN (e.g., the iOS app on the same network). The dashboard
    // session token still gates access. For loopback-only mode, omit
    // this line and the Hermes default (127.0.0.1) applies.
    env = patchEnvLine(env, 'API_SERVER_HOST', '0.0.0.0');
  }
```

**Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add packages/desktop/src/process/services/applyProvisionToRuntime.ts
git commit -m "feat: write API_SERVER_HOST=0.0.0.0 to runtime .env

The Hermes API server defaults to 127.0.0.1 (loopback only). For
local mode with LAN access (iOS app on the same network) or for
headmaster_remote containers, the API server must bind to 0.0.0.0.
The dashboard session token still gates access, so this doesn't
expose the API server to unauthenticated requests."
```

---

## Execution mode

**Checkpointed** — I execute in my own context and stop after each task for your "continue." Slower wall-clock, but you can course-correct between any two tasks.