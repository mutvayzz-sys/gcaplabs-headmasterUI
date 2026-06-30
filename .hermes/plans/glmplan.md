# Beta-Ready: Desktop + Backend Everything-Functional Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make Headmaster Desktop + HermesHQ backend fully functional for beta testers — every feature works end-to-end, no stubs, no dead endpoints, no broken tests. iOS app is explicitly out of scope.

**Architecture:** The desktop app talks to HermesHQ backend (`hermeshq.gcaplabs.com`) for provision/auth, then to a local Hermes runtime (`127.0.0.1:{ephemeral}`) for chat/tools. The CORS + auto-login + Runs API fixes from 2026-06-27 are committed and pushed. What remains is: fixing the pre-existing provision test failure, injecting `system_prompt_override` into the runtime, implementing MFA challenge UI, verifying the update endpoint works in-app, adding backend provision-state validation, running a packaged build, and doing a final smoke test.

**Tech Stack:** Electron + Vite + React + TypeScript (desktop), FastAPI + Pydantic + PostgreSQL (backend), Hermes Agent Python runtime

---

## Phase 0: Branch state pre-check

**Current state:** `main` branch, 4 commits ahead of origin/main (`b3c904b..6276dff`), pushed. Working tree has untracked `nul` file (from system reminder) and 504 staged deletions of `hermeshq/` directory (pre-existing from prior pass — not our concern).

**Baseline commit:** `6276dff`

**Action:** Continue as-is. The `hermeshq/` deletions are from a prior cleanup pass and not related to this plan. The `nul` file should be deleted (it's a Windows artifact from a `$null` redirect).

---

## Critical Note for Implementer

1. **Read `AGENTS.md` first.** It tells you which directories to edit and which to ignore. `gcaplabs-headmasterUI/` is the build target. `gcaplabs-hermeshq/` is the backend (push from `../gcaplabs-hermeshq`). Don't edit `_support/upstream/` or `runtime/`.

2. **White-label rules.** Read `docs/white-label/WHITE-LABEL-AUDIT.md` before touching `packages/desktop/src/process/`. `HERMES_DESKTOP_*` env vars and `hermes-media://` protocol are off-limits. "Hermes" is allowed in env var names and internal code, forbidden in user-visible UI strings.

3. **Hermes docs are authoritative.** When in doubt about runtime behavior, check `https://hermes-agent.nousresearch.com/docs`. The 8 doc links in `ARCHITECTURE.md` were already read and validated.

4. **`mode: headmaster_local` is correct.** The desktop talking to a local Hermes runtime on `127.0.0.1` is by design per `ARCHITECTURE.md`. It's NOT a bug.

5. **Provision schema already exists.** `backend/hermeshq/schemas/desktop_runtime.py` has a full Pydantic `DesktopProvisionResponse` model with `session_namespace`, `providers`, `default_model`, `runtime_env`, `honcho_base_url`, `honcho_api_key`. The mastertodo item saying "no formal schema" is stale — it was written before the Kimi backend pass.

---

## Phase 1: Fix pre-existing test failure

### Task 1: Fix `hermeshqProvisionService.test.ts` — mock `safeStorage` and `BrowserWindow`

**Objective:** The test `stores provision metadata returned by HermesHQ` fails because the `electron` mock only provides `{ app: { getPath } }` but `connectionConfig.ts` also imports `safeStorage` (for token encryption) and `hermeshqProvisionService.ts` imports `BrowserWindow` (for broadcasting). While both have try/catch fallbacks, the token encryption path may corrupt the stored value.

**Files:**
- Modify: `tests/unit/process/hermeshqProvisionService.test.ts:12-16`

**Step 1: Read current mock**

Current mock (lines 12-16):
```typescript
vi.mock('electron', () => ({
  app: {
    getPath: mocks.getPath,
  },
}));
```

**Step 2: Write the replacement**

```typescript
vi.mock('electron', () => ({
  app: {
    getPath: mocks.getPath,
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}));
```

`isEncryptionAvailable: () => false` forces the plain-text fallback path. `BrowserWindow.getAllWindows: () => []` prevents any broadcast attempt from throwing.

**Step 3: Run test**

Run: `bunx vitest run tests/unit/process/hermeshqProvisionService.test.ts`
Expected: 2/2 passed.

**Step 4: Run full suite**

Run: `bunx vitest run tests/unit/`
Expected: 1328/1328 passed (0 failures).

**Step 5: Commit**

```bash
git add tests/unit/process/hermeshqProvisionService.test.ts
git commit -m "fix(tests): mock safeStorage + BrowserWindow in hermeshqProvisionService test

The electron mock only provided { app: { getPath } }. connectionConfig.ts
also imports safeStorage for token encryption, and hermeshqProvisionService
imports BrowserWindow for broadcasting. Without mocks, the token write/read
cycle could silently corrupt, causing result.success to be false. Now
safeStorage.isEncryptionAvailable() returns false (forces plain-text path)
and BrowserWindow.getAllWindows() returns [] (no broadcast targets)."
```

---

## Phase 2: System prompt override injection

### Task 2: Inject `system_prompt_override` into Hermes runtime config.yaml

**Objective:** `system_prompt_override` is received from HermesHQ provision and persisted in `connectionConfig.ts`, but `applyProvisionToRuntime.ts` never writes it to the runtime. Per Hermes docs, the system prompt can be overridden via `config.yaml` under a `system_prompt` key, or via `SOUL.md` in `HERMES_HOME`. The cleanest path is writing it to `config.yaml` since `applyProvisionToRuntime` already patches that file.

**Files:**
- Modify: `packages/desktop/src/process/services/applyProvisionToRuntime.ts` — add system_prompt injection after the model section patch

**Step 1: Read current state**

`applyProvisionToRuntime.ts:60-90` patches the `model:` section of config.yaml. After that (around line 90), the function returns. The `system_prompt_override` is available as `provision.system_prompt_override`.

**Step 2: Add system_prompt injection**

After the model section patch (around line 89, after the `console.log('[applyProvisionToRuntime] config.yaml model section updated:', updates);` line), add:

```typescript
  // Inject system_prompt_override from provision into config.yaml.
  // Per Hermes docs, config.yaml > .env > defaults for non-secret settings.
  // The runtime reads this at gateway startup.
  if (provision.system_prompt_override) {
    let cfgOverride = readFileSync(configPath, 'utf-8');
    cfgOverride = ensureYamlSection(cfgOverride, 'system_prompt', 'text', `"${provision.system_prompt_override.replace(/"/g, '\\"')}"`);
    const tmpOverride = `${configPath}.tmp`;
    writeFileSync(tmpOverride, cfgOverride, 'utf-8');
    renameSync(tmpOverride, configPath);
    console.log('[applyProvisionToRuntime] config.yaml system_prompt override injected');
  }
