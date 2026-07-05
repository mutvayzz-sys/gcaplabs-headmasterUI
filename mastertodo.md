# Master To-Do

Full historical detail (HermesHQ era, the Agent37 cutover, VPS infra build-out, per-phase
verification runs) has been moved to `masterlog.md` and is preserved in git history — this file
now only tracks what's genuinely still open, plus a launch/verify checklist for whatever changed
most recently. If you're looking for "why does X work this way," check `masterlog.md` first.

## ✅ Done 2026-07-05 — Kanban review batch: desktop duplicate-send, remote-mode gates, console CORS/OAuth

This is the closeout batch from the artifact-derived Kanban workflow. The review-required cards were
kept in the review queue until owner direction; iOS and manual desktop smoke were moved to hold.

**Desktop / `gcaplabs-headmasterUI`:**
- Fixed the web-created/desktop-resumed chat bug where one send could be replayed several times and
  end in "chat response failed." `submitResponseAndStream()` now preserves the runtime response id
  from nested Agent37 SSE envelopes and reattaches with `GET /v1/responses/{id}/stream` instead of
  issuing a second `POST /v1/responses` after a dropped stream. Focused tests cover the no-duplicate-
  POST path.
- Gated legacy desktop-local `/api/*` calls in Agent37 remote mode so Skills/MCP/providers/cron/
  assistant/local-dashboard surfaces no longer spam the remote Console with unsupported requests.
- Fixed the latest localhost CORS spam: `probeRemoteHealth()` no longer sends
  `X-Hermes-Session-Key` on `/v1/health` because health checks are not conversation/memory scoped.
- Added/updated focused tests for SSE parsing, no duplicate POST on stream recovery, cloud-mode route
  gating, integrations cloud-mode behavior, and same-tick duplicate send prevention.
- Added `docs/e2e/SMOKE-CHECKLIST.md`, `hermeshq-removal-audit.md`, and the desktop UI polish plan
  at `.hermes/plans/2026-07-06_051900-headmaster-desktop-ui-polish.md`.

**Console / `gcaplabs-console`:**
- Added CORS handling on `/api/v1/[...path]` for desktop-dev origins and the custom runtime headers
  (`Authorization`, `Content-Type`, `X-Hermes-Session-Key`, `X-Hermes-Session-Token`). Pushed to
  `gcaplabs-console/main` as `33a879f`; Vercel auto-deployed and live OPTIONS preflight now returns
  the expected `Access-Control-Allow-*` headers.
- Kept the logout/Gmail OAuth regression fixes and focused scripts from the Console review lane.
- Final branding cleanup review accepted: remaining `agent37` strings are intentional legacy SQL
  identifiers in a forward migration; no user-facing `Hermes` copy remains in active Console UI.
- Runtime provisioning/admin docs and launch checklist are now in-repo.

**Verification before push:**
- `gcaplabs-headmasterUI`: `bunx vitest run tests/unit/common-adapter/httpBridge.test.ts --reporter=dot`
  → 32 passed; `bunx tsc --noEmit` → clean.
- `gcaplabs-console`: `npm run typecheck` → clean; `npm run build` → clean Next production build;
  live production `OPTIONS https://www.console.gcaplabs.com/api/v1/health` from
  `Origin: http://localhost:5173` returns `Access-Control-Allow-Headers` with
  `X-Hermes-Session-Key`.

**Kanban state after routing:**
- Review-required implementation cards are closed/marked done as part of this push batch.
- iOS auth/build work is **on hold** until Mac/Xcode verification logs exist.
- Manual desktop smoke is **on hold** until a human login / approved saved-login smoke session is
  available.

## ✅ Done 2026-07-05 — gcaplabs-console re-themed to the new palette (retires green/gold/parchment)

**Owner explicitly asked to retire the old brand-token system, not just document it as
deprecated** — implemented in `gcaplabs-console`, verified via typecheck + production build +
a real rendered screenshot (not just "should work").

**Changes:**
- `src/app/layout.tsx` — loads real webfonts via `next/font/google` for the first time (Space
  Grotesk for display, Inter for body); neither was actually being loaded before, both were just
  named in CSS and silently falling back to system fonts.
