# Master Log

## 2026-07-01

### CI/CD: console CI + headmasterUI auto version-bump

- **gcap-console** had no CI — added `.github/workflows/ci.yml` (typecheck + `next build` on
  main push/PR, placeholder env so missing Supabase/HermesHQ env doesn't fail the build; Vercel
  still owns deploy). Commit `a4275ad`.
- **headmasterUI** — added `.github/workflows/version-bump.yml`: auto patch-bumps `package.json`
  (x.y.z) on every push to main, mirroring hermeshq's auto-bump (paths-ignore on package.json
  prevents the bot commit from looping). Commit `bc7ffe6`. Existing `build-and-release.yml`
  (build → artifacts → version tag → release on tags/dev) is unchanged and already complete.
- **hermeshq** already had it: `ci.yml` (pytest + frontend + docker build) + date-based
  `version-bump.yml` on main. No change needed.

### End-to-end flow test + desktop build (2 bugs fixed, 1 blocker found)

Ran a real provision→runtime flow on the VPS and built the desktop app.

**Flow test — routing/provision/auth WORK end-to-end.** `POST /api/desktop/provision`
(mode `headmaster_remote`, admin token) returns `hm-<id>.gcaplabs.com` + forward-auth token +
`kimi-coding` provider (`nous_api_key` null). Verified over the full public path
(DNS → Cloudflare → tunnel → Traefik → forward-auth → gateway):
`https://hm-a065eb11-fdb.gcaplabs.com/v1/health` → **HTTP 200**, no-auth → **401**, valid TLS.

**Two real bugs found & fixed in hermeshq (committed + deployed to VPS):**
1. **Multi-instance Traefik routing** (`container_supervisor.py`, commit `c50713b`): the
   supervisor appended a full `http:` block per instance into one dynamic file → duplicate
   top-level `http:` keys once 2+ instances existed → Traefik rejected the whole file → 404 for
   ALL instances. Fixed: write one `hm-<id>.yml` per instance into the watched dir (file provider
   merges them); removal deletes the file.
2. **Backend mounted a single FILE not the directory** (`docker-compose.yml` + `.env`, commit
   `41d6478`): per-instance route files written by the fix above landed in the container's
   throwaway fs. Fixed: mount the host dynamic **directory** → `/traefik`. VPS `.env`
   `RUNTIME_TRAEFIK_DYNAMIC_CONFIG_HOST_PATH=/home/m4/traefik/dynamic`, backend recreated.
   (Note: `ensure_user_runtime` reuses a container whose health passes, so forcing a fresh route
   write requires deleting the DB container record via `DELETE /api/containers/{id}`.)

