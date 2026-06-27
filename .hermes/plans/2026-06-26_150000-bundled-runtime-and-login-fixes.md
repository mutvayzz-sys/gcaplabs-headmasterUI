# Bundled Runtime + Login Server URL Fix

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fix two issues blocking the packaged Headmaster.exe: (1) Python runtime should be installed into Headmaster's own directory — never on PATH, never reusing the user's dev Hermes — by driving `install.ps1` with custom `-HermesHome`/`-InstallDir` params, and (2) login fails with "server error" because the HermesHQ URL is never baked into the build.

**Architecture:** Issue 1 — Headmaster runs the official Hermes installer (`install.ps1`) with `-HermesHome %LOCALAPPDATA%\Headmaster\runtime -InstallDir %LOCALAPPDATA%\Headmaster\runtime\hermes-agent -NonInteractive` to install a fully isolated Python+Hermes runtime. The installer's stages run individually so we SKIP the `path` stage (which would add `hermes` to the user's PATH) — hermes is never on PATH, never visible in the user's terminal. Headmaster's `hermesBootstrap.ts` resolves the binary ONLY from the isolated venv at `%LOCALAPPDATA%\Headmaster\runtime\hermes-agent\venv\Scripts\hermes.exe`. No PATH lookup, no system Python fallback, no reusing existing hermes installs — the runtime is either installed in Headmaster's dir or it gets installed there. Issue 2 — create `.env.production` with `VITE_HERMESHQ_URL` and add a hardcoded fallback in AuthContext.

**Tech Stack:** Electron, TypeScript, Vite, Node.js, Python (Hermes runtime via install.ps1)

---

## Critical Note for Implementer

- **The Hermes installer (`scripts/install.ps1`)** accepts `-HermesHome` and `-InstallDir` params. Default is `%LOCALAPPDATA%\hermes` / `%LOCALAPPDATA%\hermes\hermes-agent`. We override to `%LOCALAPPDATA%\Headmaster\runtime` / `%LOCALAPPDATA%\Headmaster\runtime\hermes-agent`.
- **The installer has a stage protocol.** `install.ps1 -Manifest` lists all stages. `install.ps1 -Stage <name>` runs one stage and emits JSON result. We run stages individually via `-Stage` so we can skip the `path` stage — hermes never goes on PATH.
- **The installer's `path` stage (`Set-PathVariable`) adds `hermes` to the user's PATH. We SKIP this stage.** The installer supports `-Stage <name>` for running individual stages. We run every stage EXCEPT `path`, `configure` (interactive setup wizard), `gateway` (starts messaging gateway), and `desktop` (builds desktop app — not needed). This ensures `hermes` is NEVER on the user's PATH. The user types `hermes` in their terminal → nothing. Completely invisible.
- **HERMES_HOME ≠ hermes binary location.** HERMES_HOME is config/data (`%LOCALAPPDATA%\Headmaster\runtime`). The binary is at `$HERMES_HOME\hermes-agent\venv\Scripts\hermes.exe`. Both are in the Headmaster-isolated directory tree.
- **The installer installs everything:** uv, Python 3.11, git (PortableGit), Node.js, repo clone, venv, deps, skills. All under the Headmaster directory. Nothing touches the user's system PATH — we skip the `path` stage entirely.
- **Repo is on `main` at `6f88e0b`** with 4 dirty files (comment-only diffs). The dirty changes don't conflict.
- **Build:** `node scripts/build-with-builder.js auto --win --dir`. Close any running `Headmaster.exe` first.
- **Test the exe:** `out\win-unpacked\Headmaster.exe`. Logs at `%APPDATA%\Headmaster\logs\`.

---

## Phase 0: Branch state pre-check

### Task 0: Verify clean working tree and record baseline

**Objective:** Confirm the repo state before making changes.

**Step 1: Check git status**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && git status --short && git log -1 --oneline && git branch --show-current`

Expected: `main` branch, HEAD at `6f88e0b`, with dirty modifications (comment-only).

**DEFAULT: Continue as-is.** Baseline SHA: `6f88e0b`