- `src/app/globals.css` — full token replacement. Light: white `#ffffff` bg, ink `#0d0f14`,
  primary blue `#2563ff`, accent purple `#7c3aed`, destructive `#e11d48`. Dark: bg `#0d0f14`,
  card `#15181f`, same blue primary, lighter purple accent `#9b6bff` for contrast. Added two new
  token groups not in the old system: `--gradient-brand` (blue→purple→pink→orange, for future
  primary-CTA/progress-bar use) and `--pill-{priority,processing,connected,warning}` (+ `-soft`
  tint pairs) for status-pill components, sourced from owner-supplied UI reference mockups (see
  below). Old `gcap-brand-tokens.*` files in `docs/theming/` left on disk as historical reference,
  clearly marked superseded — not deleted, since they're still valid historical documentation of
  what shipped before.
- `src/config/branding.ts` — theme object updated to match (reshaped: dropped `primaryHover`/
  `gold`, added `accent`/`pillPriority`/`pillWarning`).

**Verification:** `npm run typecheck` clean, `npm run build` clean (full route manifest built
with no errors), then actually rendered `/login` in a browser against a fresh production server
(a pre-existing stale dev server on the expected port had an unrelated broken import from before
today — left it alone, didn't kill the owner's session, verified via a separate `next start` on
a scratch port instead). Screenshot confirmed: white background, Space Grotesk heading actually
rendering (not falling back), blue `#2563ff` primary button.

**Not done in this pass (scope was explicitly "the tokens," not a full redesign):** no component
actually uses `--gradient-brand` or the pill tokens yet — buttons, badges, the sidebar, and the
composer are all still plain shadcn defaults just re-colored. Owner supplied several UI reference
mockups (2026-07-05) of the actual target look for the **Headmaster Desktop app** specifically
(chat sidebar, gradient CTAs, pill status badges, blurred-glow hero) — confirmed by the owner as
"pull out the colors/branding/design/artistic direction" for general use, not a literal console
redesign brief. Full description saved in the `gcap-brand-logo-decision` memory. Next real step
if this continues: apply `--gradient-brand`/pill tokens to actual console components, and
separately scope a real Headmaster Desktop UI pass against the reference mockups.

## ✅ Done 2026-07-05 — Logo decision confirmed with full spec sheets; docs-mintlify removed

**Logos are now decided with exact specs**, not just picked images — see
`gcap-labs/brand-logos/{gcaplabs,headmaster}-logo-specsheet.png` (added today) and the
`gcap-brand-logo-decision` memory for the full writeup. Two marks:
- **GCAP Labs (company)** — folded/origami "G" glyph on black, "GCAP LABS" wordmark, tagline
  "Intelligence. Engineered.", Inter Medium/SemiBold.
- **Headmaster (product)** — hexagonal node/circuit glyph, "HEADMASTERUI" wordmark, tagline
  "AI Interface", Space Grotesk Medium/SemiBold. Exact hex palette: black `#0D0F14`, blue
  `#2563FF`, purple `#7C3AED`, pink `#FF2D8F`, orange `#FFB020`, grey `#E5E7EB`. The sheet also
  specs buttons/status-cards/pills — a fuller product-UI direction, not just a logo mark.

**This supersedes the green `#1a4d2e`/gold `#c9a96e`/parchment `#f4f1ea` token system** in
`docs/theming/gcap-brand-tokens.json` (already applied in `gcaplabs-console`) — that system is
now dead, not a fallback. Rebrand work across headmasterUI (app icon, banner, theme thumbnails,
mascot), `gcaplabs-docs` (wordmark, `docs.json` theme), and `gcaplabs-site` (logo, imagery) can
now proceed against a real, hex-confirmed target instead of being blocked on "no logo chosen."
Not yet started: applying these hexes anywhere in code/assets.

**Also removed `gcap-labs/docs-mintlify/`** — a stale, superseded duplicate of `gcaplabs-docs/`
(dated 2026-06-23 vs. `gcaplabs-docs`'s 2026-07-04/05 content); working tree was clean before
deletion.

## ✅ Done 2026-07-05 — Diagnosed + fixed "chats not loading" (100+ console errors)

**Symptom reported:** desktop app showed 100+ dev-console errors and chat history would not load at
all for `mutvayzz@gmail.com`.

**Root cause found (live, via CDP + production `vercel logs` + direct instance curl):** the
account's Agent37 runtime instance (`gcl8ku74ch`) was in a `container_unreachable` state — the VM was
up but the agent process inside wasn't answering its port (per the Agent37 errors doc, this is
distinct from `container_unavailable` (stopped) and `instance_suspended` (billing)). Every
`/api/v1/health` and `/api/v1/sessions/:id` call the desktop polls proxied through
`gcaplabs-console`'s `/api/v1/[...path]` route correctly, and correctly got back a real upstream 502
— the proxy code itself was not the bug.

