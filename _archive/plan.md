# Headmaster v0.2.0 Smoke Test & Audit Plan

## Context

Headmaster Desktop v0.2.0 is a white-label of Hermes Agent (NousResearch), forked from AionUi, with features cherry-picked from fathah/hermes-desktop and outsourc-e/hermes-workspace. The build target is `packages/desktop/` inside the monorepo at `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/`.

Current state: v0.2.0 RC. Many P0 blockers have been fixed in code but not all have been verified in the packaged build. Interactive smoke tests are largely unchecked. The todo.md has ~50 unchecked items.

## Three Upstream Sources & What Was Ported

| Source | What was taken | Current status in Headmaster |
|--------|----------------|------------------------------|
| **NousResearch/hermes-agent** (base) | Chat, file browser, MCP/tools, voice, deep settings, Electron main process | ✅ Heavily modified; Hermes-native adapters added |
| **fathah/hermes-desktop** | 12-screen UI grid concept, installer ideas | ⚠️ Mostly dropped (PostHog, crypto badge, Atlas Cloud); some UI patterns may remain |
| **outsourc-e/hermes-workspace** | Multi-agent Swarm, terminal, memory, cron, skills marketplace, Kanban, Runs | ⚠️ Partially ported; many screens are Phase 2 stubs |

## Target 14 Screens (per WHAT-WE-TAKE.md)

| # | Screen | Source | Status |
|---|--------|--------|--------|
| 1 | **Dashboard** | 🔨 Build custom | `/dashboard` — stub page |
| 2 | **Chat** | 📋 Nous | `/conversation/:id` — functional, but has P0 bugs |
| 3 | **Workflows** | 📋 workspace | `/workflows` — stub page |
| 4 | **Kanban** | 📋 workspace | `/kanban` — stub page |
| 5 | **Runs** | 📋 workspace | `/activity` — stub page |
| 6 | **Approvals** | 🔨 Build custom | Not a standalone route; part of chat UI |
| 7 | **Documents** | 📋 Nous | `/documents` — stub page |
| 8 | **Memory** | 📋 workspace | `/memory` — stub page; Settings → Memory embeds iframe |
| 9 | **Automations** | 📋 workspace | `/scheduled` — functional (Cron tasks) |
| 10 | **Agents** | 🔨 Build custom | `/agents` — stub page; Settings → Agents/Assistants merged |
| 11 | **Integrations** | 📋 Nous | `/settings/integrations` — functional (MCP) |
| 12 | **Channels** | 📋 Nous | `/settings/channels` — functional |
| 13 | **Analytics** | 🔨 Build custom | Not a standalone route |
| 14 | **Settings** | 📋 Nous | `/settings/*` — functional but restructured |

## Execution Stages

### Stage 1 — Parallel Deep Audits (4-5 agents)

Each agent receives:
- **Role label** — specialist identity
- **Guidance** — what to look for, what files to read
- **Context** — upstream source, current implementation, known bugs from todo.md
- **Mission** — specific deliverable: a structured report of findings

| Agent | Area | Key Files | Mission |
|-------|------|-----------|---------|
| **Audit_Adapters** | Chat/Session adapters, gateway resilience, message flow | `hermesChatAdapter.ts`, `hermesSessionAdapter.ts`, `httpBridge.ts`, `hermesRouteFallback.ts` | Identify bugs, race conditions, missing error recovery, stub providers, incomplete Hermes RPC coverage |
| **Audit_Settings** | Settings pages, routes, redirects, modal vs page consistency | `SettingsModal/index.tsx`, `Router.tsx`, `pages/settings/*`, `SettingsSider` | Find broken redirects, missing settings tabs, inconsistent IA, unimplemented pages, route collisions |
| **Audit_WhiteLabel** | Remaining branding leaks, i18n gaps, asset issues | `src/renderer/**`, `src/process/**`, `i18n/*.ts`, `public/`, `assets/` | Catalog every remaining Hermes/Nous/AionUi reference; find i18n untranslated strings; identify missing assets |
| **Audit_Tests** | Test coverage, build config, typecheck, packaging | `package.json`, `electron.vite.config.ts`, `scripts/build-with-builder.js`, `*.test.ts` | Find untested critical paths; check build errors; verify installer config; validate release readiness |
| **Audit_Features** | Feature completeness against 14-screen spec | `pages/*`, `hooks/*`, `components/*` | Map each of the 14 screens to actual implementation; identify stubs vs real; find missing dependencies |

### Stage 2 — Integration & Cross-Validation

- Combine all agent findings into a single master report
- Cross-reference: e.g., if a feature is stubbed, does the test agent know? If a route is broken, does the white-label agent see the error page?
- Prioritize findings into P0/P1/P2

### Stage 3 — Actionable Report

Produce `AUDIT_REPORT_v0.2.0.md` with:
1. Executive summary (what's broken, what's missing, what's stubbed)
2. P0 Release Blockers (must fix before v0.2.0 ships)
3. P1 Polish Items (should fix before marketing push)
4. P2 Nice-to-Haves
5. Test coverage gaps
6. White-label remaining work
7. Recommended next steps

## Agent Prompts (Stage 1)

See each dispatched `Agent` tool call for the full prompt.

## Constraints
- Do NOT run `bunx tsc` or `node scripts/build-with-builder.js` — system is under resource pressure
- Do NOT spawn processes that fork (Bash is failing)
- Focus on static code analysis, file reading, and pattern matching
- Use `Grep` extensively for finding references
- Read files with `Read` and `Glob`
- Report file paths and line numbers for every finding
