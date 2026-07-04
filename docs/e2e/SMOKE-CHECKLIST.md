# Headmaster Desktop E2E Smoke Checklist (Agent37 runtime)

**Scope:** Manual end-to-end smoke verification for the Headmaster Desktop app against the Agent37/Headmaster Console cloud runtime path. This checklist is intended for QA before a release build or after runtime/auth/provisioning changes.

**Prerequisites:**
1. A real Console account exists (email + password) on `https://www.console.gcaplabs.com`.
2. The account has a provisioned Agent37 instance that is reachable from the desktop.
3. A packaged build exists under `out/win-unpacked/Headmaster.exe` (or platform equivalent), or dev mode is enabled.
4. No `HEADMASTER_DISABLE_AUTO_UPDATE` override is required; this is only smoke.
5. `git status` is clean or the changed files are documented.

**What is automated vs. manual:**
- The existing E2E harness lives in `tests/e2e/` and uses Playwright + Electron. It can run in `dev` (default locally, launches `electron .`) or `packaged` (`E2E_PACKAGED=1`, launches `out/win-unpacked/Headmaster.exe`).
- The checklist below is *manual* and runnable by a person. It is designed to be reused and converted into Playwright specs once the runtime is stable.
- Local-only automation items are marked with `🤖` (build, typecheck, unit tests). Items that need a real Console login and a reachable runtime are marked with `☁️`.

---

## 1. App launch and renderer load

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1.1 | Launch the app (portable EXE or `bun run start`). | Electron window opens, no crash dialog. | [ ] |
| 1.2 | Wait 5 seconds. | `body` is visible and contains text. | [ ] |
| 1.3 | Open DevTools (Ctrl+Shift+I) and check the Console tab. | No uncaught exceptions (red) on initial load. | [ ] |
| 1.4 | Inspect `window.__backendPort` and `window.__agent37Provision` in the renderer console. | Both exist and are objects/numbers (not `undefined`). | [ ] |

**Notes from code:** `tests/e2e/specs/app-launch.e2e.ts` already verifies 1.1–1.3. The provision object is injected in `agent37ProvisionBridge.ts`.

---

## 2. Login / provisioned cloud backend

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 2.1 | If not already signed in, enter valid Console email + password and sign in. | Spinner appears, then redirect to chat. | [ ] |
| 2.2 | Inspect the Network tab filtered by `api/desktop/provision/current`. | Request returns `200` with `mode: "headmaster_remote"`, `user`, `runtime`, `session_namespace`, and `providers`. | [ ] |
| 2.3 | Check the URL canonicalisation. | The request host is `www.console.gcaplabs.com`, not the bare `console.gcaplabs.com` apex. | [ ] |
| 2.4 | Check the request headers. | `Authorization: Bearer <token>` and `X-Headmaster-*` headers are present. | [ ] |
| 2.5 | If using a beta account that is not approved, confirm the app shows "pending approval" and does not load the full chat. | No crash; message is visible. | [ ] |
| 2.6 | Sign out. | App returns to the sign-in screen; stored provision is cleared. | [ ] |
| 2.7 | Sign in again with an invalid password. | Inline error message appears; no crash. | [ ] |

**Notes from code:** `agent37ProvisionService.ts` handles `POST /api/auth/login`, `GET /api/desktop/provision/current`, and `normalizeBaseUrl()` canonicalizes the apex to `www.`. The beta-approval security check is enforced server-side in the console (verified 2026-07-04 per `mastertodo.md`).

---

## 3. Session history load

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 3.1 | After login, wait for the sidebar conversation list to populate. | Existing conversations appear. | [ ] |
| 3.2 | Click an existing conversation. | Conversation opens; history (user and AI messages) renders. | [ ] |
| 3.3 | Scroll to the top of a long history. | Earlier messages are present; no "missing messages" or duplicated blanks. | [ ] |
| 3.4 | Check the renderer console for errors during history load. | No 4xx/5xx errors from `/api/v1/sessions/:id`. | [ ] |
| 3.5 | If the runtime is in `container_unreachable` state, confirm the app shows a runtime-recovery UI rather than hanging. | Recovery button or error message appears; log points at `api/v1/health` 502. | [ ] |

**Notes from code:** `hermesSessionAdapter.ts` and `hermesChatAdapter.ts` load sessions; `mastertodo.md` 2026-07-05 entry documents the `container_unreachable` recovery path.

---

