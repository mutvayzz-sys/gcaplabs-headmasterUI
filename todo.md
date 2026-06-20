# Headmaster — Active TODO

Updated: **2026-06-20**

Current source version: **v0.1.8**

Completed work belongs in `CHANGELOG.md`. This file contains only remaining
implementation, validation, and release work.

## Current position

The Hermes-native adapter and packaged-renderer recovery are implemented. A
signed Windows portable build mounts successfully with a clean observed
startup console.

Release completion is blocked by interactive chat/profile bugs, unfinished
settings and support surfaces, full validation, installer packaging, and
publication.

## P0 — Release blockers

### Profile launch and chat crash

Evidence:
`C:\Users\Matve\AppData\Local\Temp\codex-clipboard-99cf4f0e-8441-4ff7-95d3-1e896b516075.png`

- [ ] Reproduce launching the `recruiter` Hermes profile from Specialists.
- [ ] Fix `Cannot read properties of undefined (reading 'model')`.
- [ ] Identify the profile/session/model mapper returning `undefined`.
- [ ] Add regression coverage for non-default profile provider/model metadata.
- [ ] Prevent a single conversation failure from replacing every route with
      the global error boundary.
- [ ] Add conversation- or route-level recovery.
- [ ] Make **Try again** restore the failed route without leaving Chat
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
- [ ] Verify stored-session → live-session mapping for profile chats.
- [ ] Confirm `message.userCreated` reaches active conversation state.
- [ ] Confirm `prompt.submit` uses the resumed live session ID.
- [ ] Confirm streamed events map back to the stored conversation ID in order.
- [ ] Add timeout/error recovery instead of indefinite processing.
- [ ] Add a regression test covering resume → follow-up → stream → persistence.

### Skills tab fails to fetch

- [ ] Capture the exact failing request, status, and response shape.
- [ ] Route the page to real Hermes `GET /api/skills`.
- [ ] Remove or adapt inherited skill CRUD routes Hermes does not expose.
- [ ] Add a useful non-looping empty/error state.
- [ ] Use one normalized skill catalog across Settings, Specialists, and New
      Mission.

## P1 — Models and Specialists

### Model catalog and authentication state

- [ ] Determine why Models & Providers shows zero API keys for providers Hermes
      already uses.
- [ ] Distinguish model availability, provider authentication, direct API-key
      storage, OAuth, environment credentials, and profile configuration.
- [ ] Stop describing OAuth/environment/profile-backed authentication as
      “0 API keys”.
- [ ] Hide providers/models without usable authentication.
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

- [ ] Remove the inherited AionUI Channels section.
- [ ] Build Channels from the real Hermes gateway catalog and status.
- [ ] Use each channel’s real icon and connection state.
- [ ] Make Channels its own settings sidebar tab in the Tools group.
- [ ] Move Remote / Headmaster on the Go / Web UI under Channels.
- [ ] Move MCP and Webhooks under Integrations.
- [ ] Keep Tools shallow rather than nesting another tab container.
- [ ] Rehome remaining Advanced/Capabilities content where appropriate.
- [ ] Update routes, deep links, extension anchors, i18n, and tests.

## P1 — Updates

- [ ] Audit `mutvayzz-sys/gcaplabs-headmasterhub` for private material.
- [ ] Make the Headmaster Hub repository public after explicit approval.
- [ ] Use Headmaster Hub or the GCAP Labs release endpoint as the public
      Headmaster Desktop version source.
- [ ] Keep a persistent sidebar indicator for Headmaster Desktop updates.
- [ ] Show Hermes runtime updates at most once on the first launch each day.
- [ ] Add daily dismissal/acknowledgement state for Hermes update notices.
- [ ] Remove the persistent Hermes update badge.
- [ ] Remove the current runtime restart button from the Hermes status/update
      indicator.
- [ ] Put restart/install actions on the Headmaster Desktop update UI.
- [ ] Clearly distinguish Desktop and runtime updates.
- [ ] Verify About → Check for updates works without a private GitHub token.

## P1 — About, help, and support

- [ ] Create and publish Headmaster documentation through Headmaster Hub.
- [ ] Wire **Help Documentation** to the published docs.
- [ ] Make **Update Log** show Headmaster Desktop release notes and selected
      runtime changes.
- [ ] Wire **Report Issue** to a working feedback/issue flow.
- [ ] Make **Contact Me** open a modal with:
  - `admin@gcaplabs.com`
  - `+971 50 105 2900`
  - a Discord link after its destination is specified.
- [ ] Make **Official Website** open `https://gcaplabs.com`.
- [ ] Make all About actions keyboard accessible with visible failure feedback.

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
