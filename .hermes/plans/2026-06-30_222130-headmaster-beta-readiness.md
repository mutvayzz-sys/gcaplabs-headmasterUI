# Headmaster Beta Readiness Task Breakdown

Source of truth: `veeplan.md`.

This plan restores the missing bite-sized execution file referenced by `veeplan.md`. The scope is the Agent37-aligned beta stack: Agent37 Gateway as the runtime API, routed per-user runtime containers, Supabase-backed console, desktop/iOS `/v1/responses` migration, and unified GCAP branding.

## Phase 0 - Source Pins And Gateway Spike

- Record Agent37 pins in `_support/upstream/agent37/VENDOR.md`.
- Use workspace-root `_support/upstream/agent37/*` as canonical references.
- Do not copy `.git` directories into the Headmaster repo unless a self-contained mirror is explicitly needed.
- Recover `openclaw-host-kit`; if unavailable, implement the minimal Headmaster host-kit from `veeplan.md`.
- Run Gateway locally with Hermes:
  - `npm install`
  - `npm run selftest:worker`
  - `npm run dev`
  - verify `GET /v1/health`, `GET /v1/models`, and streaming `POST /v1/responses`.

Gate: token streaming works through Agent37 Gateway against local Hermes.

## Phase 1 - Runtime Image And `/v1` Contract

- Build a Headmaster runtime image with Hermes Python runtime, Agent37 Gateway, `hermes_worker.py`, and browser/tool dependencies.
- Standardize container env: `PORT=3737`, `GATEWAY_DEFAULT_AGENT=hermes`, `HERMES_HOME`, `HERMES_AGENT_DIR`, `HERMES_PYTHON`, `GATEWAY_WORKSPACE_DIR`, `AGENT37_GATEWAY_HOME`, `NOUS_API_KEY`, optional `NOUS_BASE_URL`.
- Keep Gateway unauthenticated inside the container.
- Serve `/v1/responses`, `/v1/sessions`, `/v1/files`, `/v1/models`, `/v1/health`, and `/v1/version`.

Gate: containerized Gateway serves the full `/v1` surface on `:3737`.

## Phase 2 - VPS Host Kit

- Deploy Cloudflare tunnel to Traefik.
- Route `*.run.gcaplabs.com` to per-user containers.
- Add HMAC forward-auth to every runtime request.
- Create scripts: `provision-host.sh`, `create-instance.sh`, `destroy-instance.sh`, `dashboard-url.sh`, `terminal-url.sh`, `reap-idle-instances.sh`.
- Persist instance data at `/var/lib/headmaster/instances/<id>/`.
- Enforce CPU, memory, PID, shm, `no-new-privileges`, and restart policy.

Gate: valid bearer token reaches `/v1/health`; bad token is rejected.

## Phase 3 - HermesHQ Provisioning

- Add provision fields: `runtime.base_url`, `runtime.api_base_path`, `runtime.health_url`, `runtime.version_url`, `runtime.ttl_seconds`, `cloud_container_config.forward_auth_token`, `cloud_container_config.forward_auth_expires_at`.
- Stop publishing ephemeral host ports.
- Store public routed health URL and token metadata.
- Inject `org.nous_api_key` into runtime env, not client responses.
- Trust Supabase user JWTs for console-originated calls while preserving admin auth.
- Confirm env: `PUBLIC_BASE_URL`, `RUN_DOMAIN`, `FORWARD_AUTH_HMAC_SECRET`, Supabase settings, and CORS origins.

Gate: HermesHQ provisions, validates, and destroys routed `/v1` instances.

## Phase 4 - New Console

- Replace the Wasp console with Agent37 starter-kit as `gcaplabs-console`.
- Use Next.js, Supabase, and Vercel.
- Rewire instance lifecycle APIs from Agent37 Cloud to HermesHQ.
- Proxy chat/files/sessions to the user's `runtime.base_url`.
- Never expose service-role Supabase keys or HermesHQ admin secrets to the browser.

Gate: user signs up, admin approves, fleet renders, chat streams through `/v1/responses`.

## Phase 5 - Desktop `/v1/responses`

- Persist new provision runtime fields in `connectionConfig.ts`.
- For remote mode, write route/token to connection config and renderer globals, not local Hermes `.env`.
- Use `POST /v1/responses` with `stream: true` for remote runtime chat.
- Parse `response.created`, `response.output_text.delta`, `response.reasoning.delta`, `response.tool_call.*`, `response.completed`, and `response.failed`.
- Cancel with `POST /v1/responses/{id}/cancel`.
- Reattach dropped streams with `GET /v1/responses/{id}/stream`.
- Keep legacy dashboard/Runs behavior for local mode only.

Gate: desktop remote chat can stream, cancel, and recover without dashboard WS or raw port assumptions.

## Phase 6 - iOS `/v1/responses`

- Decode the new provision response.
- Persist base URL, forward-auth token, expiry, session namespace, and model catalog.
- Replace Runs API hot path with `/v1/responses` SSE.
- Implement cancel, session list/detail, and files where UX exposes them.

Gate: iOS and desktop can use the same approved user/session namespace.

## Phase 7 - Branding Kit

- Create canonical tokens under `docs/theming/`.
- Use parchment background, warm ink, Headmaster green `#1a4d2e`, muted gold accent, warm clay tones, Georgia display, system sans body, and JetBrains Mono/existing mono.
- Map tokens into site, console, desktop, and HermesHQ.
- Preserve white-label rules for user-facing strings.

Gate: all four surfaces visually align in light/dark mode.

## Phase 8 - Beta Hardening

- Add provisioning limits and beta gates.
- Configure auth/approval emails.
- Enable Traefik logs, HermesHQ health dashboard, and Sentry where DSNs exist.
- Rotate forward-auth tokens and keep secrets out of images.
- Rehearse cold VPS setup, package desktop, deploy console/HermesHQ.

Gate: 5-10 external beta testers can sign up, be approved, chat reliably in isolated containers, and be torn down cleanly.
