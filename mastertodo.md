# Master To-Do

## veeplan.md (Agent37-aligned, 2026-06-30)

The beta roadmap is `veeplan.md` (Phases 0–7) +
`.hermes/plans/2026-06-30_222130-headmaster-beta-readiness.md` (bite-sized task breakdown).
This file is the single source of truth for per-phase status and outstanding work.

### VPS Infrastructure (Hoster kanban — running)

- [x] H1: Docker + Compose + dirs — VPS ready
- [x] H2: Traefik :443 + wildcard cert — Traefik v3.5 behind Cloudflare tunnel, file-provider routing
- [x] H3: forward-auth HMAC — `headmaster-forward-auth` running on `127.0.0.1:18081`
- [x] H6: per-user agent image — `headmaster-hermes-runtime:latest` built on VPS
- [x] H8: Traefik access logs — enabled
- [x] H9: Portainer CE — running, local Docker environment attached
- [x] H10: Cockpit — installed and `cockpit.socket` active
- [ ] H4: create-instance.sh — _todo (blocked H1+H2+H3)_
- [ ] H5: dashboard/terminal URL helpers — _todo (blocked H4)_
- [ ] H7: idle reaper — _todo (blocked H4)_

### Code Phases

- [x] Phase 0: restore bite-sized plan + pin Agent37 refs in `_support/upstream/agent37/VENDOR.md`
- [~] Phase 0: local Agent37 gateway spike against Hermes — **intentionally deferred** (not run against local Hermes, per instruction); revisit if container `/v1` contract needs local repro
- [x] Phase 1: gateway in per-user container (:3737)
- [x] Phase 2: host-kit Traefik + forward-auth + caps
- [x] Phase 3: HermesHQ provision response includes `/v1` runtime route, health/version URLs, forward-auth token fields
- [ ] Phase 3: Supabase JWT trust for console-originated provision calls
- [ ] Phase 3: full approve→provision→runtime smoke on VPS (gate — see Broken/Follow-Up below)
- [ ] Phase 4: new console = starter-kit (Next.js + Supabase, Vercel) — _not started_
- [x] Phase 5: desktop remote runtime chat uses `/v1/responses` SSE + cancel/reconnect path
- [ ] Phase 5: iOS → `/v1/responses` SSE — _not started_
- [ ] Phase 6: beta hardening — _not started_
  - [ ] billing/limits: starter-kit + Stripe gating provisioning; per-org Nous spend; resource caps enforced
  - [ ] email: finish MFA + password-reset (`RESEND_API_KEY`/`FROM_EMAIL` on HermesHQ or console provider)
  - [ ] observability: Traefik access logs, container health dashboard, Sentry on console + desktop
  - [ ] security: forward-auth token rotation, `no-new-privileges`, secrets out of images, admin surface gated
  - [ ] lifecycle: idle-instance reaping (= H7), restart policies, data-dir backups
- [x] Phase 7: canonical GCAP brand token files created in `docs/theming/`
- [ ] Phase 7: apply brand tokens to all four consumers:
  - [ ] site → `gcaplabs-site/tailwind.config.js` + `app/globals.css`
  - [ ] console (starter-kit) → `src/config/branding.ts` + Tailwind theme
  - [ ] desktop → `uno.config.ts` + `:root`/`:root.dark` seed vars
  - [ ] HermesHQ dashboard → its Tailwind v4 theme

## Done

- [x] Container provisioning: admin provisions Hermes container per user via GUI
- [x] Domain routing: containers proxied through `hq.gcaplabs.com/runtime/{name}` via nginx + Docker DNS
- [x] WebSocket support for container proxy
- [x] Domain migration: all `hermeshq.gcaplabs.com` → `hq.gcaplabs.com`
- [x] Open sign-up: `POST /api/auth/register` public endpoint (requires `OPEN_SIGNUP=true`)
- [x] Pending role: new sign-ups get `pending` role with zero capabilities
- [x] Admin approval UI: Approve / Approve+Provision buttons in UsersPage
- [x] OAuth buttons on login page (Google, Microsoft)
- [x] Desktop app: OAuth login via popup BrowserWindow
- [x] Desktop app: sign-up form inline in login page
- [x] Desktop app: "Hello, {username}" + logout button in sidebar
- [x] Tracker files: masterlog.md + mastertodo.md
- [x] v0.3.0: Runs API across console, desktop, iOS (code-complete)
- [x] SSH ControlMaster/ProxyCommand fix in Hermes source (2026-06-30)
- [x] Passwordless sudo for m4 on VPS (2026-06-30)

## Next / Pending

- [ ] Set `OPEN_SIGNUP=true` in VPS `.env` to enable registrations
- [ ] Configure Google OAuth credentials in VPS `.env`
- [ ] Build and distribute desktop app: `node scripts/build-with-builder.js auto --win`
- [ ] MFA email setup (optional): `RESEND_API_KEY` + `FROM_EMAIL`

## Broken / Follow-Up From 2026-06-30 Agent37 Pass

- [ ] Install Visual Studio Spectre-mitigated libraries so `bun install` can rebuild `node-pty` cleanly on Windows.
- [x] Vendor Agent37 Gateway into the HermesHQ runtime Docker context and replace `backend/runtime.Dockerfile` old `hermes gateway`/8080 path with Agent37 Gateway on `:3737`.
- [x] Replace temporary forward-auth compatibility token (`api_server_key` reused as `forward_auth_token`) with real HMAC signing using `FORWARD_AUTH_HMAC_SECRET`.
- [ ] Finish `openclaw-host-kit` recovery or implement equivalent VPS scripts: `provision-host.sh`, `create-instance.sh`, `destroy-instance.sh`, URL helpers, idle reaper.
- [ ] Install backend lint tooling or add it to the HermesHQ backend venv; `python -m ruff` is currently unavailable there.
- [ ] Decide final Portainer hostname: `http://portainer.run.gcaplabs.com` works now; `portainer.gcaplabs.com` exists but some resolvers still cache NXDOMAIN.
- [ ] Fix/replace existing `hq.gcaplabs.com` DNS record so it points at the Cloudflare tunnel route for HermesHQ frontend.
- [ ] Avoid browser HTTPS on `*.run.gcaplabs.com` until Cloudflare advanced cert/SaaS wildcard covers second-level wildcard names; runtime clients can still use the tunnel path once certing is resolved.
- [ ] Bring up HermesHQ backend/frontend containers on VPS and run an approve→provision→runtime health smoke.
- [x] Removed superseded docs: `todo.md` + `CHANGELOG.md` (tombstones → master files) and `revisedplan.md` (superseded by `veeplan.md`); scrubbed stale `AGENTS.md` pointers to `todo.md`.
