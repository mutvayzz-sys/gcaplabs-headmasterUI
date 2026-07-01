# AGENTS.md — GCAP-Labs working root

> **Read this first.** You are inside the working root of the **Headmaster** product build (GCAP Labs, white-label of Hermes Agent). Every subdirectory here serves a different role in the build. This file tells you which is which, what to use it for, and what to ignore.

---

## TL;DR — what's in this folder

| Path                                              | What it is                                                                                                                                                                                                                     | When to use it                                                                                             | When to ignore it                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `gcaplabs-headmasterUI/`                         | **The actual app.** Electron + Vite + React + TypeScript. This is the build target. Pushed to `gcaplabs-headmasterUI` (private) on GitHub. **v0.2.2** adds cloud container support, capability gating, and cross-device session namespace. | Always — unless explicitly told otherwise.                                                                 | Never.                                                                               |
| `headmaster-hub/`                                 | The "Headmaster Hub" web frontend (separate product). Has its own `.git`.                                                                                                                                                      | When the user asks about the Headmaster Hub web app.                                                       | For desktop work, ignore entirely.                                                   |
| `gcaplabs-site/`                                  | The GCAP Labs marketing site. Next.js 15 App Router. **Live on gcaplabs.com.** Pushed to `mutvayzz-sys/gcaplabs-site` (private) on GitHub.                                                                                     | When the user asks to change gcaplabs.com / Headmaster HQ copy or pages.                                   | For desktop work, ignore entirely.                                                   |
| `runtime/hermes-agent/`                           | The Python runtime (NousResearch). The actual agent code that runs in the background. Spawned by the desktop app via `hermes dashboard`. This is the **canonical** checkout.                                                   | When the user asks about runtime behavior, dashboard endpoints, or the `hermes_bootstrap.py` install flow. | For UI / frontstuff work — that's `gcaplabs-headmasterUI/`. |
| `runtime-recon/`                                  | Hermes recon workspace. Has `RECON.md` (Task 0) and `reconcile.md` (Task 1) plus a **recon copy** of `hermes-agent` (27 files more than the canonical, with local recon edits).                                                | When you need to verify a Hermes runtime assumption before writing app code, or to read the recon notes.   | Don't ship anything from here.                                                       |
| `_support/upstream/aionui/`                       | The original Apache-2.0 source repo (`iOfficeAI/AionUi`). This is **what `gcaplabs-headmasterUI/` is forked from**.                                                                                   | When the user asks "what was the original code" or to compare.                                             | For active build work, use `gcaplabs-headmasterUI/`.        |
| ~~`_support/upstream/hermes-desktop/`~~               | **DELETED** — was a reference clone of `fathah/hermes-desktop`. Removed 2026-07-02; the canonical Hermes Desktop is at `hermes-agent-desktop/` (junction).                                                                                                                                    | —                                                                                                          | —                                                                                    |
| `_support/upstream/hermes-workspace/`             | Reference clone of `outsourc-e/hermes-workspace`. Multi-agent Swarm, terminal, memory, cron, skills marketplace.                                                                                                               | When the user wants to crib Workspace features (Kanban, Runs, Skills, Cron).                               | Don't edit — treat as reference. Run `git pull` to track upstream.                   |
| `_support/upstream/hermes-agent-desktop/`         | **The official Hermes Desktop** from `NousResearch/hermes-agent` at `apps/desktop/`. 518 files, 13MB. Exposed via a directory junction to `runtime-recon/hermes-agent/apps/desktop/` so it stays live with the upstream clone. | When the user wants the **canonical** Hermes Desktop reference (vs the fathah fork).                       | Don't edit — it's a junction.                                                        |
| `_support/upstream/hermes-webui/`                 | Hermes WebUI reference (Python/FastAPI). Part of the official Hermes Agent repo.                                                                                                                                               | When the user wants to reference the web UI implementation or API structure.                               | Don't edit — treat as reference. Run `git pull` to track upstream.                   |
| `_support/staging/assets/`                        | Asset staging area (Vercel Blob uploads, prompt-and-generate outputs).                                                                                                                                                         | When generating or staging new visual assets.                                                              | —                                                                                    |
| `_support/staging/skills/`                        | Skill drafts.                                                                                                                                                                                                                  | When porting/authoring new skills.                                                                         | —                                                                                    |
| `_support/staging/marketplace/`                   | Bencium marketplace code (separate project).                                                                                                                                                                                   | When the user asks about the marketplace.                                                                  | For Headmaster work, ignore.                                                         |
| `_support/archive/`                               | Historical scratch from prior sessions (AUDIT_REPORT.md, claude-plan.md, claude-notes.md, output.txt, GOOGLE-OAUTH-URL.txt, Vault.lnk).                                                                                        | Reference only — stale.                                                                                    | Treat as historical, not current truth.                                              |
| `hermeshq/`                                      | **HermesHQ backend** (FastAPI + PostgreSQL). The cloud control plane that provisions desktop clients. Contains provision endpoints, provider catalog, agent configs, container supervisor. Vendored from `mutvayzz-sys/gcapslab-hermeshq` with `.git` removed. Source of truth for provision-response schema changes. Push backend changes to the original repo at `../gcaplabs-hermeshq`. | When modifying the provision endpoint, provider catalog, agent model config, or any backend API the desktop talks to. | Don't deploy from here — the live backend runs in Docker on the Mac Mini. Edit here for co-editing, push from the original repo. |
| `AGENTS.md` / `INDEX.md`                          | This file + the human-facing project map.                                                                                                                                                                                      | —                                                                                                          | —                                                                                    |
| `.claude/`                                        | Your AI tool config (Claude settings, etc.).                                                                                                                                                                                   | —                                                                                                          | Never commit `settings.local.json`.                                                  |

