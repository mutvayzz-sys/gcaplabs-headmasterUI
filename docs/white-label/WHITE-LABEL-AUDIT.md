# Hermes Desktop → Headmaster White-Label Audit

**Date:** 2026-06-12
**Target:** `apps/desktop/` (Electron + Vite + React + TypeScript) inside `C:\Users\Matve\Desktop\Gcaplabs.com\desktop\hermes-agent\`
**Goal:** Identify every touchpoint that needs to change to ship this app as **Headmaster by GCAP Labs** with zero grep-able upstream identifiers (Hermes, Hermes Agent, Nous Research, Hermes Agent codenames).

> **Scope:** Audit only. No files were modified. This report is the checklist — execution is a separate phase.

---

# SCOPE LOCK: FRONTSTUFF ONLY

**The constraint (locked in by user 2026-06-12):** Touch only the **front-facing surfaces** of the desktop app. Do NOT modify anything that would break the underlying Hermes Agent runtime. The rebrand is a UI/metadata skin — the agent core, CLI, gateway, install scripts, and IPC plumbing must keep working exactly as they do today.

## What counts as "frontstuff" (safe to change)

| Category                              | Examples                                                                                                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **App identity**                      | `package.json` `name`, `productName`, `author`, `description`                                                                                                    |
| **OS-level install metadata**         | `appId`, `executableName`, `artifactName` pattern, `protocols[].name` and `schemes` (only if NOT used for IPC — see runtime list), DMG title, NSIS shortcut name |
| **Window / menu / About**             | `APP_NAME` constant in `main.cjs`, `setAboutPanelOptions` `applicationName` + `copyright`, menu items                                                            |
| **Window title**                      | `index.html` `<title>`, native window title                                                                                                                      |
| **Renderer UI text**                  | All strings in `src/i18n/*.ts`, all hard-coded strings in `src/app/**`, `src/components/**`                                                                      |
| **Onboarding copy**                   | `desktop-onboarding-overlay.tsx`, provider display names, featured provider list                                                                                 |
| **Theme names**                       | `--stroke-nous`, `--shadow-nous` token names, theme class names like `.theme-hermes`, theme labels in the picker (Hermes/Nous/Bronze/Slate/Mono)                 |
| **Log tag prefixes**                  | `console.log('[hermes] …')` → `console.log('[headmaster] …')` in `electron/*.cjs`                                                                                |
| **Marketing / docs**                  | `README.md`, `DESIGN.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, all translated READMEs                                                                              |
| **Brand assets**                      | `assets/icon.icns/ico/png`, `public/apple-touch-icon.png`, `public/hermes*.png`, `public/hermes-frames/*.png`, `public/nous-girl.jpg`                            |
| **Source-mapped string identifiers**  | Function/type names like `HermesConnection` → `HeadmasterConnection` (low risk, mostly type-level)                                                               |
| **Test file names**                   | `hermes.test.ts` → `headmaster.test.ts` (and the test contents)                                                                                                  |
| **localStorage keys**                 | `hermes-onboarding-show-all-v1` → `headmaster-onboarding-show-all-v1`                                                                                            |
| **Code-signing identity**             | `scripts/set-exe-identity.cjs` — change the cert subject to GCAP                                                                                                 |
| **Notarization**                      | `scripts/notarize.cjs` — change Apple ID, team ID, etc.                                                                                                          |
| **Winget / Linux maintainer strings** | `linux.maintainer`, `winget` manifest publisher, etc.                                                                                                            |

## What is "runtime" (DO NOT TOUCH)

| Category                                                                                                                                                                                                                        | Why it's off-limits                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`HERMES_HOME` env var**                                                                                                                                                                                                       | The actual install root. Desktop app reads it, install scripts write to it, Python runtime lives in it. Renaming breaks the entire install path detection.                                                                                                                                                                                                                                                                                       |
| **`HERMES_DESKTOP_*` env vars** (e.g., `HERMES_DESKTOP_HERMES_ROOT`, `HERMES_DESKTOP_USER_DATA_DIR`, `HERMES_DESKTOP_DEV_SERVER`, `HERMES_DESKTOP_BOOT_FAKE`, `HERMES_DESKTOP_BOOT_FAKE_STEP_MS`, `HERMES_DESKTOP_DISABLE_GPU`) | These wire the desktop app to the runtime. Renaming them requires changing them in BOTH the desktop source AND the runtime's environment-var resolution code. Not worth it — the desktop works fine with these names internally even if the user-visible app is "Headmaster."                                                                                                                                                                    |
| **`hermes-media://` protocol**                                                                                                                                                                                                  | Custom URL scheme used for streaming local media files into the renderer. Internal IPC between main and renderer. Renaming = renderer can't load videos.                                                                                                                                                                                                                                                                                         |
| **Python entrypoint commands** (`hermes gateway`, `hermes dashboard`, `hermes model`, `hermes update`, `hermes desktop`)                                                                                                        | Defined in the upstream `hermes-agent/` Python package. The desktop spawns these. Don't change them.                                                                                                                                                                                                                                                                                                                                             |
| **Gateway ports** (`9120-9199` port pool, `:8642` default gateway, `:9119` dashboard, `:3000` workspace)                                                                                                                        | Hard-coded in the orchestration logic. Changing them without updating the Python runtime causes port conflicts.                                                                                                                                                                                                                                                                                                                                  |
| **Bootstrap process** (`BOOTSTRAP_COMPLETE_MARKER`, `ACTIVE_HERMES_ROOT` = `HERMES_HOME/hermes-agent`, `VENV_ROOT`, `INSTALL_STAMP_SCHEMA_VERSION`)                                                                             | The first-launch install orchestration. Touching this breaks the install flow.                                                                                                                                                                                                                                                                                                                                                                   |
| **Install scripts** (`scripts/install.ps1`, `scripts/install.sh`, `macos/com.hermes.workspace.plist.template` in workspace)                                                                                                     | Spawn Python, create venvs, set up PATH. Don't touch.                                                                                                                                                                                                                                                                                                                                                                                            |
| **`hermes-agent` subdirectory under `HERMES_HOME`**                                                                                                                                                                             | The actual git checkout. Desktop app reads from `HERMES_HOME/hermes-agent/...` paths. Don't change.                                                                                                                                                                                                                                                                                                                                              |
| **`@hermes/shared` workspace package** (`apps/shared/`)                                                                                                                                                                         | Shared types between desktop and other parts of the monorepo. Type-only. Not user-facing. Don't touch internals.                                                                                                                                                                                                                                                                                                                                 |
| **The `hermes` git remote URL in `update-remote.cjs`** (`OFFICIAL_REPO_HTTPS_URL`, `OFFICIAL_REPO_CANONICAL`)                                                                                                                   | **This is the trickiest one.** It IS user-facing (a savvy user could `git remote -v` in `HERMES_HOME/hermes-agent` and see where updates come from), but the desktop app's `update-remote.cjs` logic is part of the bootstrap process. If you're not forking the entire `hermes-agent` runtime, this URL needs to keep pointing at the upstream `NousResearch/hermes-agent` so the desktop can install the runtime. **See decision tree below.** |
| **Backend HTTP API paths and IPC channel names**                                                                                                                                                                                | The desktop calls these. Renaming them requires changing the Python runtime's HTTP routes too. Out of scope.                                                                                                                                                                                                                                                                                                                                     |
| **`cli.py` and the entire Python runtime**                                                                                                                                                                                      | The actual agent. Not in the desktop repo. Don't touch.                                                                                                                                                                                                                                                                                                                                                                                          |
| **Tauri-based bootstrap installer** (`apps/bootstrap-installer/`)                                                                                                                                                               | Separate installer app that runs the install.ps1. Don't touch unless you're forking the install flow.                                                                                                                                                                                                                                                                                                                                            |

## Decision tree for ambiguous cases

When you're not sure if a string is "frontstuff" or "runtime":

```
Does renaming this string change what shows up in a USER-FACING UI surface?
├── YES → it's frontstuff, change it
│   Examples: window title, About panel, README, error message shown to user
└── NO → does it change how the desktop app talks to the Python runtime?
    ├── YES → it's runtime, don't touch
    │   Examples: env var name, IPC protocol scheme, port number, CLI command
    └── NO → it's internal/dev, doesn't matter
        Examples: test file names, dev-only console.log tags
```

## The `OFFICIAL_REPO_*` exception

The `update-remote.cjs` constants are a real edge case:

- They ARE grep-able (a user with `cat ~/.hermes/hermes-agent/.git/config` would see the remote)
- They ARE part of the "vanilla Nous" lineage leak
- BUT the desktop app uses them to fetch the runtime via `git clone` — if you point this at a GCAP fork, you also need to host and maintain that fork

**Three paths:**

1. **Keep pointing at NousResearch/hermes-agent** — desktop continues to install the upstream runtime. This is what fathah's fork does. Minimal change. The rebrand is purely UI.
2. **Point at a GCAP-maintained fork** — requires GCAP to maintain a fork of the entire `hermes-agent` Python runtime, build releases, etc. Big commitment.
3. **Replace with a self-hosted binary distribution** — instead of `git clone` from GitHub, the desktop downloads a pre-built tarball from a GCAP-controlled server. Requires a build/release infra.

**My default recommendation:** Option 1 (keep pointing at Nous). The repo URL is grep-able but most prospects won't think to look there. The bigger branding leak is the visible UI.

---

# SCOPE RECONCILIATION

This section was added after the SCOPE LOCK above. It lists the **specific items in Parts 1 and 2 that get reclassified by the "frontstuff only" scope filter.** Anything not listed here follows the scope rule as written in its original section.

## Items in Part 1 that are RUNTIME (do not change)

| Item                                                                                                                                                                                                                        | Location                               | Reclassified from                              | Why                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MEDIA_PROTOCOL = 'hermes-media'`                                                                                                                                                                                           | `electron/main.cjs:497`                | SHOULD-FIX in 2.1                              | IPC scheme for streaming local media between main and renderer. Renaming breaks video/audio playback in the renderer.                                                                                                                                                                                                                                                                                                              |
| `hermes://` URL scheme in `protocols[].schemes`                                                                                                                                                                             | `package.json:140-143`                 | MUST-FIX in 2.1, MUST-FIX in 2.8               | **VERIFY BEFORE CHANGING.** The scheme is registered but no `protocol.handle('hermes', ...)` was found in the read of `main.cjs`. If it's only registered (no handler), it's a future deep-link placeholder and can be changed to `headmaster://`. If a handler exists, it's runtime. **Open the file and grep for `protocol.handle` and `hermes://` to confirm before scrubbing.**                                                |
| `HERMES_DESKTOP_*` env vars (e.g., `HERMES_DESKTOP_HERMES_ROOT`, `HERMES_DESKTOP_USER_DATA_DIR`, `HERMES_DESKTOP_DEV_SERVER`, `HERMES_DESKTOP_BOOT_FAKE`, `HERMES_DESKTOP_BOOT_FAKE_STEP_MS`, `HERMES_DESKTOP_DISABLE_GPU`) | `main.cjs`, `README.md`                | Already SHOULD-FIX/keep in 2.1 and pitfall #10 | Runtime wiring. Don't rename. Docs that reference them stay accurate.                                                                                                                                                                                                                                                                                                                                                              |
| Python entrypoint commands in docs (`hermes desktop`, `hermes update`, `hermes gateway`, `hermes dashboard`)                                                                                                                | `README.md`                            | n/a (docs were already correct)                | These are real CLI commands. Docs should keep using them. Don't say "use the desktop" — say "run `hermes desktop`".                                                                                                                                                                                                                                                                                                                |
| `OFFICIAL_REPO_HTTPS_URL` / `OFFICIAL_REPO_CANONICAL` in `update-remote.cjs`                                                                                                                                                | `electron/update-remote.cjs:15-16`     | SHOULD-FIX in 2.1                              | **Default: keep pointing at NousResearch/hermes-agent** (Option 1 in the OFFICIAL*REPO*\* exception above). The desktop needs to fetch the runtime from somewhere; if you're not hosting a GCAP fork, leave it.                                                                                                                                                                                                                    |
| `hermes.ts` / `types/hermes.ts` source files                                                                                                                                                                                | `src/hermes.ts`, `src/types/hermes.ts` | NICE in 2.1                                    | **JUDGMENT CALL.** These are internal module names, not user-facing. Renaming them is low risk (TypeScript will catch all the import sites) but adds churn. **Recommend: SKIP** for the frontstuff-only pass. Leave the file/module names alone. The user-visible API is the window title, About panel, etc. — those are what matter.                                                                                              |
| `@nous-research/ui` external dep                                                                                                                                                                                            | `package.json:59`                      | DECISION in Section 4                          | **Default: KEEP the dep.** It provides the BrandMark and design tokens. Renaming the visible tokens (`--stroke-nous` → `--stroke-headmaster`, etc.) is safe and gets you the visual rebrand. Forking/inlining the dep is a bigger lift and crosses into "risk of breaking functionality" territory. The font URL `url('@nous-research/ui/dist/fonts/Collapse-Bold.woff2')` works as long as the package is installed. Don't touch. |
| The `HERMES_HOME` env var                                                                                                                                                                                                   | All                                    | n/a (already excluded in Part 1)               | Runtime install root. Don't touch.                                                                                                                                                                                                                                                                                                                                                                                                 |
| `BOOTSTRAP_COMPLETE_MARKER`, `ACTIVE_HERMES_ROOT`, `VENV_ROOT`, `INSTALL_STAMP_SCHEMA_VERSION` constants in `main.cjs`                                                                                                      | `main.cjs:264-278`                     | n/a                                            | Runtime bootstrap orchestration. Don't touch.                                                                                                                                                                                                                                                                                                                                                                                      |
| `PortPool(PORT_FLOOR=9120, PORT_CEILING=9199)`                                                                                                                                                                              | `main.cjs:111-116`                     | n/a                                            | Port range for spawning the Python backend. Don't touch.                                                                                                                                                                                                                                                                                                                                                                           |
| `HERMES_HOME`, `LOCALAPPDATA\hermes`, `~/.hermes` path resolution in `main.cjs`                                                                                                                                             | `main.cjs:229-256`                     | n/a                                            | Install-path detection. Don't touch.                                                                                                                                                                                                                                                                                                                                                                                               |

## Items in Part 1 that are FRONTSTUFF (confirmed safe to change)

The SCOPE LOCK doesn't change anything in the frontstuff category — all the MUST-FIX items from Section 2.1 through 2.6 remain in scope. Key confirmed frontstuff:

- `package.json` `name`, `productName`, `version`, `author`, `description` (lines 2-7)
- `package.json` `appId` (line 135) — OS-level install identifier
- `package.json` `executableName` (line 137)
- `package.json` `artifactName` (line 146) — installer filename pattern
- `package.json` macOS `extendInfo` block (lines 187-191) — bundle display name, executable, copyright
- `package.json` DMG title (line 201)
- `package.json` NSIS `shortcutName`, `uninstallDisplayName` (lines 244-245)
- `package.json` `linux.maintainer`, `linux.synopsis` (lines 232-233)
- `package.json` `win.legalTrademarks` (line 223)
- `electron/main.cjs` `APP_NAME` (line 326) + `app.setName(APP_NAME)` (line 480)
- `electron/main.cjs` `app.setAboutPanelOptions` (lines 485-489) — copyright, applicationName
- `electron/main.cjs` log tag prefix `[hermes]` → `[headmaster]` (SHOULD-FIX items in 2.1)
- `index.html` `<title>Hermes</title>` (line 11)
- `src/i18n/*.ts` — ALL 1,820+ lines of user-facing strings
- `src/components/brand-mark.tsx` — visible logo
- `src/components/desktop-onboarding-overlay.tsx` — provider names, featured provider, localStorage key
- `src/app/settings/about-settings.tsx` — `RELEASE_NOTES_URL` (line 22)
- All 9 binary assets in `assets/` and `public/`
- `README.md` (all branding, NOT the CLI command names which are runtime)
- `DESIGN.md`, `CONTRIBUTING.md`, `CHANGELOG.md` (dev-internal docs — per pitfall #1, these can keep some references, but if you want the public repo to be clean, scrub them)
- All test file renames (`hermes.test.ts` → `headmaster.test.ts` etc.)

## Items in Part 2 that are reclassified

### fathah/hermes-desktop reclassifications

| Item                                         | Location                                                       | Reclassified from | Why                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linux.vendor: Nous Research`                | `electron-builder.yml:67`                                      | MUST-FIX in B.1   | **JUDGMENT CALL.** This is the Linux package maintainer field. It IS user-facing (`apt show` / `rpm -qi` show it). But it's also functionally identifying the package's source. If you want a clean install, change it. If you're keeping the upstream `hermes-agent` runtime install, you can leave it (the vendor says "we don't maintain this; it comes from the hermes-agent project"). |
| `scripts/drive-nous-*.js` and similar        | `scripts/*.js`                                                 | DECISION in B.2   | **PROBABLY RUNTIME.** These scripts probe the Nous OAuth/models API. If GCAP drops the Nous Portal integration, the scripts are dead code — delete. If GCAP keeps the integration, the scripts need to keep their `nous-*` filenames because the filenames are referenced from the install flow / test suite. Renaming is a bigger change than it looks.                                    |
| `posthog-js` telemetry dep                   | `package.json:39`                                              | MUST-FIX in B.3   | **FRONTSTUFF** — third-party analytics is a privacy/branding concern, not a runtime concern. Strip it.                                                                                                                                                                                                                                                                                      |
| `previews/` directory screenshots            | `previews/*.png, *.webp`                                       | MUST-FIX in B.5   | **FRONTSTUFF** — these are the marketing screenshots. If they're not shipped in the final app, they're dev assets. If they ARE shipped (e.g., linked from the README on a public site), they're customer-facing.                                                                                                                                                                            |
| `~/.hermes-fresh` path in `dev:fresh` script | `package.json:15` (`HERMES_HOME=$(mktemp -d -t hermes-fresh)`) | n/a               | **RUNTIME.** This is a dev-mode test path. Don't touch.                                                                                                                                                                                                                                                                                                                                     |

### outsourc-e/hermes-workspace reclassifications

| Item                                                          | Location                                                                      | Reclassified from        | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `macos/com.hermes.workspace.plist.template`                   | `macos/com.hermes.workspace.plist.template`                                   | MUST-FIX in C.2 and C.10 | **MOSTLY RUNTIME.** The plist is the launchd service config that runs the app on macOS. The `Label` field MUST stay unique, but it's not user-facing in the way the appId is. The `ProgramArguments` (the `server-entry.js` path) is runtime. The `EnvironmentVariables` (`HERMES_API_URL`, `CLAUDE_API_URL`, `HERMES_API_TOKEN`, `CLAUDE_API_TOKEN`) are RUNTIME — don't rename. The `StandardOutPath` / `StandardErrorPath` (log file paths in `/tmp/hermes-workspace.out.log`) are RUNTIME-ish — they only show up in `tail -f` for debugging. **Minimal change: leave the plist as-is.** |
| `playground-ws-worker` sub-package                            | `playground-ws-worker/`                                                       | n/a (flagged in 7 of E)  | **RUNTIME.** This is a Cloudflare Worker sub-package that handles some web functionality. Don't touch.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `swarm.yaml` worker definitions                               | `swarm.yaml`                                                                  | DECISION in C.5          | **MIXED.** The worker IDs (`orchestrator`, `builder`, etc.) are runtime — they're spawned by the runtime. **Don't rename.** The `name: Orchestrator` fields and the `mission: ...` text are frontstuff-ish (they appear in the Agent View UI). The `model: GPT-5.5` field is a runtime config. The skills list (e.g., `gstack-for-hermes`, `gbrain`) is runtime config. **Minimal change: leave swarm.yaml alone. UI text that displays worker names is in `src/components/agent-view/` and similar — scrub that.**                                                                          |
| `agents/{worker}/README.md` files                             | `agents/*/README.md`                                                          | n/a                      | **DEV DOCS** — these are dev-internal documentation. Per pitfall #1, can keep some upstream references.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `memory/` directory                                           | `memory/`                                                                     | n/a (flagged in C.11)    | **DEV DOCS** — internal project memory. Can keep codenames.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Greek mythology persona avatars                               | `public/avatars/*.png`, `public/avatars-3d/*`, `public/ascii-portraits/*.txt` | DECISION in C.4          | **MOSTLY FRONTSTUFF.** The `hermes` persona in particular is a UI surface (the default agent avatar). Replace it. The other 8 Greek gods are visual decoration — keep or replace based on whether you want the mythology theme. The `src/screens/Office/office3d/` code that USES the avatars is frontstuff (UI rendering).                                                                                                                                                                                                                                                                  |
| `claude-*` assets in `public/`                                | `public/claude-*`                                                             | MUST-FIX in C.3          | **FRONTSTUFF.** The README uses `claude-avatar.webp` as the page title avatar. That's clearly user-facing. Delete or replace. The `claude-chat.sh` script is also frontstuff if it's a UI helper.                                                                                                                                                                                                                                                                                                                                                                                            |
| `@outsourc-e/hermes-*` skill names referenced in `swarm.yaml` | `swarm.yaml`                                                                  | DECISION in C.5          | **RUNTIME.** These are the actual skill names the runtime looks for. If a skill is named `gstack-for-hermes` in the upstream, the swarm spawn will look for that exact name. **Don't rename** without verifying the skill exists at the new path.                                                                                                                                                                                                                                                                                                                                            |
| Theme names (Hermes, Nous, Bronze, Slate, Mono)               | `src/themes/*` (presumed)                                                     | MUST-FIX in C.6          | **FRONTSTUFF.** The theme names appear in the theme picker UI. Rename "Hermes" and "Nous" themes. The other 3 are fine. The CSS class names (`.theme-hermes`, etc.) are frontstuff.                                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs/conductor-bug-log.md`                                   | `docs/conductor-bug-log.md`                                                   | n/a (flagged in C.4)     | **DEV DOCS** — internal bug log. Per pitfall #1, can keep some references.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `install.sh` script                                           | `install.sh`                                                                  | n/a                      | **RUNTIME.** Don't touch. The 42 branding matches are mostly in comments and the help text — the actual install logic should be left alone.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Updated scope-aware decision tree (additive to the one above)

When the frontstuff/runtime split is ambiguous, ask:

1. **Does the string appear in code that the USER can see in the app, README, or installer metadata?**
   - YES → frontstuff, change
2. **Does the string appear in code that the RUNTIME (Python, gateway, install scripts, port detection, env var resolution) reads?**
   - YES → runtime, don't touch
3. **Does the string appear in dev-internal docs (AGENTS.md, CONTRIBUTING.md, internal memory)?**
   - YES → can keep per pitfall #1; not on the customer-facing surface
4. **Still ambiguous?** Ask the user.

---

_Part 1 (Nous desktop) and Part 2 (fathah + workspace) follow. They were written before the SCOPE LOCK above. Use the SCOPE RECONCILIATION table to reclassify specific items as needed before executing the scrub plan._

---

# PART 3: SOURCE OF TRUTH — HEADMASTER DESIGN REFERENCES (CORRECTED)

Added 2026-06-12. This section supersedes an earlier draft that was based on the wrong folder. The earlier draft pointed to AI-generated marketing mockups in `C:\Users\Matve\Desktop\Gcaplabs.com\repo\public\images\generated\mockups\` — those are throwaway marketing visuals, NOT the product spec.

**The real product spec is at:** `C:\Users\Matve\Desktop\07 - Projects & Repos\Gcaplabs.com\References\` (numbered `01-12`).

## What the real spec shows (12 design screens)

The `References/01-dashboard-command-center.png` is the home view and reveals the full product. 14 sidebar items, 4 KPI cards, 6 dashboard panels, persistent chat composer, brand details.

### Sidebar (14 screens)

Dashboard • Chat • Workflows • Kanban • Runs • Approvals • Documents • Memory • Automations • Agents • Integrations • Channels • Analytics • Settings

Plus: workspace switcher at the bottom (Nova Product Launch / Business Workspace), user profile (Alex Morgan / Product Manager).

### Branding details visible in 01

- App name: **GCAP HEADMASTER** with shield logo
- Greeting: **"Good morning, Alex 👋 / Headmaster is running your operations."**
- Theme: dark navy background, **purple/indigo** primary accent
- Search bar with cmd+K hint
- Notification bell with badge
- "+ New Task" primary CTA (purple)
- Persistent bottom composer: ✨ "Ask Headmaster anything..." with 4 quick chips (Create launch plan, Analyze competitors, Draft investor update, Optimize landing page)

### 4 KPI cards (top of dashboard)

Active Runs (12) • Pending Approvals (7) • Tasks Completed (128) • Time Saved (42.6 hrs) — each with sparkline + vs-yesterday delta

### 6 main panels

1. Active Runs — list of 5 tasks w/ status pills, category, assigned agent, time
2. Approvals — 3 priority items w/ ✓/✗/💬 actions
3. Top Workflows — 5 ranked w/ run counts + % trend
4. System Status — 5 components all "Operational": Model Layer (TayX), Memory Engine, Integrations, Automations, Data Pipeline
5. Memory Updates — 5 recent entries w/ categories (Important / Update / Reference)
6. Automation Schedule — 5 scheduled jobs w/ on/off toggles

### Named agents visible in the spec

Copywriter, Researcher, Marketing Agent, Growth Marketer, Content Creator, Designer, PR Specialist — these map to the multi-agent roster.

## The other 11 references (file-rename summary)

| File                                | Screen                                                          |
| ----------------------------------- | --------------------------------------------------------------- |
| `01-dashboard-command-center.png`   | Home — 4 KPIs + 6 panels (described above)                      |
| `02-chat-ask-headmaster.png`        | Chat surface (Nous-style chat composer + message stream)        |
| `03-runs-execution-history.png`     | Run history (list of past agent runs with status, time, output) |
| `04-approvals-queue.png`            | Approvals queue (the ✓/✗/💬 review surface)                     |
| `05-documents-knowledge-base.png`   | Documents (file browser, knowledge base)                        |
| `06-memory-providers.png`           | Memory (the persistent knowledge + provider config)             |
| `07-automations-schedules.png`      | Automations (scheduled jobs)                                    |
| `08-workflows-skills-library.png`   | Workflows (skill templates, runnable flows)                     |
| `09-agents-profiles.png`            | Agents (roster of named agents, profiles, status)               |
| `10-integrations-channels-mcp.png`  | Integrations (MCP servers, external tools)                      |
| `11-model-stack-providers-tayx.png` | Model Stack (TayX + other LLM providers)                        |
| `12-guided-workflow-run.png`        | Guided Workflow Run / Demo Theater (the "show me how" tour)     |

Plus **5 unnumbered older versions** (`Memory.png`, `Automations.png`, `Workflows.png`, `Agents.png`, and 2 GUID-named files) — these are the same screens, older iterations. Safe to delete from the References folder for cleanliness.

## Where the actual build map lives

**See `WHAT-WE-TAKE.md` in this folder** for the simplified build plan (4 custom screens + 10 ported screens + 1 shared composer + 5-step merge).

## Updated scope-aware decision tree (additive to the one above)

When the frontstuff/runtime split is ambiguous, ask:

1. **Does the string appear in code that the USER can see in the app, README, or installer metadata?**
   - YES → frontstuff, change
2. **Does the string appear in code that the RUNTIME (Python, gateway, install scripts, port detection, env var resolution) reads?**
   - YES → runtime, don't touch
3. **Does the string appear in dev-internal docs (AGENTS.md, CONTRIBUTING.md, internal memory)?**
   - YES → can keep per pitfall #1; not on the customer-facing surface
4. **Still ambiguous?** Ask the user.

---

_End of Part 3. With this, the audit has three parts: Part 1 = original Nous audit. Part 2 = fathah + workspace findings. Part 3 = the mockup-based source-of-truth spec. The execution plan should follow Part 3's priority list, not Parts 1/2's flat "scrub everything" approach._

---

## 1. Executive summary

| Severity                                       | Count   | Notes                                                                                                                    |
| ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| **MUST-FIX** (visible to end user)             | **~45** | App name, window title, About panel, installer metadata, splash, icons, i18n, onboarding, system menus, OS-level strings |
| **SHOULD-FIX** (visible to technical reviewer) | **~30** | Source-mapped strings, README, electron-builder details, internal codenames, env-var names, REPO URL refs                |
| **NICE-TO-HAVE** (build/dev only, low risk)    | **~15** | Test names, dev comments, log line tags, schema names                                                                    |

### Top 5 must-fix

1. **`package.json` `appId: "com.nousresearch.hermes"`** — the OS-level bundle identifier. Persists in install registry, plist, MSI, AppID metadata. This is the #1 grep target.
2. **`public/apple-touch-icon.png` (541 KB), `assets/icon.icns` / `assets/icon.ico` / `assets/icon.png`, `public/hermes.png` (1.4 MB)** — every visible icon. 8 PNGs total.
3. **`@nous-research/ui` npm dep** — external package that ships its own brand mark, fonts, and CSS variables (`--stroke-nous`, `--shadow-nous`, `arc-nous`). Hard-coded into `src/styles.css` line 17 (`@import Collapse-Bold.woff2` from its dist). Can NOT be rebranded in-place — must be replaced, removed, or forked.
4. **i18n strings** — `Hermes` / `Hermes Desktop` appears throughout `src/i18n/{en,zh,zh-hant,ja}.ts`. The English file alone is **1,820 lines / 77 KB** with many user-visible `Hermes` references.
5. **`electron/main.cjs` `APP_NAME = 'Hermes'`** (line 326) and `app.setName(APP_NAME)` (line 480), plus `app.setAboutPanelOptions({ copyright: 'Copyright © 2026 Nous Research' })` (line 488). Sets every OS-level identity string (macOS menu bar, Windows taskbar, dock).

### External dependency risk callout

`@nous-research/ui` is a **fork-or-replace** decision, not a "change a string" task. The desktop app's visual identity leans heavily on tokens defined by this package. See **Section 4** for the deep-dive.

---

## 2. Categorized findings

### 2.1 Product name (Hermes / Hermes Agent / Hermes Desktop)

| Severity | File                                                                         | Line                                                                  | Current                                                                                                                                                                                                                                                                       | Recommended                                                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MUST     | `apps/desktop/package.json`                                                  | 2-3                                                                   | `"name": "hermes"`, `"productName": "Hermes"`                                                                                                                                                                                                                                 | `"name": "headmaster"`, `"productName": "Headmaster"`                                                                                                                       |
| MUST     | `apps/desktop/package.json`                                                  | 6                                                                     | `"description": "Native desktop shell for Hermes Agent."`                                                                                                                                                                                                                     | `"description": "Native desktop shell for Headmaster."`                                                                                                                     |
| MUST     | `apps/desktop/package.json`                                                  | 7                                                                     | `"author": "Nous Research"`                                                                                                                                                                                                                                                   | `"author": "GCAP Labs"`                                                                                                                                                     |
| MUST     | `apps/desktop/package.json`                                                  | 135                                                                   | `"appId": "com.nousresearch.hermes"`                                                                                                                                                                                                                                          | `"appId": "com.gcaplabs.headmaster"` (verify reverse-DNS unused)                                                                                                            |
| MUST     | `apps/desktop/package.json`                                                  | 136                                                                   | `"productName": "Hermes"` (in build)                                                                                                                                                                                                                                          | `"productName": "Headmaster"`                                                                                                                                               |
| MUST     | `apps/desktop/package.json`                                                  | 137                                                                   | `"executableName": "Hermes"`                                                                                                                                                                                                                                                  | `"executableName": "Headmaster"`                                                                                                                                            |
| MUST     | `apps/desktop/package.json`                                                  | 140-143                                                               | `protocols: [{name: "Hermes Protocol", schemes: ["hermes"]}]`                                                                                                                                                                                                                 | `[{name: "Headmaster Protocol", schemes: ["headmaster"]}]`                                                                                                                  |
| MUST     | `apps/desktop/package.json`                                                  | 146                                                                   | `"artifactName": "Hermes-${version}-${os}-${arch}.${ext}"`                                                                                                                                                                                                                    | `"Headmaster-${version}-${os}-${arch}.${ext}"`                                                                                                                              |
| MUST     | `apps/desktop/package.json`                                                  | 187-191                                                               | `extendInfo.CFBundleDisplayName: "Hermes"`, `CFBundleExecutable: "Hermes"`, `CFBundleName: "Hermes"`, `NSAudioCaptureUsageDescription: "Hermes uses audio capture for voice conversations."`, `NSMicrophoneUsageDescription: "Hermes uses the microphone for voice input..."` | All `"Headmaster"`                                                                                                                                                          |
| MUST     | `apps/desktop/package.json`                                                  | 201                                                                   | `dmg.title: "Install Hermes"`                                                                                                                                                                                                                                                 | `"Install Headmaster"`                                                                                                                                                      |
| MUST     | `apps/desktop/package.json`                                                  | 223                                                                   | `win.legalTrademarks: "Hermes"`                                                                                                                                                                                                                                               | `"Headmaster"`                                                                                                                                                              |
| MUST     | `apps/desktop/package.json`                                                  | 232-233                                                               | `linux.maintainer: "Nous Research <support@nousresearch.com>"`, `synopsis: "Native desktop shell for Hermes Agent."`                                                                                                                                                          | `"GCAP Labs <support@gcaplabs.com>"`, `"Native desktop shell for Headmaster."`                                                                                              |
| MUST     | `apps/desktop/package.json`                                                  | 244-245                                                               | `nsis.shortcutName: "Hermes"`, `uninstallDisplayName: "Hermes"`                                                                                                                                                                                                               | `"Headmaster"`                                                                                                                                                              |
| MUST     | `apps/desktop/index.html`                                                    | 11                                                                    | `<title>Hermes</title>`                                                                                                                                                                                                                                                       | `<title>Headmaster</title>`                                                                                                                                                 |
| MUST     | `apps/desktop/electron/main.cjs`                                             | 326                                                                   | `const APP_NAME = 'Hermes'`                                                                                                                                                                                                                                                   | `const APP_NAME = 'Headmaster'`                                                                                                                                             |
| MUST     | `apps/desktop/electron/main.cjs`                                             | 480                                                                   | `app.setName(APP_NAME)` (uses above)                                                                                                                                                                                                                                          | (auto-follows)                                                                                                                                                              |
| MUST     | `apps/desktop/electron/main.cjs`                                             | 486-488                                                               | `app.setAboutPanelOptions({ applicationName: APP_NAME, applicationVersion: resolveHermesVersion(), copyright: 'Copyright © 2026 Nous Research' })`                                                                                                                            | `copyright: 'Copyright © 2026 GCAP Labs'`                                                                                                                                   |
| MUST     | `apps/desktop/electron/main.cjs`                                             | 497                                                                   | `const MEDIA_PROTOCOL = 'hermes-media'`                                                                                                                                                                                                                                       | `'headmaster-media'` (or pick a clean scheme)                                                                                                                               |
| MUST     | `apps/desktop/src/i18n/en.ts`                                                | 46, 56-57, 65, 102, 110, 379, and ~30+ more                           | `'Hermes Desktop is ready'`, `'Hermes couldn't start'`, `'Update Hermes'`, `'Talk to Hermes'`, etc.                                                                                                                                                                           | `'Headmaster is ready'`, `'Headmaster couldn't start'`, `'Update Headmaster'`, `'Talk to Headmaster'`                                                                       |
| MUST     | `apps/desktop/src/i18n/{zh,zh-hant,ja}.ts`                                   | (parallel files)                                                      | Same `Hermes` / `Hermes Desktop` references in 3 additional languages                                                                                                                                                                                                         | Same replacements in each language file                                                                                                                                     |
| MUST     | `apps/desktop/src/components/brand-mark.tsx`                                 | 1, 2                                                                  | Imports `BrandMark` from `@/components/brand-mark`; references to it in About page and onboarding                                                                                                                                                                             | Re-render with Headmaster glyph (see 2.4)                                                                                                                                   |
| MUST     | `apps/desktop/src/components/desktop-onboarding-overlay.tsx`                 | 411                                                                   | `const SHOW_ALL_KEY = 'hermes-onboarding-show-all-v1'` (localStorage key)                                                                                                                                                                                                     | `'headmaster-onboarding-show-all-v1'`                                                                                                                                       |
| MUST     | `apps/desktop/README.md`                                                     | 1, 4-7, 10, 13-16, 22, 25, 27, 33, 37, 88, 103, 125, 131-133, 138-141 | Title `# Hermes Desktop ☤`, all badges link to `github.com/NousResearch/hermes-agent`, body copy                                                                                                                                                                              | Full rewrite — see 2.5                                                                                                                                                      |
| SHOULD   | `apps/desktop/electron/main.cjs`                                             | (search needed)                                                       | `console.log('[hermes] ...')` log tag prefix throughout file                                                                                                                                                                                                                  | `'[headmaster]'`                                                                                                                                                            |
| SHOULD   | `apps/desktop/electron/*.cjs`                                                | (search needed)                                                       | Same `[hermes]` log tag prefix across ~15 cjs files                                                                                                                                                                                                                           | `'[headmaster]'`                                                                                                                                                            |
| SHOULD   | `apps/desktop/electron/update-remote.cjs`                                    | 15-16                                                                 | `OFFICIAL_REPO_HTTPS_URL: 'https://github.com/NousResearch/hermes-agent.git'`, `OFFICIAL_REPO_CANONICAL: 'github.com/nousresearch/hermes-agent'`                                                                                                                              | Your own update channel URL (or remove the official-repo logic if you're forking)                                                                                           |
| SHOULD   | `apps/desktop/scripts/test-desktop.mjs`                                      | (search needed)                                                       | Test names / paths referencing `hermes-agent`                                                                                                                                                                                                                                 | Update to `headmaster`                                                                                                                                                      |
| SHOULD   | `apps/desktop/scripts/set-exe-identity.cjs`                                  | (search needed)                                                       | Code-signing identity                                                                                                                                                                                                                                                         | Update to GCAP code-sign cert subject                                                                                                                                       |
| SHOULD   | `apps/desktop/scripts/before-build.cjs`, `before-pack.cjs`, `after-pack.cjs` | (search needed)                                                       | Build hooks                                                                                                                                                                                                                                                                   | TBD — flag for review                                                                                                                                                       |
| NICE     | `apps/desktop/src/hermes.ts`                                                 | 70 matches                                                            | Mostly type/identifier names (`HermesConnection`, `HermesConfig`, etc.) — NOT user-facing but DOES show up in source maps and stack traces                                                                                                                                    | Judgment call: rename to `Headmaster*` to prevent stack-trace grep, OR keep `hermes` as internal type name (less common but legit). **Recommend rename** for full coverage. |
| NICE     | `apps/desktop/src/types/hermes.ts`                                           | 6 matches                                                             | Same — type names only                                                                                                                                                                                                                                                        | Same — rename to `types/headmaster.ts`                                                                                                                                      |
| NICE     | `apps/desktop/src/hermes.test.ts`                                            | 3 matches                                                             | Test file                                                                                                                                                                                                                                                                     | Rename to `headmaster.test.ts`                                                                                                                                              |
| NICE     | `apps/desktop/electron/*.test.cjs`                                           | 17 files                                                              | Test files with various Hermes refs                                                                                                                                                                                                                                           | Rename + update assertions                                                                                                                                                  |

### 2.2 Company name (Nous Research / NousResearch / @nous-research)

| Severity | File                                                         | Line                      | Current                                                                                                                                                         | Recommended                                                                                                                                              |
| -------- | ------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MUST     | `apps/desktop/package.json`                                  | 232                       | `linux.maintainer: "Nous Research <support@nousresearch.com>"`                                                                                                  | `"GCAP Labs <support@gcaplabs.com>"`                                                                                                                     |
| MUST     | `apps/desktop/electron/main.cjs`                             | 488                       | `copyright: 'Copyright © 2026 Nous Research'`                                                                                                                   | `'Copyright © 2026 GCAP Labs'`                                                                                                                           |
| MUST     | `apps/desktop/src/i18n/en.ts`                                | (search needed)           | Provider display: `nous: { order: 0, title: 'Nous Portal' }`                                                                                                    | **CRITICAL**: this is a featured OAuth provider. Either remove the entry entirely (if GCAP won't offer portal auth) or rename to `GCAP Portal` / similar |
| MUST     | `apps/desktop/src/components/desktop-onboarding-overlay.tsx` | 96                        | `docsUrl: 'https://github.com/NousResearch/hermes-agent#bring-your-own-endpoint'`                                                                               | `'https://github.com/GCAPLabs/headmaster#bring-your-own-endpoint'` (or your actual repo)                                                                 |
| MUST     | `apps/desktop/src/components/desktop-onboarding-overlay.tsx` | 169-179                   | `PROVIDER_DISPLAY.nous: { order: 0, title: 'Nous Portal' }`, comment `// Collapse the secondary providers behind a disclosure only when Nous Portal is present` | Drop `nous` provider entry, drop comment, re-order remaining                                                                                             |
| MUST     | `apps/desktop/src/components/desktop-onboarding-overlay.tsx` | 410                       | `export const FEATURED_ID = 'nous'`                                                                                                                             | Replace with your actual featured provider id (or `'openrouter'` if you don't have a GCAP-native auth)                                                   |
| MUST     | `apps/desktop/src/styles.css`                                | 17                        | `url('../../../node_modules/@nous-research/ui/dist/fonts/Collapse-Bold.woff2')`                                                                                 | **REMOVE** — this pulls a font from the upstream package's dist. After the package is replaced/forked, this url will 404.                                |
| MUST     | `apps/desktop/src/styles.css`                                | 104, 109, 111, 617, 618   | `--shadow-nous:`, `--stroke-nous:`, `.arc-border.arc-nous,`                                                                                                     | Rename to `--shadow-headmaster`, `--stroke-headmaster`, `.arc-border.arc-headmaster` and update ALL component class references. Touches ~30+ files.      |
| SHOULD   | `apps/desktop/electron/main.cjs`                             | (comment grep)            | `// Hermes Agent runtime`, `// Hermes Desktop shell`, etc. throughout                                                                                           | Headmaster language                                                                                                                                      |
| SHOULD   | `apps/desktop/README.md`                                     | 10, 130-141               | `by [Nous Research](https://nousresearch.com)`, Discord link, "Built by Nous Research"                                                                          | "by GCAP Labs", your own links                                                                                                                           |
| NICE     | `apps/desktop/DESIGN.md`                                     | 2, 13, 14, 28, 31, 44, 51 | Comment-level references to `shadow-nous`, `stroke-nous`, "The white tile in `BrandMark` is the one sanctioned literal"                                         | Update to Headmaster token names; keep DESIGN.md as a dev-internal doc (see pitfall #1 in white-label-scrub skill)                                       |

### 2.3 Version numbers

| Severity | File                                                             | Line               | Current                                                                                                                                                                | Recommended                                                                                               |
| -------- | ---------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| MUST     | `apps/desktop/package.json`                                      | 5                  | `"version": "0.15.1"`                                                                                                                                                  | Set to `"0.1.0"` (or your preferred GCAP starting version) and bump per your release cadence              |
| MUST     | `apps/desktop/src/i18n/en.ts`                                    | 49-53              | `boot.steps.connectingGateway`, `loadingSettings`, etc. — strings don't contain version but **the About page** shows `version.appVersion` from `$desktopVersion` store | About page version display is fine to keep (users expect it) — just stop advertising it in marketing copy |
| SHOULD   | `apps/desktop/src/app/settings/about-settings.tsx`               | 22                 | `const RELEASE_NOTES_URL = 'https://github.com/NousResearch/hermes-agent/releases'`                                                                                    | Your own release notes URL                                                                                |
| SHOULD   | `apps/desktop/electron/main.cjs`                                 | (version function) | `resolveHermesVersion()` (function name)                                                                                                                               | Rename to `resolveHeadmasterVersion()`                                                                    |
| NICE     | `apps/desktop/src/store/updates.ts`, `src/store/updates.test.ts` | (search needed)    | Internal version handling                                                                                                                                              | Rename for consistency                                                                                    |

### 2.4 Logos / icons / images

| File                                                                          | Size                                    | Dimensions              | Notes                                                                                                                        |
| ----------------------------------------------------------------------------- | --------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/assets/icon.icns`                                               | 574 KB                                  | 1024×1024               | **macOS app icon** (visible in Finder, Dock, Launchpad, App Switcher)                                                        |
| `apps/desktop/assets/icon.ico`                                                | 370 KB                                  | multi-size (16/32/etc.) | **Windows app icon** (visible in Taskbar, Start Menu, Alt-Tab, Explorer)                                                     |
| `apps/desktop/assets/icon.png`                                                | 574 KB                                  | 1024×1024               | Source PNG for `.icns` (icon-builder convention)                                                                             |
| `apps/desktop/public/apple-touch-icon.png`                                    | 541 KB                                  | 1024×1024               | **Web favicon** for `index.html`, also bundled into `dist/` and used as `APP_ICON_PATHS` fallback in main.cjs (line 341-345) |
| `apps/desktop/public/hermes.png`                                              | 1.4 MB                                  | 1254×1254               | **Likely the splash/login hero** — bigger than the app icon                                                                  |
| `apps/desktop/public/hermes-sprite.png`                                       | 904 KB                                  | 1536×1024               | **Animation sprite sheet** — multiple Hermes glyph states in one image                                                       |
| `apps/desktop/public/hermes-frames/hermes-frame-0.png` … `hermes-frame-6.png` | 78-135 KB each (7 files, ~760 KB total) | varies                  | **Individual animation frames** — referenced by the sprite for the boot/loading animation                                    |
| `apps/desktop/public/nous-girl.jpg`                                           | 20 KB                                   | varies                  | **Marketing/team image** — check if used in onboarding/about                                                                 |
| `apps/desktop/public/ds-assets/`                                              | (folder)                                | n/a                     | Design system assets folder — needs directory listing to enumerate                                                           |

**All 8 PNGs + the icns/ico must be regenerated as Headmaster branded artwork.** Same dimensions, same aspect ratios, same format. Drop the `hermes-` and `nous-` filename prefixes.

**Critical note on `hermes-frames/`:** the 7 individual frames are referenced from the sprite sheet and the boot animation. They need to be regenerated as a coordinated set so the animation doesn't look broken.

### 2.5 README & docs (customer-facing public surface)

`apps/desktop/README.md` (141 lines) is a customer-facing public surface. The white-label-scrub skill explicitly calls this out (pitfall #14: "The public GitHub repo README is a public surface").

Every section needs editing:

- Title: `# Hermes Desktop ☤` → `# Headmaster` (drop the ankh glyph, replace with GCAP mark)
- Download badge: `https://github.com/NousResearch/hermes-agent/releases` → your own
- Docs badge: `https://hermes-agent.nousresearch.com/docs/` → `https://docs.gcaplabs.com/` (or similar)
- Discord badge: `https://discord.gg/NousResearch` → your own (or remove if not public-facing yet)
- License badge: `https://github.com/NousResearch/hermes-agent/blob/main/LICENSE` → your own LICENSE
- Body: every `Hermes Agent`, `Hermes`, `Nous Research` reference — 20+ instances
- Code blocks: `hermes desktop`, `hermes update`, `HERMES_DESKTOP_HERMES_ROOT`, `HERMES_HOME` env vars — keep env-var names (they're functional), but rename `hermes` CLI command to `headmaster`
- macOS-specific: `tccutil reset Microphone com.nousresearch.hermes` → `com.gcaplabs.headmaster`
- Community section: Discord, Docs, Issues links — all yours
- License + footer: `MIT — see [LICENSE](../../LICENSE). Built by [Nous Research](https://nousresearch.com).` → `MIT — see [LICENSE](../../LICENSE). Built by [GCAP Labs](https://gcaplabs.com).`

### 2.6 Installer / packaging

Covered in 2.1 (electron-builder config). Additional specific items:

- **DMG title** (line 201): `Install Hermes` → `Install Headmaster`
- **NSIS installer name, shortcut name, uninstall display name** (lines 244-245)
- **MSI product name** (derived from productName)
- **AppImage filename** (derived from artifactName pattern)
- **Code-signing identity** (`scripts/set-exe-identity.cjs` — flagged for review)
- **Notarization config** (`scripts/notarize.cjs` — flagged for review)
- **macOS entitlements files** (`electron/entitlements.mac.plist`, `electron/entitlements.mac.inherit.plist` — check for any branding strings)

### 2.7 Slash commands / CLI integration

| Severity | File                                                    | Notes                                                                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SHOULD   | `apps/desktop/src/lib/desktop-slash-commands.ts`        | Slash command registry — verify no `/hermes` or `/hermes-*` commands are registered. If yes, rename to `/headmaster`                                                                                                                                               |
| SHOULD   | `apps/desktop/src/lib/desktop-slash-commands.ts` (test) | `src/lib/desktop-slash-commands.test.*` — update if exists                                                                                                                                                                                                         |
| MUST     | README / docs                                           | `hermes desktop` CLI command references — these fire from the upstream CLI. If you're forking the CLI too, the command name changes. If NOT forking the CLI, the desktop app's docs should just say "run from terminal: `python -m headmaster_desktop`" or similar |

### 2.8 Custom URL protocol

`hermes://` is registered as a custom URL protocol (package.json line 140-143). If a user clicks `hermes://...` anywhere on the web, the OS launches the Headmaster app. This is grep-able in:

- Electron-builder config
- macOS Info.plist (`CFBundleURLTypes`)
- Windows registry

Rename to `headmaster://` (or a GCAP-specific scheme).

### 2.9 Internal codenames (judgment call)

The white-label-scrub skill flags internal codenames as a category to scrub. The desktop app itself doesn't appear to expose upstream codenames (no `Paperclip`, `Memento`, `Honcho`, `Camofox` references in `apps/desktop/` source). However, the broader `hermes-agent/` repo (parent) DOES use these — if any of them leak into the desktop app's runtime data (logs, error messages, settings keys), flag them in a follow-up audit.

Settings/onboarding localStorage keys worth checking (already flagged):

- `apps/desktop/src/components/desktop-onboarding-overlay.tsx:411` — `'hermes-onboarding-show-all-v1'`

Suggest grep for any other `hermes-*` or `nous-*` localStorage keys in `apps/desktop/src/store/`.

### 2.10 Niche platform names

The desktop app itself doesn't appear to ship with WeChat/WeCom/QQBot/DingTalk/BlueBubbles/Termux references. The parent `hermes-agent/` repo has gateway support for many of these, but the desktop app is a separate surface. **Likely clean — verify with a full grep before sign-off.**

### 2.11 Featured provider — "Nous Portal"

This is a special-case branding item. The onboarding flow features a "Nous Portal" OAuth provider (id: `nous`) as the FIRST option shown to new users. If you rebrand without addressing this:

- New users see a button labeled "Nous Portal" prominently
- It links to Nous Research's auth flow
- Your rebrand is functionally broken

**Options:**

1. **Drop the `nous` provider entry entirely** — remove from `PROVIDER_DISPLAY` and `FEATURED_ID`. Replace with `openrouter` or another provider as the featured one.
2. **Build your own portal auth** — add a `gcap` provider with `GCAP Portal` branding.
3. **Keep the auth backend but rebrand the UI label** — `id: 'nous'` stays, `title: 'GCAP Portal'`. (But users grepping the app will still see the `nous` slug in the network calls and the bundled API URLs.)

**Recommendation:** Option 1 or 2. Option 3 is half-measure.

---

## 3. Asset replacement checklist

| Current file                                   | Replace with                                           | Notes                                                                         |
| ---------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `assets/icon.icns`                             | `assets/icon.icns`                                     | Same dimensions, Headmaster glyph                                             |
| `assets/icon.ico`                              | `assets/icon.ico`                                      | Same multi-size, Headmaster glyph                                             |
| `assets/icon.png`                              | `assets/icon.png`                                      | Source PNG, 1024×1024                                                         |
| `public/apple-touch-icon.png`                  | `public/apple-touch-icon.png`                          | 1024×1024 — this is the favicon                                               |
| `public/hermes.png`                            | `public/headmaster.png`                                | 1254×1254 splash/login hero                                                   |
| `public/hermes-sprite.png`                     | `public/headmaster-sprite.png`                         | 1536×1024 sprite sheet                                                        |
| `public/hermes-frames/hermes-frame-{0..6}.png` | `public/headmaster-frames/headmaster-frame-{0..6}.png` | 7 individual frames, 78-135 KB each                                           |
| `public/nous-girl.jpg`                         | (delete or replace with GCAP imagery)                  | 20 KB — used somewhere; check `desktop-onboarding-overlay.tsx` for references |
| `public/ds-assets/`                            | (audit + replace any branded assets)                   | Unaudited — needs directory listing                                           |

**Total asset replacement:** ~9 binary files + 1 directory.

**All asset replacements also need filename updates** — any TypeScript/CSS that imports `hermes.png` or `hermes-sprite.png` needs its import path updated too.

---

## 4. External dependency footprint — `@nous-research/ui`

**This is the biggest white-label risk in the codebase.**

### What it is

- A separate npm package, version `^0.13.0`, listed in `package.json` line 59
- Source not in the hermes-agent monorepo (resolved from `node_modules` on install)
- The desktop app's visual identity depends on it heavily

### What branding it ships

Based on `src/styles.css` line 17:

```css
src: url('../../../node_modules/@nous-research/ui/dist/fonts/Collapse-Bold.woff2') format('woff2');
```

- **Custom font "Collapse-Bold"** — loaded from the package's `dist/fonts/` directory. Replacing this is non-trivial; it's a licensed/commissioned font.
- **CSS custom properties** (per the `shadow-nous` / `stroke-nous` / `arc-nous` references):
  - `--shadow-nous` (visual elevation token)
  - `--stroke-nous` (hairline border token)
  - `.arc-border.arc-nous` (a CSS class)
- **BrandMark component** — the white-on-color logo tile shown in the About page header. Re-rendering it requires either a new export from this package, or replacing the import.

### Decision tree

| Option                                                           | Effort                                                | Risk                                                                                                   | Recommendation                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **A. Fork `@nous-research/ui`** to `@gcaplabs/ui`                | High (fork + maintain + version-bump)                 | Low (you control it)                                                                                   | **Best long-term** if you plan ongoing UI work  |
| **B. Inline its components** into `apps/desktop/src/components/` | Medium (pull source, remove indirection)              | Medium (you lose package updates)                                                                      | Good if the package is stable                   |
| **C. Replace it with a minimal local design system**             | High (rebuild BrandMark, design tokens, font loading) | High (visual fidelity to upstream)                                                                     | Good if you want a fundamentally different look |
| **D. Keep the package, only rebrand CSS tokens**                 | Low                                                   | High — font URL still says `@nous-research/ui`, grep-able in CSS and the actual font binary's metadata | **NOT recommended** — half-measure              |

**My recommendation:** Option B (inline). Pull the few components you actually use (BrandMark, Button primitives, anything else) into `apps/desktop/src/components/ui/` or a new `apps/desktop/src/design-system/`, then drop the dep. The font either becomes a local asset (with proper licensing) or is replaced with a Google Font equivalent.

### Impact map

Every file that uses `--stroke-nous` or `--shadow-nous` needs to be updated if you rename the tokens. Quick estimate from the count grep: ~30+ files. The rename is mechanical (find-and-replace) but cross-cutting.

---

## 5. Recommended execution order

A staged plan that minimizes risk per step.

1. **Stage 1 — Metadata & installer (low risk, high visibility):**
   - `package.json` full update (name, productName, author, appId, protocols, artifactName, all electron-builder fields, version reset)
   - `electron/main.cjs` — `APP_NAME`, copyright, MEDIA_PROTOCOL scheme, version function rename
   - `electron/update-remote.cjs` — OFFICIAL*REPO*\* (point to your repo, or remove if you control the update channel via a different mechanism)
   - `index.html` — title
   - `electron/entitlements.mac.plist` + `inherit.plist` (verify and update)

2. **Stage 2 — Assets (independent, batch in parallel):**
   - Regenerate all 9 binary assets
   - Rename files (drop `hermes-` / `nous-` prefixes)
   - Update all import paths in source

3. **Stage 3 — Source strings (i18n, UI text):**
   - Update `src/i18n/en.ts` (1,820 lines — likely 40+ `Hermes` instances)
   - Update `src/i18n/zh.ts`, `zh-hant.ts`, `ja.ts` (parallel files)
   - Update `src/components/desktop-onboarding-overlay.tsx` (PROVIDER_DISPLAY, FEATURED_ID, localStorage key, GitHub URL in API_KEY_OPTIONS)
   - Update `src/app/settings/about-settings.tsx` (RELEASE_NOTES_URL)
   - Update `src/components/brand-mark.tsx` (the import path & glyph)
   - Update log tag prefixes across `electron/*.cjs` (`[hermes]` → `[headmaster]`)
   - Update CSS tokens (`--stroke-nous` → `--stroke-headmaster`, etc.) — this is cross-cutting

4. **Stage 4 — Provider list / onboarding flow:**
   - Decide: drop `nous` provider entirely OR replace with a GCAP-branded one
   - Update `PROVIDER_DISPLAY` and `FEATURED_ID` in `desktop-onboarding-overlay.tsx`
   - Update onboarding copy in i18n files

5. **Stage 5 — Design system / external dep:**
   - **Pick your path for `@nous-research/ui` (Section 4 decision tree)**
   - Execute: fork / inline / replace
   - Update `package.json` deps accordingly
   - Update `src/styles.css` line 17 font URL

6. **Stage 6 — Docs (public surface):**
   - Rewrite `apps/desktop/README.md` end-to-end
   - Update `apps/desktop/DESIGN.md` (internal dev doc — can keep some internal jargon, but rename `--stroke-nous` references)
   - If you have a public repo for the white-label: write a new top-level README that does NOT mention Hermes or Nous Research (see white-label-scrub pitfall #14)

7. **Stage 7 — Slash commands, internal identifiers:**
   - Rename `hermes.ts` → `headmaster.ts` (and the `types/hermes.ts`)
   - Update `desktop-slash-commands.ts` registry
   - Rename test files (17 `.test.cjs` files in `electron/`)
   - Update `src/hermes.test.ts` and any other `.test.ts`/`.test.tsx` files

8. **Stage 8 — Verification:**
   - Run the search patterns from Section 6
   - Build a throwaway install of all 3 platforms (mac, win, linux)
   - Inspect the built installers for any leftover branding (open the .app bundle's Info.plist, the .msi's ProductName, the AppImage's .desktop file)
   - Click around the installed app and verify zero grep targets surface

---

## 6. Verification commands

Run these AFTER scrubbing. Target: **zero matches** in the public-facing paths. Build artifacts in `dist/` and `release/` are excluded.

```bash
# 1. Product name — case-insensitive
rg -i "hermes|hermes[- ]agent" apps/desktop/src apps/desktop/index.html apps/desktop/electron --type-add 'web:*.{ts,tsx,html,css}' -t web -t ts -t js

# 2. Company name
rg -i "nous[- ]research|nousresearch|@nous-research" apps/desktop/src apps/desktop/electron apps/desktop/index.html apps/desktop/README.md

# 3. Repo URL
rg "github\.com/(NousResearch|nousresearch|hermes-agent)" apps/desktop/src apps/desktop/electron apps/desktop/README.md

# 4. Bundle ID
rg "com\.nousresearch\.hermes" apps/desktop/src apps/desktop/electron apps/desktop/package.json

# 5. Custom protocol
rg "\bhermes://|hermes-media\b|'hermes'" apps/desktop/src apps/desktop/electron

# 6. CSS design tokens
rg "stroke-nous|shadow-nous|arc-nous" apps/desktop/src

# 7. Font URL pointing at upstream package
rg "@nous-research/ui/dist" apps/desktop/src

# 8. Version number (verify only the About-page display remains)
rg "0\.15\.[0-9]+" apps/desktop/src apps/desktop/README.md

# 9. i18n: explicit Hermes in any language
rg "Hermes" apps/desktop/src/i18n/

# 10. Featured provider id
rg "FEATURED_ID|nous.portal|nous-portal" apps/desktop/src

# 11. Public assets directory listing (verify no orphan Hermes files)
ls apps/desktop/public/ apps/desktop/public/hermes-frames/ apps/desktop/assets/
```

**Pass criteria:** Items 1-7, 9, 10 = zero matches. Item 8 = zero matches in README, one match expected in About page (version display, acceptable). Item 11 = no files matching `hermes*` or `nous*`.

---

## 7. Pitfalls specific to this codebase

These are non-obvious gotchas the audit surfaced:

1. **`@nous-research/ui` font URL is in `styles.css` line 17, not in the package.json or a config file.** A blind search for branding in source files will miss it. The actual font file is in `node_modules/@nous-research/ui/dist/fonts/Collapse-Bold.woff2` and is loaded at runtime by the browser.

2. **`hermes.ts` has 70 matches but they're all type names, not user-facing strings.** Blind find-and-replace would break type imports across 20+ files. Rename the file, update all imports, and let the TypeScript compiler find the stragglers.

3. **`app.setName(APP_NAME)` is the official Electron way to set the OS-level app name** (used in macOS menu bar, Windows taskbar, app switcher). It overrides the `name` from `package.json` at runtime, so even if you set `"name": "hermes"` in package.json, `APP_NAME = 'Headmaster'` will win for OS display strings. But the **installer filename**, the **Windows registry entry**, and the **appId** all come from package.json — you need to update both.

4. **The 7 `hermes-frame-*.png` files are referenced by the boot animation.** They're loaded as a sprite sheet and probably cycled by index. If you rename them without updating the JS that loads them, the boot animation will show a blank/missing glyph during loading. Verify the loading mechanism before renaming.

5. **The `hermes-media://` protocol is a custom URL scheme for streaming local media** (videos, audio) into the renderer. It's not just branding — it's a functional protocol. If you rename it, you also need to update:
   - `main.cjs` line 497 (MEDIA_PROTOCOL constant)
   - The `protocol.handle()` call (need to grep for it)
   - Any `<video>` / `<audio>` tags that reference the scheme

6. **`@nous-research/ui` BrandMark is referenced as `@/components/brand-mark` in AboutSettings, NOT as `@nous-research/ui`'s BrandMark directly** — there's likely a re-export in `apps/desktop/src/components/brand-mark.tsx`. That means renaming the import path is one search-and-replace, but you also need to replace the implementation.

7. **`desktop-onboarding-overlay.tsx` has the `nous` provider hardcoded as `FEATURED_ID`** with extensive comments saying "Collapse the secondary providers behind a disclosure only when Nous Portal is present to anchor the choice." If you drop the `nous` provider, the disclosure logic may need to be revised — the comment is a hint that the UI structure depends on a featured provider existing.

8. **`update-remote.cjs` is a security file** (it decides which GitHub remote to fetch updates from). Replacing the URL blindly could open you up to update-channel hijacking if you don't also update the signing/verification. **Coordinate with whoever owns your update infra before scrubbing this file.**

9. **The `defaultBranch: 'main'` constant in `update-remote.cjs` and `main.cjs` (line 294)** is functional, not branding — but if you're forking the upstream repo, you might want to use a different branch name (e.g., `release` or `stable`).

10. **`HERMES_DESKTOP_HERMES_ROOT`, `HERMES_HOME`, `HERMES_DESKTOP_*` env vars** — these are functional and don't need renaming. The "HERMES" prefix is the upstream's brand but it's also the actual name of the home directory and tool the desktop app is managing. Renaming these would break the integration with the underlying Hermes CLI/runtime. **Keep them as-is.** If you fork the runtime, rename then.

11. **`src/i18n/en.ts` is 1,820 lines.** A blind find-and-replace is fast but error-prone. Recommendation: do a careful pass with a `Hermes` → `Headmaster` regex, then a manual review for cases where the word appears in code comments, log messages, or variable names that shouldn't be touched (e.g., `hermesRuntime`, `hermesConnection`).

12. **`@hermes/shared` is a workspace dep (`file:../shared`)** — it's the desktop app's local sibling package for shared types. Branding in this package will leak into the desktop app. Audit `apps/shared/` separately.

13. **The `bootstrap-runner.cjs` test files reference `com.nousresearch.hermes`** in the macOS tccutil command. Update the README's troubleshooting section in lockstep, otherwise the docs will instruct users to reset the wrong bundle ID.

---

## Appendix: Audit methodology

- **Searches run:**
  - `rg -i "Hermes"` in `apps/desktop/` → 98 files
  - `rg "Nous Research|hermes-agent|@nous-research"` in `apps/desktop/` → 17 files
  - `rg "nous|hermes|@nous-research"` in `apps/desktop/src/` → 240 matches across ~50 files
  - File-type-specific reads of high-priority files (package.json, main.cjs, about-settings, onboarding, README, index.html, i18n/en.ts, update-remote.cjs, DESIGN.md, styles.css)
  - Asset directory listings (assets/, public/, public/hermes-frames/)
  - `file` command on all binary assets to confirm dimensions

- **Files NOT read in detail** (delegated to execution phase):
  - `apps/desktop/src/i18n/{zh,zh-hant,ja}.ts` — assumed parallel to `en.ts`
  - `apps/desktop/electron/*.cjs` (15 files) — only `main.cjs` and `update-remote.cjs` read
  - `apps/desktop/scripts/*.cjs` and `*.mjs` — only flagged, not read
  - `apps/desktop/src/store/*.ts` (10+ files) — only flagged
  - `apps/desktop/src/lib/*.ts` (20+ files) — only flagged
  - `apps/desktop/src/app/**/*.tsx` (40+ files) — only flagged
  - `apps/desktop/components.json` — flagged, not read
  - `apps/desktop/vite.config.ts` — flagged, not read
  - `apps/desktop/electron/entitlements.mac.plist` and inherit version — flagged, not read
  - `apps/desktop/electron/notarize.cjs`, `set-exe-identity.cjs` — flagged, not read

- **Out of scope (separate audit needed):**
  - `apps/shared/` (the `@hermes/shared` workspace dep)
  - `apps/bootstrap-installer/` (Tauri-based installer)
  - Parent repo's `cli.py`, `gateway/`, etc. (CLI/TUI surfaces, separate from desktop)

---

_End of Part 1 audit. Ready for execution. Recommend running Stage 1+2 first as a quick win (visible installer rename) before committing to the @nous-research/ui dep decision (Stage 5)._

---

# Part 2: Fusion forks (fathah/hermes-desktop + outsourc-e/hermes-workspace)

The GCAP Headmaster screenshots are a **fusion** of three separate codebases. This section extends the audit to cover the other two forks and flags a new problem class: **merge conflicts, attribution, and feature provenance** — not just branding.

## A. Revised scope

| Repo                            | Path                        | Branding matches            | Role in fusion                                                                                                                                                                                                         |
| ------------------------------- | --------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NousResearch/hermes-agent**   | `desktop/hermes-agent/`     | 240+ in `apps/desktop/src/` | The official Electron desktop — chat, sessions, files, voice, settings. Provides the core shell.                                                                                                                       |
| **fathah/hermes-desktop**       | `desktop/hermes-desktop/`   | 491 matches                 | Smaller Electron app; cleaner first-run installer flow. Provides the 12-screen UI grid (Chat, Profiles, Models, Providers, Tools, Skills, Schedules, Gateway, Persona, Kanban, Office, Settings).                      |
| **outsourc-e/hermes-workspace** | `desktop/hermes-workspace/` | 511 matches                 | The biggest of the three. Adds Swarm Mode (multi-agent orchestrator), Agent View, 3D Office/persona scene, Kanban task board, Memory viewer, Themes, PWA + Tailscale. Provides the heavy multi-agent and visual flair. |

**New problem:** You can't just rebrand one repo. You're building a hybrid that doesn't exist in any single fork. So the white-label plan needs three layers:

1. **Rebrand each fork** individually (Part 1 covered the first; this section covers the other two).
2. **Decide what to merge** — features overlap (Kanban exists in fathah AND workspace; Settings exists in all three; Persona/Office only in workspace).
3. **Single-source-of-truth enforcement** post-merge — once you've picked the canonical version of each feature, the other two implementations need to be deleted (otherwise you have two branding surfaces to scrub).

## B. fathah/hermes-desktop — repo-specific findings

### B.1 Metadata (electron-builder.yml)

This is the most surprising finding: **fathah's fork uses the SAME `appId: com.nousresearch.hermes` as the official Nous desktop**, even though the product name is different (`Hermes One`). This is a copy-paste from the upstream config. It needs a new bundle ID.

| Severity | Line           | Current                                                                                                                  | Recommended                                         |
| -------- | -------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| MUST     | 1              | `appId: com.nousresearch.hermes`                                                                                         | `com.gcaplabs.headmaster` (or your own reverse-DNS) |
| MUST     | 2              | `productName: Hermes One`                                                                                                | `Headmaster`                                        |
| MUST     | 30             | `win.executableName: hermes-agent`                                                                                       | `headmaster`                                        |
| MUST     | 67             | `linux.vendor: Nous Research`                                                                                            | `GCAP Labs`                                         |
| MUST     | 70-73          | `linux.description: "Hermes One is a native desktop app for installing, configuring, and chatting with Hermes Agent..."` | Headmaster-branded equivalent                       |
| MUST     | (package.json) | `description: "Hermes Agent Desktop — self-improving AI assistant"`                                                      | Headmaster description                              |
| MUST     | (package.json) | `author: "fathah"`                                                                                                       | `GCAP Labs`                                         |
| MUST     | (package.json) | `homepage: https://github.com/fathah/hermes-desktop`                                                                     | Your own repo URL                                   |

