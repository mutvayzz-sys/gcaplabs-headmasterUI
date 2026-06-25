# INDEX — GCAP-Labs working root

> Human + agent index. **AGENTS.md** is the directory map (what's where, when to use it). **This file** is the project map: what the product is, where it lives, and where to start.

---

## What this workspace is

The working root of the **Headmaster** build for **GCAP Labs** (white-label of Hermes Agent, MIT, by Nous Research). Three products share this machine:

1. **Headmaster Desktop** — the Electron app you're most likely to be editing. Lives in `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/`. Pushed to `gcaplabs-headmasterUI` (private repo on GitHub).
2. **Headmaster Hub** (web) — `headmaster-hub/`. Separate product surface. Has its own git.
3. **GCAP Labs marketing site** — `gcaplabs-site/`. Next.js 15 App Router. **Live on `gcaplabs.com`.** Pushed to `mutvayzz-sys/gcaplabs-site` (private).

Everything else in this folder is upstream reference, runtime, recon, staging, or history.

## Where to start

| If you want to…                                                      | Start here                                                                                                                                                                                            |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| See what's queued for the desktop app                                | `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/todo.md` — TODO backlog is cleared through remote runtime mode + storage rename. Remaining: build + smoke test, docs/wiki refresh, Honcho upgrade.    |
| Edit the desktop app (most common)                                   | `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/` — read its `AGENTS.md` and `CLAUDE.md` (it has them).                                                                                               |
| Understand the desktop app's structure                               | `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/WHAT-WE-TAKE.md` (the plan) + `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/WHITE-LABEL-AUDIT.md` (rename rules). |
| Understand the Hermes runtime (Python backend)                       | `runtime-recon/RECON.md` (Task 0 recon, ground truth).                                                                                                                                                |
| Look up a name in Headmaster (UI term)                               | `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/HEADMASTER-VOCABULARY.csv` (AionUi → Headmaster mapping, authoritative).                                                             |
| Edit the marketing site (gcaplabs.com)                               | `gcaplabs-site/`. Read its `AGENTS.md`.                                                                                                                                                               |
| Edit the Headmaster Hub (web)                                        | `headmaster-hub/`.                                                                                                                                                                                    |
| Find a long-running decision / project context                       | `G:\Vault\KBs\headmasterui-kb\` (file index at `_MOC.md`) and Honcho memory (auto-injected).                                                                                                          |
| Reference UI from fathah's Hermes Desktop fork                       | `_support/upstream/hermes-desktop/` (run `git pull` to track upstream).                                                                                                                               |
| Reference the **official** Hermes Desktop (NousResearch)             | `_support/upstream/hermes-agent-desktop/` (junction into `runtime-recon/hermes-agent/apps/desktop/`).                                                                                                 |
| Reference features from Hermes Workspace (Kanban/Runs/Skills/Cron)   | `_support/upstream/hermes-workspace/` (run `git pull` to track upstream).                                                                                                                             |
| Find what an upstream Hermes app looked like before any of our edits | `_support/upstream/aionui/` (the original Apache-2.0 source `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/` is forked from).                                                                        |
| Stage new visual assets                                              | `_support/staging/assets/`.                                                                                                                                                                           |
| Look at planning history                                             | `_support/archive/` (AUDIT_REPORT.md, claude-plan.md, claude-notes.md, etc — stale, treat as historical).                                                                                             |

```
GCAP-Labs/
├── gcaplabs-headmaster/repo/gcaplabs-headmasterUI/      ← the Electron app (build target)
├── headmaster-hub/          ← Headmaster Hub web app
├── gcaplabs-site/           ← gcaplabs.com (Next.js)
│
├── runtime/
│   └── hermes-agent/        ← Python runtime (canonical)
│
├── runtime-recon/           ← RECON.md, reconcile.md + recon-only copy
│
├── _support/                ← reference, staging, and historical
│   ├── upstream/            ←   upstream clones
│   │   ├── aionui/              ←   Apache-2.0 source we forked from
│   │   ├── hermes-desktop/      ←   fathah's UI ref
│   │   ├── hermes-workspace/    ←   outsourc-e's multi-agent ref
│   │   ├── hermes-agent-desktop/←   OFFICIAL Hermes Desktop (NousResearch, junction to runtime-recon)
│   │   └── hermes-webui/        ←   Hermes WebUI (Python/FastAPI reference)
│   ├── staging/             ←   working areas
│   │   ├── assets/              ←   Vercel Blob, prompt-and-generate outputs
│   │   ├── skills/              ←   skill drafts
│   │   └── marketplace/         ←   Bencium marketplace (separate)
│   └── archive/             ←   historical scratch (claude-plan.md, AUDIT_REPORT.md, ...)
│
├── .claude/                 ← AI tool config (not committed)
├── AGENTS.md                ← directory map
└── INDEX.md                 ← this file
```

## Git remotes

| Local folder                                      | GitHub remote                                  | Visibility |
| ------------------------------------------------- | ---------------------------------------------- | ---------- |
| `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/` | `gcaplabs-headmasterUI` (origin)               | private    |
| `headmaster-hub/`                                 | `mutvayzz-sys/gcaplabs-headmasterhub`          | private    |
| `gcaplabs-site/`                                  | `mutvayzz-sys/gcaplabs-site`                   | private    |
| `runtime/hermes-agent/`                           | `NousResearch/hermes-agent` (or upstream fork) | public     |
| `_support/upstream/hermes-desktop/`               | `fathah/hermes-desktop` (or your fork)         | public     |
| `_support/upstream/hermes-workspace/`             | `outsourc-e/hermes-workspace` (or your fork)   | public     |
| `_support/upstream/aionui/`                       | `iOfficeAI/AionUi`                             | public     |
| `_support/upstream/hermes-webui/`                 | `NousResearch/hermes-agent` (subfolder)        | public     |

## Naming rules (TL;DR — see `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/HEADMASTER-VOCABULARY.csv` for full map)

| Don't ship this in the UI                  | Use this instead                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AionUi, aionui, AionUi Desktop             | **Headmaster**, **Headmaster Desktop**                                                                                                                                                                                                                                                                                                                             |
| iOfficeAI                                  | **GCAP Labs**                                                                                                                                                                                                                                                                                                                                                      |
| aionrs, aioncore, Adonis Core              | **Adonis** (backend, technical) — never as user-facing brand                                                                                                                                                                                                                                                                                                       |
| Cowork, Cowork Mode                        | **Work Along** (mode), "Work along" (verb)                                                                                                                                                                                                                                                                                                                         |
| Team Mode                                  | **The Council**                                                                                                                                                                                                                                                                                                                                                    |
| Run (autonomous)                           | **Run It Yourself** (mode), "run it" (verb)                                                                                                                                                                                                                                                                                                                        |
| YOLO Mode                                  | **Hands-Off** (mode)                                                                                                                                                                                                                                                                                                                                               |
| Full-Auto Mode                             | **Autopilot** (mode)                                                                                                                                                                                                                                                                                                                                               |
| New Chat                                   | **New Mission** (button)                                                                                                                                                                                                                                                                                                                                           |
| Teammates                                  | **Specialists**                                                                                                                                                                                                                                                                                                                                                    |
| Leader agent                               | **The Headmaster** (orchestrator role)                                                                                                                                                                                                                                                                                                                             |
| Shared task board                          | **The Council Chamber** (UI)                                                                                                                                                                                                                                                                                                                                       |
| Skills Marketplace                         | **The Agency**                                                                                                                                                                                                                                                                                                                                                     |
| Built-in Skills                            | **Founding Skills**                                                                                                                                                                                                                                                                                                                                                |
| Custom Skills                              | **Your Skills**                                                                                                                                                                                                                                                                                                                                                    |
| Specialist names (Patrick, Marco, Maya, …) | **The Writer**, **The Storyteller**, **The Visualizer**, **The Closer**, **The Analyst**, **The Dash**, **The Modeler**, **The Reporter**, **The Researcher**, **The Architect**, **The Designer**, **The Builder**, **The Wordsmith**, **The Coach**, **The Operator**, **The Planner**, **The Recruiter**, **The Setup Crew**, **The DevOps**, **The Connector** |

These mappings are **locked**. If you find yourself writing a new name that isn't in this table, ask before introducing it.

## Frontstuff vs. runtime (TL;DR — see `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/WHITE-LABEL-AUDIT.md` for full list)

**Safe to rename (user-facing):** app name, package metadata, window/menu/About text, renderer UI strings, theme names, brand assets, marketing docs, `localStorage` keys, code-signing identity, Winget/Linux maintainer strings.

**Off-limits (runtime):** `HERMES_HOME` env var, `HERMES_DESKTOP_*` env vars, `hermes-media://` URL scheme, Python entrypoint commands (`hermes gateway`, `hermes dashboard`, `hermes model`, `hermes update`, `hermes desktop`), gateway ports (`9120-9199` pool, `:8642` default, `:9119` dashboard, `:3000` workspace), `hermes-agent` subdirectory under `HERMES_HOME`, `@hermes/shared` workspace package, `cli.py` and the entire Python runtime, the `hermes` git remote URL in `update-remote.cjs`, backend HTTP API paths and IPC channel names.

**Decision rule:** "Does renaming this string change what shows up in a USER-FACING UI surface?" → Yes, it's frontstuff, change it. → No, leave it alone.

## Build and run

**Current desktop version:** `0.1.7` (root `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/package.json`).

**Desktop build** (from `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/`):

```bash
bunx tsc --noEmit                                              # typecheck
bunx electron-vite build --config packages/desktop/electron.vite.config.ts
node scripts/build-with-builder.js auto --win                  # package win (installer + zip + portable)
node scripts/build-with-builder.js auto --win --dir            # fast: portable exe only (skip installer/zip)
```

Close any running `Headmaster.exe` before building — it locks `out/win-unpacked/`.

**Launch test:** `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/out/win-unpacked/Headmaster.exe` (shortcut: `GCAP-Labs/Headmaster.lnk`)

**Logs:** `%APPDATA%\Headmaster\logs\YYYY-MM-DD.log`

**Runtime mode:** Settings → Runtime now stores Local/Remote Hermes connection mode in `connection-config.json`. Local mode launches `hermes dashboard`; Remote mode connects renderer HTTP/WS calls to the configured host/port/token and does not spawn local Hermes.

**Storage:** App data now uses `%APPDATA%\Headmaster\headmaster\` instead of `%APPDATA%\Headmaster\aionui\`; startup migrates the old folder and old `aionui-*` config/history filenames forward.

**Build wrapper (sets `HEADMASTER_RUNTIME=hermes`):** `C:\Users\Matve\AppData\Local\Temp\run-headmaster-dist-win-hermes.bat`

**Marketing site (from `gcaplabs-site/`):** `npm run dev` (Next.js dev server)

## Git remotes

| Local folder                                      | GitHub remote                                  | Visibility |
| ------------------------------------------------- | ---------------------------------------------- | ---------- |
| `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/` | `gcaplabs-headmasterUI` (origin)               | private    |
| `headmaster-hub/`                                 | `mutvayzz-sys/gcaplabs-headmasterhub`          | private    |
| `gcaplabs-site/`                                  | `mutvayzz-sys/gcaplabs-site`                   | private    |
| `runtime/hermes-agent/`                           | `NousResearch/hermes-agent` (or upstream fork) | public     |
| `_support/upstream/hermes-desktop/`               | `fathah/hermes-desktop` (or your fork)         | public     |
| `_support/upstream/hermes-workspace/`             | `outsourc-e/hermes-workspace` (or your fork)   | public     |
| `_support/upstream/aionui/`                       | `iOfficeAI/AionUi`                             | public     |
| `_support/upstream/hermes-webui/`                 | `NousResearch/hermes-agent` (subfolder)        | public     |

## Project context (where decisions live)

- **This folder** = the working tree
- **`G:\Vault\KBs\headmasterui-kb\`** = structured knowledge base (file index at `_MOC.md`)
- **Honcho memory** = auto-injected facts about the user, project, and decisions
- **`gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/WHAT-WE-TAKE.md`** = the original 3-LEGO-sets plan (out of date, but explains intent)
- **`runtime-recon/RECON.md`** = authoritative ground truth on the Hermes Python runtime
- **`runtime-recon/reconcile.md`** = the original plan's assumptions vs. the actual runtime
- **`gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/white-label/WHITE-LABEL-AUDIT.md`** = frontstuff vs. runtime boundary

## What is NOT in this folder

- **OpenConcho** (Honcho memory screen / dashboard) — separate third-party app, runs on its own infra. Wired into Headmaster as an external-link Settings tab only.
- **Honcho** — Python memory service. Lives at `https://honcho.gcaplabs.com`. Hermes Agent is the canonical memory backend; OpenConcho is the visual UI for it.
- **The actual AI model APIs** (OpenAI, Anthropic, etc.) — Headmaster/Hermes calls them at runtime via standard API keys, no model code is checked into this repo.
- **The Headmaster design assets** (Sorting Hat mascot, GCAP shield, custom icons) — placeholders only, see `HEADMASTER-ASSET-INVENTORY.md`.

## Owners and cadence

- **Vic** = project owner. Expects short casual responses, immediate execution, receipts for any tool/CLI claim.
- **AionUi is a fork** — if upstream iOfficeAI/AionUi changes, the merge is into `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/`, not into `_support/upstream/aionui/`.
- **Hermes upstreams are reference clones** — pull fresh with `git pull --ff-only` when you need a clean read; do not commit to them.
- **Gaming machine constraint** — this box runs WoW with kernel-level cheats. Hyper-V AND WSL2 must stay DISABLED. No Docker / Podman / Rancher on this box. Containerized services live elsewhere (Fly.io, k8s) or use native Windows installs.
