# AGENTS.md — GCAP-Labs working root

> **Read this first.** You are inside the working root of the **Headmaster** product build (GCAP Labs, white-label of Hermes Agent). Every subdirectory here serves a different role in the build. This file tells you which is which, what to use it for, and what to ignore.

---

## TL;DR — what's in this folder

| Path | What it is | When to use it | When to ignore it |
|---|---|---|---|
| `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/` | **The actual app.** Electron + Vite + React + TypeScript. This is the build target. Pushed to `gcaplabs-headmasterUI` (private) on GitHub. | Always — unless explicitly told otherwise. | Never. |
| `headmaster-hub/` | The "Headmaster Hub" web frontend (separate product). Has its own `.git`. | When the user asks about the Headmaster Hub web app. | For desktop work, ignore entirely. |
| `gcaplabs-site/` | The GCAP Labs marketing site. Next.js 15 App Router. **Live on gcaplabs.com.** Pushed to `mutvayzz-sys/gcaplabs-site` (private) on GitHub. | When the user asks to change gcaplabs.com / Headmaster HQ copy or pages. | For desktop work, ignore entirely. |
| `runtime/hermes-agent/` | The Python runtime (NousResearch). The actual agent code that runs in the background. Spawned by the desktop app via `hermes dashboard`. This is the **canonical** checkout. | When the user asks about runtime behavior, dashboard endpoints, or the `hermes_bootstrap.py` install flow. | For UI / frontstuff work — that's `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/`. |
| `runtime-recon/` | Hermes recon workspace. Has `RECON.md` (Task 0) and `reconcile.md` (Task 1) plus a **recon copy** of `hermes-agent` (27 files more than the canonical, with local recon edits). | When you need to verify a Hermes runtime assumption before writing app code, or to read the recon notes. | Don't ship anything from here. |
| `_support/upstream/aionui/` | The original Apache-2.0 source repo (`iOfficeAI/AionUi`). This is **what `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/` is forked from**. | When the user asks "what was the original code" or to compare. | For active build work, use `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/`. |
| `_support/upstream/hermes-desktop/` | Reference clone of `fathah/hermes-desktop`. | When the user wants to crib UI from fathah's fork (12-screen grid layout, installer). | Don't edit — treat as reference. Run `git pull` to track upstream. |
| `_support/upstream/hermes-workspace/` | Reference clone of `outsourc-e/hermes-workspace`. Multi-agent Swarm, terminal, memory, cron, skills marketplace. | When the user wants to crib Workspace features (Kanban, Runs, Skills, Cron). | Don't edit — treat as reference. Run `git pull` to track upstream. |
| `_support/upstream/hermes-agent-desktop/` | **The official Hermes Desktop** from `NousResearch/hermes-agent` at `apps/desktop/`. 518 files, 13MB. Exposed via a directory junction to `runtime-recon/hermes-agent/apps/desktop/` so it stays live with the upstream clone. | When the user wants the **canonical** Hermes Desktop reference (vs the fathah fork). | Don't edit — it's a junction. |
| `_support/upstream/hermes-webui/` | Hermes WebUI reference (Python/FastAPI). Part of the official Hermes Agent repo. | When the user wants to reference the web UI implementation or API structure. | Don't edit — treat as reference. Run `git pull` to track upstream. |
| `_support/staging/assets/` | Asset staging area (Vercel Blob uploads, prompt-and-generate outputs). | When generating or staging new visual assets. | — |
| `_support/staging/skills/` | Skill drafts. | When porting/authoring new skills. | — |
| `_support/staging/marketplace/` | Bencium marketplace code (separate project). | When the user asks about the marketplace. | For Headmaster work, ignore. |
| `_support/archive/` | Historical scratch from prior sessions (AUDIT_REPORT.md, claude-plan.md, claude-notes.md, output.txt, GOOGLE-OAUTH-URL.txt, Vault.lnk). | Reference only — stale. | Treat as historical, not current truth. |
| `AGENTS.md` / `INDEX.md` | This file + the human-facing project map. | — | — |
| `.claude/` | Your AI tool config (Claude settings, etc.). | — | Never commit `settings.local.json`. |

---

## What's actually shipping

**One product**: Headmaster Desktop (Electron). Its source is `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/`. Everything else is upstream / reference / scratch.

**The build target:** run from `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/`. Build commands:

```bash
# Typecheck
bunx tsc --noEmit

# Renderer+main+preload bundle
bunx electron-vite build --config packages/desktop/electron.vite.config.ts

# Package as Windows installer + zip + portable EXE
node scripts/build-with-builder.js auto --win
```

**Version:** `0.1.7` (implementation checkpoint for the Hermes-native desktop adapter; final packaged validation remains pending). Output filenames track this version.

Output lands in `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/out/`:
- `out/win-unpacked/Headmaster.exe` — portable (run this for testing)
- `out/Headmaster-<version>-win-x64.exe` — NSIS installer
- `out/Headmaster-<version>-win-x64.zip` — portable zip

For a quick iteration that only produces the runnable portable exe (skips the slow installer/zip), add `--dir`: `node scripts/build-with-builder.js auto --win --dir`. Close any running `Headmaster.exe` first — it locks `out/win-unpacked/`.

