# Master Log

## 2026-07-01

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