## 4. New chat

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 4.1 | Click "New Chat" or the equivalent button in the sidebar. | A new, empty conversation opens. | [ ] |
| 4.2 | Select a provider/model from the model selector. | Selected model appears in the UI. | [ ] |
| 4.3 | Type a short message and press Enter. | Message appears as a user bubble; input clears. | [ ] |
| 4.4 | Wait for the AI response. | AI response appears (streaming or completed). | [ ] |
| 4.5 | Verify the request in the Network tab. | `POST /v1/responses` (or equivalent) returns 200 and an SSE stream. | [ ] |
| 4.6 | Cancel a response while streaming. | Streaming stops; UI returns to idle sendable state. | [ ] |
| 4.7 | Check the conversation list sidebar. | The new conversation is added with a title/snippet. | [ ] |

---

## 5. Resumed web-created chat

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 5.1 | In the web Console (`https://www.console.gcaplabs.com`), start a new chat and send one message. | Web chat shows a response and is saved. | [ ] |
| 5.2 | Copy the conversation ID or session namespace from the web URL. | ID is available. | [ ] |
| 5.3 | Open the desktop app and log in as the same user. | Desktop loads the same conversation list. | [ ] |
| 5.4 | Open the conversation that was created on the web. | Desktop shows the same history and can continue the thread. | [ ] |
| 5.5 | Send a follow-up message from the desktop. | Message is sent **once**; AI response appears; no 5x retry loop. | [ ] |
| 5.6 | Verify on the web Console that the same message appears. | Cross-device sync works. | [ ] |

**Notes from code:** `mastertodo.md` 2026-07-05 calls out a live bug where a web-created session sent 5x and failed. This checklist explicitly tests that the retry loop in `httpBridge.ts` does not replay the request. Requires manual verification because it depends on live request logs.

---

## 6. Message send / stream

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 6.1 | Send a simple message. | User message appears, then AI response streams. | [ ] |
| 6.2 | Send a message that triggers a tool call (e.g., "list files in current directory"). | Tool-call card appears; approval UI is shown if `approval` is required. | [ ] |
| 6.3 | Approve the tool call. | Tool executes; AI response continues. | [ ] |
| 6.4 | Send a message that requires clarification (e.g., ambiguous instruction). | Clarification prompt appears in the chat. | [ ] |
| 6.5 | Answer the clarification. | Conversation continues from the clarification. | [ ] |
| 6.6 | Disconnect the network mid-stream and reconnect. | App shows a reconnect attempt; resumes or surfaces an error without crashing. | [ ] |
| 6.7 | Verify the response stream closes properly. | No spinner stuck indefinitely; final message is not truncated. | [ ] |

**Notes from code:** `hermesChatAdapter.ts` handles `submitResponseAndStream`, `cancelResponse`, and interactive `approval/clarify/secret/sudo` prompts.

---

## 7. Settings / Runtime status

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 7.1 | Open Settings → Runtime (or Connection). | Runtime panel shows status, template, CPU/memory/disk, and start/stop/restart buttons. | [ ] |
| 7.2 | Check the runtime status indicator. | Status matches `/api/chat/runtime/status` (e.g., running, stopped, unreachable). | [ ] |
| 7.3 | Click "Start" if the runtime is stopped. | Runtime transitions to running; health check passes. | [ ] |
| 7.4 | Click "Restart". | Runtime restarts; UI updates without needing app reload. | [ ] |
| 7.5 | Verify the gateway status indicator in the sidebar footer. | Shows connected/disconnected state. | [ ] |
| 7.6 | Switch to Settings → Models & Providers. | Provider list loads from `window.__agent37Provision.providers`. | [ ] |
| 7.7 | Switch to Settings → Memory & Context. | Memory panel renders (iframe or embedded). | [ ] |
| 7.8 | Switch to Settings → Tools & Integrations. | Available tools/extensions list renders; dead local-Hermes calls do not spam 404s. | [ ] |

**Notes from code:** `agent37ProvisionBridge.ts` exposes `agent37:runtime:*` IPC channels. `agent37ProvisionService.ts` proxies lifecycle to `/api/chat/runtime/*`. Some tools/integrations are known feature gaps in remote mode and 404 today (see `mastertodo.md` 2026-07-05).

---

## 8. Memory / Apps navigation

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 8.1 | Navigate to the Memory page (sidebar or settings). | Memory page loads; if using an iframe, `memory.gcaplabs.com` is visible. | [ ] |
| 8.2 | Interact with the memory UI (create/hide a note if supported). | No console errors or navigation crashes. | [ ] |
| 8.3 | Navigate to Apps / Tools (if exposed). | Apps list renders; extensions are shown. | [ ] |
| 8.4 | Open an extension-contributed settings tab. | Tab loads without crashing. | [ ] |
| 8.5 | Return to the chat view. | Chat view is restored; composer is usable. | [ ] |

---

