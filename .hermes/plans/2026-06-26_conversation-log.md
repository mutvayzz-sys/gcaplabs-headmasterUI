# Conversation Log — Runtime Isolation + Login Fix Planning Session

**Date:** June 26, 2026
**Participants:** Maker (Matvey), Vic (agent)
**Topic:** Fixing two issues in packaged Headmaster.exe — Python runtime detection and login server error

---

## Opening Request

**Maker:**
> Okay so in gcaplabs-headmasterUI claude fixed whatever was stopping us from building. I ran into 2 issues after. when I launched the exe it said python runtime was missing. Please fix it so it doesnt use a local hermes if a local hermes was detected it just uses the runtime from a different place simple as that. also on the login modal im entering login creds from hermeshq.gcaplabs.com and they are not working saying server error pls try again later.

*(Invoked the "plan" skill — planning only, no execution)*

---

## Investigation Phase

**Vic** explored the codebase:

1. **Repo state:** `gcaplabs-headmasterUI` on `main` at `6f88e0b`, 4 dirty files (comment-only diffs)
2. **Runtime issue:** `hermesBootstrap.ts` `HERMES_HOME_WIN32()` falls back to `%LOCALAPPDATA%\hermes` (the dev Hermes install) when Headmaster's isolated path doesn't exist. The dev install has `hermes.exe` in `bin/` but the venv is at `hermes-agent\.venv\` (not `venv\`), so binary resolution misses it.
3. **Login issue:** `VITE_HERMESHQ_URL` is never set. There's a `.env.example` with the var name but no actual `.env` file. The renderer defaults to empty string, so login fetch goes to `${''}/api/auth/login` — a relative URL hitting Electron's `file://` origin. Falls through to `code: 'serverError'`.
4. **Server confirmed reachable:** `curl https://hermeshq.gcaplabs.com/api/auth/login` returns 405 (GET) and 401 with `{"detail":"Invalid credentials"}` (POST with bad creds).
5. **`.env` is gitignored** (line 58 of `.gitignore`), `.env.production` is NOT gitignored.

**First plan written:** 8 tasks, 3 phases. Simple approach — remove legacy path fallback, add `where hermes` PATH lookup, add `.venv` candidates, create `.env.production`, hardcode fallback URL.

---

## Maker's First Pivot — Installer Scripts

**Maker:**
> But wait look for example at the installer script for hermes maybe? https://github.com/NousResearch/hermes-agent or perhaps making cli wrappers? like headmaster cli commands?

**Vic** investigated the Hermes installer:

- **`scripts/install.ps1`** — 3095-line PowerShell installer. Accepts `-HermesHome` and `-InstallDir` params. Has a stage protocol (`-Stage <name>` runs individual stages, `-Manifest` lists all stages).
- **`setup-hermes.sh`** — POSIX installer. Uses `uv` for venv creation, symlinks `hermes` into `~/.local/bin`.
- **`pyproject.toml`** — entry points: `hermes = "hermes_cli.main:main"`, `hermes-agent`, `hermes-acp`.
- **Official Hermes Desktop** (`apps/desktop/electron/main.cjs`) — has a 6-step resolution chain: explicit override → dev source → bootstrap-complete ACTIVE_ROOT → `hermes` on PATH (with `--version` smoke test) → system Python with `hermes_cli` importable → bootstrap-needed sentinel.
- **`backend-probes.cjs`** — `verifyHermesCli()` runs `hermes --version` with 5s timeout. `canImportHermesCli()` runs `python -c "import hermes_cli"`.
- **Key insight:** HERMES_HOME (config/data dir) is separate from hermes binary location. The official installer puts config at `%LOCALAPPDATA%\hermes` and binary at `%LOCALAPPDATA%\hermes\hermes-agent\venv\Scripts\hermes.exe`.

**Second plan written:** 7 tasks. Ported the official desktop's resolution pattern — `findOnPath()` with PATHEXT, `verifyHermesCli()` smoke test, `canImportHermesCli()` probe, `findSystemPython()`. 4-step chain: Headmaster venv → PATH with smoke test → system Python with import probe → not-installed.

---

## Maker's Second Pivot — Isolated Directory, No PATH

**Maker:**
> Okay so wait if it does not need to be on path, can it just install it to a headmaster dir? this way we wont even expose hermes to cli path for example you get me so if user writes hermes it doesnt pop up,

**Vic** investigated the installer's stage protocol more deeply:

- `Set-PathVariable` (the `path` stage) adds `$InstallDir\venv\Scripts` to the USER PATH env var via `[Environment]::SetEnvironmentVariable("Path", ..., "User")`.
- The installer supports `-Stage <name>` for running individual stages, with JSON output via `-Json`.
- Stage manifest: `uv`, `python`, `git`, `node`, `system-packages`, `repository`, `venv`, `dependencies`, `node-deps`, `desktop` (optional), `path`, `config-templates`, `platform-sdks`, `bootstrap-marker`, `configure`, `gateway`.