---

## Phase 1: Bundled runtime resolution (Issue 1)

### Task 1: Simplify HERMES_HOME_WIN32 to always use Headmaster-isolated path

**Objective:** HERMES_HOME (config/data directory) should always be `%LOCALAPPDATA%\Headmaster\runtime`. No fallback to `%LOCALAPPDATA%\hermes`. No `HERMES_HOME` env var override either — the app controls its own runtime location.

**Files:**
- Modify: `packages/desktop/src/process/backend/hermesBootstrap.ts:77-88`

**Step 1: Read current state**

Lines 77-88 have `HERMES_HOME_POSIX` and `HERMES_HOME_WIN32` with a fallback to `legacyPath`.

**Step 2: Write the replacement**

Replace lines 77-88 with:

```typescript
const HERMES_HOME_POSIX = (): string => join(homedir(), '.headmaster', 'runtime');
const HERMES_HOME_WIN32 = (): string => {
  // Always use the Headmaster-isolated runtime directory. Never fall back
  // to the user's dev Hermes at %LOCALAPPDATA%\hermes. The runtime is
  // installed here by install.ps1 with -HermesHome pointing at this path.
  // We intentionally do NOT honor process.env.HERMES_HOME — the app owns
  // its runtime location, and a user's dev HERMES_HOME could point at an
  // incompatible install.
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  return join(localAppData, 'Headmaster', 'runtime');
};
```

**Step 3: Typecheck**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && bunx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add packages/desktop/src/process/backend/hermesBootstrap.ts
git commit -m "fix: hardcode HERMES_HOME to Headmaster-isolated directory

HERMES_HOME always uses %LOCALAPPDATA%\Headmaster\runtime on Windows.
No fallback to %LOCALAPPDATA%\hermes, no HERMES_HOME env var override.
The app owns its runtime location — a user's dev Hermes HERMES_HOME
could point at an incompatible install."
```

---

### Task 2: Simplify resolveHermesBin to only look in Headmaster's venv

**Objective:** Since the runtime is always installed in Headmaster's directory, binary resolution is simple: check the venv at `$HERMES_HOME\hermes-agent\venv\Scripts\hermes.exe`. No PATH lookup, no system Python fallback. If it's not there, the runtime needs to be installed (Task 3).

**Files:**
- Modify: `packages/desktop/src/process/backend/hermesBootstrap.ts:254-274` (the `resolveHermesBin` method)

**Step 1: Read current state**

`resolveHermesBin()` currently checks 3 paths under `hermesHome` and returns the first match.

**Step 2: Write the replacement**

Replace the entire `resolveHermesBin()` method with:

```typescript
  /**
   * Resolve the hermes binary from the Headmaster-isolated venv.
   * The runtime is installed by install.ps1 with -InstallDir pointing
   * at $HERMES_HOME\hermes-agent. The venv is at
   * $HERMES_HOME\hermes-agent\venv\ (install.ps1 uses 'venv', not '.venv').
   *
   * No PATH lookup, no system Python fallback — the runtime is either
   * installed in Headmaster's directory or it needs to be installed.
   * This keeps hermes invisible to the user's terminal.
   */
  private resolveHermesBin(): string | null {
    const bin = PLATFORM_HERMES_BIN(process.platform);
    const candidates =
      process.platform === 'win32'
        ? [
            // install.ps1 creates venv\Scripts\hermes.exe
            join(this.hermesHome, 'hermes-agent', 'venv', 'Scripts', bin),
            // .venv variant (in case a future installer version switches)
            join(this.hermesHome, 'hermes-agent', '.venv', 'Scripts', bin),
          ]
        : [
            join(this.hermesHome, 'hermes-agent', 'venv', 'bin', bin),
            join(this.hermesHome, 'hermes-agent', '.venv', 'bin', bin),
          ];

    return candidates.find((candidate) => existsSync(candidate)) ?? null;
  }