**Fix:** `POST https://api.agent37.com/v1/instances/gcl8ku74ch/restart` (owner-approved, run directly
against production). Confirmed fixed immediately after: `GET /v1/health` on the instance →
`{"ok":true,"agent":"hermes","healthy":true}`; `GET /api/v1/sessions/1440202f` through the real
console proxy → `200` with the session's history. Desktop reload picked it up cleanly.

**Follow-up audit — which of the ~15 other failing endpoints are real vs. noise:** every non-`/v1`
call the desktop was also firing (`/api/agents`, `/api/skills`, `/api/providers`, `/api/mcp/servers`,
`/api/model/options`, `/api/google/*`, `/api/assistants`, `/api/conversations/:id/{artifacts,
confirmations,mode,slash-commands}`, `/api/cron/jobs`, `/api/extensions/acp-adapters`) 404s against
`console.gcaplabs.com`, because none of those routes exist there — only `/api/v1/*` (the Agent37
proxy) and the `/api/chat/*` / `/api/desktop/*` BFF routes are implemented. Breakdown:
- **Providers/model list is already migrated** — `useModelProviderList.ts` reads
  `window.__agent37Provision.providers` (shipped directly in the provision response via
  `groupModelsByProvider` in `gcaplabs-console`'s `provision/current/route.ts`) as the primary
  source; the failing `/api/providers` HTTP call is a vestigial local-Hermes-dashboard fallback that
  fires unconditionally (a `useSWR` hook with no remote-mode guard) even though it's never needed in
  remote mode. Cosmetic only.
- **Everything else is a real, unbuilt feature gap in remote/cloud mode**, not leftover cruft with a
  replacement: Skills Hub, MCP server management, the local multi-agent/assistant roster, cron
  Scheduled Tasks, Google Auth model provider, ACP tool adapters, and the conversation
  artifacts/confirmations/mode/slash-commands side panels all have zero cloud-side implementation —
  confirmed by `httpBridge.ts`'s own deprecation comment on `submitRemoteInteractive` ("Agent37's
  gateway has no such event in its eight-event stream contract"). These fail closed (empty
  lists/panels) rather than crash, so the app still works, just silently missing those features while
  logging errors.

**Not yet fixed / new open items from this pass:** see "🔧 Open items" below —
(1) gate the dead local-Hermes-dashboard calls behind `isRemoteContainerMode()` so they stop firing
and logging noise in remote mode, and (2) a live repro of a chat-send failure on a desktop-opened,
web-created session (see bug report below).

**🐛 New bug — chat send retried 5x and failed, on a session originally created on web:** owner
opened an existing conversation in the desktop app that had been started from the web console, sent
one message, and observed it get sent 5 times with a final "chat response failed" error surfaced in
the UI. Not yet root-caused. Suspect area: `submitResponseAndStream`'s
`RESPONSE_STREAM_RECOVERY_ATTEMPTS` reconnect/replay loop in `httpBridge.ts` (retries up to 8x on a
dropped SSE stream before giving up) firing repeat `POST /v1/responses` calls instead of only
replaying the existing stream — needs to be confirmed against actual request logs for that session,
and checked specifically for the cross-origin (web-created, desktop-resumed) session case, since that
path exercises `session_namespace`/`session_id` reconciliation that a desktop-native session never
would. Add to verification checklist below once repro'd.

## ✅ Done 2026-07-04 — Desktop upstream parity + sidecar/warning audit

**Current status:** `gcaplabs-headmasterUI/main` has the upstream parity/performance pass committed
and pushed, and the follow-up sidecar/warning audit is in progress in the working tree pending final
commit. The app is buildable and the full unit/integration suite is green.

**Sidecar root issue:** fixed beyond the original failing test.

- `tests/unit/bootstrap/buildWithBuilder.test.ts` no longer accidentally exercises real GCAPCore
  packaging/spawn while testing builder argument parsing.
- `gcapcoreBinaryResolver.ts` now treats packaged production differently from dev staging:
  packaged builds only resolve `bundled-gcapcore`, while dev staging can still accept the legacy
  `bundled-aioncore` layout used by upstream artifact prep. This prevents stale legacy sidecars from
  being selected in a packaged app if both directories happen to exist.
