# Headmaster — Active TODO

Updated: **2026-06-26**

Current source version: **v0.2.3**

Completed work belongs in `CHANGELOG.md`. Finished audit/plan docs live in `_archive/`.
This file contains only remaining validation, runtime stability, and release work.

## Current position

**v0.2.3** (2026-06-26) — packaged exe runtime isolation + login + install UI:

- Runtime always installs to `%LOCALAPPDATA%\Headmaster\runtime` (no PATH mutation, no fallback to existing Hermes)
- First-run installer runs automatically via `install.ps1` stage protocol; window appears immediately
- In-app install progress screen with live stage checklist, progress bar, log output
- Login working: `VITE_HERMESHQ_URL` baked at build time; CORS headers injected for HermesHQ
- F12 opens DevTools in packaged builds
- Native OS install dialog removed

**v0.2.2** (2026-06-25) — cross-device memory, safeStorage, provision flow, iOS fixes.

**Still open:** end-to-end login + Hermes dashboard startup verify, full installer/zip build, release publication.

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