```

**Step 3: Typecheck**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && bunx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add packages/desktop/src/process/backend/hermesBootstrap.ts
git commit -m "fix: resolve hermes binary only from Headmaster's venv

No PATH lookup, no system Python fallback. The binary is at
\$HERMES_HOME\hermes-agent\venv\Scripts\hermes.exe or it's not installed.
This keeps hermes invisible to the user's terminal — typing 'hermes'
in cmd/PowerShell does nothing because it's not on PATH."
```

---

### Task 3: Implement runtime installer — drive install.ps1 from Headmaster

**Objective:** When the runtime is not installed (resolveHermesBin returns null), Headmaster runs `install.ps1` with custom paths to install the Hermes runtime into `%LOCALAPPDATA%\Headmaster\runtime`. This replaces the current `runBootstrapInstaller()` which tries to run `hermes_bootstrap.py` (a UTF-8 fixer, not an installer).

**Files:**
- Modify: `packages/desktop/src/process/backend/hermesBootstrap.ts:286-320` (the `runBootstrapInstaller` method)

**Step 1: Read current `runBootstrapInstaller()`**

Lines 286-320 — it tries to find `hermes_bootstrap.py` under HERMES_HOME and run it with `python`. This is wrong — `hermes_bootstrap.py` is a UTF-8 fixer, not an installer. The real installer is `scripts/install.ps1` in the hermes-agent repo.

**Step 2: Write the replacement**

Replace the entire `runBootstrapInstaller()` method with:

```typescript
  /**
   * Run the Hermes installer (install.ps1) to install the Python runtime
   * into Headmaster's isolated directory. Downloads install.ps1 from the
   * official Hermes repo, then runs individual stages with -HermesHome
   * and -InstallDir pointing at the Headmaster runtime directory.
   *
   * Stages run individually so we can SKIP the 'path' stage, which would
   * add 'hermes' to the user's system PATH. We also skip 'configure'
   * (interactive setup wizard), 'gateway' (starts messaging gateway),
   * and 'desktop' (builds desktop app — not needed).
   *
   * Stages we run (in order):
   *   uv, python, git, node, system-packages, repository, venv,
   *   dependencies, node-deps, config-templates, platform-sdks,
   *   bootstrap-marker
   *
   * Stages we SKIP:
   *   path (adds hermes to user PATH — NEVER)
   *   configure (interactive setup wizard — Headmaster handles config)
   *   gateway (starts messaging gateway — not needed for desktop)
   *   desktop (builds Hermes.exe — not needed, we're Headmaster)
   *
   * On Windows only. POSIX uses setup-hermes.sh.
   */
  private async runBootstrapInstaller(): Promise<boolean> {
    this._status = 'installing';
    const home = this.hermesHome;
    const installDir = join(home, 'hermes-agent');

    // The stages to run, in order. Matches install.ps1's manifest order
    // but skips: path, configure, gateway, desktop.
    const STAGES_TO_RUN = [
      'uv',
      'python',
      'git',
      'node',
      'system-packages',
      'repository',
      'venv',
      'dependencies',
      'node-deps',
      'config-templates',
      'platform-sdks',
      'bootstrap-marker',
    ];

    // Download install.ps1 from the official Hermes repo.
    const installPs1Url = 'https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.ps1';
    const installPs1Path = join(home, 'install.ps1');

    try {
      mkdirSync(home, { recursive: true });

      const response = await fetch(installPs1Url);
      if (!response.ok) {
        this._lastError = `Failed to download install.ps1: ${response.status} ${response.statusText}`;
        console.error('[hermes-bootstrap]', this._lastError);
        return false;
      }
      const scriptContent = await response.text();
      writeFileSync(installPs1Path, scriptContent, 'utf-8');

      console.log('[hermes-bootstrap] running install.ps1 stages to install runtime...');
      console.log(`[hermes-bootstrap] HermesHome=${home}`);
      console.log(`[hermes-bootstrap] InstallDir=${installDir}`);
      console.log(`[hermes-bootstrap] Stages: ${STAGES_TO_RUN.join(', ')}`);
      console.log('[hermes-bootstrap] SKIPPING: path, configure, gateway, desktop');
    } catch (err) {
      this._lastError = `Failed to prepare installer: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[hermes-bootstrap]', this._lastError);
      return false;
    }

    // Run each stage individually via -Stage <name>.
    // This lets us skip the 'path' stage entirely — hermes never goes on PATH.
    // Each stage runs as a separate powershell process (the installer's
    // stage protocol is designed for this — cross-process driver mode).
    for (const stageName of STAGES_TO_RUN) {
      console.log(`[hermes-bootstrap] running stage: ${stageName}`);

      const stageResult = await this.runInstallStage(installPs1Path, home, installDir, stageName);
      if (!stageResult.ok) {
        this._lastError = `Stage '${stageName}' failed: ${stageResult.reason}`;
        console.error('[hermes-bootstrap]', this._lastError);

        // Clean up install.ps1
        try { unlinkSync(installPs1Path); } catch { /* best effort */ }
        return false;
      }

      if (stageResult.skipped) {
        console.log(`[hermes-bootstrap] stage '${stageName}' skipped: ${stageResult.reason}`);
      }
    }

    // Clean up the downloaded install.ps1
    try { unlinkSync(installPs1Path); } catch { /* best effort */ }

    console.log('[hermes-bootstrap] runtime installed successfully');
    return true;
  }

  /**
   * Run a single install.ps1 stage. Returns the stage result.
   */
  private runInstallStage(
    installPs1Path: string,
    home: string,
    installDir: string,
    stageName: string
  ): Promise<{ ok: boolean; skipped: boolean; reason: string | null }> {
    return new Promise((resolve) => {
      const args = [
        '-ExecutionPolicy', 'Bypass',
        '-NoProfile',
        '-File', installPs1Path,
        '-HermesHome', home,
        '-InstallDir', installDir,
        '-NonInteractive',
        '-Json',
        '-Stage', stageName,
      ];

      let stdout = '';
      const proc = spawn('powershell.exe', args, {
        cwd: home,
        stdio: ['ignore', 'pipe', 'inherit'],
        env: { ...process.env, HERMES_HOME: home },
        windowsHide: true, // hide installer window — Headmaster shows its own progress UI
      });

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });

      proc.on('exit', (code) => {
        // The installer emits a JSON line on stdout for -Stage mode.
        // Parse it to get ok/skipped/reason.
        try {
          const result = JSON.parse(stdout.trim());
          resolve({
            ok: Boolean(result.ok),
            skipped: Boolean(result.skipped),
            reason: result.reason ?? null,
          });
        } catch {
          // If JSON parse fails, fall back to exit code
          resolve({
            ok: code === 0,
            skipped: false,
            reason: code !== 0 ? `exit code ${code}` : null,
          });
        }
      });

      proc.on('error', (err) => {
        resolve({
          ok: false,
          skipped: false,
          reason: `spawn error: ${err.message}`,
        });
      });
    });
  }
```

**Step 3: Add fetch import if needed**

`fetch` is available globally in Node 18+ and Electron. No import needed. But if TypeScript complains, add a comment `// @ts-expect-error - fetch is global in Electron`.

**Step 4: Typecheck**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && bunx tsc --noEmit`
Expected: no new errors.

**Step 5: Commit**

```bash
git add packages/desktop/src/process/backend/hermesBootstrap.ts
git commit -m "feat: drive install.ps1 stages to install Hermes runtime into Headmaster dir

Replaces the broken runBootstrapInstaller() that tried to run
hermes_bootstrap.py (a UTF-8 fixer, not an installer). Now downloads
the official install.ps1 and runs individual stages with -HermesHome
and -InstallDir pointing at %LOCALAPPDATA%\Headmaster\runtime.

Stages run: uv, python, git, node, system-packages, repository, venv,
dependencies, node-deps, config-templates, platform-sdks, bootstrap-marker.

Stages SKIPPED:
  path — adds hermes to user PATH. NEVER. Hermes stays invisible.
  configure — interactive setup wizard. Headmaster handles config.
  gateway — starts messaging gateway. Not needed for desktop.
  desktop — builds Hermes.exe. Not needed, we're Headmaster.