- New resolver tests cover packaged-vs-dev behavior.

**Verification so far:**

- `bun run test` → 184 files passed, 1 skipped; 1356 tests passed, 3 skipped.
- `bunx tsc --noEmit` → clean.
- `CI=1 bunx electron-vite build --config packages/desktop/electron.vite.config.ts` → clean build;
  only existing chunk-size warnings remain.
- `bun run lint` → exits 0 after scoping lint to active desktop code paths (`packages tests scripts`)
  rather than unrelated root folders. No special `hermeshq/` ignore is present.

**Warnings cleaned:**

- React `act(...)` warnings: 17 → 0.
- Missing `react-i18next` test setup warnings: 3 → 0.
- Virtualized session key warning: 1 → 0.
- Feedback modal `NaN` CSS height warning: 1 → 0 by mocking Arco TextArea autosize in the content test.
- Lint errors: 2 active desktop errors → 0.

**Still open / warning debt:**

1. React 19 `element.ref` warnings remain from Arco internals/tests (dependency compatibility noise,
   not app logic).
2. Node `DEP0040 punycode` warnings remain from dependencies.
3. Lint still reports warning-level debt (`any` in tests, E2E polling `await` loops,
   `preserve-caught-error`, minor shadow/unused import warnings). It does not block.
4. Commit and push the current audit cleanup after final verification.

## ✅ Done 2026-07-04 — Console apex→www canonicalisation (fixes desktop 401 loop)

**Symptom:** desktop logs show
`POST /api/auth/login → 200 accessToken=len=926` immediately followed by
`GET /api/desktop/provision/current → 401 "Sign in required"` even with valid credentials.

**Root cause:** the bare Console apex (`console.gcaplabs.com`) 308s every path to
`www.console.gcaplabs.com` at the Vercel edge. Node's `fetch` follows the 308 but drops the
`Authorization` header on the cross-host POST follow-up, so the very next call lands on
`www.` without a bearer and 401s. The 308 can't be removed on the Vercel Hobby plan
(`vercel redirects` is paywalled and the apex domain is a per-project setting in the
dashboard), so we canonicalise at both ends instead.

**Changes shipped:**

- Desktop (`gcaplabs-headmasterUI`): `normalizeBaseUrl()` in `agent37ProvisionService.ts`
  now rewrites `agent37.gcaplabs.com` and the bare `console.gcaplabs.com` apex to
  `www.console.gcaplabs.com`. Mirrored in `oauthBridge.ts`, `AuthContext.tsx`
  (`CONSOLE_URL` default + `resolveDesktopServerUrl`), and the CORS allowlist in
  `index.ts`. Two new unit tests in `agent37ProvisionService.test.ts` lock the
  behaviour in. Typecheck clean, provision tests pass (6/6 in that file).
- Console (`gcaplabs-console`): updated `NEXT_PUBLIC_SITE_URL` to
  `https://www.console.gcaplabs.com` on Vercel production via `vercel env update`.
  Added `https://www.console.gcaplabs.com/**` and the `/auth/callback` variant to the
  Supabase `uri_allow_list` and set `site_url` to the `www.` host (via the Management
  API). `publicSiteOrigin()` in `src/lib/site-url.ts` now canonicalises a stale apex
  env value to `www.` so the server never hands the apex back to a client. `.env.example`
  updated to point at `www.` with a comment explaining why.
- Vercel: `NEXT_PUBLIC_SITE_URL` (production) changed to `https://www.console.gcaplabs.com`.
  Supabase (project `phviwwzbwyqmeutoxywh` / `gcaplabs`): `site_url` + `uri_allow_list`
  updated to canonicalise on `www.`.

**Verify once shipped:**

1. `vercel env ls production` — `NEXT_PUBLIC_SITE_URL=https://www.console.gcaplabs.com`.
2. `GET https://api.supabase.com/v1/projects/phviwwzbwyqmeutoxywh/config/auth` (with
   `SUPABASE_ACCESS_TOKEN`) — `site_url` is `https://www.console.gcaplabs.com`,
   `uri_allow_list` contains both `https://console.gcaplabs.com/**` (legacy) and
   `https://www.console.gcaplabs.com/**` + `/auth/callback`.
3. Relaunch the desktop, log in — the `[agent37Provision] GET` line should show
   `https://www.console.gcaplabs.com/...` and a 200, not a 401.

