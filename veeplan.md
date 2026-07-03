# veeplan.md — Headmaster Beta-Readiness Plan (Agent37-aligned)

> **2026-07-03 superseding status:** Phases 0–7 below are historical architecture/execution context. Current owner decision: Agent37 Cloud is the primary backend, the existing provisioned runtime is the smoke-test target, and the local Headmaster runtime stays in the desktop app for local/dev/fallback use. Do not delete local runtime/bootstrap or `applyProvisionToRuntime.ts` as part of this migration. HermesHQ VPS teardown is owner-owned and not tracked here. Future STT stays a todo until a real runtime endpoint exists.

> The single execution roadmap that takes GCAP Labs from today's state to a functioning,
> beta-testable, multi-user product, modeled on Agent37's clean open-source implementation.
>
> **Implementation plan:** see `.hermes/plans/2026-06-30_222130-headmaster-beta-readiness.md`
> for the full bite-sized task breakdown (Phases 0–7, file paths, verification steps).
>
> **VPS infra status (2026-06-30):** Docker/Compose, Traefik v3.5, Cloudflare tunnel ingress,
> forward-auth, Portainer, Cockpit, and the Agent37/Hermes runtime image are installed on `vps`.
> Traefik uses the file provider for runtime routes because Docker 29 rejects Traefik's
> Docker-provider API version. SSH ControlMaster/cloudflared ProxyCommand conflict patched in
> Hermes source (`tools/environments/ssh.py`). Passwordless sudo configured for `m4` on the VPS.

**Decisions locked from Q&A (2026-06-30):**
1. **Full adopt** — vendor `gateway` + `host-kit`; **starter-kit becomes the new `gcaplabs-console`.**
2. **Routing/isolation** — adopt host-kit's **Traefik + forward-auth**, behind the existing Cloudflare tunnel.
3. **Front door & identity** — **build the console fresh on starter-kit (Next.js + Supabase).**
   **Supabase is the single identity source of truth.** HermesHQ trusts Supabase-issued JWTs
   for end users.
4. **Client transport** — migrate Headmaster Desktop + iOS to the unified `/v1/responses` SSE contract **now**.
5. **Console hosting** — the console runs on **Vercel** (stateless Next.js front door; VPS stays runtime-only).
6. **Branding** — **one canonical GCAP brand kit**, reconciled from the marketing site + the
   desktop app, applied across site, console, desktop, and the HermesHQ dashboard (see "Branding unification").

**Decisions locked (2026-07-01):**
7. **Default model = kimi-code** (NOT Nous Portal): provider `kimi-coding`, model `kimi-k2.7-code`,
   `base_url https://api.kimi.com/coding`, `api_mode anthropic_messages`. `KIMI_API_KEY` replaces
   the legacy per-org `nous_api_key` injection in the per-user runtime.
8. **Beta is free** — no Stripe / payment gate during beta. Access is gated by the approval
   pipeline + per-container resource caps; Nous/model spend is visibility-only. Stripe deferred to GA.
9. **Supabase new asymmetric-key system** — HermesHQ verifies user JWTs against the public JWKS
   (`SUPABASE_JWKS_URL`); there is **no shared `SUPABASE_JWT_SECRET`**.
10. **Secrets** — all beta secrets live in the gitignored `gcaplabs-headmasterUI/vps.env` (never committed).
11. **Cloudflare/DNS** — managed by the owner directly; automation must not touch Cloudflare.

> Note: there is **no existing console to migrate**. The `gcaplabs-console/` Wasp scaffold was
> never built out (no real users, no data), so the console is started **fresh** on starter-kit
> with Supabase as identity. The unused scaffold is simply dropped.

---

## Current progress (2026-07-01)