The user never sees 'hermes' in their terminal because:
1. The install dir is Headmaster-specific, not %LOCALAPPDATA%\hermes
2. The 'path' stage is skipped — hermes is never added to PATH
3. Headmaster's spawn env sets its own PATH, ignoring the user's"
```

---

### Task 4: Update the runtime detection dialog text

**Objective:** The runtime detection dialog should tell the user what's happening when the runtime is being installed, not just say "runtime not found."

**Files:**
- Modify: `packages/desktop/src/process/bridge/runtimeDetectionBridge.ts:34-47`

**Step 1: Read current state**

The dialog says "Headmaster requires the Hermes runtime to function" and offers three buttons: Specify Path, Launch Without Runtime, Quit.

**Step 2: Update the dialog**

Since the app now auto-installs the runtime, the dialog should only appear if the auto-install fails. Update the message:

Find:
```typescript
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Runtime Not Found',
      message: 'Headmaster requires the Hermes runtime to function.',
      detail:
        'The Hermes runtime was not detected at the expected location.\n\n' +
        'Would you like to:\n' +
        '• Specify a custom runtime installation path\n' +
        '• Launch without runtime (limited functionality)\n' +
        '• Quit and install the runtime',
      buttons: ['Specify Path', 'Launch Without Runtime', 'Quit'],
      defaultId: 2,
      cancelId: 2,
    });
```

Replace with:
```typescript
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Runtime Installation Failed',
      message: 'Headmaster could not install its runtime automatically.',
      detail:
        'The Headmaster runtime failed to install. This may be due to network issues or missing system prerequisites.\n\n' +
        'Would you like to:\n' +
        '• Retry the installation\n' +
        '• Specify a custom runtime installation path\n' +
        '• Quit',
      buttons: ['Retry', 'Specify Path', 'Quit'],
      defaultId: 0,
      cancelId: 2,
    });