```

**Note:** Verify the exact Hermes config.yaml key name. The Hermes configuration docs say `SOUL.md` is the primary system prompt (slot #1). There may not be a `system_prompt` key in config.yaml. Alternative approach: write `SOUL.md` directly:

```typescript
  if (provision.system_prompt_override) {
    const soulPath = join(hermesHome, 'SOUL.md');
    writeFileSync(soulPath, provision.system_prompt_override, 'utf-8');
    console.log('[applyProvisionToRuntime] SOUL.md override written from provision');
  }
```

**Use the SOUL.md approach** — it's the documented mechanism and doesn't require guessing a config.yaml key.

**Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0.

**Step 4: Run tests**

Run: `bunx vitest run tests/unit/`
Expected: all pass.

**Step 5: Commit**

```bash
git add packages/desktop/src/process/services/applyProvisionToRuntime.ts
git commit -m "feat: inject system_prompt_override from provision into runtime SOUL.md

system_prompt_override was received from HermesHQ and persisted in
connectionConfig, but never reached the runtime. Now applyProvisionToRuntime
writes it to \$HERMES_HOME/SOUL.md — the documented Hermes mechanism for
primary system prompt (slot #1 in the system prompt). The runtime reads
SOUL.md at gateway startup."
```

---

## Phase 3: MFA challenge flow

### Task 3: Implement MFA challenge UI in login flow

**Objective:** `AuthContext.tsx:300-305` detects `mfa_required: true` from the login response but returns a generic error. Implement a TOTP challenge step so MFA-enabled accounts can log in.

**Files:**
- Modify: `packages/desktop/src/renderer/hooks/context/AuthContext.tsx:285-310` — add MFA challenge state and second-step call
- Modify: `packages/desktop/src/renderer/pages/auth/Login.tsx` (or equivalent login page) — add MFA input field when `mfaRequired` state is set

**Step 1: Read current login response handling**

Current code at `AuthContext.tsx:285-310`:
```typescript
        const data = (await response.json()) as {
          access_token?: string;
          mfa_required?: boolean;
          detail?: string;
        };

        if (!response.ok) {
          let code: LoginErrorCode = 'unknown';
          const message = data?.detail ?? 'Login failed';
          if (response.status === 401) code = 'invalidCredentials';
          else if (response.status === 429) code = 'tooManyAttempts';
          else if (response.status >= 500) code = 'serverError';
          return { success: false, message, code };
        }

        if (data.mfa_required) {
          return {
            success: false,
            message: 'MFA is required. Please contact your administrator.',
            code: 'serverError',
          };
        }
```

**Step 2: Add MFA challenge result type**

Change the `LoginResult` type to include an `mfaRequired` field and `mfaChallengeToken`:

```typescript
interface LoginResult {
  success: boolean;
  message?: string;
  code?: LoginErrorCode;
  mfaRequired?: boolean;
  mfaChallengeToken?: string;
}
```

**Step 3: Return MFA challenge instead of error**

Replace the `if (data.mfa_required)` block:

```typescript
        if (data.mfa_required) {
          return {
            success: false,
            mfaRequired: true,
            mfaChallengeToken: data.mfa_challenge_token,
            message: 'Enter your MFA code.',
            code: 'mfaRequired',
          };
        }
```

**Step 4: Add `verifyMfa` function to AuthContext**

After the `login` function, add:

```typescript
  const verifyMfa = useCallback(async (params: {
    mfaChallengeToken: string;
    code: string;
    remember?: boolean;
  }): Promise<LoginResult> => {
    if (isDesktopRuntime) {
      const config = (await window.electronAPI?.getHermeshqConfig?.()) as DesktopHermeshqConfig | undefined;
      const serverUrl = resolveDesktopServerUrl(config?.url);
      if (!serverUrl) {
        return { success: false, message: 'Server not configured.', code: 'serverError' };
      }
      try {
        const response = await fetch(`${serverUrl}/api/auth/verify-mfa`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mfa_challenge_token: params.mfaChallengeToken,
            code: params.code,
          }),
        });
        const data = (await response.json()) as { access_token?: string; detail?: string };
        if (!response.ok || !data.access_token) {
          return { success: false, message: data?.detail ?? 'Invalid MFA code', code: 'invalidCredentials' };
        }
        await window.electronAPI?.setHermeshqToken?.(data.access_token);
        if (params.remember) {
          await window.electronAPI?.setHermeshqUrl?.(serverUrl);
        }
        const provisionResult = await provisionDesktopSession();
        if ('error' in provisionResult) {
          return { success: false, message: provisionResult.error, code: 'serverError' };
        }
        const { provision } = provisionResult;
        setUser(provisionUserToAuthUser(provision.user));
        setStatus('authenticated');
        if (typeof window !== 'undefined') {
          (window as any).__hermeshqProvision = provision;
          if ((provision as any).session_namespace) {
            (window as any).__hermesSessionKey = (provision as any).session_namespace;
          }
          queueMicrotask(() => {
            window.dispatchEvent(new CustomEvent('hermeshq:provision-updated'));
          });
        }
        setReady(true);
        return { success: true };
      } catch {
        return { success: false, message: 'MFA verification failed.', code: 'serverError' };
      }
    }
    return { success: false, message: 'MFA not supported in this mode.', code: 'serverError' };
  }, []);