---

## What's actually shipping

**One product**: Headmaster Desktop (Electron). Its source is `gcaplabs-headmasterUI/`. Everything else is upstream / reference / scratch.

**The build target:** run from `gcaplabs-headmasterUI/`. Build commands:

```bash
# Typecheck
bunx tsc --noEmit

# Renderer+main+preload bundle
bunx electron-vite build --config packages/desktop/electron.vite.config.ts

# Package as Windows installer + zip + portable EXE
node scripts/build-with-builder.js auto --win
```

**Version:** `0.2.1` (release candidate; final packaged validation tracked in `mastertodo.md`). Output filenames track this version.

Output lands in `gcaplabs-headmasterUI/out/`:

- `out/win-unpacked/Headmaster.exe` — portable (run this for testing)
- `out/Headmaster-<version>-win-x64.exe` — NSIS installer
- `out/Headmaster-<version>-win-x64.zip` — portable zip

For a quick iteration that only produces the runnable portable exe (skips the slow installer/zip), add `--dir`: `node scripts/build-with-builder.js auto --win --dir`. Close any running `Headmaster.exe` first — it locks `out/win-unpacked/`.

**Launch test:** `out\win-unpacked\Headmaster.exe`. Logs go to `%APPDATA%\Headmaster\logs\YYYY-MM-DD.log`.

**Runtime: Hermes Python** (per the 2026-06-15 runtime pivot). The desktop supports two runtime modes: **Local Hermes** starts `hermes dashboard` on this machine, while **Remote Hermes** connects to a configured host/port/token. The legacy desktop backend resolver, bundled binary preparation, and fallback startup path have been removed.

---

## How to work in this tree

1. **Read** `gcaplabs-headmasterUI/docs/white-label/HEADMASTER-VOCABULARY.csv` before naming anything user-facing. **Do not** ship AionUi / aionui / aionrs / Cowork / Hermes in the UI. Use the Headmaster column.
2. **Read** `gcaplabs-headmasterUI/docs/white-label/WHITE-LABEL-AUDIT.md` before touching anything in `gcaplabs-headmasterUI/packages/desktop/src/process/`. `HERMES_DESKTOP_*` env vars and the `hermes-media://` protocol are off-limits.
3. **Edit** in `gcaplabs-headmasterUI/` only. Do not edit `runtime/hermes-agent/`, `_support/upstream/`, or `_support/staging/`. Those are reference clones.
4. **Pull fresh upstream** for `_support/upstream/hermes-workspace/` before relying on its content: `cd _support/upstream/hermes-workspace && git pull --ff-only`. The canonical Hermes Agent is at `runtime/hermes-agent/` — pull there for runtime changes. The `hermes-agent-desktop/` junction follows automatically.
5. **Don't introduce new port numbers or endpoint paths** without checking `runtime-recon/RECON.md` (real Hermes endpoint map) first.
6. **Knowledge base:** real product + runtime state lives in `G:\Vault\KBs\headmasterui-kb\` (Honcho memory is auto-injected; vault is human-readable).

---

## Things that are easy to get wrong

- **Remote runtime mode exists now.** Settings → Runtime has a Local/Remote selector plus host/port/token fields. Remote mode sets `__backendHost`, `__backendPort`, and `__hermesSessionToken` instead of spawning local Hermes. Local mode still starts `hermes dashboard`.
- **There is no legacy desktop backend fallback.** Don't restore the removed binary resolver, bundled binary preparation, or fallback startup path. Hermes is the only desktop runtime.
- **"Hermes" is allowed in some places, forbidden in others.** Allowed in: env var names (`HERMES_HOME`, `HERMES_DESKTOP_*`), the `hermes-media://` URL scheme, the Python venv directory `~/.hermes/hermes-agent/`, the `hermes` console script name, the `hermes dashboard` spawn command. Forbidden in: any user-visible UI string, app name, About panel, window title, marketing copy. See WHITE-LABEL-AUDIT.md for the full list.
- **The Headmaster icon (the Sorting Hat) doesn't exist yet.** All icon assets are PLACEHOLDER per `HEADMASTER-ASSET-INVENTORY.md`. Don't reference them as if they exist.
- **`gcaplabs-site/` is the website, not the desktop.** Different stack, different product surface. If the user says "change the website", that's `gcaplabs-site/`. If they say "change the app", that's `gcaplabs-headmasterUI/`.
- **`headmaster-hub/` is the Headmaster Hub web app.** Not the same as the marketing site (`gcaplabs-site/`) and not the same as the desktop app.
- **Local dev can't run Docker on this machine** (Hyper-V/WSL2 disabled for WoW kernel-level cheats). Anything that needs Docker (OpenConcho) has to be external or native.
- **`_support/upstream/aionui/` is the Apache-2.0 upstream source.** Don't edit it; if you want to compare, that's what it's for.