```

And update the switch cases:

Find:
```typescript
    switch (result.response) {
      case 0: // Specify Path
```

Replace with:
```typescript
    switch (result.response) {
      case 0: // Retry
        userRuntimeChoice = { action: 'use-detected' };
        return { detected: false, choice: 'retry' };

      case 1: // Specify Path
```

And update the remaining case numbers (1→2 for skip, 2→2 for quit):

Find:
```typescript
      case 1: // Launch Without Runtime
        userRuntimeChoice = { action: 'skip' };
        return { detected: false, choice: 'skip' };

      case 2: // Quit
      default:
```

Replace with:
```typescript
      case 2: // Quit
      default:
```

Also update the `RuntimeChoice` interface to include `'retry'`:

Find:
```typescript
export interface RuntimeChoice {
  action: 'use-detected' | 'specify-path' | 'skip' | 'quit';
  customPath?: string;
}
```

Replace with:
```typescript
export interface RuntimeChoice {
  action: 'use-detected' | 'specify-path' | 'skip' | 'quit' | 'retry';
  customPath?: string;
}
```

**Step 3: Typecheck**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && bunx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add packages/desktop/src/process/bridge/runtimeDetectionBridge.ts
git commit -m "fix: update runtime detection dialog for auto-install flow

The dialog now offers Retry instead of 'Launch Without Runtime' since
the app auto-installs the runtime. Shows 'Installation Failed' instead
of 'Not Found' because the dialog only appears after auto-install fails."
```

---

### Task 5: Add missing fs imports at top of hermesBootstrap.ts

**Objective:** The `runBootstrapInstaller` rewrite uses `mkdirSync`, `writeFileSync`, `unlinkSync` from `node:fs`. Currently only `existsSync` is imported. Clean up the imports.

**Files:**
- Modify: `packages/desktop/src/process/backend/hermesBootstrap.ts:31`

**Step 1: Read current import**

Line 31:
```typescript
import { existsSync } from 'node:fs';
```

**Step 2: Replace with**

```typescript
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
```

**Step 3: Update runBootstrapInstaller to use direct imports**

In the `runBootstrapInstaller` method from Task 3, replace the `require('node:fs')` calls with the direct imports:

Find:
```typescript
        const { mkdirSync } = require('node:fs');
        mkdirSync(home, { recursive: true });
```

Replace with:
```typescript
        mkdirSync(home, { recursive: true });
```

Find:
```typescript
      const { writeFileSync } = require('node:fs');
      writeFileSync(installPs1Path, scriptContent, 'utf-8');
```

Replace with:
```typescript
      writeFileSync(installPs1Path, scriptContent, 'utf-8');
```

Find:
```typescript
          const { unlinkSync } = require('node:fs');
          unlinkSync(installPs1Path);
```

Replace with:
```typescript
          unlinkSync(installPs1Path);
```

**Step 4: Typecheck**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && bunx tsc --noEmit`
Expected: no new errors.

**Step 5: Commit**

```bash
git add packages/desktop/src/process/backend/hermesBootstrap.ts
git commit -m "refactor: use direct fs imports instead of require() in runBootstrapInstaller"
```

---

## Phase 2: Fix login server error (Issue 2)

### Task 6: Create .env.production with VITE_HERMESHQ_URL

**Objective:** Bake the HermesHQ server URL into the build.

**Files:**
- Create: `packages/desktop/.env.production`

**Step 1: Create the file**

Create `packages/desktop/.env.production` with:
```
VITE_HERMESHQ_URL=https://hermeshq.gcaplabs.com
```

Note: `.env` is gitignored (line 58 of `.gitignore`), but `.env.production` is NOT gitignored.

**Step 2: Commit**

```bash
git add packages/desktop/.env.production
git commit -m "fix: set VITE_HERMESHQ_URL for login server URL

The login modal showed 'server error' because VITE_HERMESHQ_URL was
never set. Now baked into the build via .env.production."
```

---

### Task 7: Add hardcoded fallback URL in AuthContext

**Objective:** Safety net — if the env var is missing, default to the production URL.

**Files:**
- Modify: `packages/desktop/src/renderer/hooks/context/AuthContext.tsx:78-83`

**Step 1: Read current code (lines 78-83)**

```typescript
const HERMESHQ_URL = (
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_HERMESHQ_URL as
    | string
    | undefined) ?? ''
).replace(/\/$/, '');
```

**Step 2: Replace with**

```typescript
const HERMESHQ_URL = (
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_HERMESHQ_URL as
    | string
    | undefined) ?? 'https://hermeshq.gcaplabs.com'
).replace(/\/$/, '');
```

**Step 3: Typecheck**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && bunx tsc --noEmit`
Expected: no new errors.

**Step 4: Commit**

```bash
git add packages/desktop/src/renderer/hooks/context/AuthContext.tsx
git commit -m "fix: add hardcoded fallback for HermesHQ server URL

If VITE_HERMESHQ_URL is not set at build time, default to
https://hermeshq.gcaplabs.com instead of empty string."
```

---

### Task 8: Add envDir to Vite renderer config

**Objective:** Ensure Vite loads `.env.production` from `packages/desktop/`.

**Files:**
- Modify: `packages/desktop/electron.vite.config.ts` (renderer section, ~line 203)

**Step 1: Check if envDir is set**

Run: `grep -n "envDir" packages/desktop/electron.vite.config.ts`
Expected: no results.

**Step 2: Add envDir**

Find:
```typescript
    renderer: {
      root: rendererRoot,
      base: './',
```

Replace with:
```typescript
    renderer: {
      root: rendererRoot,
      envDir: resolve('packages/desktop'),
      base: './',
```

**Step 3: Typecheck**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && bunx tsc --noEmit`
Expected: no new errors.

**Step 4: Verify env var baked**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && bunx electron-vite build --config packages/desktop/electron.vite.config.ts && grep -r "hermeshq.gcaplabs.com" out/renderer/ | head -5`
Expected: URL appears in bundled JS.

**Step 5: Commit**

```bash
git add packages/desktop/electron.vite.config.ts
git commit -m "fix: set envDir so Vite loads .env from packages/desktop"
```