**If the Vercel 308 ever needs to be removed** (cleaner long-term fix): requires
removing the apex→www domain redirect in the Vercel dashboard for project
`gcap-console` and adding `console.gcaplabs.com` as a domain that points to the
deployment. Not paywalled, but only do it after we have a way to make the legacy
apex client code path stop 308ing.

## 🚀 Ready to launch & verify — 2026-07-04 (gcaplabs-console admin/org/security pass)

See `masterlog.md` → "2026-07-04" for the full write-up. Everything below is live on
`console.gcaplabs.com` and `www.gcaplabs.com`. Suggested check order:

1. **Log in as `admin@gcaplabs.com`** (site admin). Confirm the left nav shows: Agent, Account
   (everyone), then an "Admin" section: Users, Organizations, Messages, Announcements, Health,
   Config.
2. **`/dashboard/admin/users`** — search/pagination work; click into a user for the detail page;
   confirm the new **Runtime control** panel shows Start/Stop/Restart/Re-pull image/Rename/Delete,
   the budget cap, and "Dashboard/Terminal/Files" buttons that open the real Agent37 instance.
3. **`/dashboard/admin/organizations`** — create a test org, click into it, generate an invite
   link, confirm it opens `/invite-org/{token}` and accepting it sets `organization_id`/`org_role`.
4. **`/dashboard/org`** as an org admin — confirm you only see your own org's members, and can't
   see/affect other orgs.
5. **Log in as `mutvayzz@gmail.com`** (currently `beta_approved=false`, has an org membership from
   testing) — confirm she sees **only** Agent + Account in the nav, and hitting her agent's chat
   page shows "pending approval," **not** the full chat/files/integrations view. This is the fixed
   security bug — worth double-checking directly since it was live-broken before today.
6. **`/dashboard/settings`** as any user — Profile tab (edit display name), Security tab (password
   change, MFA QR enroll, sign-out-other-devices, message-an-admin form all work).
7. **`/dashboard/admin/health`** — Supabase + Agent37 pings both show green/healthy, runtime status
   counts look right.
8. Confirm the regular user's own agent Settings tab (`/dashboard/agents/.../settings`) **no
   longer** shows Dashboard/Terminal/Files buttons — that's admin-only now.
9. **Desktop app**: launch it, log in with a real account, confirm it still provisions/loads the
   correct runtime and streams chat (nothing in the desktop app itself changed today, but it reads
   the same `profiles` table the security fix touched — worth a quick sanity check).

## 🔧 Open items (carried forward, still real)

1. **Manual desktop E2E smoke — ON HOLD** until a human login / approved saved-login smoke session
   is available. Checklist: login → provision/load existing Agent37 runtime → chat streams
   token-by-token via `/v1/responses` → file attach via `/v1/files/content` (agent can read it) →
   tool call started/completed/failed events render → cancel posts `/v1/responses/{id}/cancel` →
   session list/detail/rename/delete via `/v1/sessions` → STT UI clearly unavailable, never calls
   dead STT endpoints.
2. **iOS build verification — ON HOLD** until Mac/Xcode logs exist. Source/static checks passed in
   the Kanban lane, but canonical verification still needs `swift test --package-path
   scarf/Packages/HeadmasterIOS --filter Agent37ProvisionTests` and `xcodebuild -project
   scarf/scarf.xcodeproj -scheme "Headmaster iOS" -configuration Debug build` on a Mac.
3. **Console live launch/admin/security clickthrough** — code/typecheck/build evidence is good, but
   true browser verification still needs a live console URL/session with safe admin + pending-user
   credentials and a funded runtime.
4. **Real marketing screenshots** — fake screenshots have been replaced with truthful capture-plan
   placeholders; final real captures wait on a runnable Headmaster desktop session and sanitized
   logged-in product states.
5. **STT support** — keep `isSttAvailable()` false until a real runtime contract exists (`/api/stt`,
   `/api/stt/stream`, or Agent37-native). Add endpoint-specific tests before enabling UI calls.
6. **HermesHQ VPS teardown** — owner-owned, manual, deliberately not automated/tracked here.

### ✅ No longer open (confirmed via `masterlog.md`, remove if you see this repeated elsewhere)

- Interactive mid-turn prompt rewire (`respondToPendingRequest`) — **done**, 2026-07-03
  (`masterlog.md`), with unit test coverage. Do not re-open this as a todo.