**Remaining BLOCKER — Hermes worker doesn't start in the runtime image.** The Agent37 gateway
runs (node PID 1, serves `/v1/health` 200) but the Hermes Python worker never spawns (no python
process in the container; log: "Hermes backend failed to start — Hermes worker did not respond
within 10000ms"). So `/v1/models` → 502 and chat won't work until the worker boots. KIMI_* +
HERMES_DEFAULT_* env are all present in the container, so it's a runtime-image / worker-launch
issue (`headmaster-hermes-runtime:latest`), NOT routing/provision. Needs investigation of
`backend/runtime.Dockerfile` + how the gateway spawns hermes_worker.

**Desktop app built.** `node scripts/build-with-builder.js auto --win --dir` →
`out/win-unpacked/Headmaster.exe` (v0.2.4, native modules rebuilt + signed). Created
`C:\Users\Matve\Desktop\Headmaster.lnk` shortcut.

### Runtime domain decided + applied: hm-<id>.gcaplabs.com

Picked the per-instance runtime domain scheme (owner delegated the choice).

- **Decision:** instances at `https://hm-<id>.gcaplabs.com` (was temp `hm-<id>.run.gcaplabs.com`).
  Rationale: a single-level subdomain is covered by Cloudflare's **free universal `*.gcaplabs.com`
  cert**; the old second-level `run.gcaplabs.com` would have required paid Advanced Certificate
  Manager. Subdomain routing (not path-based) keeps the gateway's `/v1` URLs clean; the `hm-`
  prefix avoids collisions with console/hq/portainer.
- **Applied in repo:** `RUN_DOMAIN=gcaplabs.com` in `gcaplabs-hermeshq/.env.example` (commit
  `6d3b3c8`). The supervisor already builds `https://hm-{id[:12]}.{RUN_DOMAIN}`, so no code change.
- **Applied & verified live on the VPS (2026-07-01):**
  - VPS stack `/home/m4/headmaster-stack`: set `.env` `RUN_DOMAIN=gcaplabs.com` (backup
    `.env.bak-predomain`), `docker compose up -d --force-recreate backend` → healthy,
    `printenv RUN_DOMAIN`=`gcaplabs.com`.
  - Tunnel `71b69661-7312-47ba-a451-ee7957a08fc4`: added `*.gcaplabs.com → https://localhost:443`
    (noTLSVerify) to `/etc/cloudflared/config.yml` after the explicit hosts (backup
    `config.yml.bak-predomain`); `cloudflared ingress validate` OK; restarted cloudflared.
  - DNS: created wildcard `*.gcaplabs.com` CNAME → tunnel via
    `cloudflared tunnel route dns` using origin cert `/home/m4/.cloudflared/cert.pem`.
  - End-to-end verify: `https://hm-test123456.gcaplabs.com/v1/health` returns valid TLS
    (verify=0) + Traefik 404 (no instance provisioned = expected); `hq.gcaplabs.com` and
    `console.gcaplabs.com` both still 200 (explicit records override the wildcard — no regression).
  - Net: the free universal `*.gcaplabs.com` cert covers per-instance hosts; runtime routing is live.

### Console deployed to Vercel

- Deployed `gcap-console` to Vercel production (`vercel deploy --prod`) — build OK, `READY`,
  deploy `dpl_7SGvsMiqx6…`. Project `gcap-console` (`prj_d9OcX3q…`) was already linked with all
  6 env vars set (Supabase URL/anon/service-role, `HERMESHQ_URL`, `NEXT_PUBLIC_SITE_URL`, Sentry
  DSN). Live and correct on the `*.vercel.app` URL (302 → auth, as expected).
- **`console.gcaplabs.com` is LIVE on Vercel** (2026-07-01): owner replaced the dead tunnel
  record with `A → 76.76.21.21` (DNS-only) in Cloudflare; Vercel auto-issued the TLS cert.
  Verified: `https://console.gcaplabs.com/login` returns HTTP 200 with `Server: Vercel`
  (was 530 against the old tunnel). The new Next.js console front door is now serving on its domain.

### Console main replaced + domain corrections

- **gcap-console:** replaced `origin/main` (old Wasp) with the fresh Next.js starter-kit console
  (`e574d85`) via force-push — histories were unrelated, so this is a replace, not a merge. Per
  owner: the old Wasp code is not kept (no backup branch). Deleted the redundant `main-nextjs`.
  `mutvayzz-sys/gcaplabs-console` now has a single `main` = the new console.
- **Domain corrections (owner):** `*.run.gcaplabs.com` was a **temporary** placeholder, NOT the
  production runtime domain — dropped the `*.run` wildcard-TLS blocker; real per-instance domain
  is TBD (added as a Confirm item). Portainer's actual host is **`portainer.gcaplabs.com`**.
- **Resend:** `gcaplabs.com` domain is already set up/verified in Resend — email delivery is live
  (removed the "domain verification pending" item).

### Implementation review — Phases 3–7 (independent verification)

Reviewed the completed Phases 3–7 work across all repos against the trackers' "done" claims.
Verdict: the core implementation is **real and substantially matches the claims**, with a few
push/accuracy gaps corrected in `mastertodo.md`.

**Verified present & correct:**
- **hermeshq Phase 3** — `core/supabase_auth.py` does real asymmetric JWKS (RS256) verification
  with a 1h key cache (no shared secret). Kimi-code injection is real but lives in
  `routers/desktop_runtime.py` (builds `runtime_env` with `KIMI_API_KEY` + `HERMES_DEFAULT_
  PROVIDER/MODEL/BASE_URL/API_MODE`, sets legacy `nous_api_key=None`) — **not** in
  `container_supervisor.py` as the tracker wording implied; the supervisor just forwards
  `runtime_env`. `config.py` carries the kimi defaults. Health routes exist
  (`routers/containers.py` `/{id}/health`, `routers/dashboard.py` fleet health). Sentry init in
  `main.py`. `mint_admin_token.py` is at `backend/scripts/` (not the path the tracker named).
- **gcap-console (Phase 4)** — real Next.js 16 + Supabase app; `src/lib/hermeshq.ts` present.
  Pushed to `origin/main-nextjs`; old Wasp code still occupies `origin/main` (merge pending).
- **Desktop (Phase 7)** — brand tokens applied to `…/AppearanceSettings/presets/default.css`.
- **VPS scripts (H4/H5/H7)** — `docs/{create-instance,dashboard-url,terminal-url,reap-idle-instances}.sh` present.
- **iOS (Phase 5)** — `RunsAPIClient.swift` SSE migration present.

**Gaps found & corrected in the tracker:**
- **iOS commit `0105789` is NOT pushed** — local `main` is 1 ahead of `origin/main` (`1ca2b97`).
  The SSE migration exists only locally. Added a push item to Next/Pending.
- **hermeshq local checkout is 1 behind `origin/main`** (`a982fa1`, a version bump pushed from
  another machine) — all local work is already on GitHub; this Windows copy just needs a pull.
- Corrected the kimi-injection file location (desktop_runtime.py, not container_supervisor.py).
- Untracked `.hermes/plans/2026-07-01_140000-beta-readiness-phases-3-7.md` left uncommitted.

**Not independently re-verified this session (infra/runtime claims — trusted as reported by the
implementation pass):** VPS approve→provision→runtime smoke (`/v1/health` 200), idle-reaper cron,
`hq.gcaplabs.com` DNS repoint, Resend deliverability. These require live VPS/DNS checks; the
still-pending items (TLS wildcard, console Vercel deploy + DNS, Resend domain verification) remain
correctly listed under Next/Pending.

### Audit of Agent37 push + veeplan integration

Audited the prior Agent37-aligned pass and folded `veeplan.md` into the trackers.

**Push audit (verified against git, both repos clean & on `main` == `origin/main`):**
- `gcaplabs-hermeshq` @ `402b433` — Agent37 Gateway vendored (`third_party/agent37/gateway`),
  HMAC forward-auth (`docker/forward-auth/{Dockerfile,server.js}`), Traefik file-provider
  routes in `container_supervisor.py`, `docker-compose.yml` + `.env.example`, `runtime.Dockerfile`,
  `tests/test_containers_runtime.py`. Backend test result "14 passed, 1 skipped" is **as reported
  by the prior pass** (not re-run here).
- `gcaplabs-headmasterUI` @ `5efc80c` — desktop `/v1/responses` SSE + cancel/reconnect in
  `hermesChatAdapter.ts` / `httpBridge.ts`, provision snapshot fields in `connectionConfig.ts`,
  brand tokens in `docs/theming/`, new `veeplan.md`. Desktop "19 vitest passed" + typecheck
  is **as reported** (not re-run here).

**Integration changes (this entry's commit):**
- `mastertodo.md` reconciled with `veeplan.md`: Phase 0 spike marked deferred (not "todo"),
  Phase 3 VPS smoke gate surfaced, Phase 6 expanded into its five hardening sub-tracks,
  Phase 7 rollout expanded into the four brand-kit consumers, circular header reference removed.
- Removed superseded docs and their stale references: `todo.md`, `CHANGELOG.md` (tombstones
  already redirecting to the master files) and `revisedplan.md` (superseded by `veeplan.md`);
  fixed two `AGENTS.md` pointers that still named `todo.md` as the active backlog.
- `veeplan.md`: dropped all Wasp-migration framing — the `gcaplabs-console/` Wasp scaffold was
  never built, so the console (Phase 4) is built **fresh** on starter-kit + Supabase with
  nothing to migrate (removed the false "Console (Wasp)" pre-existing-work claim and the
  migrate-domain/records steps). `supabase/migrations/*` and the historical hermeshq→hq
  domain-migration item are unrelated and kept.
- **Billing decision:** beta is **free** — no Stripe / payment gate during beta. Access is gated
  by the HermesHQ approval pipeline + per-container resource caps; per-org Nous spend is
  visibility-only. Stripe is deferred to GA (post-beta). Updated Phase 6 + the Phase 4/6 gates.
- **Env audit (Mac mini `macmini` docker context):** the running HermesHQ stack
  (`hermeshq-backend/frontend/postgres/tunnel`) was launched from this machine's
  `gcaplabs-hermeshq/.env`. Already set: `JWT_SECRET`, admin creds, DB, CORS,
  `CONTAINER_HOST_URL=https://hq.gcaplabs.com`, runtime image + idle TTL. Empty/missing:
  all `OIDC_*` (OAuth), `OPEN_SIGNUP=false`, and no Supabase/Sentry/email vars. Note: this
  running stack is the **older proxy build** (`AUTH_MODE=local`, no Traefik/forward-auth env) —
  the pushed `402b433` routed stack is **not deployed on the Mac mini**; forward-auth/Traefik
  live on the VPS. Two environments.

### Beta config decisions locked + Hermes handoff

Collected the remaining beta secrets and locked the model/identity/billing decisions; folded
the non-secret config into `veeplan.md` + `mastertodo.md` and produced the Hermes handoff prompt.

- **Default model = kimi-code** (not Nous Portal): provider `kimi-coding`, model `kimi-k2.7-code`,
  `base_url https://api.kimi.com/coding`, `api_mode anthropic_messages`. `KIMI_API_KEY` replaces
  the legacy per-org `nous_api_key` injection in the per-user runtime.
- **Supabase new asymmetric-key system**: HermesHQ verifies user JWTs against the public JWKS
  (`SUPABASE_JWKS_URL`) — no shared `SUPABASE_JWT_SECRET`.
- **Beta is free** (no Stripe) — already recorded; cross-referenced here.
- **Secrets**: stored in the gitignored `vps.env` (Supabase URL/publishable/secret/JWKS,
  KIMI_API_KEY, Resend + `noreply@gcaplabs.com`, Sentry DSN (Electron; reused for console),
  Vercel token, Google OAuth client id/secret + discovery, `OPEN_SIGNUP=true`). `*.env` added to
  `.gitignore`; verified `vps.env` is untracked.
- **Cloudflare/DNS** managed by the owner directly — automation must not touch it.
- Hermes handoff prompt points at `gcaplabs-headmasterUI/vps.env` for all config.

## 2026-06-30

### VPS runtime host + Portainer/Cockpit

Deployed the VPS runtime foundation from GitHub pulls only:

- Pushed HermesHQ Agent37 runtime stack to `mutvayzz-sys/gcapslab-hermeshq`.
- VPS cloned `/home/m4/headmaster-stack` from GitHub over SSH.
- Built `headmaster-stack-headmaster-forward-auth` and started it on `127.0.0.1:18081`.
- Built `headmaster-hermes-runtime:latest` with Hermes Agent + Agent37 Gateway on `:3737`.
- Installed Portainer CE, initialized admin credentials at `/home/m4/portainer-admin.txt`, and attached the local Docker socket as `vps-local-docker`.
- Installed Cockpit and enabled `cockpit.socket`.
- Updated system Cloudflare tunnel ingress for runtime wildcard, Portainer, and HQ routes.
- Upgraded Traefik to `v3.5`, removed broken ACME/example.com config, and switched VPS runtime routing to Traefik file provider because Docker 29 rejects Traefik's Docker-provider API version.
- Added HermesHQ supervisor support for file-provider runtime routes via `RUNTIME_TRAEFIK_DYNAMIC_CONFIG_PATH`.

Verified:
- `headmaster-forward-auth` health: `ok`.
- Runtime image exists on VPS: `headmaster-hermes-runtime:latest`.
- Portainer reachable at `http://portainer.run.gcaplabs.com`.
- Portainer shows baseline: 2 stacks, 5 images, 2 volumes, 3 containers.
- Traefik now starts without Docker-provider errors.

Follow-up:
- `portainer.gcaplabs.com` was added to Cloudflare but local/router DNS may still cache NXDOMAIN; use `http://portainer.run.gcaplabs.com` until it settles.
- `hq.gcaplabs.com` has an existing DNS record that must be replaced/confirmed before HermesHQ frontend can be publicly routed through the tunnel.
- HTTPS for second-level wildcard names like `*.run.gcaplabs.com` needs Cloudflare cert coverage beyond the ordinary `*.gcaplabs.com` certificate.

### Agent37 `/v1` desktop + HermesHQ provision contract

Implemented the first Agent37-aligned runtime contract slice:

- Restored `.hermes/plans/2026-06-30_222130-headmaster-beta-readiness.md`.
- Added Agent37 source pins in `_support/upstream/agent37/VENDOR.md`.
- Added GCAP brand token source files under `docs/theming/`.
- Desktop remote runtime now prefers `/v1/responses` SSE, reconnects through `/v1/responses/{id}/stream`, and cancels through `/v1/responses/{id}/cancel`.
- Desktop provision storage now preserves `runtime.base_url`, `runtime.api_base_path`, health/version URLs, `forward_auth_token`, and token expiry.
- HermesHQ provision and container APIs now return `/v1` route metadata and forward-auth token fields.
- HermesHQ supervisor now starts runtime containers for Gateway on `:3737`, adds resource caps, and emits Traefik labels when `RUN_DOMAIN` is configured.
- Fixed desktop login TypeScript issues around OAuth bridge typing and `setTimeout` callback return annotations.

Verified:
- `bunx tsc --noEmit --pretty false`
- `bunx vitest run tests/unit/common/adapter/hermesChatAdapter.test.ts tests/unit/process/hermeshqProvisionService.test.ts`
- HermesHQ backend focused pytest: `tests/test_containers_runtime.py tests/test_desktop_runtime.py`

### veeplan.md + Hoster VPS kanban + SSH fix

**veeplan.md:** User dropped Agent37-aligned beta-readiness plan. Full implementation plan produced → `.hermes/plans/2026-06-30_222130-headmaster-beta-readiness.md` (Phases 0–7). 9 VPS infra cards queued on `hoster` profile.

**SSH fix:** Hermes SSH backend (`tools/environments/ssh.py`) always added `-o ControlMaster=auto`, which conflicts with `cloudflared access ssh` ProxyCommand on Windows. Patched `_build_ssh_command()` to detect ProxyCommand in `~/.ssh/config` and skip ControlMaster when detected. Also patched `cleanup()`.

**VPS setup:** Passwordless sudo for `m4` configured. `persistent_shell=false` in Hoster config. Existing CF tunnel routes `vps.gcaplabs.com` → SSH. Traefik will sit behind tunnel — CF terminates TLS, Traefik routes internally on :80.

**Files changed:**
- `veeplan.md` — progress section, plan link
- `.hermes/plans/2026-06-30_222130-headmaster-beta-readiness.md` — full plan (new)
- `~/AppData/Local/hermes/hermes-agent/tools/environments/ssh.py` — ControlMaster fix
- `~/AppData/Local/hermes/profiles/hoster/config.yaml` — persistent_shell: false

See top-level `masterlog.md` for the full session record.

## 2026-06-28

### Open Sign-Up + OAuth + Approval System

**Backend (gcaplabs-hermeshq):**

- Added `open_signup: bool = False` to `config.py`; set via `OPEN_SIGNUP` env var in `docker-compose.yml`
- Added `RegisterRequest` / `RegisterResponse` to `schemas/auth.py`
- Added `POST /api/auth/register` — public endpoint; creates users with `pending` role; disabled when `OPEN_SIGNUP=false`
- Blocked pending users from logging in via password (`POST /api/auth/login` returns 403)
- Blocked pending users from logging in via OAuth (callback returns redirect with error message)
- New OIDC users get `pending` role when `open_signup=True` (was `user`)
- Added `pending` to `ROLE_CAPABILITIES` in `desktop_runtime.py` with empty capabilities tuple
- Added `POST /api/users/{id}/approve` — sets role to `beta_user`
- Added `POST /api/users/{id}/approve-and-provision` — approves + starts Hermes container in one call
- Added `desktop: bool` param to `GET /api/auth/oidc/login` — tracks state in `_DESKTOP_OAUTH_STATES`
- Modified `oidc_callback` to redirect to `/desktop-oauth-success?token=JWT` for desktop OAuth flows
- Modified `_build_frontend_redirect` to accept `desktop=True` parameter

**Frontend (gcaplabs-hermeshq):**

- Added `register()` function to `frontend/src/api/auth.ts`
- Updated `buildOidcLoginUrl()` to accept optional `desktop` param
- Added `useApproveUser()` and `useApproveAndProvisionUser()` hooks to `frontend/src/api/users.ts`
- Created `frontend/src/pages/RegisterPage.tsx` — form + OAuth buttons, redirects to `/login` after success
- Created `frontend/src/pages/DesktopOAuthSuccessPage.tsx` — catches OAuth token from URL, shows success
- Added `/register` and `/desktop-oauth-success` routes to `frontend/src/App.tsx`
- Added `pending`, `beta_user`, `staff` options to role selector in `UsersPage.tsx`
- Added "Pending approval" action block in `UsersPage.tsx` with Approve + Approve+Provision buttons

**Desktop app (gcaplabs-headmasterui):**

- Created `process/bridge/oauthBridge.ts` — opens popup `BrowserWindow` for OAuth, intercepts `/desktop-oauth-success?token=` navigation, returns JWT to renderer
- Registered `initOAuthBridge()` in `process/bridge/index.ts`
- Exposed `triggerOAuthLogin(provider)` in `preload/main.ts`
- Added `loginWithOAuthToken(token)` and `register(params)` to `AuthContext.tsx`
- Rewrote `renderer/pages/login/index.tsx` — added Google/Microsoft OAuth buttons, sign-up/sign-in toggle, register form
- Added CSS for OAuth buttons, divider, and mode-toggle link to `LoginPage.css`
- Replaced "Headmaster" in sidebar with "Hello, {username}" + logout button (`Layout.tsx`)

---

## 2026-07-01

### Phases 3–7 + VPS infra — beta readiness push

**Goal:** finish the control plane, update the console, migrate iOS, harden for beta, roll out brand tokens, wire remaining VPS scripts.

**Repos touched:** `gcaplabs-hermeshq`, `gcaplabs-console`, `gcaplabs-ios`, `gcaplabs-headmasterUI`, `gcaplabs-site`.

**Phase 3 — Control plane (gcaplabs-hermeshq):**
- Created `backend/hermeshq/core/supabase_auth.py` — RS256 JWT verification via public JWKS, 1h cache, user lookup by email
- Created `backend/hermeshq/core/combined_auth.py` — try Supabase first, fall back to local HS256
- Wired combined auth into `/api/desktop/provision`, `/api/desktop/provision/current`, `/api/desktop/runtime/validate`
- Added `target_user_id` to `DesktopProvisionRequest` (admin-only) so the console can provision on behalf of its users
- Replaced legacy `nous_api_key` injection with kimi-code: `KIMI_API_KEY` + `HERMES_DEFAULT_PROVIDER/MODEL/BASE_URL/API_MODE` injected into per-user container env
- Added kimi + Supabase JWKS + Resend + Sentry env vars to `docker-compose.yml`; added `console.gcaplabs.com` to CORS
- Changed default user mode to `headmaster_remote` for beta
- Fixed migration bug: `c1d2e3f4a5b6` was trying to ALTER `containers` table before it existed in fresh DBs
- Marked `hermes_runtime` network as `external: true` in compose
- Created `backend/scripts/mint_admin_token.py` for service-to-service JWT minting
- Added optional Sentry init to `backend/hermeshq/main.py`
- 4 Supabase auth tests + 11 desktop runtime tests pass

**Phase 3 deploy + smoke (VPS):**
- Pushed code, pulled on VPS at `/home/m4/headmaster-stack/`
- Repointed `hq.gcaplabs.com` from Mac mini tunnel to VPS tunnel via `cloudflared tunnel route dns -f 71b69661-... hq.gcaplabs.com`
- Added all new env vars to VPS `.env` from `gcaplabs-headmasterUI/vps.env` (KIMI_API_KEY, SUPABASE_JWKS_URL, RESEND_API_KEY, FROM_EMAIL, SENTRY_DSN, OPEN_SIGNUP=true, OIDC_*)
- `https://hq.gcaplabs.com/api/health` → 200, version `2026.6.30.10`
- Smoke: registered `beta-test` user, approved via admin, provisioned — `runtime.base_url=https://hm-31b0452a-321.run.gcaplabs.com`, `cloud_container_config.forward_auth_token` present, container started with kimi-code env vars, direct Docker-network `/v1/health` returns `{"ok":true,"agent":"hermes","healthy":true}`

**Phase 4 — Console (gcaplabs-console):**
- Rewrote `app/src/user/dashboard/runsApiClient.ts` to use `/v1/responses` SSE instead of `/v1/runs` + `/v1/runs/{id}/events`
- Updated `DashboardChatPage.tsx` to use new client + `forwardAuthToken` field name
- Rewrote `app/src/user/chatOperations.ts` to call HermesHQ provision API via `HERMESHQ_ADMIN_TOKEN` + `target_user_id`
- Added `HERMESHQ_URL` + `HERMESHQ_ADMIN_TOKEN` to `app/.env.server.example`
- Minted 1-year admin JWT, written to `app/.env.server` (gitignored)
- Rebranded user-facing strings: "Hermes instance" → "Headmaster instance", `assignedInstanceName` → "Headmaster", `main.wasp` title → "Headmaster Console"
- Updated dbSeeds URL pattern from `.hermes.gcaplabs.com` to `.run.gcaplabs.com`

**Phase 5 — iOS (gcaplabs-ios):**
- Rewrote `scarf/Packages/HeadmasterIOS/Sources/HeadmasterIOS/RunsAPIClient.swift` to POST `/v1/responses` with `stream: true` and parse the SSE stream directly (no separate events endpoint)
- Event mapping: `response.created` / `response.output_text.delta` / `response.reasoning.delta` / `response.tool_call.started|completed|failed` / `response.approval_requested` / `response.completed` / `response.failed`
- Updated `CloudContainerConfig` (HeadmasterCore) to use `forwardAuthToken` instead of `apiServerKey`
- Updated `CloudContainerTransport.swift` — baked config switched from `nous-api / Hermes-3-Llama-3.1-70B` to `kimi-coding / kimi-k2.7-code / anthropic_messages`
- Updated `HermesHQAuthService.swift` provision response model to include `forward_auth_token` + `forward_auth_expires_at`
- Updated `HermesHQLoginViewModel.swift` to prefer `forward_auth_token` over legacy `api_server_key`
- Updated `HeadmasterIOSApp.swift` + `ChatView.swift` to pass `forwardAuthToken`
- Build verification requires Mac (no Xcode on Windows)

**Phase 6 — Beta hardening:**
- Resend email: `RESEND_API_KEY` + `FROM_EMAIL=noreply@gcaplabs.com` configured. Password reset endpoint tested (sends to Resend, needs `gcaplabs.com` domain verified in Resend dashboard for actual delivery)
- Container health: `/api/dashboard/health` and `/api/containers/{id}/health` already exist
- Sentry: optional init added to HermesHQ backend; desktop already had it
- Security: `no-new-privileges` confirmed in `container_supervisor.py:234`; verified no KIMI/NOUS secrets baked in `headmaster-hermes-runtime` image env
- Idle reaper: `docs/reap-idle-instances.sh` deployed to `/opt/headmaster/scripts/`, cron at `/etc/cron.d/headmaster-reaper` runs every 10 min, TTL 3600s

**Phase 7 — Brand tokens:**
- Desktop: `packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/default.css` updated with GCAP tokens — Headmaster green `#1a4d2e` primary, parchment cream `#faf7f2` backgrounds, brand color aligned. Typecheck clean.
- Marketing site: already aligned (Headmaster green + parchment in `gcaplabs-site/tailwind.config.js` + `app/globals.css`)
- Console: user-facing strings rebranded; visual theme not changed (Wasp defaults)
- HermesHQ admin dashboard: deferred (operator tool, not user-facing surface; white-label rules apply to user-facing only)

**VPS infra (Hoster):**
- H4: `docs/create-instance.sh` deployed to `/opt/headmaster/scripts/` — manual-ops wrapper for per-user container provisioning (Traefik labels + resource caps + no-new-privileges)
- H5: `docs/dashboard-url.sh` + `docs/terminal-url.sh` deployed — print public URLs for a container ID
- H7: idle reaper cron installed (see Phase 6)

**Blockers / known issues:**
- `*.run.gcaplabs.com` TLS: Cloudflare SaaS cert doesn't cover second-level wildcards. Container reachable via Docker network, but browser HTTPS for per-user routes doesn't work yet. Temporary per the owner.
- Console deploy: existing `gcaplabs-console` is a Wasp app, not Vercel-compatible. Code changes are committed; deploy step blocked on owner deciding console replacement.
- Resend `gcaplabs.com` domain needs verification in Resend dashboard.
- iOS build verification needs a Mac.