---

## Phase 3: Build and verify

### Task 9: Build the portable exe

**Objective:** Build the app with all fixes and verify.

**Step 1: Close any running Headmaster.exe**

Run: `taskkill /F /IM Headmaster.exe 2>/dev/null; true`

**Step 2: Build**

Run: `cd ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI && node scripts/build-with-builder.js auto --win --dir`

Expected: build succeeds, `out/win-unpacked/Headmaster.exe` exists.

**Step 3: Verify env var baked**

Run: `grep -r "hermeshq.gcaplabs.com" ~/Desktop/GCAP-Labs/gcaplabs-headmasterUI/out/renderer/ | head -5`
Expected: matches in bundled JS.

---

### Task 10: Smoke test the packaged exe

**Objective:** Launch the exe and verify both issues are fixed.

**Step 1: Launch the exe**

Run: `~/Desktop/GCAP-Labs/gcaplabs-headmasterUI/out/win-unpacked/Headmaster.exe &`

**Step 2: Verify runtime behavior**

- On first launch, the app should attempt to install the runtime via `install.ps1` (downloading it, then running it with custom paths)
- This takes several minutes — the installer output should be visible
- After install, the dashboard should start
- `hermes` should NOT appear on the user's PATH (verify: open a new terminal, type `hermes`, should get "not recognized" — the `path` stage was skipped)
- HERMES_HOME should be `%LOCALAPPDATA%\Headmaster\runtime` (check logs)

Check logs: `cat "$APPDATA/Headmaster/logs/$(date +%Y-%m-%d).log" | grep -i "hermes\|runtime\|bootstrap\|install\|spawning" | tail -30`

**Step 3: Verify login works**

- On the login page, enter credentials from hermeshq.gcaplabs.com
- Should NOT get "server error, please try again later"
- If credentials are wrong, should get "Invalid username or password" (401)

**Step 4: Document results**

Record what happened in the execution report.

---

## Files Likely to Change

| File | Change | Phase |
|---|---|---|
| `packages/desktop/src/process/backend/hermesBootstrap.ts` | Hardcode HERMES_HOME, simplify resolveHermesBin, rewrite runBootstrapInstaller to drive install.ps1, add fs imports | 1 |
| `packages/desktop/src/process/bridge/runtimeDetectionBridge.ts` | Update dialog text for auto-install flow, add retry action | 1 |
| `packages/desktop/.env.production` | New file with VITE_HERMESHQ_URL | 2 |
| `packages/desktop/src/renderer/hooks/context/AuthContext.tsx` | Hardcoded fallback URL | 2 |
| `packages/desktop/electron.vite.config.ts` | Add envDir to renderer config | 2 |

## Tests / Validation

1. `bunx tsc --noEmit` — typecheck after each code change
2. `grep -r "hermeshq.gcaplabs.com" out/renderer/` — verify URL baked into build
3. Launch `out/win-unpacked/Headmaster.exe` — smoke test
4. Check logs at `%APPDATA%\Headmaster\logs\` for runtime install and dashboard startup
5. Open new terminal, type `hermes` — should NOT be recognized (not on PATH)
6. Try login — should reach hermeshq.gcaplabs.com, not get "server error"
7. `curl -s -o /dev/null -w "%{http_code}" https://hermeshq.gcaplabs.com/api/auth/login` — server reachable

## Risks, Tradeoffs, and Open Questions

### Risks

1. **First-launch install takes several minutes.** The installer downloads Python, git (PortableGit), clones the hermes-agent repo, creates a venv, and installs all deps. On a fast connection, 3-5 minutes. On slow connections, 10+. The user sees the installer output (stdio: 'inherit'), but there's no progress bar or polished UI. Future improvement: port the official Hermes Desktop's `bootstrap-runner.cjs` which has a proper progress UI.

2. **Individual stage execution is slower.** Running 12 stages as separate PowerShell processes has process-spawn overhead (~1-2s per stage). Total overhead: ~15-20s on top of the actual install work. Acceptable for a first-launch install that takes minutes anyway.