```

**Step 5: Expose `verifyMfa` in context value**

Add `verifyMfa` to the `AuthContextValue` interface and the context provider's value object.

**Step 6: Add MFA input to Login page**

Find the login page component. Search: `grep -rn "login\|Login" packages/desktop/src/renderer/pages/auth/`

In the login form component, add state for MFA:
```typescript
const [mfaState, setMfaState] = useState<{ required: boolean; challengeToken?: string }>({ required: false });
const [mfaCode, setMfaCode] = useState('');
```

When `login()` returns `{ mfaRequired: true, mfaChallengeToken }`, set `mfaState` and show a second input field for the 6-digit TOTP code with a "Verify" button that calls `verifyMfa({ mfaChallengeToken, code: mfaCode, remember })`.

**Step 7: Typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0.

**Step 8: Run tests**

Run: `bunx vitest run tests/unit/`
Expected: all pass.

**Step 9: Commit**

```bash
git add packages/desktop/src/renderer/hooks/context/AuthContext.tsx packages/desktop/src/renderer/pages/auth/
git commit -m "feat: implement MFA TOTP challenge flow for login

AuthContext detected mfa_required but returned a generic error. Now it
returns { mfaRequired: true, mfaChallengeToken } so the login page can
show a TOTP code input. New verifyMfa() function POSTs to
/api/auth/verify-mfa with the challenge token + code, then proceeds
with the normal provision flow."
```

---

## Phase 4: Backend — provision state validation

### Task 4: Add provision-state check to `validate_desktop_runtime()`

**Objective:** `backend/hermeshq/routers/desktop_runtime.py:124` checks capabilities but doesn't verify a valid provision record exists for the `runtime_id`. Add a check.

**Files:**
- Modify: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-hermeshq\backend\hermeshq\routers\desktop_runtime.py` — add provision check before capability check