**Launch test:** `out\win-unpacked\Headmaster.exe`. Logs go to `%APPDATA%\Headmaster\logs\YYYY-MM-DD.log`.

**Runtime: Hermes Python** (per the 2026-06-15 runtime pivot). Local mode starts `hermes dashboard`; Remote mode connects to a configured host/port/token. The legacy backend resolver and fallback startup path have been removed.

---

## How to work in this tree

1. **Read** `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/HEADMASTER-VOCABULARY.csv` before naming anything user-facing. **Do not** ship AionUi / aionui / aionrs / Cowork / Hermes in the UI. Use the Headmaster column.
2. **Read** `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/WHITE-LABEL-AUDIT.md` before touching anything in `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/packages/desktop/src/process/`. `HERMES_DESKTOP_*` env vars and the `hermes-media://` protocol are off-limits.
3. **Edit** in `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/` only. Do not edit `runtime/hermes-agent/`, `_support/upstream/`, or `_support/staging/`. Those are reference clones.
4. **Pull fresh upstream** for `_support/upstream/hermes-desktop/` and `_support/upstream/hermes-workspace/` before relying on their content: `cd _support/upstream/hermes-... && git pull --ff-only`.
5. **Don't introduce new port numbers or endpoint paths** without checking `runtime-recon/RECON.md` (real Hermes endpoint map) first.
6. **Knowledge base:** real product + runtime state lives in `G:\Vault\KBs\headmasterui-kb\` (Honcho memory is auto-injected; vault is human-readable).

---

## Things that are easy to get wrong

- **There is no legacy desktop backend fallback.** Don't restore the removed binary resolver, bundled binary preparation, or fallback startup path. Hermes is the only desktop runtime.
- **"Hermes" is allowed in some places, forbidden in others.** Allowed in: env var names (`HERMES_HOME`, `HERMES_DESKTOP_*`), the `hermes-media://` URL scheme, the Python venv directory `~/.hermes/hermes-agent/`, the `hermes` console script name, the `hermes dashboard` spawn command. Forbidden in: any user-visible UI string, app name, About panel, window title, marketing copy. See WHITE-LABEL-AUDIT.md for the full list.
- **The Headmaster icon (the Sorting Hat) doesn't exist yet.** All icon assets are PLACEHOLDER per `HEADMASTER-ASSET-INVENTORY.md`. Don't reference them as if they exist.
- **`gcaplabs-site/` is the website, not the desktop.** Different stack, different product surface. If the user says "change the website", that's `gcaplabs-site/`. If they say "change the app", that's `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/`.
- **`headmaster-hub/` is the Headmaster Hub web app.** Not the same as the marketing site (`gcaplabs-site/`) and not the same as the desktop app.
- **Local dev can't run Docker on this machine** (Hyper-V/WSL2 disabled for WoW kernel-level cheats). Anything that needs Docker (OpenConcho) has to be external or native.
- **`_support/upstream/aionui/` is the Apache-2.0 upstream source.** Don't edit it; if you want to compare, that's what it's for.

---

## Cross-references

- **Knowledge base:** `G:\Vault\KBs\headmasterui-kb\` (the file index lives at `G:\Vault\KBs\headmasterui-kb\_MOC.md`).
- **Honcho memory** is auto-injected — long-term facts about the user, project, and decisions.
- **White-label audit:** `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/WHITE-LABEL-AUDIT.md` (read before any rename work).
- **Vocab mapping:** `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/HEADMASTER-VOCABULARY.csv` (read before any naming work).
- **Hermes runtime recon:** `runtime-recon/RECON.md` (read before any runtime/backend work).
- **The plan:** `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/WHAT-WE-TAKE.md` (high-level; likely out of date, the recon wins).
- **Active backlog:** `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/todo.md` — read this first when resuming desktop work. The v0.1.7 implementation is assembled; final automated validation, installed-runtime smoke testing, debugging, and release closeout remain.
- **Full history:** `DEVLOG.md` (newest first).
- **Last few things we did** (most recent first):
  1. **2026-06-18 — TODO backlog cleared:** Settings restructured (Hermes→Runtime, Advanced Settings tab, dead i18n removed), local CLI agent scanner implemented (`process/agent/agentScanner.ts`), BottomComposer removed, ChatSlider workspace fix, white-label grep audit across all locales, RuntimeSettings rewritten to use real `/api/config` endpoints, gateway status indicator + Headmaster update checker in sidebar footer, Memory page now embeds `memory.gcaplabs.com` via iframe.
  2. Version reset to `0.1.3`; removed the "installation incomplete" startup check entirely; added `AppErrorBoundary`; produced fresh signed build + `GCAP-Labs/Headmaster.lnk` shortcut.
  3. OpenConcho wired as external-link Memory settings tab.
  4. Icon-park plugin fix for `as` aliases in icon imports.
  5. Hermes runtime pivot (no more aioncore dependency for the build).
  6. Repository split: `gcaplabs-headmaster` (old, deleted) → `gcaplabs-headmasterUI` (current, private). Marketing site renamed to `gcaplabs-site`.
  7. Folder restructure: `Desktop/Gcaplabs.com/` → `Desktop/GCAP-Labs/`, with `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/`, `headmaster-hub/`, `gcaplabs-site/`, `runtime/`, `runtime-recon/`, `_support/upstream/`, `_support/staging/`, `_support/archive/`.