3. **`HERMES_HOME` env var override removed.** If a user has `HERMES_HOME` set, the app now ignores it. This is intentional — the app owns its runtime location. But it means a user who installed Hermes system-wide and wants Headmaster to use that install can't do so. Trade-off: isolation over flexibility.

4. **Disk space.** The full Hermes install (Python + git + repo + venv + deps) is ~500MB-1GB. This is per Headmaster install, separate from any dev Hermes. Unavoidable if we want isolation.

5. **Network dependency on first launch.** If the user is offline on first launch, the install fails. The runtime can't be pre-bundled into the exe because it's too large (>2GB with all deps). Future: ship a runtime zip as a separate download or use electron-builder's `extraResources` for a minimal Python+hermes bundle.

### Open Questions

1. **Stage-Path is SKIPPED.** Hermes is never added to the user's PATH. The user types `hermes` in their terminal → not recognized. Completely invisible. This is non-negotiable.

2. **DEFAULT: No pre-bundled runtime yet — install.ps1 on first launch.** The full Hermes install is 4.9GB — way too big to bundle. A stripped venv (just `hermes dashboard` deps: web, cli, no messaging/browser/voice) would be ~200-300MB and could ship as an electron-builder `extraResource` zip. That's a future task. For now, `install.ps1` with individual stages (skipping `path`) is the approach. The pre-bundled zip can replace `install.ps1` later without changing the resolution chain — just extract the zip to `$HERMES_HOME\hermes-agent\venv\` instead of running the installer.

3. **DEFAULT: No login UI for server URL.** The URL is baked in. Fine for now.

4. **Should we cache the downloaded install.ps1?** If the user uninstalls and reinstalls Headmaster, it re-downloads install.ps1. Minor — the file is small (~100KB). Not worth caching.

5. **What about updates?** When Hermes releases a new version, the user needs to update the runtime. Currently `hermes update` (run from within the Headmaster-spawned dashboard) handles this. The app could also check for updates and re-run install.ps1. Future task.

---

## Future: Pre-bundled Runtime Zip (Not in this plan)

The current plan uses `install.ps1` on first launch — requires network, takes 5-10 minutes. A better UX is shipping a pre-built runtime zip inside the exe. Here's the approach for when we're ready:

**Size breakdown (measured from Maker's dev install):**
- Full Hermes install: 4.9GB (too big)
- hermes-agent repo + .git: 3.2GB (strip .git → ~50MB source)
- venv site-packages: 779MB (384 packages)
- PortableGit: ~300MB
- Node: ~50MB

**What `hermes dashboard` actually needs:**
- Python 3.11 runtime (~15MB embedded)
- hermes-agent source (~50MB, no .git)
- Core deps: fastapi, uvicorn, pydantic, anthropic, openai, httpx, etc.
- Does NOT need: playwright, telegram, discord, slack, whatsapp, baileys (Node.js), torch, transformers

**Estimated stripped venv: ~200-300MB** (core Python + API server deps only)

**Implementation plan (future):**
1. CI job: create a fresh venv with `uv pip install hermes-agent[web,cli]` (no messaging/browser/voice extras)
2. CI job: zip the venv + hermes-agent source (no .git) + embedded Python
3. electron-builder `extraResources`: ship the zip as `resources/headmaster-runtime.zip`
4. On first launch: extract zip to `%LOCALAPPDATA%\Headmaster\runtime\hermes-agent\`
5. `resolveHermesBin()` finds the binary immediately — no install.ps1, no network, instant startup

**Pro:** Instant first launch, no network dependency, no PATH pollution, fully self-contained
**Con:** Larger exe download (~250MB vs ~80MB), needs CI rebuild on each Hermes version bump, can't use user's GPU drivers for local models (deps are stripped)

**The resolution chain in this plan doesn't change** — `resolveHermesBin()` still checks `$HERMES_HOME\hermes-agent\venv\Scripts\hermes.exe`. The only difference is how the venv gets there: install.ps1 (current) vs zip extraction (future).