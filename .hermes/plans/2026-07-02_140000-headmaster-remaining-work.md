# Headmaster Remaining Work Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Complete the remaining open items from `mastertodo.md`: the desktop `/v1` migration (the big one — remote mode is broken because sessions + prompt submission still use legacy WS-RPC), the VPS runtime image rebuild, iOS build verification, hermeshq local sync, backend lint tooling, the beta cold-VPS rehearsal, and cherry-pick any useful upstream commits from AionUi v2.1.22–v2.1.27 and Hermes Agent v0.18.0.

**Architecture:** The desktop app's remote mode is currently half-migrated: response streaming uses `/v1/responses` SSE (good), but session creation, prompt submission, interruption, and interactive approvals still use the legacy WebSocket JSON-RPC (`gatewayRpcRequest` → `wss://<runtime>/api/ws`). The Agent37 runtime has no `/api/ws` endpoint, so in remote mode the WS never connects → "Headmaster: Inactive" and chat can't send prompts or create sessions. The fix: migrate every `gatewayRpcRequest` call site in `hermesChatAdapter.ts` and `useRuntimeConnectionState.ts` to the Agent37 `/v1` REST surface, and retire `connectRpcWs`/`gatewayRpcRequest`/`getWsUrl` for remote mode.

**Tech Stack:** TypeScript/Electron (desktop), Python/FastAPI (HermesHQ), Docker (VPS runtime image), Swift (iOS), bun (build).