## 9. Error logging

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 9.1 | Trigger an error (e.g., send a message while the runtime is unreachable). | App surfaces a user-facing error message, not a white screen. | [ ] |
| 9.2 | Check `%APPDATA%\Headmaster\logs\YYYY-MM-DD.log`. | Error is logged with timestamp and stack/context. | [ ] |
| 9.3 | Check the renderer DevTools console. | Error is captured; no infinite retry loop. | [ ] |
| 9.4 | Reproduce the 401-after-login scenario with a stale apex URL. | `normalizeBaseUrl()` redirects to `www.console.gcaplabs.com`; login succeeds. | [ ] |

**Notes from code:** App logs go to `%APPDATA%\Headmaster\logs\` per `AGENTS.md`. The 401-after-login fix is documented in `mastertodo.md` 2026-07-04.

---

## 10. Local-only automation (run before every manual pass)

These can be run without production credentials and are the first gate before any cloud smoke. **Known as of this writing:** `bun run test` has two failing tests in `tests/unit/common-adapter/httpBridge.test.ts` (nested Agent37 SSE parsing and dropped-stream re-attachment); these are pre-existing and unrelated to the smoke checklist.

| Step | Command | Expected Result | Status |
|------|---------|-----------------|--------|
| 10.1 | `bunx tsc --noEmit` | Clean typecheck. | [ ] |
| 10.2 | `bun run lint` | Exits 0. | [ ] |
| 10.3 | `bun run test` | All unit/integration tests pass. | [ ] |
| 10.4 | `bunx electron-vite build --config packages/desktop/electron.vite.config.ts` | Renderer + main + preload build cleanly. | [ ] |
| 10.5 | `node scripts/build-with-builder.js auto --win --dir` | Portable EXE is produced in `out/win-unpacked/Headmaster.exe`. | [ ] |
| 10.6 | `E2E_DEV=1 bun run test:e2e tests/e2e/specs/app-launch.e2e.ts` | App-launch E2E spec passes (no login needed). | [ ] |

---

## Blocked / requires manual action

The following items are documented blockers that prevent fully automated execution in this environment. They do not block the checklist itself; they are recorded so the next QA run can pick them up.

| # | Blocker | Why it cannot be automated here | What is needed |
|---|---------|----------------------------------|----------------|
| B1 | Real Console login | Requires a live email/password pair and 2FA-less Supabase auth; no test credentials are stored in the repo. | Use a dedicated smoke-test account in a CI secret or a local `.env` file. |
| B2 | Reachable Agent37 runtime | The instance must be running (`container_unreachable` or better) and accessible from the desktop network. | Pre-warm the instance or use the admin runtime restart endpoint before smoke. |
| B3 | Web-created session cross-device sync | Requires a manual web Console session and a matching desktop login; session ID reconciliation depends on live request logs. | Automate via Playwright on the web + desktop, or use the API directly. |
| B4 | Network-disconnect mid-stream | Hard to simulate reliably in a headless/manual hybrid without dropping the host network. | Use a proxy or network conditioning tool (e.g., Clumsy, Charles). |
| B5 | Memory iframe content | The memory UI is loaded from an external domain; assertions on its internals are fragile and cross-origin. | Add data-testid attributes or a dedicated bridge contract. |

---

## Running the E2E harness

```bash
# 1. Build the renderer/preload/main bundles
bunx electron-vite build --config packages/desktop/electron.vite.config.ts

# 2. (Optional) build the portable EXE for packaged mode
node scripts/build-with-builder.js auto --win --dir

# 3. Run the existing app-launch smoke test (dev mode, no login needed)
E2E_DEV=1 bun run test:e2e tests/e2e/specs/app-launch.e2e.ts

# 4. Run all E2E tests in packaged mode (requires backend and credentials)
E2E_PACKAGED=1 bun run test:e2e
```

**Current state of the harness:**
- `tests/e2e/fixtures.ts` launches a singleton Electron app and supports both dev and packaged modes.
- `tests/e2e/specs/app-launch.e2e.ts` is the only spec that reliably runs without credentials.
- Most other specs (chat, assistant settings, extensions, team) assume a local AionRS/Hermes backend or local features that are not present in the Agent37 remote runtime; they are likely to fail in the current cloud-only build.

---

## Acceptance criteria

1. Checklist artifact is saved in `docs/e2e/SMOKE-CHECKLIST.md` and is under version control.
2. Local-only gates (10.1–10.6) are run and pass, or failures are noted.
3. Manual cloud items (2–9) are marked with a clear status; blocked items are explained with the B1–B5 table.
4. Any new bug found during the manual smoke is filed as a separate issue/kanban card with repro steps from this checklist.