- Web-created/desktop-resumed duplicate chat send / "chat response failed" — **fixed in the
  2026-07-05 Kanban push batch** with SSE response-id reattach tests.
- Remote-mode local-dashboard `/api/*` noise — **gated in the 2026-07-05 Kanban push batch**;
  cloud-mode unsupported local surfaces now fail closed without fetch spam.
- localhost CORS spam on `/api/v1/health` from `X-Hermes-Session-Key` — **fixed in the
  2026-07-05 Kanban push batch** on both desktop health probing and Console `/api/v1` CORS handling.
- The `gcaplabs-console` beta-approval gating fix — **done, committed, pushed, deployed**, and a
  second deeper bug in the same code path was found and fixed 2026-07-04. Stop treating this as
  "uncommitted" in any older note you find.
- Vendored `gcaplabs-headmasterUI/hermeshq/` cleanup — **done**, 2026-07-05. The tree was confirmed
  unused by workspaces, builder config, Vite config, build scripts, lockfiles, and active desktop
  source before deletion.

## 🧭 Roadmap (post-beta / parallel track — long-horizon, not urgent)

**Architecture direction (locked, 2026-07-02): remote-first thin client + HeadmasterCore.**
Client = thin, `/v1/responses` SSE only. Brain = remote Hermes container. HeadmasterCore = a local
daemon giving the remote brain hands on the user's machine (fs, shell/PTY, browser, Office) exposed
as MCP servers, built from the AionCore binary (`_support/upstream/aioncore`). Full rationale in
`masterlog.md` → 2026-07-02.

- [ ] Collapse desktop client to a single `/v1` transport; delete WS-RPC + local-bundled-Hermes path
      (WS already hard-disabled in remote mode; this is deleting the dead code, not fixing a bug).
- [ ] Fork/vendor AionCore → **HeadmasterCore**; rebrand everything (crates, binary, CLI, env, UI
      strings) — HeadmasterCore / HeadmasterMCP / Headmaster Office / Headmaster Council. No
      `AionUi`/`AionCore`/`aionui-*`/`officecli` strings may surface anywhere user-facing.
- [ ] Stand up HeadmasterCore: expose shell/file/office/team over HeadmasterMCP; add the outbound
      tunnel + forward-auth handshake so a remote container can reach it.
- [ ] Remote Hermes: register HeadmasterMCP tools per session, behind explicit user consent.
- [ ] Re-home (not re-add — these still exist in-tree, just assume local execution):
      **Preview panel** (mostly already works, source bytes from `/v1/files*`),
      **OfficeCLI** → re-home into the container image / HeadmasterCore as a Hermes tool,
      **Councils** → re-home so orchestration runs server-side or via HeadmasterCore MCP.

## Reference — how a user gets assigned their Agent37 runtime

Lazy, 1:1, self-service. All logic lives in `gcaplabs-console/src/lib/agent37.ts` —
`getCurrentAgent37Runtime()` — called by every `/api/desktop/provision*` hit (desktop + iOS both go
through this route) and by the web console's own agent page.

1. `requireUser()` verifies the caller's Supabase session. The `handle_new_user` trigger
   (`0001_init.sql`) guarantees a `profiles` row exists for every signed-up user.
2. **`profiles.beta_approved` is checked first, unconditionally** — if not `true`, throws
   `not_approved` regardless of whether a runtime already exists. (This is the 2026-07-04 fix —
   previously an already-provisioned user kept access even after revocation.)
3. Look up `profiles.agent37_id`:
   - **Set already** → `agent37.getAgent(agentId)`, sync live `status`/`name` back into the row.
   - **Null (first time)** → `agent37.createAgent({ template, user: user.id, name:
     "Gcaplabs-{email}", metadata: { supabase_user_id, email }, budget })`, upserts the returned
     `agent37_id`/`status`/`name`/`template` into `profiles`. Best-effort rollback
     (`agent37.deleteAgent`) if the Supabase write then fails.
4. Response hands the client `cloud_container_config: { container_id, forward_auth_token }`;
   desktop/iOS use that directly against `{instanceId}.agent37.app/v1/*` for chat/sessions/files.

`profiles.agent37_id` is the single source of truth for "which container belongs to which user."
`profiles.is_admin` (site-wide) and `profiles.org_role` (scoped to one org) are separate, unrelated
axes — see `masterlog.md` → 2026-07-04 for the full admin-model writeup.
