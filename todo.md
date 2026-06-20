# Headmaster — Active TODO

Updated: **2026-06-20**

Current source version: **v0.2.0**

Completed work belongs in `CHANGELOG.md`. This file contains only remaining
implementation, validation, and release work.

## Current position

The Hermes-native adapter and packaged-renderer recovery are implemented. A
signed Windows portable build mounts successfully with a clean observed
startup console.

Release completion is blocked by interactive chat/profile bugs, unfinished
settings and support surfaces, full validation, installer packaging, and
publication.

## v0.2.0 implementation progress

### Release branch and naming

- [x] Fast-forward `main` to the latest `origin/main`.
- [x] Create fresh branch `codex/headmaster-v0.2.0`.
- [x] Set the root application version to `0.2.0`.
- [x] Rename user-facing **New Mission** actions and fallback titles to
      **New Chat**.
- [ ] Verify packaged About, sidebar, installer, zip, and executable metadata
      all report v0.2.0.

### Validation completed during implementation

- [x] Run `bunx tsc --noEmit` after the profile, session, settings, update,
      support, and model changes.
- [x] Pass focused Hermes session/chat, assistant-default, and Runtime Settings
      tests (27 tests).

### Conversation tracking policy

- [x] Exclude empty and single-query Hermes sessions from Headmaster history.
- [x] Count user prompts rather than total transcript messages.
- [x] Keep a newly created chat directly accessible while it is open.
- [x] Require a second user prompt before a chat appears in tracked history.
- [x] Preserve correct visible totals and pagination after filtering.
- [x] Add coverage for text-only, tool-heavy, empty, and two-query sessions.
- [ ] Verify the policy across packaged History, Dashboard, Activity, search,
      exports, restart, interrupted first queries, and failed first queries.

- [x] Keep individual stored-message deletion unsupported.
- [x] Prevent the unsupported action from calling an inherited Hermes route.
- [x] Preserve whole-chat deletion.

## P0 — Release blockers

### Profile launch and chat crash

Evidence:
`C:\Users\Matve\AppData\Local\Temp\codex-clipboard-99cf4f0e-8441-4ff7-95d3-1e896b516075.png`

- [ ] Reproduce launching the `recruiter` Hermes profile from Specialists.
- [x] Fix `Cannot read properties of undefined (reading 'model')`.
- [x] Identify the profile/session/model mapper returning `undefined`.
- [x] Add regression coverage for non-default profile provider/model metadata.
- [x] Prevent a single conversation failure from replacing every route with
      the global error boundary.
- [x] Add conversation- or route-level recovery.
- [x] Make **Try again** restore the failed route without leaving Chat
      inaccessible.
- [ ] Verify `default`, `recruiter`, and other configured profiles can create,
      resume, and render conversations.

### Existing-chat message submission stalls

Intended flow:

- New Mission → `session.create`
- Existing stored chat → `session.resume`
- Follow-up message → `prompt.submit` on the same live session
- Stop → `session.interrupt`

- [ ] Reproduce the processing state where no user or assistant message appears.
- [x] Preserve profile identity across `session.create` and `session.resume`.
- [x] Confirm `message.userCreated` is emitted against the stored conversation.
- [x] Confirm `prompt.submit` uses the active live session ID.
- [x] Confirm streamed events map back to the stored conversation ID in order.
- [x] Add timeout/error recovery instead of indefinite processing.
- [ ] Add a regression test covering resume → follow-up → stream → persistence.

### Skills tab fails to fetch

- [ ] Capture the exact failing request, status, and response shape.
- [x] Route the page to real Hermes `GET /api/skills`.
- [x] Remove or adapt inherited skill CRUD routes Hermes does not expose.
- [x] Add a useful non-looping empty/error state.
- [x] Use one normalized skill catalog across Settings, Specialists, and New
      Chat.

## P1 — Models and Specialists

### Model catalog and authentication state

- [ ] Determine why Models & Providers shows zero API keys for providers Hermes
      already uses.
- [ ] Distinguish model availability, provider authentication, direct API-key
      storage, OAuth, environment credentials, and profile configuration.
- [x] Stop describing OAuth/environment/profile-backed authentication as
      “0 API keys”.
- [x] Hide providers/models without usable authentication.
- [ ] Keep **Add Model** only for adding a genuinely unavailable custom
      provider or endpoint.
- [ ] Verify displayed authentication agrees with models used by existing
      Hermes chats.

### Specialist engine identity

- [ ] Show each Specialist’s backing engine/provider next to its model.
- [ ] Label Hermes/Headmaster profiles, local CLI agents, preset personas, and
      remote/custom agents distinctly.
- [ ] Add real product icons and accessible labels for Claude Code, Codex,
      Gemini CLI, Headmaster profiles, and other engines.