**Repos (all at workspace root `C:\Users\Matve\Desktop\gcap-labs\`):**
- `gcaplabs-headmasterUI/` — Electron desktop (build target, `main` branch, clean)
- `gcaplabs-hermeshq/` — HermesHQ backend (FastAPI, `main` at `c258d59`, 1 commit behind origin — just a version bump)
- `gcaplabs-console/` — Next.js console (deployed on Vercel, live at `console.gcaplabs.com`)
- `gcaplabs-ios/` — iOS app at `gcaplabs-ios/scarf/` (commit `0105789` on `origin/main`, needs Mac to build-verify)
- `_support/upstream/aionui/` — AionUi upstream (6 tags behind: v2.1.22 → v2.1.27)
- `_support/upstream/hermes-agent-desktop/` — Hermes Desktop upstream (behind by ~150+ commits, tags v2026.3.12 → v2026.7.1)

---

## Critical Notes for Implementer

1. **AGENTS.md is the law.** Read `gcaplabs-headmasterUI/AGENTS.md` before touching anything. White-label rules: never surface Hermes/Nous/AionUi in UI strings. `hermes` is fine in env vars, URL schemes, Python dirs, and CLI names.

2. **The desktop /v1 migration is the #1 priority.** This is what's blocking remote mode from working. Everything else is secondary — infra rebuild, iOS build, lint, rehearsal.

3. **Local-mode WS must keep working.** The legacy WS-RPC path (`connectRpcWs`, `gatewayRpcRequest`) is still used in local-dashboard mode (when the Hermes dashboard runs locally with a real `/api/ws` endpoint). Only the **remote container mode** needs to skip WS entirely and use `/v1` REST. Gate the migration on `isRemoteContainerMode()`.

4. **Agent37 Gateway has no interactive approval/clarify/sudo/secret HTTP surface.** We are EXTENDING the gateway to add this. The gateway source confirms zero support — the worker protocol (`worker-protocol.ts`) has no message types for approval/clarify/sudo/secret, and the Python worker's only `clarify_callback` returns a hardcoded "user is not available" string. We extend the gateway with: (a) new worker protocol message types, (b) real callbacks in the Python worker that pause and emit events, (c) new SSE event types, (d) a `POST /v1/responses/{id}/interactive` HTTP route for submitting responses, (e) desktop client wiring. This keeps everything on the unified `/v1` REST contract.

5. **`vps.env` is gitignored. Never commit secrets.**

6. **Desktop dev testing:** `bun run dev` (not electron-vite build + exe launch). The GCAP-Labs folder is synced to Google Drive — minimize bloat (no node_modules, .next, out dirs in the sync).

7. **Execution mode: Checkpointed** — the user said "just do them" for this session but the plan covers future sessions. Default to in-context execution with per-task pauses if the user asks for checkpoint mode.

---

## Phase 0: Branch State Pre-Check ✅

Already verified:
- `gcaplabs-headmasterUI/` — on `main`, clean working tree (one untracked plan file in `.hermes/plans/`), HEAD at `cd4fd54`
- `gcaplabs-hermeshq/` — on `main`, clean, 1 commit behind origin (version bump only — trivial pull)
- `gcaplabs-console/` — on `main`, clean, at `2fcab92`
- Baseline: `cd4fd54` (headmasterUI), `c258d59` (hermeshq)

No action needed.

---

## Phase 1: Desktop `/v1` Migration (PRIORITY — remote mode is broken)

This is the core work. The mastertodo.md section "🔴 Desktop remote-runtime /v1 migration" documents the exact problem and call sites.

### Task 1: Fix `useRuntimeConnectionState.probe()` — quick win

**Objective:** Make the "Active/Inactive" status indicator accurate in remote mode by probing `/v1/health` instead of WS `session.list`.

**Files:**
- Modify: `packages/desktop/src/renderer/hooks/system/useRuntimeConnectionState.ts` (73 lines total)

**Step 1: Read current state**

The `probe()` function (line 33-58) currently calls `gatewayRpcRequest('session.list', { limit: 1 }, 10_000)` — this hits the WS which doesn't exist in remote mode.

**Step 2: Write the fix**

Replace the `probe` callback (lines 33-58) with:

```typescript
const probe = useCallback(async () => {
  // Remote container mode: probe /v1/health directly (no WS available)
  if (typeof window !== 'undefined' && (window as any).__cloudContainerEndpoint) {
    try {
      const endpoint = (window as any).__cloudContainerEndpoint as string;
      const basePath = (window as any).__runtimeApiBasePath || '/v1';
      const bearer = (window as any).__runtimeBearerToken || '';
      const res = await fetch(`${endpoint}${basePath}/health`, {
        headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        connectedRef.current = true;
        setState('connected');
        setReason(undefined);
      } else {
        const wasConnected = connectedRef.current;
        connectedRef.current = false;
        setState(wasConnected ? 'reconnecting' : 'failed');
        setReason(`Runtime returned ${res.status}`);
      }
    } catch (error) {
      const wasConnected = connectedRef.current;
      connectedRef.current = false;
      setState(wasConnected ? 'reconnecting' : 'failed');
      setReason(safeReason(error));
    }
    return;
  }

  // Local dashboard mode: use existing WS-RPC probe
  const port = window.__backendPort;
  if (!port) {
    connectedRef.current = false;
    setState(dashboard.status === 'failed' || dashboard.status === 'not-installed' ? 'failed' : 'starting');
    setReason(dashboard.lastError || undefined);
    return;
  }

  try {
    await gatewayRpcRequest('session.list', { limit: 1 }, 10_000);
    try {
      await httpRequest('GET', '/api/status');
    } catch {
      // Optional status endpoint; RPC success is authoritative.
    }
    connectedRef.current = true;
    setState('connected');
    setReason(undefined);
  } catch (error) {
    const wasConnected = connectedRef.current;
    connectedRef.current = false;
    setState(wasConnected ? 'reconnecting' : 'failed');
    setReason(safeReason(error));
  }
}, [dashboard.lastError, dashboard.status]);
```

**Step 3: Typecheck**

Run: `cd packages/desktop && bunx tsc --noEmit`
Expected: PASS (no new type errors)

**Step 4: Commit**

```bash
git add packages/desktop/src/renderer/hooks/system/useRuntimeConnectionState.ts
git commit -m "fix(runtime): probe /v1/health in remote mode for accurate status indicator"
```

### Task 2: Migrate `session.create` → `POST /v1/responses`

**Objective:** Replace the WS-RPC `session.create` call with a `/v1/responses` POST (which creates a session if no `session_id` is provided).

**Files:**
- Modify: `packages/desktop/src/common/adapter/hermesChatAdapter.ts` (line 722 area)
- Modify: `packages/desktop/src/common/adapter/httpBridge.ts` (add a `createRemoteSession` helper)

**Step 1: Read the current `session.create` call site**

At `hermesChatAdapter.ts:722`:
```typescript
const created = await gatewayRpcRequest<HermesSessionCreateResponse>('session.create', { ... });
```

**Step 2: Add `createRemoteSession` to httpBridge.ts**

Add after `cancelResponse` (around line 520):

```typescript
/**
 * Start a new session in remote container mode by POSTing to /v1/responses
 * with no session_id (the gateway creates a new session).
 * Returns the new session_id from the response.created SSE event.
 */
export async function createRemoteSession(
  callbacks: Pick<ResponseStreamCallbacks, 'onError'>
): Promise<{ sessionId: string } | null> {
  const baseUrl = getRuntimeV1BaseUrl();
  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: runtimeHeaders(true),
      body: JSON.stringify({ input: '', stream: true }),
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
      return null;
    }
    // Consume just enough to get the session_id from response.created
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const sessionId = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 10_000);
      (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { clearTimeout(timeout); resolve(null); return; }
          buf += decoder.decode(value, { stream: true });
          const blocks = buf.split('\n\n');
          buf = blocks.pop() ?? '';
          for (const block of blocks) {
            const dataLines = block.split('\n').filter(l => l.startsWith('data: '));
            if (!dataLines.length) continue;
            try {
              const evt = JSON.parse(dataLines.map(l => l.slice(6)).join('\n'));
              if (evt.session_id) { clearTimeout(timeout); resolve(evt.session_id); return; }
              if (evt.event === 'response.completed' || evt.event === 'response.failed') {
                clearTimeout(timeout); resolve(null); return;
              }
            } catch { /* skip */ }
          }
        }
      })();
    });
    if (!sessionId) return null;
    // Cancel the empty-input response immediately — we just wanted the session
    await fetch(`${baseUrl}/responses/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST', headers: runtimeHeaders()
    }).catch(() => {});
    return { sessionId };
  } catch {
    return null;
  }
}
```

**Step 3: Update `hermesChatAdapter.ts` to use `createRemoteSession` in remote mode**

At the `session.create` call site (~line 722), wrap with a mode check:

```typescript
// Before:
const created = await gatewayRpcRequest<HermesSessionCreateResponse>('session.create', { ... });

// After:
let created: HermesSessionCreateResponse;
if (isRemoteContainerMode()) {
  const remote = await createRemoteSession({ onError: (msg) => { /* propagate */ } });
  if (!remote) throw new Error('Failed to create remote session');
  created = { session_id: remote.sessionId };
} else {
  created = await gatewayRpcRequest<HermesSessionCreateResponse>('session.create', { ... });
}
```

**Step 4: Typecheck + commit**

```bash
bunx tsc --noEmit
git add packages/desktop/src/common/adapter/httpBridge.ts packages/desktop/src/common/adapter/hermesChatAdapter.ts
git commit -m "feat(remote): migrate session.create to POST /v1/responses in remote mode"
```

### Task 3: Migrate `session.resume` → `GET /v1/sessions/{id}`

**Objective:** Replace the WS-RPC `session.resume` call with a REST GET to retrieve transcript history.

**Files:**
- Modify: `packages/desktop/src/common/adapter/hermesChatAdapter.ts` (line 676 area)
- Modify: `packages/desktop/src/common/adapter/httpBridge.ts` (add `getRemoteSession`)

**Step 1: Add `getRemoteSession` to httpBridge.ts**

```typescript
/**
 * Retrieve a session's transcript in remote mode via GET /v1/sessions/{id}.
 */
export async function getRemoteSession(sessionId: string): Promise<HermesSessionResumeResponse | null> {
  const baseUrl = getRuntimeV1BaseUrl();
  try {
    const res = await fetch(`${baseUrl}/sessions/${encodeURIComponent(sessionId)}`, {
      headers: runtimeHeaders(),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Map the Agent37 session shape to HermesSessionResumeResponse
    return {
      session_id: sessionId,
      resumed: 'ok',
      message_count: data.messages?.length ?? 0,
      messages: data.messages ?? [],
      info: { cwd: data.cwd, model: data.model, running: data.running },
    };
  } catch {
    return null;
  }
}
```

**Step 2: Update the `session.resume` call site**

At `hermesChatAdapter.ts:676`:

```typescript
// Before:
const resumed = await gatewayRpcRequest<HermesSessionResumeResponse>('session.resume', { ... });

// After:
let resumed: HermesSessionResumeResponse;
if (isRemoteContainerMode()) {
  const remote = await getRemoteSession(sessionId);
  if (!remote) throw new Error('Failed to resume remote session');
  resumed = remote;
} else {
  resumed = await gatewayRpcRequest<HermesSessionResumeResponse>('session.resume', { ... });
}
```

**Step 3: Typecheck + commit**

### Task 4: Migrate `prompt.submit` → `POST /v1/responses`

**Objective:** Replace WS-RPC `prompt.submit` (sends a message to an existing session) with `POST /v1/responses` carrying `session_id` + input.

**Files:**
- Modify: `packages/desktop/src/common/adapter/hermesChatAdapter.ts` (lines 933, 945)

**Step 1: Read the current call sites**

Lines 933 and 945 both call:
```typescript
await gatewayRpcRequest('prompt.submit', { session_id: liveSessionId, text });
```

**Step 2: Migrate**

In remote mode, `submitResponseAndStream` already handles `POST /v1/responses` with `session_id` + input + SSE streaming. The adapter needs to route prompt submission through that existing path instead of WS-RPC.

Look at the surrounding code to understand the flow — `submitResponseAndStream` is already imported and used for the streaming path. The `prompt.submit` calls at 933/945 appear to be the non-streaming fallback or the initial prompt send. If they're already handled by the SSE path, the WS calls may be redundant in remote mode.

**Step 3: Write the migration**

```typescript
// At lines 933/945, wrap with:
if (isRemoteContainerMode()) {
  // In remote mode, submitResponseAndStream already sends the prompt via POST /v1/responses.
  // The WS prompt.submit call is redundant — skip it.
} else {
  await gatewayRpcRequest('prompt.submit', { session_id: liveSessionId, text });
}
```

**Step 4: Typecheck + commit**

### Task 5: Migrate `session.interrupt` → `POST /v1/responses/{id}/cancel`

**Objective:** Replace WS-RPC session interrupt with the `/v1` cancel endpoint.

**Files:**
- Modify: `packages/desktop/src/common/adapter/hermesChatAdapter.ts` (lines 969, 973)

**Step 1: Read current call sites**

Lines 969 and 973:
```typescript
await gatewayRpcRequest('session.interrupt', { session_id: liveSessionId });
```

**Step 2: Migrate**

In remote mode, use `cancelResponse(responseId)` (already exists in httpBridge.ts):

```typescript
// Before:
await gatewayRpcRequest('session.interrupt', { session_id: liveSessionId });

// After:
if (isRemoteContainerMode()) {
  if (activeTurn?.responseId) {
    await cancelResponse(activeTurn.responseId);
  }
} else {
  await gatewayRpcRequest('session.interrupt', { session_id: liveSessionId });
}
```

**Step 3: Typecheck + commit**

### Task 6: Extend Agent37 Gateway with interactive flows (approval/clarify/sudo/secret)

**Objective:** The Agent37 Gateway has zero support for interactive human-in-the-loop flows. We extend it with a proper `/v1` REST surface so the desktop client can handle approvals, clarifications, sudo prompts, and secret requests without WebSocket.

**Architecture of the extension:**
```
Desktop client  ──POST /v1/responses/{id}/interactive──▶  Gateway  ──▶  Worker
     ▲                                                        │           │
     │  SSE: response.interactive.requested                    │           │
     └────────────────────────────────────────────────────────┘           │
                                                                          │
Agent loop pauses on approval/clarify/sudo/secret ────────────────────────┘
```

**Files:**
- `_support/upstream/agent37/gateway/server/adapters/worker-protocol.ts` — add message types
- `_support/upstream/agent37/gateway/server/workers/hermes_worker.py` — add real callbacks
- `_support/upstream/agent37/gateway/server/responses.ts` — emit SSE events, handle interactive response
- `_support/upstream/agent37/gateway/server/routes/responses.ts` — add `POST /:id/interactive` route
- `_support/upstream/agent37/gateway/shared/types.ts` — add SSE event types
- `gcaplabs-headmasterUI/packages/desktop/src/common/adapter/httpBridge.ts` — add `submitRemoteInteractive`
- `gcaplabs-headmasterUI/packages/desktop/src/common/adapter/hermesChatAdapter.ts` — wire interactive calls

**Step 1: Extend the worker protocol with interactive message types**

In `worker-protocol.ts`, add to `WorkerEvent`:
```typescript
  | {
      id: string;
      type: 'interactive_request';
      kind: 'approval' | 'clarify' | 'sudo' | 'secret';
      prompt: string;
      callId?: string;
      commandType?: string;
      options?: string[];
    }
```

Add to `WorkerRequest`:
```typescript
  | {
      id: string;
      type: 'interactive.respond';
      sessionId: string;
      kind: 'approval' | 'clarify' | 'sudo' | 'secret';
      response: string;
      callId?: string;
    }
```

**Step 2: Add real interactive callbacks to the Python worker**

In `hermes_worker.py`, replace the hardcoded `clarify_callback` and add new callbacks:

```python
def approval_callback(command: Any, session_id: Any = None) -> str:
    """Pause agent loop and request user approval for a command."""
    # Emit an interactive_request event to the gateway
    # The gateway will buffer this and forward as an SSE event
    # The worker blocks here until the gateway sends back a response
    # via interactive.respond
    request_id = _emit_interactive(
        kind='approval',
        prompt=str(command),
        callId=str(session_id) if session_id else None,
    )
    # Block until the gateway delivers the user's response
    return _wait_for_interactive_response(request_id)

def clarify_callback(question: Any, choices: Any = None) -> str:
    """Pause agent loop and ask the user a clarifying question."""
    request_id = _emit_interactive(
        kind='clarify',
        prompt=str(question),
        options=list(choices) if choices else None,
    )
    return _wait_for_interactive_response(request_id)

def sudo_callback(prompt: str) -> str:
    """Request sudo password from user."""
    request_id = _emit_interactive(
        kind='sudo',
        prompt=prompt,
    )
    return _wait_for_interactive_response(request_id)

def secret_callback(env_var: str, prompt: str = '') -> str:
    """Request a secret value from user."""
    request_id = _emit_interactive(
        kind='secret',
        prompt=prompt or env_var,
        commandType=env_var,
    )
    return _wait_for_interactive_response(request_id)
```

The `_emit_interactive` / `_wait_for_interactive_response` mechanism uses the existing JSONL stdin/stdout protocol — the worker writes an `interactive_request` event to stdout, and the gateway buffers it. When the client POSTs the response, the gateway writes an `interactive.respond` request to the worker's stdin, which unblocks the wait.

**Step 3: Add SSE event emission in `responses.ts`**

When the worker emits an `interactive_request` event, the gateway:
1. Buffers the request with a unique `requestId`
2. Emits an SSE event to the active stream:

```typescript
emit(responseId, {
  event: 'response.interactive.requested',
  data: {
    kind: 'approval' | 'clarify' | 'sudo' | 'secret',
    prompt: '...',
    request_id: '...',
    call_id: '...',
    command_type: '...',
    options: [...],
  },
});
```

**Step 4: Add the `POST /v1/responses/:id/interactive` route**

In `routes/responses.ts`:

```typescript
// POST /v1/responses/:id/interactive — respond to an interactive prompt
responsesRouter.post('/:id/interactive', async (req, res, next) => {
  try {
    const response = await respondInteractive(req.params.id, req.body);
    res.json(response);
  } catch (err) {
    next(err);
  }
});
```

The `respondInteractive` function in `responses.ts`:
1. Looks up the live response by id
2. Forwards the user's response to the worker via the JSONL protocol
3. The worker's `_wait_for_interactive_response` unblocks
4. The agent loop resumes

Request body:
```json
{
  "kind": "approval" | "clarify" | "sudo" | "secret",
  "request_id": "...",
  "response": "user's answer / password / choice",
  "call_id": "..."
}
```

Response:
```json
{
  "ok": true,
  "request_id": "..."
}
```

**Step 5: Add `submitRemoteInteractive` to `httpBridge.ts`**

```typescript
/**
 * Submit a response to an interactive prompt (approval/clarify/sudo/secret)
 * on a running response in remote container mode.
 */
export async function submitRemoteInteractive(
  responseId: string,
  kind: 'approval' | 'clarify' | 'sudo' | 'secret',
  requestId: string,
  responseValue: string,
  callId?: string,
): Promise<void> {
  const baseUrl = getRuntimeV1BaseUrl();
  await fetch(`${baseUrl}/responses/${encodeURIComponent(responseId)}/interactive`, {
    method: 'POST',
    headers: runtimeHeaders(true),
    body: JSON.stringify({
      kind,
      request_id: requestId,
      response: responseValue,
      call_id: callId,
    }),
  }).catch(() => {});
}
```

**Step 6: Wire the desktop client to use the new endpoint**

In `hermesChatAdapter.ts`, update `respondToPendingRequest` (lines 411-438):

```typescript
async function respondToPendingRequest(request: PendingInteractiveRequest, responseValue: string): Promise<void> {
  if (isRemoteContainerMode()) {
    // In remote mode, use the /v1/responses/{id}/interactive endpoint
    const responseId = activeTurn?.responseId;
    if (!responseId) throw new Error('No active response to respond to');
    await submitRemoteInteractive(
      responseId,
      request.kind,
      request.requestId,
      responseValue,
      request.confirmation.call_id,
    );
    return;
  }
  // Local mode: use legacy WS-RPC
  switch (request.kind) {
    case 'approval':
      await gatewayRpcRequest('approval.respond', {
        choice: normalizeConfirmationChoice(responseValue),
        session_id: request.liveSessionId,
      });
      return;
    // ... existing clarify/sudo/secret cases
  }
}
```

**Step 7: Map SSE `response.interactive.requested` events to the existing UI**

In the SSE consumer (`consumeResponseStream` in httpBridge.ts), add handling for the new event:

```typescript
} else if (type === 'response.interactive.requested') {
  const kind = evt.kind as PendingInteractiveRequestKind;
  const prompt = evt.prompt as string;
  const requestId = evt.request_id as string;
  callbacks.onInteractiveRequest?.(kind, prompt, requestId, evt.call_id, evt.options);
}
```

The `hermesChatAdapter.ts` then surfaces this to the existing confirmation UI (the `PendingInteractiveRequest` system already handles rendering approval/clarify/sudo/secret prompts).

**Step 8: Typecheck + commit**

```bash
cd _support/upstream/agent37/gateway && npm run typecheck
cd gcaplabs-headmasterUI/packages/desktop && bunx tsc --noEmit
```**

### Task 7: Verify session list / file browser use `/v1` REST in remote mode

**Objective:** Confirm the session list and file browser components hit `GET /v1/sessions` + `/v1/files*` instead of WS-RPC in remote mode.

**Files:**
- Inspect: session list component, file browser component

**Step 1: Search for any remaining WS-RPC calls related to sessions or files**

Run: `grep -rn "gatewayRpcRequest" packages/desktop/src/renderer/ | grep -E "session|file"`

**Step 2: If any are found, migrate them to the appropriate `/v1` REST call**

- `session.list` → `GET /v1/sessions`
- File listing → `GET /v1/files`
- File content → `GET /v1/files/content`

**Step 3: Typecheck + commit**

### Task 8: Retire WS port fallbacks for remote mode in `httpBridge.ts`

**Objective:** Clean up the `9119`/`9120`/`8080` port fallback logic and `connectRpcWs`/`getWsUrl` for remote mode (keep for local mode).

**Files:**
- Modify: `packages/desktop/src/common/adapter/httpBridge.ts` (lines 522-548 `getWsUrl`, lines 928-1013 `connectRpcWs`)

**Step 1: Ensure `getWsUrl()` early-returns or throws in remote mode**

The function at line 522 already checks `isRemoteContainerMode()` first and builds a WS URL from the cloud container endpoint. But the Agent37 runtime has no `/api/ws` — so this WS URL will never connect. Add a guard:

```typescript
function getWsUrl(): string {
  if (isRemoteContainerMode()) {
    // Agent37 runtime has no /api/ws endpoint — remote mode uses /v1 REST only.
    // Calling this in remote mode is a bug; return an unreachable URL that fails fast.
    throw new Error('WebSocket is not available in remote container mode — use /v1 REST instead');
  }
  // ... existing local/webui code
}
```

**Step 2: Ensure `connectRpcWs` is never called in remote mode**

Add a guard at the top of `connectRpcWs`:

```typescript
function connectRpcWs(): Promise<void> {
  if (isRemoteContainerMode()) {
    return Promise.reject(new Error('WebSocket RPC is not available in remote container mode'));
  }
  // ... existing code
}
```

**Step 3: Typecheck + commit**

### Task 9: End-to-end verification (manual)

**Objective:** Verify the full remote chat flow works against a provisioned container.

**Steps:**
1. Build the desktop app: `bun run dev` (or `electron-vite dev`)
2. Log in, get approved, provision an instance
3. Verify status indicator shows "Active" (not "Inactive")
4. Create a new conversation → send a prompt → see streaming response
5. Cancel a running turn → verify it stops
6. Switch models → verify `/v1/models` returns the catalog
7. List sessions → verify history shows
8. Browse files → verify file listing works

**Verification:**
- Status indicator: Active ✅
- Prompt submission: streams ✅
- Cancel: stops ✅
- Session list: populates ✅
- File browser: lists files ✅
- Interactive prompts (approval/clarify): round-trip ✅

---

## Phase 2: VPS Runtime Image Rebuild

### Task 10: Pull hermeshq and sync local checkout

**Objective:** Sync the local hermeshq checkout with origin (1 commit behind — just a version bump).

**Files:**
- `gcaplabs-hermeshq/` — pull `44f25d1`

**Step 1: Pull**

```bash
cd gcaplabs-hermeshq && git pull gcapslab main
```

**Step 2: Verify**

```bash
git log -1 --oneline
# Expected: 44f25d1 chore: bump version to 2026.7.1.6
```

### Task 11: Rebuild `headmaster-hermes-runtime:latest` on the VPS

**Objective:** Rebuild the runtime image with the entrypoint + Dockerfile perf fix (`c258d59`) and recreate provisioned containers.

**Note:** This was blocked 2026-07-02 by flaky SSH-over-tunnel. Retry when the tunnel is stable, or build via Portainer/Cockpit on the box.

**Steps:**
1. SSH to VPS: `ssh vps`
2. Navigate to the stack: `cd /home/m4/headmaster-stack`
3. Rebuild: `docker compose build --no-cache headmaster-hermes-runtime`
4. Recreate containers: `docker compose up -d --force-recreate headmaster-hermes-runtime`
5. Verify health: `curl https://hm-test123456.gcaplabs.com/v1/health` (should 200 with valid TLS)

**Verification:**
- `docker images | grep headmaster-hermes-runtime` — new build timestamp
- `curl https://hm-<id>.gcaplabs.com/v1/health` → 200
- `/v1/models` returns kimi catalog

### Task 12: Full chat smoke test against rebuilt container

**Objective:** Verify `/v1/responses` streams a real kimi turn end-to-end.

**Steps:**
1. Provision an instance via HermesHQ
2. `curl -X POST https://hm-<id>.gcaplabs.com/v1/responses -H 'Authorization: Bearer <token>' -H 'content-type: application/json' -d '{"input":"Say hello","stream":true}'`
3. Verify SSE events: `response.created`, `response.output_text.delta`, `response.completed`

---

## Phase 3: iOS Build Verification

### Task 13: Verify iOS build on Mac

**Objective:** Confirm the `/v1/responses` SSE migration (commit `0105789`) compiles and builds.

**Note:** This requires a Mac — not actionable from this Windows machine. Flag to the user.

**Steps (on Mac):**
1. `cd gcaplabs-ios/scarf && open Headmaster.xcodeproj`
2. Build for simulator: Cmd+B
3. Run tests if available
4. Verify `RunsAPIClient.swift` and `CloudContainerTransport.swift` compile clean

---

## Phase 4: Backend Lint Tooling

### Task 14: Add ruff to HermesHQ backend venv

**Objective:** `python -m ruff` is currently unavailable in the HermesHQ backend venv. Add it.

**Files:**
- `gcaplabs-hermeshq/backend/` (venv or requirements)

**Step 1: Check the venv**

```bash
cd gcaplabs-hermeshq/backend && source venv/bin/activate 2>/dev/null || source .venv/bin/activate 2>/dev/null
pip show ruff 2>/dev/null || echo "ruff not installed"
```

**Step 2: Install ruff**

```bash
pip install ruff
```

**Step 3: Verify**

```bash
python -m ruff check . --stats
```

---

## Phase 5: Upstream Cherry-Picks (AionUi + Hermes Desktop)

### Task 15: Pull upstream references

**Objective:** Update the reference clones to the latest upstream so we can evaluate useful commits.

**Files:**
- `_support/upstream/aionui/` — pull `6869892` (v2.1.27)
- `_support/upstream/hermes-agent-desktop/` — pull `b3bc30237` (v2026.7.1)

**Step 1: Pull both**

```bash
cd _support/upstream/aionui && git pull origin main
cd _support/upstream/hermes-agent-desktop && git pull origin main
```

### Task 16: Evaluate AionUi v2.1.22–v2.1.27 for useful changes

**Objective:** Review the ~60 new AionUi commits and identify any that are worth cherry-picking into `gcaplabs-headmasterUI`.

**Key commits to evaluate:**

From AionUi upstream (v2.1.22 → v2.1.27):
- `fix(acp): dedupe runtime option requests (#3490)` — may fix duplicate ACP requests
- `feat(conversation): keep batch-selection panel pinned while scrolling` — UX improvement
- `feat(conversation): surface session skills in slash command menu` — feature parity
- `fix(cron): sync manual task assistant selection` — cron fix
- `fix(team): reconcile stale run state` — team chat fix
- `fix(mcp): isolate backend cwd for stdio tools` — MCP stability
- `fix(agent): show ACP model descriptions` — model picker UX
- `fix(guid): remember last selected assistant` — UX
- `fix(guid): prefer runtime config options for defaults` — config
- `feat(webui): add browser notifications for permission requests and turn completion` — web UI feature
- `feat(agent): connection testing and assistant availability surfacing` — connection health UI

**Process:**
1. For each candidate commit, check if the file it touches exists in `gcaplabs-headmasterUI/` and has diverged
2. If the file is unchanged from the AionUi fork point, the commit can be cherry-picked directly
3. If the file has local modifications, manually port the logic

**Note:** Many AionUi commits are team/workspace/cron features that may not apply to the Headmaster desktop. Focus on:
- ACP fixes (runtime option dedup, model descriptions)
- Connection testing / assistant availability surfacing (directly relevant to the "Inactive" fix)
- MCP stdio cwd isolation
- Conversation UX (sticky headers, slash session skills)

### Task 17: Evaluate Hermes Desktop v0.18.0 for useful changes

**Objective:** Review the ~150 new Hermes Agent commits and identify any desktop-relevant improvements.

**Key areas from Hermes upstream:**
- `fix(desktop): make MoA preset selection persistent` — MoA fix
- `fix(desktop): don't false-timeout long prompt.submit turns` — timeout fix (directly relevant to our prompt.submit migration)
- `fix(gateway): queue interrupts during in-flight context compression` — interrupt handling
- `fix(moa): raise aux timeouts to 900s` — timeout tuning
- `fix(compaction): detect and strip merge-into-tail summaries` — context compaction
- `feat(vertex): add Google Vertex AI provider` — new provider
- `feat(models): add claude-fable-5, claude-sonnet-5, fugu-ultra` — new models
- `fix(terminal): prefer Git for Windows bash over Linux bash on Windows` — Windows terminal fix
- `fix(terminal): route init_session bootstrap cd through Windows path conversion` — Windows path fix
- Security fixes (browser hardening, approval bypasses, gateway IDOR fixes)

**Process:**
1. Most Hermes Agent changes are in the Python runtime, not the desktop app
2. The desktop-relevant changes are in `apps/desktop/` — check which files have changed
3. Cherry-pick or manually port any directly relevant fixes

---

## Phase 6: Beta Cold-VPS Rehearsal

### Task 18: Cold-VPS rehearsal

**Objective:** From a clean VPS box, run `provision-host.sh` + build image + create an instance end-to-end.

**Note:** Blocked on the runtime image rebuild (Task 11) for a fully working instance. Can proceed with a partial test after the rebuild.

**Steps:**
1. SSH to VPS (or a fresh VPS if available)
2. Run `provision-host.sh` (one-time host setup)
3. `docker compose up -d` (bring up HermesHQ stack)
4. Build image: `docker compose build --no-cache headmaster-hermes-runtime`
5. Create an instance: `bash /opt/headmaster/scripts/create-instance.sh <user>`
6. Verify: `curl https://hm-<id>.gcaplabs.com/v1/health` → 200
7. Full flow: approve → provision → runtime health → chat → destroy

**Verification:**
- Clean box can be provisioned from scripts
- Instance reachable at subdomain
- Forward-auth rejects bad token, accepts minted token
- Resource caps enforced (docker stats)
- Destroy removes container + route

---

## Phase 7: Provision Admin Container for Smoke Testing

### Task 19: Provision a container for admin/admin123

**Objective:** After all the above work is done, provision a runtime container tied to the admin account (admin/admin123) so the user can smoke test the full flow whenever needed.

**Steps:**
1. Log into the desktop app (or HermesHQ admin UI) as admin/admin123
2. If not already approved+provisioned, approve the admin account and trigger provisioning
3. Verify the provision response returns:
   - `hm-<id>.gcaplabs.com` subdomain URL
   - forward-auth bearer token
   - `/v1` base path
   - kimi model catalog
4. Verify the container is healthy: `curl https://hm-<id>.gcaplabs.com/v1/health` → 200
5. Verify the container runs kimi: `curl https://hm-<id>.gcaplabs.com/v1/models` → kimi catalog
6. Record the container URL and token for the user

**Verification:**
- Container running and healthy
- `/v1/health` returns 200
- `/v1/models` returns kimi catalog
- `/v1/responses` streams a real kimi turn
- The user can log in with admin/admin123 and immediately chat against this container

**Output for the user:**
- Container URL: `https://hm-<id>.gcaplabs.com`
- Bearer token: (from provision response)
- Status: healthy and ready for smoke testing

---

## Files Likely to Change

### Desktop (primary — Phase 1):
- `packages/desktop/src/renderer/hooks/system/useRuntimeConnectionState.ts` — status probe
- `packages/desktop/src/common/adapter/hermesChatAdapter.ts` — session/prompt/interrupt/approval migration
- `packages/desktop/src/common/adapter/httpBridge.ts` — new REST helpers, WS guard for remote mode

### HermesHQ (Phase 2):
- `VERSION` — pull version bump

### Upstream references (Phase 5):
- `_support/upstream/aionui/` — git pull
- `_support/upstream/hermes-agent-desktop/` — git pull

### VPS (Phase 2 + 6, on the box):
- `/home/m4/headmaster-stack/` — image rebuild
- `/opt/headmaster/scripts/` — cold rehearsal

---

## Tests / Validation

### Desktop:
```bash
cd packages/desktop && bunx tsc --noEmit
# Expected: 0 errors
```

### Remote mode smoke (after migration):
1. `bun run dev` → login → provision
2. Status indicator: Active
3. Create conversation → send prompt → see streaming
4. Cancel → stops
5. Session list → populates
6. File browser → lists files
7. Approval/clarify → round-trips

### HermesHQ:
```bash
cd gcaplabs-hermeshq && git pull gcapslab main
git log -1 --oneline  # 44f25d1
```

### VPS:
```bash
ssh vps "cd /home/m4/headmaster-stack && docker compose build --no-cache headmaster-hermes-runtime"
curl https://hm-<id>.gcaplabs.com/v1/health  # 200
```

---

## Risks, Tradeoffs, and Open Questions

### Risks
1. **Gateway extension scope.** Task 6 touches the Agent37 gateway (TypeScript), the Python worker, and the desktop client. It's the most complex task — the worker needs to block on interactive requests and the gateway needs to buffer/relay them. If the blocking mechanism is tricky, we can ship Phase 1 Tasks 1-5+8 first (gets chat working with auto-proceed on approvals) and do the interactive extension after.
2. **Local-mode WS must keep working.** All migrations gate on `isRemoteContainerMode()`. If the gating is wrong, local mode breaks.
3. **Upstream cherry-picks may conflict.** AionUi and Hermes Desktop have diverged from the Headmaster fork point. Many commits won't apply cleanly — manual porting needed.
4. **VPS SSH-over-tunnel flakiness.** The image rebuild was blocked by this. May need to build via Portainer/Cockpit directly on the box.

### Open Questions
1. **RESOLVED: Interactive approval flow.** We are extending the gateway with a `POST /v1/responses/{id}/interactive` route. No more investigation needed — the plan is in Task 6.
2. **DEFAULT: Upstream cherry-pick scope.** Only cherry-pick fixes that are directly relevant to the Headmaster desktop's current issues (ACP dedup, connection testing, MCP cwd, Windows terminal). Skip team/workspace/cron features that don't apply. User can override.
3. **RESOLVED: Execution mode.** Autonomous — user said "do the entire plan and then have a container tied to my account." Continuous execution, no checkpoints.

### Deferred (not in this plan)
- HermesHQ dashboard branding (Phase 7, deferred per mastertodo — operator tool, not user-facing)
- iOS build verification (requires Mac — flagged to user)
- Stripe/billing (deferred to GA per mastertodo)