**VPS infrastructure (Hoster kanban — complete):**
- ✅ Hermes SSH backend patched — `tools/environments/ssh.py` now skips ControlMaster when ProxyCommand detected (fixes Windows + cloudflared conflict)
- ✅ Passwordless sudo configured for `m4` on VPS
- ✅ `persistent_shell` set to `false` for Hoster profile (avoids ControlMaster path)
- ✅ H1: Docker + Compose install — complete
- ✅ H2: Traefik :443 + Cloudflare tunnel ingress — complete; file-provider routing active
- ✅ H3: forward-auth HMAC — complete; `headmaster-forward-auth` healthy on `127.0.0.1:18081`
- ✅ H4: `create-instance.sh` deployed at `/opt/headmaster/scripts/`
- ✅ H5: `dashboard-url.sh` + `terminal-url.sh` deployed
- ✅ H6: per-user Agent37/Hermes image build — complete; `headmaster-hermes-runtime:latest`
- ✅ H7: idle reaper — `reap-idle-instances.sh` + cron at `/etc/cron.d/headmaster-reaper`
- ✅ H8: Traefik access logs — enabled
- ✅ H9: Portainer CE — complete; local Docker environment attached
- ✅ H10: Cockpit — installed and active

**Code work (Phases 0–7):**
- ✅ Phase 0: task plan restored, Agent37 source pinned, Gateway vendored into HermesHQ runtime context
- ⚠️ Phase 0 spike: local gateway spike intentionally skipped per instruction not to run it against local Hermes
- ✅ Phase 1: containerized Agent37 Gateway runs on `:3737`
- ✅ Phase 2: VPS Traefik + forward-auth + resource-capped runtime container path implemented
- ✅ Phase 3: HermesHQ provision schema returns `/v1` route metadata and forward-auth token fields
- ✅ Phase 3: Supabase JWT trust — `core/supabase_auth.py` + combined auth; verified via tests
- ✅ Phase 3: kimi-code model credential injection (replaces legacy `nous_api_key`)
- ✅ Phase 3: full approve→provision→runtime smoke passed on VPS — container started, `/v1/health` returns 200
- ✅ Phase 4: console rewired to HermesHQ provision API + `/v1/responses` SSE + Headmaster branding. Deploy step blocked on console replacement decision (Wasp app can't deploy to Vercel as-is).
- ✅ Phase 5 desktop: remote provisioned runtime uses `/v1/responses` SSE + cancel/reconnect
- ✅ Phase 5 iOS: `RunsAPIClient.swift` + `CloudContainerConfig`/`CloudContainerTransport.swift` migrated to `/v1/responses` SSE; build verification requires Mac
- ✅ Phase 6 beta hardening: Resend email (needs `gcaplabs.com` domain verification), Sentry init on backend, container health endpoints, idle reaper cron, no-new-privileges + secrets-out-of-image confirmed
- ✅ Phase 7 source tokens: canonical GCAP brand token files created
- ✅ Phase 7 rollout: tokens applied to site, desktop, console (strings); HermesHQ admin dashboard deferred (operator tool)

**Pre-existing work (from prior sessions — still valid):**
- ✅ HermesHQ backend: open sign-up, OAuth, approval pipeline, container supervisor, provision endpoints
- ✅ Desktop: Runs API transport (~80% wired), local/remote parity, login + MFA, install UI
- ✅ iOS: RunsAPIClient actor, CloudContainerTransport, auth + provision

---

## Target architecture (GCAP Labs)

```
                          console.gcaplabs.com
End user ──HTTPS──▶ gcap-console (starter-kit: Next.js + Supabase)  ← signup, billing, fleet UI, identity SoT
                          │  issues Supabase JWT
                          ▼
                    HermesHQ control plane (FastAPI)       ← trusts Supabase JWT; provision/admin
                          │  create/start/stop/destroy
                          ▼
              VPS host (Traefik :443 + forward-auth)        ← wildcard *.run.gcaplabs.com, HMAC tokens
                          │  per-user routing + auth
                          ▼
        Per-user container  [ Agent37 gateway :3737 (no auth) ]
                          │  NDJSON stdio
                          ▼
                 hermes_worker.py → Hermes AIAgent          ← model, tools, memory, sessions

Clients: Headmaster Desktop (Electron) + iOS  ──▶ speak /v1/responses + SSE to their container
                                                    (via Traefik subdomain + forward-auth token)
```

Everything reaches the VPS through the **existing Cloudflare tunnel**; Traefik terminates
routing internally. Canonical public host stays **`hq.gcaplabs.com`** (admin/control plane)
and **`console.gcaplabs.com`** (users); per-instance runtime at **`*.run.gcaplabs.com`**.

---

## Phase 0 — Vendor & spike (foundation)

**Goal:** get the reference code in-tree and prove the gateway runs against our Hermes build.

- Vendor under `gcaplabs-headmasterUI/_support/upstream/agent37/` (alongside existing
  `_support/upstream/hermes-desktop`): clone `gateway`, `openclaw-host-kit`, `starter-kit`,
  `examples`, `minions` (no `.git`, pin commit hashes in a `VENDOR.md`).
- Stand up `gateway` locally (`npm install && npm run selftest:worker && npm run dev`,
  `http://localhost:3737`) pointed at our Hermes install via `HERMES_AGENT_DIR` /
  `HERMES_PYTHON`. Confirm `POST /v1/responses` (stream) + `GET /v1/models` + `/v1/health`.
- Run the `examples/hermes-chat` app against it to validate the SSE event contract end-to-end.

**Gate:** token-by-token streaming chat works through the gateway against our Hermes runtime.

---

## Phase 1 — Gateway: the unified `/v1` contract

**Goal:** every agent interaction (desktop, iOS, console) speaks ONE contract, agent-agnostic.

- Adopt the gateway's surface as our canonical runtime API:
  - `POST /v1/responses`, `GET /v1/responses/{id}/stream`, `POST /v1/responses/{id}/cancel`
  - `GET/PATCH/DELETE /v1/sessions`, `GET /v1/sessions/{id}`
  - `/v1/files*` (list/content/dir/archive), `GET /v1/models`, `/v1/health`, `/v1/version`
  - SSE events: `response.created`, `response.reasoning.delta`, `response.output_text.delta`,
    `response.tool_call.started|completed|failed`, `response.completed|failed`.
- Bake the gateway **into the per-user container image** so it runs on container port `3737`
  (replacing the bespoke Hermes API-server-on-8080 assumption). The gateway is localhost +
  no-auth by design — auth is the host's job (Phase 2).
- Map provider/model config into the gateway's worker env via provision. **Default model is
  kimi-code** (provider `kimi-coding`, model `kimi-k2.7-code`, `base_url
  https://api.kimi.com/coding`, `api_mode anthropic_messages`); inject `KIMI_API_KEY`. This
  **replaces** the legacy `org.nous_api_key` injection in `container_supervisor.py`.
- Keep our white-label rules: gateway/worker are runtime-internal, so "Hermes" naming is fine
  there; never surface it in client UI strings.

**Gate:** a freshly built container image serves the full `/v1` contract on `:3737` with
streaming, sessions, files, and models; the default kimi-code model (`kimi-k2.7-code`) resolves.

---

## Phase 2 — Host kit: Traefik + forward-auth + per-user containers

**Goal:** replace the ephemeral-port / `localhost`-healthcheck model with host-kit's clean,
isolated, authenticated routing.

- Vendor `openclaw-host-kit`'s `deploy/traefik/` + `docker/forward-auth/` + `scripts/`.
- **Routing:** Traefik on `:443`, wildcard `*.run.gcaplabs.com` → per-instance container; each
  user gets `https://hm-<id>.run.gcaplabs.com`. Traefik sits *behind* the Cloudflare tunnel
  (tunnel public hostname → Traefik), so no inbound ports are opened on the VPS.
- **Auth:** adopt the `forward-auth` HMAC-token model (24h TTL) gating every runtime request;
  HermesHQ mints the token at provision time and returns it to the client (replaces the raw
  per-container `API_SERVER_KEY` flow).
- **Isolation:** per-container CPU/mem/PID caps (host-kit defaults: 2 CPU, 4–6 GB, 512 PID;
  tune to VPS), `--shm-size=1g` for browser tools, `no-new-privileges`.
- **Persistence:** instance data at `/var/lib/headmaster/instances/<id>/` (host-kit pattern),
  mounted to the container's data dir — **fixing the current `/app/data` vs runtime mismatch**.
- Rework `container_supervisor.py` to drive host-kit scripts / labels instead of ephemeral
  `-P` port publishing + `localhost` health checks. Health check hits the Traefik route.

**Gate:** `create-instance.sh <user>` (or the reworked supervisor) yields a running container
reachable at its subdomain, gated by forward-auth, with resource caps enforced; destroy is clean.

---

## Phase 3 — Control plane: HermesHQ provisioning rework

**Goal:** HermesHQ orchestrates host-kit instances and serves a `/v1`-aware provision response.

- Update `services/desktop_runtime.py` + `routers/desktop_runtime.py` provision response to
  return: instance subdomain URL, forward-auth token, `/v1` base path, model catalog. Add
  fields to `schemas/desktop_runtime.py` + `connectionConfig.ts` (`HermeshqProvisionSnapshot`).
- Make HermesHQ **trust Supabase identity**: validate Supabase-issued JWTs for end users by
  verifying against the project's **public JWKS** (`SUPABASE_JWKS_URL`). The Supabase project uses
  the **new asymmetric-key system**, so there is **no shared `SUPABASE_JWT_SECRET`** to configure.
  Keep local admin auth for the HermesHQ admin UI.
- Implement the open-signup / approval pipeline against the *real* `gcaplabs-hermeshq` repo —
  the vendored copy lacks `/register` and `OPEN_SIGNUP`; verify the real flag name there.
- Inject the kimi-code model credential (`KIMI_API_KEY` + provider/base_url/model, see Phase 1)
  → gateway worker env, **replacing** the legacy `org.nous_api_key` path; confirm
  `PUBLIC_BASE_URL` is in the backend compose `environment:` block (currently missing).

**Gate:** desktop/iOS/console all receive a provision response that points at a working,
authenticated `/v1` instance; admin can approve→provision→destroy from the HermesHQ UI.

---

## Phase 4 — New gcap-console = starter-kit (Next.js + Supabase)

**Goal:** stand up starter-kit as the new `console.gcaplabs.com`, with Supabase as the single
identity source. Built **fresh** — there is no prior console to replace.

- Stand up starter-kit per its `SETUP.md`: `npm install && npm run setup` (creates `.env.local`,
  provisions a Supabase project, runs migrations `supabase/migrations/0001_init.sql`, enables
  email auth), `npm run typecheck && npm run build`. Secrets: `AGENT37_API_KEY`-equivalent →
  our HermesHQ provisioning, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_SITE_URL=https://console.gcaplabs.com`.
- **Rewire its agent backend from Agent37 Cloud → our HermesHQ provision API**, so "create
  instance / fleet / chat / files" screens drive HermesHQ + the per-user gateway containers
  (Phases 1–3), not Agent37's hosted API.
- **Branding:** apply the unified GCAP brand kit (see "Branding unification" below) via
  starter-kit's `src/config/branding.ts` + its Tailwind theme; domain `console.gcaplabs.com`.
- **Fresh start (no migration):** the `gcaplabs-console/` Wasp scaffold was never built, so there
  are no users/records/billing to migrate. Point `console.gcaplabs.com` at the new Vercel
  deployment. Keep open email signup (starter-kit default) gated by the HermesHQ approval pipeline.
- **Deploy: Vercel (decided).** The console is a stateless Next.js front door with no runtime
  containers, so it ships on Vercel per starter-kit's `SETUP.md` (free TLS/CDN/preview deploys),
  keeping the VPS focused on agent runtime + control plane. It reaches HermesHQ via the existing
  public tunnel and Supabase as a managed service. Set `NEXT_PUBLIC_SITE_URL=https://console.gcaplabs.com`.

**Gate:** a new user signs up on the Supabase-backed console, is approved, sees their fleet,
and launches a working chat session — single Supabase identity, HermesHQ-provisioned instance.

---

## Phase 5 — Client migration to `/v1/responses` SSE

**Goal:** Desktop + iOS drop the WS/port transport and speak the unified contract.

- Desktop: replace `hermesChatAdapter.ts`'s gateway-WS path with a `/v1/responses` + SSE
  client (model on `examples/hermes-chat`). Use provision's subdomain URL + forward-auth token.
  Reuse the existing `responseStream` pattern; map SSE events to current UI events. Add a
  capability probe (`GET /v1/version`/`/v1/models`) before session start (per upstream finding #9).
- Remove the brittle 9119/9120/8080 port logic + `httpBridge.ts` port guards once `/v1` is live.
- iOS: same provision response + `/v1` SSE; shared session namespace preserved.
- Keep local-runtime mode working for dev (gateway can run locally too).

**Gate:** desktop and iOS both chat, stream, cancel, browse files, and switch models against
a remote provisioned instance with zero WS/port code in the hot path.

---

## Phase 6 — Beta hardening

**Goal:** safe for real external beta testers.

- **Billing/limits:** **beta is free — no Stripe / payment gate during beta.** Deferred until
  GA (post-beta): wire starter-kit + Stripe (via Supabase) to gate provisioning then. For now,
  control access via the HermesHQ approval pipeline + per-container resource caps (Phase 2) and
  keep per-org Nous spend *visibility* (read-only, no charging).
- **Email:** finish MFA + password-reset email (`RESEND_API_KEY`/`FROM_EMAIL` on HermesHQ, or
  the console's own email provider).
- **Observability:** Traefik access logs, container health dashboard (extend HermesHQ health
  monitor loop), Sentry on console + desktop (skills already exist: `fix-sentry`).
- **Security:** forward-auth token rotation, `no-new-privileges`, secrets out of images,
  Cloudflare in front of Traefik, admin surface IP/role-gated.
- **Lifecycle:** idle-instance reaping, restart policies, data-dir backups.

**Gate:** a clean VPS can be provisioned from scripts; 5–10 external testers each get an
isolated, monitored instance (free during beta — no billing gate); tear-down and restart are reliable.

---

## Branding unification (cross-surface)

**Goal:** one visual identity across every surface — the marketing site, the new console, the
desktop app, and the HermesHQ admin dashboard. Today there are two divergent palettes; we
reconcile them into a single canonical **GCAP brand kit** and consume it everywhere.

**Two existing sources to reconcile:**
- **Site** — `gcaplabs-site/tailwind.config.js` + `gcaplabs-site/app/globals.css`: warm/earthy
  OKLCH palette (`paper #f4f1ea`, `ink #1a1814`, `warm #c4a882`, `clay #8b7355`, `moss #4a5d4e`,
  gold `signal #d4a574` / `accent #c9a96e`), `display` serif (Georgia) + `sans` body + JetBrains
  Mono, and signature motion (`grain-shift`, `float`, `pulse-glow`, `shimmer`).
- **App** — `gcaplabs-headmasterUI/docs/white-label/HEADMASTER-PALETTE-SNIPPET.css` +
  `uno.config.ts` + `docs/theming/tokens.md`: parchment-cream + Slytherin-green seed-variable
  system (`--theme-primary #1a4d2e`, `--theme-background-seed #faf7f2`, `--theme-warm #cf806d`),
  derived via `color-mix` from 4–5 seeds, light + dark variants.

**The reconciliation:** the two already share a warm, parchment, serif-forward DNA — keep the
site's earthy neutrals + gold accent + serif/mono type as the primary identity, and adopt the
app's green (`#1a4d2e`) as the brand primary/CTA color and its seed-variable + `color-mix`
mechanism (it scales to light/dark and to Arco/Uno cleanly). Resolve the conflicts (site gold
`#c9a96e` vs app green primary; `paper #f4f1ea` vs `--theme-background-seed #faf7f2`) into one
agreed token set.

**Deliverable — a single source of truth:** define the canonical tokens once (color seeds,
type scale, radius, motion) as framework-neutral CSS custom properties + a small JSON/TS token
file, version it (proposed home: `gcaplabs-headmasterUI/docs/theming/` as the brand kit, mirrored
to a shared snippet), then map it into each consumer:
- **Site** → `tailwind.config.js` `theme.extend` + `app/globals.css` `:root`.
- **Console (starter-kit)** → `src/config/branding.ts` + its Tailwind theme / globals.
- **Desktop app** → `uno.config.ts` theme + the `:root` / `:root.dark` seed vars (extend the
  existing white-label palette snippet rather than replace the mechanism).
- **HermesHQ dashboard** → its Tailwind v4 theme (admin surface).
Honor white-label rules throughout (Headmaster brand in UI; `hermes`/`Nous`/`AionUi` never surfaced).

**Gate:** site, console, desktop, and HermesHQ render the same palette, type, radius, and accent;
a single token change propagates to all four; light/dark both correct.

---

## VPS infrastructure spec — everything the VPS needs

**Base host**
- Linux VPS, Docker + Docker Compose v2, `git`, `openssl`; user in `docker` group.
- Sizing: budget ~ (2 CPU / 4–6 GB) per concurrent instance + control-plane overhead;
  set `CONCURRENCY_SEMAPHORE = available_RAM_MB / 60` for HermesHQ task runners.
- Firewall: **no inbound ports**; all ingress via Cloudflare tunnel → Traefik.

**DNS / TLS**
- Wildcard `*.run.gcaplabs.com` → VPS (via tunnel); `hq.gcaplabs.com` (control plane),
  `console.gcaplabs.com` (front door).
- Traefik handles internal routing + (if not terminating at Cloudflare) ACME certs
  (`OPENCLAW_ACME_EMAIL` equivalent). Cloudflare tunnel token provided out-of-band.

**Services on the host**
1. **Cloudflare tunnel** (existing) — public hostnames → Traefik / frontend.
2. **Traefik** (`:443` internal) — wildcard subdomain routing + forward-auth middleware.
3. **forward-auth** — HMAC token (24h TTL) validation; shared secret with HermesHQ.
4. **HermesHQ stack** (`docker compose`): postgres, backend (FastAPI, `expose 8000`),
   frontend (nginx `:3420`), tunnel. `.env` (chmod 600) with: `POSTGRES_*`, strong
   `JWT_SECRET`, `AUTH_MODE`, `CORS_ORIGINS_JSON` (incl. `https://hq.gcaplabs.com`,
   `https://console.gcaplabs.com`), **`PUBLIC_BASE_URL=https://hq.gcaplabs.com` added to the
   backend `environment:` block**, OIDC/Google creds, `ADMIN_*`, `SUPABASE_JWKS_URL` (verify user
   JWTs — asymmetric, no shared secret). Model credential is **kimi-code** (`KIMI_API_KEY` +
   provider/base_url/model) injected into the per-user runtime, replacing the legacy per-org
   `nous_api_key`. All secrets live in the gitignored `vps.env`.
5. **Per-user agent image** — built FROM the Hermes runtime + vendored gateway, default
   `CMD` starts gateway on `:3737`, data dir matches host-kit mount, API server/worker enabled,
   `[web,pty]` tooling present, `--shm-size=1g` at run.
6. **gcap-console** — starter-kit (Next.js + Supabase) at `console.gcaplabs.com`, hosted on
   **Vercel** (not the VPS). Supabase project hosts identity; share the Supabase JWT secret /
   JWKS with HermesHQ so it can validate user tokens. Nothing console-related runs on the VPS.

**Host-kit scripts to wire in:** `provision-host.sh` (one-time host setup),
`create-instance.sh <user>`, `dashboard-url.sh`, `terminal-url.sh` — adapted to Headmaster
naming + `/var/lib/headmaster/instances/<id>/`.

---

## Verification — end-to-end

1. **Gateway unit:** `npm run selftest:worker`; `bruno` collection green against a container.
2. **Container lifecycle:** provision → subdomain reachable → forward-auth rejects bad token,
   accepts minted token → resource caps via `docker stats` → destroy removes container + route.
3. **Provision contract:** `POST /api/desktop/provision` returns subdomain + token + `/v1` base
   + models; `HERMES_HQ_URL` is `https://hq.gcaplabs.com` (not `localhost`).
4. **Clients:** desktop + iOS chat/stream/cancel/files/model-switch against remote instance.
5. **Front door:** console signup → approve → fleet → launch → chat, single identity (free beta — no billing gate).
6. **Cold VPS rehearsal:** from a clean box run `provision-host.sh` + compose up + build image +
   create an instance; confirm external `https://hm-<id>.run.gcaplabs.com/v1/health` = 200.
7. **Suites:** `bunx tsc --noEmit`, `bunx vitest run` (desktop); HermesHQ pytest (excluding the
   3 known-bad files); console `npm run typecheck && npm run build` (starter-kit).

---

## Critical files

**Vendor (new):** `gcaplabs-headmasterUI/_support/upstream/agent37/{gateway,openclaw-host-kit,starter-kit,examples,minions}` + `VENDOR.md`.

**HermesHQ (real repo `gcaplabs-hermeshq`):**
- `backend/hermeshq/services/container_supervisor.py` — rework to host-kit + Traefik + caps.
- `backend/hermeshq/services/desktop_runtime.py`, `routers/desktop_runtime.py`,
  `schemas/desktop_runtime.py` — `/v1` + subdomain + forward-auth token in provision.
- `backend/hermeshq/config.py` + `docker-compose.yml` (add `PUBLIC_BASE_URL` to backend env).
- Auth/register flow + `OPEN_SIGNUP` (verify real flag) → trust Supabase JWT.

**Desktop:** `packages/desktop/src/.../hermesChatAdapter.ts` (→ `/v1` SSE),
`connectionConfig.ts` (`HermeshqProvisionSnapshot`), `httpBridge.ts` (retire port guards),
`applyProvisionToRuntime` (write subdomain/token/model config).

**Console (new = starter-kit):** `src/` (fleet/chat/files, rewired to HermesHQ),
`src/config/branding.ts`, `supabase/migrations/0001_init.sql`, `.env.local`, `next.config.ts`.
The unused `gcaplabs-console/` Wasp scaffold is dropped (nothing to migrate).

**VPS:** vendored `deploy/traefik/`, `docker/forward-auth/`, adapted `scripts/*.sh`;
HermesHQ `.env`; per-user image Dockerfile.

**Branding kit (source → consumers):** canonical tokens in `gcaplabs-headmasterUI/docs/theming/`
(brand kit) ← reconciled from `gcaplabs-site/tailwind.config.js` + `app/globals.css` and
`gcaplabs-headmasterUI/docs/white-label/HEADMASTER-PALETTE-SNIPPET.css` + `uno.config.ts`.
Consumers: site `tailwind.config.js`/`app/globals.css`, console `src/config/branding.ts`,
desktop `uno.config.ts` + `:root` seed vars, HermesHQ Tailwind theme.
