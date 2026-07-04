# Master To-Do

Full historical detail (HermesHQ era, the Agent37 cutover, VPS infra build-out, per-phase
verification runs) has been moved to `masterlog.md` and is preserved in git history — this file
now only tracks what's genuinely still open, plus a launch/verify checklist for whatever changed
most recently. If you're looking for "why does X work this way," check `masterlog.md` first.

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

1. **Manual desktop E2E smoke** — login → provision/load existing Agent37 runtime → chat streams
   token-by-token via `/v1/responses` → file attach via `/v1/files/content` (agent can read it) →
   tool call started/completed/failed events render → cancel posts `/v1/responses/{id}/cancel` →
   session list/detail/rename/delete via `/v1/sessions` → STT UI clearly unavailable, never calls
   dead STT endpoints.
2. **iOS build verification** — code changes (SSE migration, commit `0105789`) are pushed; actually
   building/running requires a Mac, not yet done.
3. **NotebookLM / `gcaplabs-home` bundle refresh** — regenerate so stale `hermeshq.gcaplabs.com`
   URLs stop surfacing in docs; upload/audit if auth is available, otherwise leave `STATUS.md` with
   exact next commands.
4. **Optional cleanup**: delete the vendored `gcaplabs-headmasterUI/hermeshq/` tree once confirmed
   unreferenced by `electron-builder.yml`/build scripts. Not urgent, no functional impact either way.
5. **STT support** — keep `isSttAvailable()` false until a real runtime contract exists (`/api/stt`,
   `/api/stt/stream`, or Agent37-native). Add endpoint-specific tests before enabling UI calls.
6. **HermesHQ VPS teardown** — owner-owned, manual, deliberately not automated/tracked here.

### ✅ No longer open (confirmed via `masterlog.md`, remove if you see this repeated elsewhere)

- Interactive mid-turn prompt rewire (`respondToPendingRequest`) — **done**, 2026-07-03
  (`masterlog.md`), with unit test coverage. Do not re-open this as a todo.
- The `gcaplabs-console` beta-approval gating fix — **done, committed, pushed, deployed**, and a
  second deeper bug in the same code path was found and fixed 2026-07-04. Stop treating this as
  "uncommitted" in any older note you find.

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
