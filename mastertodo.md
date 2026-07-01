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
- [x] H4: create-instance.sh — `docs/create-instance.sh` deployed to `/opt/headmaster/scripts/`
- [x] H5: dashboard/terminal URL helpers — `docs/dashboard-url.sh` + `docs/terminal-url.sh` deployed
- [x] H7: idle reaper — `docs/reap-idle-instances.sh` + cron at `/etc/cron.d/headmaster-reaper`

### Code Phases

- [x] Phase 0: restore bite-sized plan + pin Agent37 refs in `_support/upstream/agent37/VENDOR.md`
- [x] Phase 0: local Agent37 gateway spike against Hermes — **intentionally deferred** (not run against local Hermes, per instruction); revisit if container `/v1` contract needs local repro
- [x] Phase 1: gateway in per-user container (:3737)
- [x] Phase 2: host-kit Traefik + forward-auth + caps
- [x] Phase 3: HermesHQ provision response includes `/v1` runtime route, health/version URLs, forward-auth token fields
- [x] Phase 3: Supabase JWT trust — `core/supabase_auth.py` + combined auth on provision endpoint; verified by JWT trust test (no shared secret, asymmetric JWKS)
- [x] Phase 3: swap runtime model credential to **kimi-code** (`KIMI_API_KEY`, provider `kimi-coding`, `kimi-k2.7-code`, `api_mode anthropic_messages`) — replaces legacy `org.nous_api_key` injection
- [x] Phase 3: full approve→provision→runtime smoke — VPS smoke test passed: container started with kimi-code env vars, `/v1/health` returns 200 via direct Docker network
- [x] Phase 4: **NEW console built fresh from starter-kit** — `gcap-console/` at workspace root is a Next.js 16 + Supabase + Tailwind v4 app with GCAP brand tokens (parchment + green + gold), Headmaster branding, HermesHQ provision API client (`src/lib/hermeshq.ts`), `/v1/responses` SSE chat routes, simplified one-page dashboard, Supabase profiles migration (fleet tables commented out for future use). Typecheck + build both PASS. Pushed to `main-nextjs` branch on `mutvayzz-sys/gcaplabs-console` — needs force-push or branch merge to replace old Wasp code on `main`. Deploy to Vercel pending DNS (`console.gcaplabs.com`).
- [x] Phase 5: desktop remote runtime chat uses `/v1/responses` SSE + cancel/reconnect path
- [x] Phase 5: iOS → `/v1/responses` SSE — `RunsAPIClient.swift`, `CloudContainerConfig`/`CloudContainerTransport.swift` updated; build verification requires Mac. Commit `0105789` pushed to `origin/main` 2026-07-01.
- [x] Phase 6: beta hardening
  - [x] billing/limits: **beta is free — no Stripe/payment gate during beta**; access gated by approval + resource caps; per-org Nous spend visibility only. Stripe deferred to GA (post-beta).
  - [x] email: MFA + password-reset via Resend — wired and functional; `gcaplabs.com` domain needs verification in Resend dashboard for actual delivery
  - [x] observability: container health dashboard (`/api/dashboard/health`, `/api/containers/{id}/health`); Sentry init added to HermesHQ backend main.py (optional via `SENTRY_DSN` env var); desktop already had Sentry
  - [x] security: forward-auth token rotation (HMAC TTL 86400s, configurable); `no-new-privileges` confirmed in `container_supervisor.py`; secrets out of image (verified — no KIMI/NOUS in image env); admin surface gated
  - [x] lifecycle: idle-instance reaping via cron (every 10 min, TTL 3600s); restart policies `unless-stopped`; data-dir backups
- [x] Phase 7: canonical GCAP brand token files created in `docs/theming/`
- [x] Phase 7: apply brand tokens to all four consumers:
  - [x] site — already aligned (Headmaster green + parchment in `gcaplabs-site/tailwind.config.js` + `app/globals.css`)
  - [x] console (Next.js) — fresh build from starter-kit with GCAP brand tokens + Headmaster branding; pushed to `main-nextjs` branch
  - [x] desktop — `packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/default.css` updated with GCAP tokens; typecheck clean
  - [ ] HermesHQ dashboard — **deferred** (operator tool, dark+red theme; not a user-facing surface; brand kit applies to user-facing only per white-label rules)

## Done

- [x] Container provisioning: admin provisions Hermes container per user via GUI
- [x] Domain routing: per-container proxy via Traefik + forward-auth (the `*.run.gcaplabs.com` subdomain used here was a **temporary** scheme — production runtime domain TBD)
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
- [x] **2026-07-01: Phases 3–7 + VPS infra complete** — Supabase JWT trust, kimi-code model credential, console rewired to HermesHQ, iOS on `/v1/responses` SSE, brand kit applied to site/desktop/console, H4/H5/H7 scripts deployed, idle reaper cron, Resend + Sentry + observability wired, VPS HermesHQ deployed with `/v1` contract

