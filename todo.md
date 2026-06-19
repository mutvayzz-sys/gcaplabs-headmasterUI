# Headmaster — Active TODO

Updated: **2026-06-19**

Current source version: **v0.1.7**

This file tracks the remaining implementation and verification work from
`C:\Users\Matve\Desktop\gcap-labs\codexplan.md`.

## Current position

The core Hermes migration is substantially implemented. Headmaster now uses
Hermes sessions for history and native Hermes JSON-RPC for primary chat
create/send/stop operations. Runtime connectivity, update behavior, settings,
Desktop Pet removal, and most inherited backend cleanup are also implemented.

The work is **not release-complete**. Remaining inherited conversation routes
must be replaced or intentionally disabled, then the complete app must pass
build, packaging, live-runtime smoke testing, and debugging.

## Completed

### 1. Preserve existing v0.1.6 work

- [x] Reviewed and preserved the existing worktree.
- [x] Created preservation commit `85708dd`.
- [x] Created initial Hermes session adapter commit `7e98e5d`.
- [x] Pushed branch `codex/hermes-session-adapter-v0.1.6`.
- [x] Opened draft PR #2.
- [x] Left unrelated untracked files `Driver`, `Manager`, and `Tasks` untouched.

### 2. Hermes session history adapter

- [x] Use `/api/sessions` as the primary conversation source.
- [x] Load transcripts from `/api/sessions/{id}/messages`.
- [x] Map Hermes sessions into Headmaster conversation models.
- [x] Map text, reasoning, tool calls, tool results, and context metadata.
- [x] Route session get, rename, delete, and archive operations through Hermes.
- [x] Suppress unsupported active-conversation count behavior.
- [x] Convert Dashboard, Activity, and Documents to Hermes session/file APIs.
- [x] Add focused session adapter tests.

### 3. Native Hermes chat flow

- [x] Add JSON-RPC support for `session.create`.
- [x] Add JSON-RPC support for `session.resume`.
- [x] Send prompts through `prompt.submit`.
- [x] Stop generation through `session.interrupt`.
- [x] Keep durable stored session IDs separate from live runtime session IDs.
- [x] Recover from stale live session IDs by resuming the stored session.
- [x] Translate text, reasoning, tool, completion, and error events.
- [x] Pass attachments to Hermes as `@file:` references.
- [x] Add focused chat adapter tests.

### 4. Runtime state and diagnostics

- [x] Require both REST readiness and JSON-RPC WebSocket connectivity.
- [x] Add connected/reconnecting/disconnected runtime state.
- [x] Add a persistent disconnected banner with Retry and Restart controls.
- [x] Show a sanitized runtime failure reason.
- [x] Make sidebar status reflect real runtime connectivity.
- [x] Reset bridge sockets when the runtime restarts.
- [x] Keep the installed Hermes runtime as the canonical local runtime.

### 5. Replace inherited settings/data endpoints

- [x] Store desktop client settings locally instead of using `/api/settings/client`.
- [x] Map assistants to `/api/profiles`.
- [x] Map provider/model choices to `/api/model/options`.
- [x] Map memory operations to Hermes memory endpoints.
- [x] Remove the unsupported settings dependency from the MCP catalog.
- [x] Use local process configuration for system, web UI, and tray settings.

### 6. Remove inherited dead features and backend fallback

- [x] Remove Desktop Pet process code, preload entries, renderer assets, routes,
      settings, tray integration, config keys, and all locale files.
- [x] Rename the cron model-required key to neutral `modelRequired` wording.
- [x] Remove user-facing “Headmaster CLI” terminology.
- [x] Remove the desktop legacy `aioncore` binary resolver and fallback startup.
- [x] Remove desktop build preparation and verification for bundled aioncore.
- [x] Stop Hermes bootstrap cleanly on application quit.

### 7. Update and diagnostics behavior

- [x] Route application release checks through `gcaplabs.com/api/release`.
- [x] Avoid shipping a GitHub token for private-repository release checks.
- [x] Guard `electron-updater` in portable and `--dir` builds.
- [x] Remove forced runtime restart after a runtime update.
- [x] Show an installed/restart-when-ready state with manual restart.
- [x] Make missing `SENTRY_DSN` a clean no-op.
- [x] Rename the Sentry log attachment to `headmaster-logs.log.gz`.

### 8. Verification completed so far

- [x] TypeScript typecheck passed after the adapter work.
- [x] Hermes session and chat adapter unit tests passed (8 tests).
- [x] Electron bundle passed before the latest complete adapter increment.

## Remaining implementation

### 9. P0 — Remove or adapt remaining inherited conversation APIs

