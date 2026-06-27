# Post-Login Runtime Connection Fixes — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix the "Headmaster: Inactive" + "Cannot assign to read only property '_backendPort'" error so the renderer connects to the Hermes dashboard after login.

**Architecture:** The root cause is `contextBridge.exposeInMainWorld('__backendPort', 0)` in the preload — it creates a read-only, non-configurable window property. When `useDashboardStatus` tries to write the real port, it throws. The port stays 0, `httpBridge` falls back to 9119, everything gets ERR_CONNECTION_REFUSED. Same for `__hermesSessionToken`. Fix: stop exposing those two via contextBridge (let the renderer hook own them as writable globals), and make the hook resilient with `defineProperty` fallback. Then clean up secondary issues: stale 9119 fallback when port is unknown, and the startup-failure flag propagation.

**Tech Stack:** Electron, React, TypeScript, Vite, Vitest, Bun

---

## Phase 0 — Branch state

**Current state (verified):**
- Branch: `main` (clean, tracking `origin/main`)
- Last commit: `2ceaf52` (chore: update changelog, todo, and add F12 DevTools shortcut for v0.2.3)
- Working tree: 10 modified files from prior session (login fix + `_backendPort` fix already applied)
- Baseline commit: `2ceaf52`

**The `_backendPort` fix is already applied and verified** (tsc clean, build passes, 1330 tests pass). The remaining tasks below target secondary issues visible in the console log the user provided.

---

## Task 1: Remove `__backendPort` and `__hermesSessionToken` from contextBridge exposure

**Status:** ✅ Already done in this session.

**Files:**
- `packages/desktop/src/preload/main.ts:89-95` — removed `contextBridge.exposeInMainWorld('__backendPort', ...)` and `__hermesSessionToken`

**Verification:** `bunx tsc --noEmit` passes, build passes, 1330 tests pass.

---

## Task 2: Make `mirrorHermesDashboardGlobals` resilient with `defineProperty` fallback

**Status:** ✅ Already done in this session.

**Files:**
- `packages/desktop/src/renderer/hooks/system/useDashboardStatus.ts:71-104` — `assignPort` / `assignToken` helpers with try/catch + `Object.defineProperty` fallback (writable, configurable)

**Verification:** `tests/unit/hooks/useDashboardStatus.test.ts` — 2 tests pass. `tests/unit/hooks/useRuntimeConnectionState.test.ts` — 2 tests pass. `tests/unit/common-adapter/httpBridge.test.ts` — 29 tests pass.

---

## Task 3: Fix `__backendStartupFailed` propagation — renderer never sees the failure flag

**Objective:** The main process sets `__backendStartupFailed` on globalThis (line 465 of index.ts) but the renderer's `main.tsx:16` reads `window.__backendStartupFailed`. The preload exposes it via contextBridge (`preload/main.ts:94`), which IS read-only and that's fine here (nobody writes to it). But the IPC `get-backend-startup-failed` handler may not exist — verify it's wired.

**Files:**
- Read: `packages/desktop/src/index.ts` (search for `get-backend-startup-failed` IPC handler)
- Read: `packages/desktop/src/preload/main.ts:87` (the `sendSync` call)

**Step 1: Check if the IPC handler exists**

Run: `grep -n "get-backend-startup-failed" packages/desktop/src/index.ts`
Expected: a handler registered via `ipcMain.on('get-backend-startup-failed', ...)`

**Step 2: If missing, add the handler**

In `packages/desktop/src/index.ts`, near the other `ipcMain.on('get-*'` handlers (around line 265-285):

```typescript
ipcMain.on('get-backend-startup-failed', (event) => {
  event.returnValue = backendStartupFailed;
});
```

**Step 3: Verify typecheck**

Run: `bunx tsc --noEmit`
Expected: clean

**Step 4: Commit**

```bash
git add packages/desktop/src/index.ts
git commit -m "fix: wire get-backend-startup-failed IPC handler so renderer sees startup failures"
```

---

## Task 4: Suppress ERR_CONNECTION_REFUSED error spam in console during startup

**Objective:** While the dashboard is booting (port=0), the renderer fires dozens of HTTP requests to 127.0.0.1:9119 (the fallback port) and floods the console with `ERR_CONNECTION_REFUSED`. The `httpBridge` should skip requests entirely when the backend port is 0 or unknown, instead of hitting a dead port.

**Files:**
- Modify: `packages/desktop/src/common/adapter/httpBridge.ts` — `httpRequest` function (around line 294)

**Step 1: Read the current `httpRequest` function**

Run: `read_file packages/desktop/src/common/adapter/httpBridge.ts offset=280 limit=40`

**Step 2: Add early-return guard when port is 0/unknown**

In `httpRequest`, before building the URL, check the port:

```typescript
function httpRequest(method: string, path: string, ...args: unknown[]): Promise<unknown> {
  const port = getBackendPort();
  if (!port || port <= 0) {
    return Promise.reject(new Error('Backend not ready (port=0)'));
  }
  // ... existing URL building
}
```

This makes the rejection fast and clean instead of a network timeout. The callers already catch and log — the error message is clearer ("Backend not ready" vs "ERR_CONNECTION_REFUSED").

**Step 3: Verify no test breaks**

Run: `bunx vitest run tests/unit/common-adapter/httpBridge.test.ts tests/unit/hooks/ 2>&1 | tail -10`
Expected: all pass (the test that sets `window.__backendPort = 0` expects fallback behavior — check if the guard breaks it)