### B.2 Pre-existing "nous" references in scripts

fathah has integration scripts named after the Nous OAuth/provider flow:

- `scripts/drive-nous-oauth.js` (2 matches)
- `scripts/drive-nous-chat.js` (5 matches)
- `scripts/probe-nous-models.js` (1 match)
- `scripts/repro-nous-cards-schema-367.js` (2 matches)
- `scripts/repro-nous-detection-367.js` (11 matches)
- `scripts/verify-nous-discovery.js` (1 match)

**Decision required:** Is GCAP keeping a "Nous Portal" integration? If no, all `nous` references in these scripts are dead code — delete the scripts. If yes, rename the files and the internal IDs but keep the integration.

### B.3 Telemetry leak (postHog)

`package.json` line 39: `"posthog-js": "^1.376.0"` — this is **third-party analytics**. The fathah fork is instrumenting usage with PostHog. **MUST-FIX or strip:** enterprise security reviewers will flag this immediately. Either:

- Drop the dep entirely (recommended for GCAP's white-label play)
- Replace with a self-hosted PostHog under your own domain
- Disable the call sites (postHog usually has a runtime opt-in toggle)

Flag this for the user before continuing — the white-label-scrub skill pitfall #10 specifically warns about self-claimed/unverified third-party integrations.

### B.4 README + 4 translated READMEs

`README.md` (288 lines, 43 Hermes matches) + `README.es-LATAM.md`, `README.ja-JP.md`, `README.zh-CN.md` (40 matches each). All four language versions need parallel rewrites. The fathah README has badges linking to:

- `https://hermesagents.cc/` (download portal — third-party)
- `https://t.me/hermes_agent_desktop` (Telegram)
- `https://github.com/fathah/hermes-desktop` (repo)
- `https://bankr.bot/launches/0xfda75f77a22b4f4b783bbbb21915ef64d149bba3` — **this is a $HD TOKEN LAUNCH LINK.** A crypto token badge. **Strip or replace with a real funding/contact link.** Otherwise the audit will look like you're shilling a meme coin.

### B.5 Previews/screenshots in the public surface

`previews/` directory contains `.webp` and `.png` marketing screenshots that ship with the repo README. If you publish this fork's README to your site or to a customer, these screenshots are customer-facing surfaces and need rebrand:

- `previews/header.webp` (hero)
- `previews/download.webp` (CTA)
- `previews/chat.png`, `previews/profiles.png`, `previews/models.png`, `previews/providers.png`, `previews/tools.png`, `previews/skills.png`, `previews/schedules.png`, `previews/gateway.png`, `previews/persona.png`, `previews/kanban.png`, `previews/office.png`, `previews/settings.png`

All 14 previews are referenced by filename in README.md. If you replace them, also update the README's HTML img tags.

### B.6 Sponsors and footer

`README.md` lines 35-40 reference Atlas Cloud as a sponsor:

> Atlas Cloud is a full-modal, OpenAI-compatible AI inference platform... Use it in Hermes Desktop by selecting Atlas Cloud as your provider — the base URL is pre-configured automatically.

If you're not partnering with Atlas Cloud, **strip the sponsor block entirely** — it's an embedded third-party endorsement of an unrelated product. Audit pitfall #11 (don't list integrations that don't exist or are sunsetting) applies in reverse: don't keep sponsorships you don't have.

## C. outsourc-e/hermes-workspace — repo-specific findings

### C.1 Metadata (electron-builder.config.cjs)

This fork is **already partially scrubbed** — it uses its own appId `com.hermesworkspace.app` (not Nous's), its own copyright, its own publish target. Good baseline. What remains:

| Severity | Line           | Current                                                                                                     | Recommended                                             |
| -------- | -------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| MUST     | 2              | `appId: 'com.hermesworkspace.app'`                                                                          | `com.gcaplabs.headmaster`                               |
| MUST     | 3              | `productName: 'hermes-workspace'`                                                                           | `Headmaster`                                            |
| MUST     | 4              | `copyright: 'Copyright © 2026 hermes-workspace'`                                                            | `Copyright © 2026 GCAP Labs`                            |
| MUST     | 38             | `dmg.title: 'Hermes Workspace'`                                                                             | `Headmaster`                                            |
| MUST     | 41             | `win.executableName: 'hermes-workspace'`                                                                    | `headmaster`                                            |
| MUST     | 47             | `executableName` in artifactName `hermes-workspace-setup-${version}.${ext}`                                 | `headmaster-setup-${version}.${ext}`                    |
| MUST     | 55-58          | `publish.provider: 'github'`, `owner: 'outsourc-e'`, `repo: 'hermes-workspace'`                             | `owner: 'gcaplabs'` (or your org), `repo: 'headmaster'` |
| MUST     | (package.json) | `name: 'hermes-workspace'`                                                                                  | `headmaster`                                            |
| MUST     | (package.json) | `version: '2.3.0'`                                                                                          | Reset to your own versioning scheme (0.1.0 or similar)  |
| MUST     | (package.json) | `author: 'Eric (https://github.com/outsourc-e)'`                                                            | `GCAP Labs`                                             |
| MUST     | (package.json) | `description: "Desktop workspace for Hermes Agent — chat, orchestration, and multi-agent coding pipelines"` | Headmaster description                                  |

### C.2 macOS plist template (launchd service)

`macos/com.hermes.workspace.plist.template` line 5: `Label: com.hermes.workspace` — needs to match the new appId. Plus the dual-named env vars on lines 24-31:

```xml
<key>HERMES_API_URL</key><string>{{HERMES_API_URL}}</string>
<key>CLAUDE_API_URL</key><string>{{HERMES_API_URL}}</string>
<key>HERMES_API_TOKEN</key><string>{{HERMES_API_TOKEN}}</string>
<key>CLAUDE_API_TOKEN</key><string>{{HERMES_API_TOKEN}}</string>
```

The duplication (`HERMES_*` and `CLAUDE_*` pointing to the same value) is a backward-compat shim. **For GCAP:** drop the `CLAUDE_*` variants (or rename both to `HEADMASTER_*`). The StandardOutPath/StandardErrorPath log files at lines 43-45 also reference `hermes-workspace.out.log` / `.err.log` — rename.

### C.3 CLAUDE BRANDING LEAK (high-priority)

This is the most surprising finding in the entire audit. The `public/` directory contains Claude-branded images:

| File                             | Size   | Notes                                                       |
| -------------------------------- | ------ | ----------------------------------------------------------- |
| `public/claude-avatar.png`       | 84 KB  | Avatar                                                      |
| `public/claude-avatar.webp`      | 16 KB  | Same avatar, webp                                           |
| `public/claude-banner.png`       | 12 KB  | Banner                                                      |
| `public/claude-banner-light.png` | 9 KB   | Light variant                                               |
| `public/claude-caduceus.png`     | 202 KB | The caduceus (medical/Hermes symbol — double branding leak) |
| `public/claude-crest.svg`        | 1 KB   | Crest/sigil                                                 |
| `public/claude-favicon.ico`      | 2 KB   | Favicon                                                     |
| `public/claude-icon.png`         | 2 KB   | Icon                                                        |
| `public/claude-icon-192.png`     | 25 KB  | Icon, 192px                                                 |
| `public/claude-icon-512.png`     | 133 KB | Icon, 512px                                                 |
| `public/claude-logo.png`         | 1.3 MB | Full logo                                                   |
| `public/cover.png`               | 84 KB  | Cover image (also exists as .webp)                          |
| `public/claude-chat.sh`          | 618 B  | Script (probably Claude Code CLI integration helper)        |

**Hypothesis:** This fork was originally Claude-themed (or had a Claude agent persona) and was re-themed to "Hermes Workspace" but the assets were missed. The caduceus leak is double-bad — it's the Greek god Hermes's symbol (the snake-staff) and Anthropic's "Claude" branding also borrows it.

**MUST-FIX:** Delete all `claude-*` files OR replace with Headmaster-branded equivalents. Also `claude-chat.sh` and any reference to it in scripts/agents.

The README comment on line 4: `<!-- avatar filename retained for cache stability — do not rename without coordinated cache-bust -->` — refers to `claude-avatar.webp`. This means the avatar is fetched from a CDN and the filename is a cache-busting anchor. **Renaming requires coordinated cache invalidation.** Either keep the filename but change the binary content, or do a real cache-bust on your CDN.

### C.4 Greek mythology persona avatars (avatars/, avatars-3d/, ascii-portraits/)

The persona/agent system uses Greek god avatars:

- **2D:** `apollo`, `artemis`, `athena`, `chronos`, `eros`, **hermes** (the most important — this is literally a Hermes avatar used for the default agent), `iris`, `nike`, `pan`
- **ASCII:** Same set plus `banker`, `recruiter`, `shopkeeper`, `tavernkeeper`, `trainer`, plus 2 banner variants
- **3D models** in `public/avatars-3d/` (folder, not enumerated — assume GLB/USDZ files for the Office scene)

**This is a thematic choice, not a branding mistake** — Greek mythology is decorative, not upstream-fingerprint-y. But:

- The `hermes` avatar in particular is a direct branding leak. It probably serves as the default agent avatar. **MUST-FIX** — replace with a GCAP-branded persona.
- The other 8 Greek gods (apollo, artemis, etc.) are upstream persona names. **Should-fix** if you want zero grep targets for "hermes" in any file; otherwise, **defer** if the mythology theme is part of the product identity (e.g., if the user is going with a "team of specialists" framing where each agent is a named character).
- 3D models are typically not text-grep-able but are visual. They need visual rebranding to match any new persona set.

**The Office scene** in `src/screens/Office/` (in the fathah fork) + `src/screens/Office/office3d/` shows the avatars in a 3D environment. The full 3D Office is in workspace's `src/components/agent-view/` and 3D avatars in `public/avatars-3d/`. This is a major visual surface — rebrand = either redesign the 3D scene or pick a new persona theme.

### C.5 Swarm Mode worker definitions (swarm.yaml)

`swarm.yaml` (10,663 bytes) defines 10 workers. Each worker has a name, role, mission, model, tools, skills. The worker IDs themselves are mostly generic (`orchestrator`, `builder`, `reviewer`, `qa`, `researcher`, `ops-watch`, `maintainer`, `strategist`, `inbox-triage`, `km-agent`) and don't need rebranding. BUT:

- **`model: GPT-5.5`** in worker specs (orchestrator) — that's a future-dated model name. Either deliberate (testing) or copy-paste from upstream. **Flag for user clarification** — white-label-scrub pitfall #10 (don't claim capabilities you don't have). If the public site advertises "GPT-5.5 powered", you need to actually have access to that model.
- **Skills referenced:** `gstack-for-hermes`, `gbrain`, `kanban-orchestrator`, `subagent-driven-development`, `writing-plans`, etc. These are real skill names in the parent `hermes-agent/skills/` directory — but `gstack-for-hermes` and `gbrain` are NOT in the standard hermes-agent skills. They look like custom/3rd-party skills. **Verify these exist** in the parent repo before relying on them. If they don't, the swarm will fail to spawn workers.
- **`AGENTS.md`** (in the workspace repo) is a "Hermes Workspace Agent Contract" — it documents the swarm worker setup using both `Hermes` and `RAZSOC` branding. `RAZSOC` is an internal codename (looks like an acronym, possibly the workspace maintainer's previous project). **SHOULD-FIX** — remove or replace with a GCAP codename.
- **Worker wrapper scripts** (e.g., `orchestrator:plan`, `km:health`, `builder:task`) in the AGENTS.md table — these reference `~/.local/bin/` wrappers. If you're forking, these wrappers need to exist in the new install.

### C.6 Themes with branded names

`README.md` line 55: "🎨 **Themes** — Hermes, Nous, Bronze, Slate, Mono (light + dark)"

**This is a branding leak in the UI itself.** Users select a theme called "Hermes" or "Nous" from a dropdown. The themes are presumably defined in `src/themes/` (saw a `presets.ts` and `user-themes.ts` in the official fork — workspace likely has equivalents).

**MUST-FIX:** Rename themes:

- "Hermes" → "Headmaster" (or your product's primary theme)
- "Nous" → "Research" or just "Default" or your secondary theme
- "Bronze", "Slate", "Mono" are fine — generic.

If the theme names are hardcoded in CSS class names (e.g., `.theme-hermes` and `.theme-nous`), those need rename too — same approach as the `--stroke-nous` tokens from Part 1.

### C.7 Codename leak: "Eric" (author handle)

`package.json` line 6: `"author": "Eric (https://github.com/outsourc-e)"` — "Eric" is the upstream author's first name. The repo AGENTS.md also has casual references to "Eric" as a person. **Strip the personal name from the new package.json** but the internal docs (AGENTS.md) can keep the name if it's a private/internal doc — per white-label-scrub pitfall #1, don't scrub internal/dev files.

### C.8 Codenames: gbrain, gstack-for-hermes, Conductor, RAZSOC

These appear in `swarm.yaml`, `AGENTS.md`, and other dev docs:

- **`gbrain`** — likely a "global brain" memory tool or context layer. Internal codename.
- **`gstack-for-hermes`** — a "gstack" skill that targets Hermes. Looks like it's a "GTM/sales stack" or "growth stack" by another author. **Source not in this repo** — verify it exists in the parent hermes-agent skills/.
- **`Conductor`** — the workspace's main product surface (mission dispatch). Generic enough as a name but check the README: it's framed as a branded product capability, not just a function name.
- **`RAZSOC`** — in the AGENTS.md "Keep GBrain-first lookup for context-sensitive RAZSOC/Hermes/workflow decisions" — looks like an acronym for the upstream author's previous project or a private codename for Hermes's decision logic.

**Decision required:** Are you keeping the "Swarm Mode" feature? If yes, the codenames need a GCAP rebrand (or kept as internal). If no, drop the entire Swarm Mode and the codenames go with it.

### C.9 README structure

`README.md` is 875 lines / 36 KB with 120 Hermes matches. Sections:

- Title: "Hermes Workspace" + the cached claude-avatar image
- Badges: version 2.3.0, license MIT, Node 22+, PRs welcome
- Description: "Your AI agent's command center — chat, files, memory, skills, and terminal in one place."
- "Swarm Mode" section (lines 25-41) — the multi-agent pitch
- "What's inside" feature list (lines 43-58) — 16 features, most reference Hermes
- Screenshots section (lines 62-79) — references docs/screenshots/\*.png
- Quick Start (lines 82-100) — install paths
- A "v2 — zero-fork" claim: "Clone, don't fork. Runs on vanilla NousResearch/hermes-agent installed via Nous's own installer." — this is **literally admitting upstream lineage in the public README**. **MUST-FIX.** Per white-label-scrub pitfall #14, this is exactly the leak the audit is trying to prevent.

### C.10 macOS helper files

`macos/` directory has the plist template (covered in C.2) but also probably a service install script. **Verify** what's in there and scrub.

### C.11 The "viral sprint" goal doc

`memory/goals/2026-05-05-hermesworld-viral-sprint/handoff.md` (35 matches) — this is an internal project plan with the codename "hermesworld-viral-sprint" and a list of launch tactics. **Internal dev doc** — can keep per pitfall #1, but be aware the codename "hermesworld" might leak into other files. The "memory/" subfolder pattern is interesting — looks like the workspace maintainer uses a markdown-based memory system. If GCAP wants this pattern, fork the structure but not the content.

## D. The fusion problem — what features come from where

A quick feature-provenance map based on the README screenshots and source structure:

| Feature                       | fathah       | workspace                         | official Nous    | Recommendation for fusion                               |
| ----------------------------- | ------------ | --------------------------------- | ---------------- | ------------------------------------------------------- |
| Chat                          | ✓            | ✓                                 | ✓                | Use official Nous (most polished)                       |
| Profiles                      | ✓ (screen)   | ✓ (worker profiles)               | partial          | Use workspace's profile system + fathah's UI            |
| Models                        | ✓ (screen)   | ✓                                 | ✓                | Use fathah (cleaner grid)                               |
| Providers                     | ✓ (screen)   | ✓ (settings)                      | ✓ (onboarding)   | Use fathah's provider screen                            |
| Tools                         | ✓ (screen)   | ✓ (config)                        | ✓                | Use fathah                                              |
| Skills                        | ✓ (screen)   | ✓ (browser)                       | partial          | Use workspace (has marketplace)                         |
| Schedules / Cron              | ✓ (screen)   | ✓ (manager)                       | ✓ (cron/)        | Use workspace's cron-manager component                  |
| Gateway                       | ✓ (screen)   | ✓                                 | ✓ (status panel) | Use fathah                                              |
| Persona                       | ✓ (3D scene) | ✓ (3D scene)                      | ✗                | **DECISION:** pick one. Both are heavy 3D (react-three) |
| Kanban                        | ✓ (screen)   | ✓ (task board)                    | ✗                | **DECISION:** pick one. Both exist                      |
| Office                        | ✗            | ✓ (3D scene)                      | ✗                | Drop fathah's, use workspace's (more polished)          |
| Settings                      | ✓            | ✓                                 | ✓                | Use official Nous (deepest settings surface)            |
| Agent View (live agent panel) | ✗            | ✓ (component)                     | ✗                | Use workspace                                           |
| Memory viewer                 | ✗            | ✓ (component)                     | partial          | Use workspace                                           |
| Terminal (xterm)              | ✗            | ✓                                 | ✓ (xterm)        | Use workspace's terminal component                      |
| Conductor (mission dispatch)  | ✗            | ✓                                 | ✗                | Use workspace                                           |
| Swarm Mode (multi-agent)      | ✗            | ✓ (swarm.yaml)                    | ✗                | Use workspace — but rebrand codenames                   |
| Themes                        | partial      | ✓ (Hermes/Nous/Bronze/Slate/Mono) | partial          | Use workspace's theme system, rename Hermes/Nous themes |
| Dashboard (mission overview)  | ✗            | ✓                                 | ✗                | Use workspace                                           |
| 3D Office scene               | ✗            | ✓ (office3d)                      | ✗                | Use workspace                                           |

**Conflicts to resolve:**

1. **Persona/3D scene** exists in both fathah (`src/renderer/src/screens/Persona/`) and workspace (3D in `public/avatars-3d/`, 2D in `public/avatars/`). Pick one. Recommended: **workspace** (more developed, has the persona-as-character theme).

2. **Kanban** exists in both fathah (`src/renderer/src/screens/Kanban/`) and workspace (Task Board in `src/components/swarm/` or similar). Pick one. Recommended: **workspace** (tighter integration with Conductor/Swarm).

3. **Settings** exists in all three. Pick one. Recommended: **official Nous** (deepest — sessions, profiles, models, MCP, etc.) and port any fathah-specific options.

4. **Provider screen** vs **Provider onboarding** — fathah has a dedicated `Providers` screen; Nous has onboarding-time provider setup. Both can coexist (onboarding for first run, screen for later changes). Or unify under one.

5. **Gateway/Conductor** — these are different abstractions. fathah's Gateway screen is the connection-status surface; workspace's Conductor is the mission-dispatch surface. **Keep both** — they're different features.

## E. Revised execution plan (with the fusion in mind)

The 8-stage plan from Part 1 expands to:

### Stage 0 — Decide the merge (NEW, do this first)

- For each feature in Section D, pick a source.
- Document the decision: "Kanban = workspace" / "Settings = Nous" / etc.
- Mark all non-canonical implementations for deletion.

### Stage 1 — Metadata & installer (low risk, high visibility)

- All 3 repos' package.json + electron-builder config
- `main.cjs` / `electron/main.cjs` identity constants
- macOS plist templates
- Linux maintainer strings

### Stage 2 — Assets (independent, batch in parallel)

- **Official Nous:** 9 binary assets (Part 1 Section 3)
- **fathah:** 14 previews + 3 icons (icon.icns/ico/png in `build/`) + the resources/icon.png
- **workspace:** icon.png, mcp-presets.seed.json + ALL Claude-branded assets (delete or replace) + 9 persona avatars (2D) + 16 ASCII portraits + the 3D avatar set
- **Total asset replacement:** ~70 binary files

### Stage 3 — Source strings (i18n, UI text, log tags)

- All 3 i18n setups (Nous has 4 langs, fathah has i18next, workspace has its own)
- Log tag prefixes (`[hermes]` / `[fathah]` / etc.)
- README + 4 translated READMEs per fork (3 forks × 4 langs = 12 README rewrites)
- docs/, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md

### Stage 4 — Provider/feature parity removal

- Drop `nous` featured provider in Nous onboarding (Part 1 finding)
- Decide what to do with the Claude assets in workspace (C.3)
- Strip fathah's PostHog telemetry (B.3) — or replace with self-hosted

### Stage 5 — Design system / external deps

- **NEW:** The workspace has its own dep tree (TanStack Router, react-three stack, framer-motion, etc.). Decide which of these stay.
- **NEW:** fathah's `@electron-toolkit/*` deps are different from Nous's `@nous-research/ui`. Pick one design system approach for the merged product.
- The `@nous-research/ui` fork-or-inline decision from Part 1 Section 4 still applies.

### Stage 6 — Codenames & feature rebranding

- **NEW:** Swarm Mode worker names (orchestrator, builder, etc.) — mostly fine, but the skills they reference (gstack-for-hermes, gbrain) need audit.
- **NEW:** Theme names (Hermes, Nous, Bronze, Slate, Mono) — rename Hermes/Nous to GCAP equivalents.
- **NEW:** "Conductor" feature name — keep, drop, or rename?
- **NEW:** Greek mythology persona avatars — keep theme, replace "hermes" persona specifically, decide on the other 8.

### Stage 7 — Internal identifiers (renames)

- All `hermes.ts` → `headmaster.ts` (3 forks, 3 rename passes)
- Test files (17 in Nous, ~30 in fathah, ~40 in workspace)
- Workspace sub-package rename (`playground-ws-worker` → `playground-headmaster-worker`)

### Stage 8 — Verification (extended for 3 repos)

Updated verification commands. Run from `C:\Users\Matve\Desktop\Gcaplabs.com\desktop\` (the parent of all three repos).

```bash
# 1. Product name — case-insensitive, all 3 repos
rg -i "hermes" hermes-agent/apps/desktop hermes-desktop hermes-workspace --type-add 'web:*.{ts,tsx,html,css,md,yml,yaml,cjs,mjs,js}' -t web

# 2. Company name + Claude branding
rg -i "nous[- ]research|nousresearch|@nous-research" hermes-agent/apps/desktop hermes-desktop hermes-workspace
rg -i "claude" hermes-workspace/public/ hermes-workspace/README.md

# 3. Repo URLs
rg "github\.com/(NousResearch|nousresearch|fathah|outsourc-e|hermes-agent|hermes-workspace)" hermes-agent/apps/desktop hermes-desktop hermes-workspace

# 4. Bundle IDs (3 different ones to scrub)
rg "com\.(nousresearch|hermesworkspace)\.(hermes|app|workspace)" hermes-agent/apps/desktop hermes-desktop hermes-workspace
rg "com\.hermes\.workspace" hermes-workspace/macos/

# 5. Custom protocols
rg "\bhermes://|hermes-media\b|headmaster://" hermes-agent/apps/desktop hermes-desktop hermes-workspace

# 6. CSS design tokens (Nous + workspace have these)
rg "stroke-nous|shadow-nous|arc-nous" hermes-agent/apps/desktop/src
rg "theme-hermes|theme-nous" hermes-workspace/src

# 7. Theme names
rg "'Hermes'|'Nous'|\"Hermes\"|\"Nous\"" hermes-workspace/src --type ts --type tsx

# 8. Claude assets
ls hermes-workspace/public/claude*

# 9. Codenames (RAZSOC, gbrain, gstack, Eric as author)
rg -i "razsoc|gbrain|gstack|outsourc-e|\bEric\b" hermes-workspace

# 10. PostHog telemetry
rg "posthog" hermes-desktop/

# 11. Crypto token references
rg "bankr\.bot|\\$HD|token" hermes-desktop/README.md

# 12. Zero-fork admission
rg "zero-fork|vanilla NousResearch|fork.*Nous" hermes-workspace/README.md
```

**Pass criteria:** Items 1-7, 9, 12 = zero matches in `src/`, `public/`, `README.md`. Item 8 = zero files. Item 10 = removed or replaced. Item 11 = stripped.

## F. New pitfalls specific to the fusion

1. **Same `appId` across forks causes installer collision.** fathah's `com.nousresearch.hermes` and Nous's `com.nousresearch.hermes` are the SAME bundle ID. If a user has both installed (unlikely but possible during dev/testing), the second install overwrites the first. After rebrand, all three need DISTINCT bundle IDs.

2. **Workspace's `com.hermesworkspace.app` is different from fathah/Nous.** This is correct (no collision), but it means the macOS plist Label `com.hermes.workspace` (which is DIFFERENT from the appId `com.hermesworkspace.app`!) is yet a third identifier. **Inconsistency in the upstream — fix during rebrand.**

3. **Greek mythology personas are decorative, not branding.** You can keep them. But the `hermes.png` persona is a direct upstream-fingerprint. If you keep the mythology theme, swap hermes for another character (e.g., add a "prometheus" or "athena-2" as the new default). If you drop the theme entirely, the 3D Office scene needs a full visual rebuild — that's a much bigger project.

4. **Workspace's "Conductor" feature is a big lift to rebrand.** It's referenced in ~20+ files, has a dedicated docs file (`docs/conductor-bug-log.md`), and is the main product narrative ("Multi-agent mission dispatch"). Either keep the name, or do a global rename + docs update.

5. **The 12-feature screen grid from fathah is not in workspace.** If your site screenshots show this grid, you're committing to building it (or porting it from fathah). Workspace's UI is more card-based/swarm-focused. **Match the screenshots to the source.**

6. **fathah's PostHog telemetry is a compliance red flag.** Most enterprise security questionnaires will reject the build for shipping a third-party analytics SDK. **Strip or replace before the prospect sees it.**

7. **The fathah fork's `$HD token` badge is a meme-coin shill.** A technical prospect will find this in 5 seconds and lose trust. **Strip immediately.**

8. **The workspace fork's "v2 — zero-fork" claim is a literal lineage admission.** "Runs on vanilla NousResearch/hermes-agent" — anyone reading the README knows you didn't build from scratch. **This is exactly the leak white-label-scrub pitfall #14 warns about. Rewrite to "Built on the Hermes Agent framework" or similar neutral framing, OR move the origin notes to `docs/archive/`.**

9. **The Claude-branded assets in workspace are a double-leak.** They identify (a) Anthropic's Claude branding AND (b) a prior Claude-themed fork. Strip them — they're also redundant (the README has its own `cover.png` and `cover.webp`).

10. **Three repos × four languages × multiple readme variants = 12+ README rewrites.** This is the largest single body of branding work. Recommend: do the English version first, then translate via DeepL/Claude (do NOT port the upstream's translations verbatim — they'll have outdated English-specific brand names).

## G. Recommended next steps

Given the scope just expanded by ~10x, here are the realistic options:

**Option 1 — Hire out the scrub.** The branding scrub for 3 forks is 3-5 days of focused work for a developer. Pros: fast, thorough. Cons: expensive, requires the dev to have context.

**Option 2 — Stage it.** Do the 8 stages in priority order, shipping an installable-but-partial build at each checkpoint. The metadata stage is 1 hour of work. The assets stage is a designer-day. The source strings is a few hours per fork. Etc.

**Option 3 — Focus on a single source.** Pick ONE fork (probably workspace, since it has the most features) and discard the other two. Re-read Part 1's audit for that single source. The downside: you lose features from the discarded forks.

**Option 4 — Hire out the merge + scrub.** The merge itself is the hardest part (resolving the Section D feature conflicts). The scrub is mechanical once the merge is done.

**My recommendation for an in-hunt-mode solo founder:** Option 2, but with a twist — do the merge FIRST (before any scrubbing). If you scrub before merging, you'll be redoing work as the merge shifts things around. Sequence:

1. Pick canonical sources (Section D) → 1 hour
2. Merge → 1-2 days (use Claude Code to do the heavy lifting, as your normal workflow)
3. THEN run the scrub plan → 2-3 days
4. Final verification → half a day

Total: ~1 week of focused work. Faster than doing each repo in isolation and merging later.

---

_End of Part 2. Combined with Part 1, this is the full white-label + merge plan for the GCAP Headmaster desktop product. The folder `C:\Users\Matve\Desktop\Gcaplabs.com\desktop\` now has the source for all 3 forks side by side, ready for execution._