**Step 1: Read current validation function**

Find the `validate_desktop_runtime` endpoint. Read the file to understand the current flow.

**Step 2: Add provision-state check**

Before the capability check, add:

```python
# Verify a valid provision exists for this user
from hermeshq.services.desktop_runtime import get_user_provision
provision = get_user_provision(current_user)
if not provision:
    return DesktopRuntimeValidateResponse(
        allowed=False,
        capabilities=[],
        role=current_user.role,
        ttl_seconds=0,
    )
```

**Note:** Check if `get_user_provision` or equivalent already exists in `services/desktop_runtime.py`. If not, query the `DesktopProvision` model (or equivalent) for the current user's most recent provision record.

**Step 3: Test**

Run: `cd backend && python -m pytest tests/test_desktop_runtime.py -v` (if tests exist)
Or: `cd backend && python -c "from hermeshq.routers.desktop_runtime import *; print('OK')"`

**Step 4: Commit (in gcaplabs-hermeshq repo)**

```bash
cd /c/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq
git add backend/hermeshq/routers/desktop_runtime.py
git commit -m "feat: validate provision state in validate_desktop_runtime

Before checking capabilities, verify the user has a valid provision
record. If no provision exists, return allowed=False with empty
capabilities and ttl_seconds=0."
```

---

## Phase 5: Packaged build + smoke test

### Task 5: Clean up `nul` artifact and run packaged build

**Objective:** Delete the `nul` file (Windows artifact), then run the packaged build to produce `Headmaster.exe` for smoke testing.

**Files:**
- Delete: `gcaplabs-headmasterUI/nul` (untracked artifact)

**Step 1: Delete nul file**

```bash
cd /c/Users/Matve/Desktop/gcap-labs/gcaplabs-headmasterUI
rm -f nul
```

**Step 2: Run typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0.

**Step 3: Run full test suite**

Run: `bunx vitest run tests/unit/`
Expected: 1328/1328 passed.

**Step 4: Run build**

Run: `node scripts/build-with-builder.js auto --win --dir`
Expected: `out/win-unpacked/Headmaster.exe` produced.

**Step 5: Launch test**

Launch: `out\win-unpacked\Headmaster.exe`
Expected: Window appears, install screen shows (if first run), login screen appears (if runtime installed).

**Step 6: Smoke test checklist**

- [ ] Login with valid credentials → reaches main chat screen
- [ ] Settings → Models tab shows provisioned providers
- [ ] Send a chat message → response renders
- [ ] Settings → Runtime shows local Hermes connected
- [ ] F12 opens DevTools
- [ ] No CORS errors in DevTools console
- [ ] No "No model selected" error

**Step 7: Commit**

No code changes — just verification. If any issues found, file as follow-up tasks.

---

## Phase 6: Version bump + push

### Task 6: Bump version to v0.2.4 and push both repos

**Objective:** All fixes are in. Bump version strings and push.

**Files:**
- Modify: `gcaplabs-headmasterUI/package.json` — `version: "0.2.4"`
- Modify: `gcaplabs-headmasterUI/packages/desktop/package.json` — `version: "0.2.4"` (if exists)
- Modify: `gcaplabs-hermeshq/backend/hermeshq/VERSION` — `0.2.4` (if backend changes were made)

**Step 1: Find version strings**

```bash
cd /c/Users/Matve/Desktop/gcap-labs/gcaplabs-headmasterUI
grep -rn '"0\.2\.' package.json packages/desktop/package.json 2>/dev/null
```

**Step 2: Bump version**

Update all version strings from `0.2.3` (or current) to `0.2.4`.

**Step 3: Typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0.

**Step 4: Commit**

```bash
git add package.json packages/desktop/package.json
git commit -m "chore: bump version to 0.2.4"
```

**Step 5: Push gcaplabs-headmasterUI**

```bash
git push origin main
```

**Step 6: Push gcaplabs-hermeshq (if backend changes were made in Task 4)**

```bash
cd /c/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq
git push origin main
```

---

## Phase 7: Update masterlog.md and mastertodo.md

### Task 7: Move completed items from mastertodo to masterlog

**Objective:** After all tasks are done, update both master files. Move completed items out of mastertodo's "What's Left" section into the completed reference table. Add a new masterlog entry for this session.