These routes are still present in `common/adapter/ipcBridge.ts` and may produce
404s or broken UI paths against Hermes:

- [x] Conversation clone and associated-conversation operations.
- [x] Reset, warmup, slash commands, and side questions.
- [x] Confirmation, clarification, and approval interactions.
- [x] Conversation artifacts.
- [x] Conversation workspace browsing.
- [x] Per-conversation mode and model operations.
- [x] OpenClaw conversation runtime operations.
- [ ] Individual conversation-message deletion.
- [x] Cron conversation-history mapping, if its current response differs from
      the inherited AionUI shape.
- [x] For every unsupported Hermes feature, disable or hide the UI explicitly
      instead of allowing a failing request.

### 10. P0 — Complete gateway event compatibility

- [x] Verify the exact live payloads for confirmation, clarification, approval,
      and permission events.
- [x] Add adapter handling for supported interactive runtime events.
- [x] Verify tool progress, tool completion, tool errors, and rich results in
      the actual message renderer.
- [ ] Add mocked tests for disconnect, reconnect, interruption, RPC errors, and
      malformed or out-of-order events.

### 11. P1 — Remove residual non-desktop aioncore paths

The desktop startup and package path are clean, but legacy web/utility scripts
still reference aioncore:

- [x] Adapt or remove `scripts/webui.ts`.
- [x] Adapt or remove `scripts/resetpass.ts`.
- [x] Adapt or remove `scripts/pack-web-cli.js`.
- [x] Adapt or remove `scripts/smoke-test-web-cli.sh`.
- [x] Replace stale aioncore comments in renderer API/status files.
- [x] Replace the stale aioncore error in `packages/desktop/src/index.ts`.
- [x] Decide whether historical `vic-*` migration scripts remain archived or
      should be deleted from the shipping repository.

### 12. P1 — Runtime Settings refinement

- [x] Group fields using real `/api/config/schema` metadata.
- [x] Show useful descriptions and defaults.
- [x] Add client-side validation for schema constraints.
- [ ] Verify save, reload, invalid-value, and backend-error behavior.

### 13. P2 — Documentation, version, and publication

- [x] Update this active TODO.
- [x] Update `DEVLOG.md`.
- [x] Update `AGENTS.md`.
- [x] Update `DEEP-WIKI.md`.
- [x] Update the source version to v0.1.7.
- [x] Update stale current-version references to v0.1.7 where appropriate.
- [x] Push the completed implementation to GitHub on
      `codex/headmaster-v0.1.7` with commit `7a636cc`.
- [x] Open draft PR
      [#3](https://github.com/mutvayzz-sys/gcaplabs-headmasterUI/pull/3).
- [x] Report back before starting sections 15 and 16.

## Final testing and debugging phase

Run this phase only after sections 9–12 are complete.

### 14. Automated validation

- [ ] Run `bunx tsc --noEmit`.
- [ ] Run focused Hermes adapter tests.
- [ ] Run the complete unit test suite.
- [ ] Run contract and integration tests.
- [ ] Run i18n generation/checks and packaged-i18n tests.
- [ ] Run `bunx electron-vite build --config packages/desktop/electron.vite.config.ts`.
- [ ] Build the Windows portable package with `--dir`.
- [ ] Build the Windows installer and zip.

### 15. Live installed-runtime smoke test

- [ ] Launch `out/win-unpacked/Headmaster.exe`.
- [ ] Verify REST and JSON-RPC WebSocket readiness.
- [ ] Verify existing Hermes sessions appear.
- [ ] Open old sessions and compare complete transcripts.
- [ ] Create a new mission and stream a complete response.
- [ ] Send attachments and verify Hermes receives them.
- [ ] Interrupt a running response.
- [ ] Restart Headmaster and verify the stored session resumes.
- [ ] Test runtime restart and runtime crash recovery.
- [ ] Test missing-runtime and disconnected-runtime states.
- [ ] Verify Dashboard, Activity, Documents, Memory, Models, Profiles, and MCP.
- [ ] Verify runtime and application update flows do not auto-restart.
- [ ] Review `%APPDATA%\Headmaster\logs\` for unsupported endpoint loops,
      uncaught errors, stale branding, or sensitive values.

### 16. Debug and release closeout

- [ ] Fix every reproducible failure found during the smoke test.
- [ ] Repeat affected automated and live tests after each fix.
- [ ] Perform a final white-label grep of source and packaged output.
- [ ] Record final test results and known limitations in project docs.
- [ ] Commit the completed implementation intentionally.
- [ ] Push the branch and update the draft PR.
- [ ] Mark the plan complete only after the packaged live-runtime test passes.