---

## Cross-references

- **Knowledge base:** `G:\Vault\KBs\headmasterui-kb\` (the file index lives at `G:\Vault\KBs\headmasterui-kb\_MOC.md`).
- **Honcho memory** is auto-injected — long-term facts about the user, project, and decisions.
- **White-label audit:** `gcaplabs-headmasterUI/docs/white-label/WHITE-LABEL-AUDIT.md` (read before any rename work).
- **Vocab mapping:** `gcaplabs-headmasterUI/docs/white-label/HEADMASTER-VOCABULARY.csv` (read before any naming work).
- **Hermes runtime recon:** `runtime-recon/RECON.md` (read before any runtime/backend work).
- **The plan:** `gcaplabs-headmasterUI/docs/white-label/WHAT-WE-TAKE.md` (high-level; likely out of date, the recon wins).
- **Active backlog:** `mastertodo.md` — read this first when resuming desktop work. The current roadmap is the Agent37-aligned beta-readiness plan in `veeplan.md` (Phases 0–7); `mastertodo.md` tracks per-phase status and outstanding items.
- **Update check architecture:** `updateBridge.ts` calls `https://gcaplabs.com/api/release` (Vercel proxy, 5-min cache) which proxies `mutvayzz-sys/gcaplabs-headmasterUI` GitHub releases with a server-side `GITHUB_TOKEN`. Needs `GITHUB_TOKEN` set in Vercel env vars. Downloads rewritten to CDN via `static.gcaplabs.com/releases/{version}/{filename}`.
- **Full history:** `DEVLOG.md` (workspace root, newest first).
- **Last few things we did** (most recent first):
  1. **2026-06-19 — v0.1.7: Hermes-native desktop adapter:** Added Hermes session history and native JSON-RPC chat adapters, runtime recovery UI, interactive approval/clarification/secret handling, real profile/model/memory mappings, schema-driven Runtime Settings, Desktop Pet removal, and legacy desktop backend/script cleanup.
  2. **2026-06-19 — v0.1.6: Settings nav restructure + update proxy:** Settings sidebar reorganised into 4 groups (Intelligence / Workspace / Tools / App); tabs renamed: "Models & Providers", "Memory & Context", "Engines" (was Agents — fixed collision where both Agents and Assistants showed "Specialists"), "Tools & Integrations" (was Advanced Settings), "Connection" (was Runtime, then hidden — Headmaster always ships with local Hermes); fixed duplicate icon bug (Model and Runtime both used LinkCloud); `updateBridge.ts` now routes through `gcaplabs.com/api/release` Vercel proxy instead of hitting private GitHub API directly; `gcaplabs-site` gained `/api/release` route that proxies GitHub with server-side token + 5-min edge cache; v0.1.6 tag published to GitHub; todo items 11–15 added (Hermes inactive, chat history missing, chat broken, Hermes update restart UX, update proxy).
  3. **2026-06-19 — v0.1.5: App update checker + Headmaster labels + agent scanner:** Bumped to v0.1.5; new `AppUpdateChecker` in sidebar; `UpdateChecker` relabeled; `DEFAULT_REPO` corrected; `publishAutoUpdate: true`; sidebar footer version chip (`v{version} · {commit}`); Hermes home path bug fixed; restart IPC chain fixed; YOLO→Hands-Off audit; `agentScanner.ts` 4→10 backends.
  4. **2026-06-18 — Remote runtime + storage rename:** Settings → Runtime now has Local/Remote Hermes connection mode; renderer HTTP/WS clients support remote host; startup branches remote vs local; AppData storage migrates `aionui/` → `headmaster/`; source migration renames conversation source `aionui` → `headmaster`.
  5. **2026-06-18 — TODO backlog cleared:** Settings restructured (Hermes→Runtime, Advanced Settings tab, dead i18n removed), local CLI agent scanner implemented (`process/agent/agentScanner.ts`), BottomComposer removed, ChatSlider workspace fix, white-label grep audit across all locales, RuntimeSettings rewritten to use real `/api/config` endpoints, gateway status indicator + Headmaster update checker in sidebar footer, Memory page now embeds `memory.gcaplabs.com` via iframe.
  6. Version reset to `0.1.3`; removed the "installation incomplete" startup check entirely; added `AppErrorBoundary`; produced fresh signed build + `GCAP-Labs/Headmaster.lnk` shortcut.
  7. OpenConcho wired as external-link Memory settings tab.
  8. Hermes runtime pivot (no more legacy backend dependency for the build).
  9. Repository split: `gcaplabs-headmaster` (old, deleted) → `gcaplabs-headmasterUI` (current, private). Marketing site renamed to `gcaplabs-site`.