- [ ] Define which engines each Specialist supports.
- [ ] Prevent unsupported Specialist/engine/model combinations.

## P1 — Settings information architecture

Target structure:

- **Tools** — local/runtime tools and permissions.
- **Skills** — skill catalog and management.
- **Integrations** — MCP connections and Webhooks.
- **Channels** — Hermes gateway channels plus remote/web access.

- [x] Remove the inherited AionUI Channels section.
- [x] Build Channels from the real Hermes gateway catalog and status.
- [x] Use each channel’s real icon and connection state.
- [x] Make Channels its own settings sidebar tab in the Tools group.
- [x] Move Remote / Headmaster on the Go / Web UI under Channels.
- [x] Move MCP and Webhooks under Integrations.
- [x] Keep Tools shallow rather than nesting another tab container.
- [x] Rehome remaining Advanced/Capabilities content where appropriate.
- [x] Update routes, deep links, and extension anchors.
- [ ] Complete i18n and route regression tests for the new settings structure.

## P1 — Updates

- [ ] Audit `mutvayzz-sys/gcaplabs-headmasterhub` for private material.
- [ ] Make the Headmaster Hub repository public after explicit approval.
- [ ] Use Headmaster Hub or the GCAP Labs release endpoint as the public
      Headmaster Desktop version source.
- [x] Keep a persistent sidebar indicator for Headmaster Desktop updates.
- [x] Show Hermes runtime updates at most once on the first launch each day.
- [x] Add daily dismissal/acknowledgement state for Hermes update notices.
- [x] Remove the persistent Hermes update badge.
- [x] Remove the current runtime restart button from the Hermes status/update
      indicator.
- [ ] Put restart/install actions on the Headmaster Desktop update UI.
- [ ] Clearly distinguish Desktop and runtime updates.
- [ ] Verify About → Check for updates works without a private GitHub token.

## P1 — About, help, and support

- [ ] Create and publish Headmaster documentation through Headmaster Hub.
- [ ] Wire **Help Documentation** to the published docs.
- [ ] Make **Update Log** show Headmaster Desktop release notes and selected
      runtime changes.
- [x] Wire **Report Issue** to a working feedback/issue flow.
- [x] Make **Contact Me** open a modal with:
  - `admin@gcaplabs.com`
  - `+971 50 105 2900`
  - a Discord link after its destination is specified.
- [x] Make **Official Website** open `https://gcaplabs.com`.
- [x] Make all About actions keyboard accessible with visible failure feedback.

## Validation

### Automated

- [ ] Run the complete unit suite: `bunx vitest run`.
- [ ] Run i18n generation/checks:
      `bun run i18n:types && node scripts/check-i18n.js`.
- [ ] Build the Windows installer and zip:
      `node scripts/build-with-builder.js auto --win`.

### Interactive runtime smoke test

- [ ] Verify the sidebar reports connected REST and JSON-RPC WebSocket state.
- [ ] Compare loaded transcripts with `/api/sessions/{id}/messages`.
- [ ] Create a new mission and stream a complete response.
- [ ] Send a follow-up in the same session.
- [ ] Send a file attachment and verify `@file:` delivery.
- [ ] Interrupt generation without leaving a spinner.
- [ ] Restart Headmaster and verify session resume/history.
- [ ] Test every configured CLI agent/tool backend.
- [ ] Verify tool progress, completion, rich results, and errors.
- [ ] Verify approval, clarification, and secret-input prompts.
- [ ] Test Council creation, activity, completion, history, and approval gates.
- [ ] Verify Dashboard, Activity, Deliverables, Memory, Models, Specialists,
      Skills, Integrations, Channels, and Runtime surfaces.
- [ ] Kill Hermes and verify disconnect/restart/reconnect behavior.
- [ ] Smoke-test System from the installer variant.
- [ ] Complete the full log review for 404/500 loops and stale branding.

### Exploratory audit

- [ ] Audit every sidebar route and Settings page with screenshots, console
      output, failing requests, and reproduction steps.
- [ ] Test all configured Hermes profiles separately.
- [ ] Test direct-key, OAuth, environment-backed, profile-backed,
      unauthenticated, and custom-provider states.
- [ ] Remove unsupported inherited UI instead of allowing repeated failures.

## Release closeout

- [ ] Fix every reproducible failure from remaining interactive testing.
- [ ] Repeat affected automated and live tests after each fix.
- [ ] Run the final source and packaged white-label grep from
      `WHITE-LABEL-AUDIT.md §6`.
- [ ] Record final test results and known limitations.
- [ ] Commit the implementation intentionally.
- [ ] Push the branch and update the draft PR.
- [ ] Mark release work complete only after the packaged interactive smoke test
      passes.