**Step 4: If test `useDashboardStatus.test.ts` expects fallback to 9119, update expectation**

The test at `tests/unit/hooks/useDashboardStatus.test.ts:15` sets `window.__backendPort = 0` in `afterEach`. The `useRuntimeConnectionState.test.ts:15` sets `window.__backendPort = 0` and expects `getBackendPort()` to return 61946 after the snapshot mirrors it. If the guard rejects instead of returning fallback, the test still passes because `mirrorHermesDashboardGlobals` sets the port before `probe()` runs.

**Step 5: Commit**

```bash
git add packages/desktop/src/common/adapter/httpBridge.ts
git commit -m "fix: short-circuit HTTP requests when backend port is 0 instead of hitting dead fallback"
```

---

## Task 5: Throttle WebSocket reconnect attempts during startup

**Objective:** The console log shows `WebSocket connection to 'ws://127.0.0.1:9119/api/ws' failed` repeated 8+ times in rapid succession while the dashboard is booting. Add a backoff or gate so WS only connects once the port is known (>0).

**Files:**
- Modify: `packages/desktop/src/common/adapter/httpBridge.ts` — `connectWs` function (around line 688)

**Step 1: Read the current `connectWs` function**

Run: `read_file packages/desktop/src/common/adapter/httpBridge.ts offset=680 limit=40`

**Step 2: Add port guard to `connectWs`**

```typescript
function connectWs(...): WebSocket | null {
  const port = getBackendPort();
  if (!port || port <= 0) {
    return null; // Backend not ready; will retry on next poll cycle
  }
  // ... existing WS construction
}
```

**Step 3: Verify typecheck + tests**

Run: `bunx tsc --noEmit && bunx vitest run tests/unit/common-adapter/ 2>&1 | tail -10`
Expected: clean + all pass

**Step 4: Commit**

```bash
git add packages/desktop/src/common/adapter/httpBridge.ts
git commit -m "fix: gate WebSocket connect on backend port > 0 to prevent reconnect storm during startup"
```

---

## Task 6: Update CHANGELOG and todo

**Objective:** Document the `_backendPort` fix and remaining secondary fixes in the changelog and todo.

**Files:**
- Modify: `CHANGELOG.md` (add to v0.2.3 Fixed section)
- Modify: `todo.md` (mark the runtime stability items as addressed)

**Step 1: Add changelog entry**

In `CHANGELOG.md`, under `## v0.2.3 — 2026-06-26` → `### Fixed`, add:

```markdown
- **"Cannot assign to read only property '_backendPort'"** — `contextBridge.exposeInMainWorld` creates read-only window properties. Removed `__backendPort` and `__hermesSessionToken` from preload exposure; the renderer hook (`useDashboardStatus`) now owns these as writable globals. `mirrorHermesDashboardGlobals` uses `Object.defineProperty` with try/catch fallback for resilience against stale descriptors.
- **HTTP/WS error spam during startup** — `httpBridge` now short-circuits requests when backend port is 0 (backend not ready) instead of hitting the 9119 fallback port and generating ERR_CONNECTION_REFUSED storms.
```

**Step 2: Update todo.md**

In `todo.md`, under `## P0 — Release blockers` → `### Hermes runtime stability`, mark the stale port/token item as done:

```markdown
- [x] Stop crash-restart loops from leaving the UI on stale port/token (fixed: contextBridge
      read-only property conflict resolved; httpBridge guards port=0)
```

**Step 3: Commit**

```bash
git add CHANGELOG.md todo.md
git commit -m "docs: changelog + todo for _backendPort and startup error spam fixes"
```

---

## Risks / Open Questions

1. **`__backendPort` not available before first poll** — Removing the preload exposure means `window.__backendPort` is `undefined` for the first ~500ms until `useDashboardStatus` polls. `httpBridge.getBackendPort()` handles this (falls back to globalThis, then 9119). The guard in Task 4 prevents the 9119 fallback from causing errors. This is acceptable — the dashboard isn't ready anyway during that window.

2. **`SpeechStreamClient.ts:105`** — `isWebUiBrowserMode()` checks `!window.__backendPort`. If `__backendPort` is `undefined` (before first poll), this returns true and would route speech to same-origin. This only matters for the STT feature, which isn't used during the startup window. No fix needed — resolves itself in <1s.

3. **DEFAULT: Task 3 (startup-failed IPC handler)** — I haven't confirmed whether the handler is already registered. If it is, Task 3 is a no-op. The implementer should grep first and skip if already present.

4. **DEFAULT: Task 4 guard approach** — The guard rejects with "Backend not ready" instead of hitting the network. If any caller doesn't have a `.catch()`, it'll throw an unhandled rejection. All current callers in the console log DO have catches (they log `[useCronJobs] Failed to fetch`, `[useMcpServers] Failed to load`, etc.). Safe to proceed.

---

## Verification (final)

After all tasks:

```bash
cd C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-headmasterUI
bunx tsc --noEmit                              # typecheck
bunx vitest run                                 # full test suite (expect 1330+ pass, 1 pre-existing fail)
bun run dev                                     # launch dev — yellow banner should clear, sidebar shows Active
```

Manual check in the app:
- Yellow "Connecting to the runtime" banner disappears within ~2s
- Sidebar shows "Headmaster: Active" (green dot)
- No `ERR_CONNECTION_REFUSED` spam in DevTools console
- No "Cannot assign to read only property" error