**Third plan written:** 10 tasks. Headmaster drives `install.ps1` with `-HermesHome %LOCALAPPDATA%\Headmaster\runtime -InstallDir %LOCALAPPDATA%\Headmaster\runtime\hermes-agent`. Runs all stages. Initially planned to accept the PATH change since it would be Headmaster's own venv.

**Vic flagged:** `install.ps1`'s `Stage-Path` adds `Headmaster\runtime\hermes-agent\venv\Scripts` to USER PATH. Asked Maker if that's acceptable or if we should skip the `path` stage.

---

## Maker's Hard Correction — NEVER Use Existing Hermes

**Maker:**
> NO please please please for the 10th time understand I NEVER want it to use an existing or running hermes runtime

**Vic** updated the plan to skip the `path` stage entirely:
- Run stages individually via `-Stage <name>` — skip `path`, `configure`, `gateway`, `desktop`
- Hermes is NEVER added to the user's PATH
- `resolveHermesBin()` only checks `$HERMES_HOME\hermes-agent\venv\Scripts\hermes.exe` — no PATH lookup, no system Python, no fallback
- Saved memory: "Maker NEVER wants Headmaster to use an existing or running Hermes runtime. Non-negotiable."

**Stages run:** uv, python, git, node, system-packages, repository, venv, dependencies, node-deps, config-templates, platform-sdks, bootstrap-marker
**Stages SKIPPED:** path (NEVER), configure (Headmaster handles config), gateway (not needed), desktop (not needed)

---

## Maker's Third Pivot — Pre-bundled Runtime

**Maker:**
> Can we ship with a pre-bundled hermes install etc?

**Vic** measured the actual install sizes:
- Full Hermes install: **4.9GB** (too big to bundle)
- hermes-agent repo + .git: 3.2GB
- venv site-packages: 779MB (384 packages)
- PortableGit: ~300MB
- Node: ~50MB

**Analysis:** Can't bundle the full install. But `hermes dashboard` only needs a fraction — no messaging platforms (telegram, discord, slack, whatsapp), no browser automation (playwright), no Node.js, no PortableGit, no .git history. A stripped venv with `hermes-agent[web,cli]` extras would be ~200-300MB. That's shippable.

**Plan updated with future section:** Pre-bundled runtime zip as an electron-builder `extraResource`. CI builds a stripped venv, ships it in the exe. App extracts on first launch. Instant startup, no network. The resolution chain doesn't change — just swap "run install.ps1" for "extract zip." Documented as a future task, not blocking the current plan.

---

## Final Plan Summary

**Plan file:** `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-headmasterUI\.hermes\plans\2026-06-26_150000-bundled-runtime-and-login-fixes.md`

**10 tasks across 3 phases:**

### Phase 1: Bundled runtime resolution (Issue 1)
- Task 0: Branch state pre-check
- Task 1: Hardcode HERMES_HOME to `%LOCALAPPDATA%\Headmaster\runtime` — no env var override, no fallback
- Task 2: Simplify `resolveHermesBin()` — only check Headmaster's venv, no PATH, no system Python
- Task 3: Rewrite `runBootstrapInstaller()` — download `install.ps1`, run stages individually, skip `path`/`configure`/`gateway`/`desktop`
- Task 4: Update runtime detection dialog — "Installation Failed" with Retry button
- Task 5: Clean up fs imports

### Phase 2: Fix login server error (Issue 2)
- Task 6: Create `.env.production` with `VITE_HERMESHQ_URL=https://hermeshq.gcaplabs.com`
- Task 7: Hardcode fallback URL in `AuthContext.tsx`
- Task 8: Add `envDir` to Vite renderer config

### Phase 3: Build and verify
- Task 9: Build portable exe
- Task 10: Smoke test — verify runtime installs to Headmaster dir, hermes NOT on PATH, login reaches hermeshq.gcaplabs.com

### Future: Pre-bundled Runtime Zip
- CI builds stripped venv (~200-300MB) with `hermes-agent[web,cli]` only
- Ships as electron-builder `extraResource` zip
- App extracts on first launch — instant startup, no network
- Resolution chain unchanged — just swap install.ps1 for zip extraction

---

## Key Decisions Made

1. **HERMES_HOME is always `%LOCALAPPDATA%\Headmaster\runtime`** — no env var override, no fallback to dev install
2. **Hermes is NEVER on PATH** — `path` stage skipped, `resolveHermesBin()` has no PATH lookup
3. **Runtime is auto-installed** via `install.ps1` with custom paths on first launch
4. **Login URL is baked at build time** via `.env.production` + hardcoded fallback
5. **Pre-bundled zip is future work** — current plan uses install.ps1, zip extraction can replace it later without architecture change

---

## Pending Question

Maker has not yet chosen execution mode:
1. **Autonomous** — subagent-driven-development, fresh subagent per task, hands-off
2. **Checkpointed** — Vic executes and stops after each task for Maker's "continue"