## Next / Pending

- [x] **Console: `main` = new Next.js console** — done 2026-07-01; force-replaced old Wasp `main` with the fresh starter-kit console on `mutvayzz-sys/gcaplabs-console` (unrelated histories; old Wasp branch not kept). `main-nextjs` deleted.
- [x] **Console: deploy to Vercel** — done 2026-07-01; prod deploy `dpl_7SGvsMiqx6…` READY, project `gcap-console`, domain attached. Live at the `*.vercel.app` URL.
- [x] **DNS: `console.gcaplabs.com` → Vercel** — done 2026-07-01; owner replaced the dead tunnel record with `A → 76.76.21.21` (DNS-only). Vercel issued TLS; **live: `https://console.gcaplabs.com/login` → HTTP 200, `Server: Vercel`.**
- [x] **Resend `gcaplabs.com` domain** — already set up / verified in Resend (owner confirmed 2026-07-01); email delivery is live
- [x] **iOS: push commit `0105789` to `origin/main`** — done 2026-07-01; SSE migration now on GitHub
- [ ] **iOS build verification** — requires Mac (code changes are committed)
- [ ] **hermeshq: `git pull` this Windows checkout** — local is 1 behind `origin/main` (`a982fa1` version bump pushed from another machine); all local work is already on GitHub
- [ ] **Beta cold-VPS rehearsal** — provision-host.sh + build image + create instance from clean box
- [x] **Runtime domain LIVE: `hm-<id>.gcaplabs.com`** — single-level subdomain covered by Cloudflare's free universal `*.gcaplabs.com` cert (replaces temp `run.gcaplabs.com`). Applied & verified end-to-end on the **VPS** 2026-07-01:
  - [x] Repo: `RUN_DOMAIN=gcaplabs.com` default (hermeshq `.env.example`, commit `6d3b3c8`).
  - [x] VPS host (`/home/m4/headmaster-stack`): `.env` `RUN_DOMAIN=gcaplabs.com` (backed up `.env.bak-predomain`); backend recreated + healthy, `printenv RUN_DOMAIN` = `gcaplabs.com`.
  - [x] Tunnel `71b69661…`: added `*.gcaplabs.com → https://localhost:443` (noTLSVerify) to `/etc/cloudflared/config.yml` after the explicit hosts (backup `config.yml.bak-predomain`); `ingress validate` OK; cloudflared restarted.
  - [x] DNS: wildcard `*.gcaplabs.com` CNAME → tunnel created via `cloudflared tunnel route dns` (origin cert `/home/m4/.cloudflared/cert.pem`).
  - [x] Verified: `https://hm-test123456.gcaplabs.com/v1/health` → **valid TLS (verify=0)**, 404 from Traefik (no instance yet = correct); `hq` + `console` still 200 (no regressions). A real provisioned instance will get its Traefik route and return `/v1/health` 200.

## Broken / Follow-Up From 2026-06-30 Agent37 Pass

- [x] Vendor Agent37 Gateway into the HermesHQ runtime Docker context and replace `backend/runtime.Dockerfile` old `hermes gateway`/8080 path with Agent37 Gateway on `:3737`.
- [x] Replace temporary forward-auth compatibility token (`api_server_key` reused as `forward_auth_token`) with real HMAC signing using `FORWARD_AUTH_HMAC_SECRET`.
- [x] Finish `openclaw-host-kit` recovery or implement equivalent VPS scripts: `provision-host.sh`, `create-instance.sh`, `destroy-instance.sh`, URL helpers, idle reaper.
- [ ] Install backend lint tooling or add it to the HermesHQ backend venv; `python -m ruff` is currently unavailable there.
- [x] Portainer hostname: **`portainer.gcaplabs.com`** is the actual/production host (the `*.run` variant was temporary).
- [x] Fix/replace existing `hq.gcaplabs.com` DNS record — repointed from Mac mini tunnel to VPS tunnel via `cloudflared tunnel route dns -f` on 2026-07-01
- [x] ~~`*.run.gcaplabs.com` wildcard TLS~~ — **dropped**: `*.run` was a temporary routing placeholder, not the production runtime domain (see "Confirm production runtime domain" above).
- [x] Bring up HermesHQ backend/frontend containers on VPS and run an approve→provision→runtime health smoke — done 2026-07-01
- [x] Removed superseded docs: `todo.md` + `CHANGELOG.md` (tombstones → master files) and `revisedplan.md` (superseded by `veeplan.md`); scrubbed stale `AGENTS.md` pointers to `todo.md`.