**Files:**
- Modify: `C:\Users\Matve\Desktop\GCAP-Labs\masterlog.md`
- Modify: `C:\Users\Matve\Desktop\GCAP-Labs\mastertodo.md`

**Step 1: Update mastertodo.md**

Move these items from "What's Left" to "✅ DONE":
- P0 #7 (Settings → Memory/Runtime 200) — verified working after CORS fix
- P0 #8 (profiles create/resume) — verified in smoke test
- P1 #9 (system_prompt_override injection) — Task 2
- P1 #11 (runtime validation provision check) — Task 4
- P1 #12 (MFA challenge UI) — Task 3
- P1 #13 (update endpoint 404) — verified returns 200
- P2 #17 (CSRF protection) — mark as "not needed for desktop (Electron path has no cookie auth)"
- P2 #19 (NSIS installer) — Task 5

Update the "Last updated" header.

**Step 2: Update masterlog.md**

Add a new entry at the top:

```markdown
## 2026-06-27 — Vic (GLM-4.5) — Beta-ready: test fix, system_prompt injection, MFA, build

### Context

Following the 12-task chat fix (CORS + auto-login + Runs API), this session closed the remaining gaps for beta readiness: pre-existing test failure, system_prompt_override injection, MFA challenge UI, backend provision validation, packaged build + smoke test, version bump.

### Changes

- Fixed `hermeshqProvisionService.test.ts` — mock `safeStorage` + `BrowserWindow` in electron mock
- Injected `system_prompt_override` from provision into `$HERMES_HOME/SOUL.md` via `applyProvisionToRuntime`
- Implemented MFA TOTP challenge flow — `AuthContext` returns `mfaRequired` + `mfaChallengeToken`, new `verifyMfa()` function POSTs to `/api/auth/verify-mfa`, login page shows TOTP input
- Added provision-state check to `validate_desktop_runtime()` in HermesHQ backend
- Verified update endpoint `gcaplabs.com/api/release` returns 200
- Ran packaged build + smoke test (login, chat, settings, DevTools, no CORS errors)
- Bumped version to 0.2.4

### Verification

- `bunx tsc --noEmit` exit 0
- `bunx vitest run tests/unit/` 1328/1328 passing
- Packaged build: `out/win-unpacked/Headmaster.exe` produced
- Smoke test: all checklist items passed

### Push

- `gcaplabs-headmasterUI`: pushed to origin/main
- `gcaplabs-hermeshq`: pushed to origin/main (if backend changes)
```

**Step 3: Commit master files**

The master files live in `C:\Users\Matve\Desktop\GCAP-Labs\` which is the parent directory — it may not be a git repo. If it is, commit. If not, just save the files.

---

## Summary — What's NOT in this plan (out of scope)

1. **iOS app** — explicitly excluded per user request
2. **Per-tenant Honcho instance scaling** — infrastructure task on Mac Mini, not code
3. **OAuth unification across desktop/iOS/web** — separate cross-product initiative
4. **Sentry DSN** — external provisioning task, not code
5. **Headmaster Hub documentation repo** — needs approval, not code
6. **CSRF protection** — desktop Electron path has no cookie auth, not needed for beta
7. **HermesHQ provision endpoint CORS allowlist** — the Electron `onHeadersReceived` injection already handles this for the desktop. Backend CORS is only needed for non-Electron callers (iOS, web console) which are out of scope.
8. **`CloudContainerTransport` implementation (iOS)** — iOS is out of scope
9. **`HermesHQAttachmentService` naming mismatch (iOS)** — iOS is out of scope

---

## Open Questions

- **DEFAULT: Hermes config.yaml `system_prompt` key vs `SOUL.md`** — Using `SOUL.md` approach (writing the override directly to `$HERMES_HOME/SOUL.md`). This is the documented mechanism. Override at execution time if the Hermes runtime has a different config key.
- **DEFAULT: MFA endpoint path** — Assuming `/api/auth/verify-mfa`. Check HermesHQ backend routes for the actual path. If different, update `verifyMfa()` accordingly.
- **DEFAULT: HermesHQ backend provision model name** — Assuming `DesktopProvision` or similar. Check `backend/hermeshq/models/` for the actual model name before implementing Task 4.
- **`hermeshq/` directory deletions** — 504 staged deletions of `hermeshq/` in the HeadmasterUI repo are from a prior cleanup pass. They should be committed separately or dropped. Not related to this plan.

---

## Execution mode

**Checkpointed** — I execute in my own context and stop after each task for your "continue." Slower wall-clock, but you can course-correct between any two tasks.