# Headmaster — Active TODO

Updated: **2026-06-23**

Current source version: **v0.2.1**

Completed work belongs in `CHANGELOG.md`. Finished audit/plan docs live in `_archive/`.
This file contains only remaining validation, runtime stability, and release work.

## Current position

The **v0.2.1 release branch** includes the audit implementation pass (branch
`codex/headmaster-v0.2.0`):

- Hermes chat adapter hardening (model fallback, deferred `userCreated`, disconnect
  grace, RPC reconnect, session profile persistence).
- IPC/route fixes (`conversation.get` / `warmup` / `reset`, `/council` →
  `/team/default`, runtime settings canonical path).
- Gateway resilience, runtime globals sync (upstream-aligned port/token mirroring
  - `hermes:runtime-changed` push).
- Settings IA (Tools / Skills / Integrations / Channels), English-only i18n.
- White-label sweep, storage/event renames, build hygiene (`out/` cleanup,
  `legalTrademarks`, electronRebuild sync).
- **Removed from product:** Approvals page stub, Analytics screen, **Dashboard
  screen** (sidebar + page deleted; `/dashboard` redirects to `/guid`).
- Automated validation: `bunx tsc --noEmit` clean; `bun run test` — 1,319+
  passed (3 skipped).

**Still open:** packaged interactive smoke test, Hermes runtime stability (log
shows repeated `dashboard exited code=1` restarts), full installer/zip build,
release publication, and a few verification items below.

## P0 — Release blockers

### Hermes runtime stability

- [ ] Capture stderr tail before each `dashboard exited code=1` in
      `%APPDATA%\Headmaster\logs\`.
- [ ] Stop crash-restart loops from leaving the UI on stale port/token (regression
      test + packaged verify after `useDashboardStatus` / `onRuntimeChange`
      fix).
- [ ] Confirm Settings → Memory, Runtime toolsets, and Runtime status probes
      return 200 (not 401) when the dashboard stays up.

### Profile and chat (packaged verify)

- [ ] Verify `default`, `recruiter`, and other configured profiles can create,
      resume, and render conversations in the packaged app.
- [ ] Re-run first-prompt / follow-up / interrupt flows on the portable build.

### Skills tab (packaged verify)

- [ ] Capture any remaining failing request on Settings → Skills in the packaged
      app (catalog path is wired to `GET /api/skills`).

## P1 — Updates and support

- [ ] Verify About → Check for updates against live `https://gcaplabs.com/api/release`
      (returned HTTP 404 on 2026-06-20).
- [ ] Make **Update Log** show Headmaster Desktop release notes and selected
      runtime changes.
- [ ] Create and publish Headmaster documentation through Headmaster Hub.
- [ ] Make the Headmaster Hub repository public after explicit approval.

## Validation

### Automated

- [x] `bunx tsc --noEmit`
- [x] `bun run test` (full unit suite; 1,319+ passed, 3 skipped)
- [x] `bun run i18n:types && node scripts/check-i18n.js`
- [x] `bunx electron-vite build` (production bundles)
- [ ] `node scripts/build-with-builder.js auto --win` (NSIS installer + zip)
- [ ] `node scripts/build-with-builder.js auto --win --dir` (portable) on a clean
      `out/` tree

### Interactive runtime smoke test

- [ ] Sidebar reports connected REST and JSON-RPC WebSocket state.
- [ ] Compare loaded transcripts with `/api/sessions/{id}/messages`.
- [ ] New chat → stream → follow-up → interrupt → restart → resume.
- [ ] File attachment (`@file:`) delivery.
- [ ] Tool progress, approvals/clarifications/secrets in-chat.
- [ ] Council / team flows.
- [ ] Activity, Deliverables, Memory, Models, Specialists, Skills, Integrations,
      Channels, Runtime settings surfaces (Dashboard **out of scope** — removed).
- [ ] Kill Hermes → disconnect banner → restart → reconnect without 401 storms.
- [ ] Full log review for 404/500 loops and stale branding.

### Conversation tracking policy (packaged)

- [ ] Verify empty / failed / interrupted first queries stay out of sidebar
      history while the open chat remains usable (re-tested after runtime auth fix).

## Release closeout

- [ ] Fix every reproducible failure from packaged interactive testing.
- [ ] Re-run affected automated tests after each fix.
- [ ] Final white-label grep from `docs/white-label/WHITE-LABEL-AUDIT.md` §6.
- [ ] Verify packaged About, sidebar, installer, zip, and executable metadata
      report v0.2.1.
- [ ] Record final test results and known limitations in `CHANGELOG.md` if needed.
- [ ] Commit implementation intentionally.
- [ ] Push branch and open/update PR.
- [ ] Tag `v0.2.1` and publish only after packaged smoke test passes.
