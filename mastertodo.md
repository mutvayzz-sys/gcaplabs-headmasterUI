# Master To-Do

## ✅ DONE 2026-07-02: stub removal + Composio MCP reload

This pass turns the remaining Composio MCP registration work into a live reload path instead of a
"write config and restart container" path.

### Implemented locally this pass

- **Gateway / runtime (`gcaplabs-hermeshq`)**
  - `/api/mcp/servers/import` now writes the real `$HERMES_HOME/config.yaml` `mcp_servers` store via
    `mcpConfigStore.ts`, not the dead `api-compat.json` MCP array.
  - Runtime image now copies `backend/hermes-agent-patches/*.patch` and applies them after cloning
    `NousResearch/hermes-agent` in `backend/runtime.Dockerfile`.
  - Added `backend/hermes-agent-patches/0001-reload-mcp-from-config.patch`, which adds
    `tools.mcp_tool.reload_mcp_from_config()` to the vendored Hermes runtime during image build.
  - `server/workers/hermes_worker.py` supports JSONL `mcp.reload`.
  - `HermesWorkerAdapter.reloadMcp()` forwards to the worker with a 130s timeout.
  - Gateway exposes `POST /api/mcp/reload` and returns `{added, removed, reconnected, tool_count,
    server_count}`.
- **Console (`gcaplabs-console2`)**
  - `src/lib/hermeshq.ts` has `reloadMcp()` for `POST /api/mcp/reload`.
  - `register-mcp` registers the Composio MCP URL with `x-api-key`, then calls reload and returns the
    reload summary.
  - `.env.example` was already scrubbed to placeholders; no real Supabase keys remain there.
  - Removed dead `src/config/agents.ts`, fixed dashboard heading to single-agent wording, and added
    Composio pagination TODOs.
  - `removeToolkitFromSharedMcp()` no longer deletes the shared MCP server when the last auth config
    is removed; it PATCHes the shared server only.
- **Desktop (`gcaplabs-headmasterUI`)**
  - Removed the unused `stubProvider` export and all test/helper references.

### Deploy / verification

- Pushed commits to all three repos.
- VPS `gcaplabs-hermeshq` pulled latest, rebuilt `headmaster-hermes-runtime:latest`, and recreated
  both active runtime containers using the existing per-user `hermes-home-*` named volumes.
- Pre-deploy backups were written under `/home/m4/headmaster-stack/backups/`:
  `pre-mcp-reload-20260702T160122Z.tar.gz` plus `runtime-homes-20260702T160122Z/`.
- Live runtime smoke passed on both recreated containers: `/v1/health` returned healthy and
  `POST /api/mcp/reload` returned a valid summary.
- Disabled MCP config smoke passed on `hm-18016c48-cda.gcaplabs.com`: create disabled server → reload
  → delete server → confirm removed.

### Still required manually

- Reconnect/refresh Gmail OAuth in `console.gcaplabs.com` if Google still blocks the existing token,
  then ask `List my 3 most recent emails` and confirm the agent uses Gmail MCP tools.

## 🔧 IN PROGRESS 2026-07-02 (later session): compat-router shape bugs, console2 → gcaplabs-console merge, real Composio integration

**Context:** this session found and fixed why Headmaster desktop chat was totally broken (not the
identity-linking bug above — a separate, later regression), then did a full redesign pass on the
console, then started wiring a real "Integrations" tab. Two follow-up features are scoped below but
**not yet built** — read the "Next session" block before starting either.

### Done and deployed this session

**`gcaplabs-hermeshq` (`third_party/agent37/gateway`) — commits `af4405b`, `5d674c7`, now live on the
VPS (`hermes-a48f4b18-b9805f74` / `hm-37c5ff7f-64e.gcaplabs.com`):**

- The `/api` compatibility router (`server/routes/api.ts`) existed locally but was **never deployed**
  — every `/api/*` route 404'd on the live container, which silently disabled the desktop chat send
  button (no model ever resolved from `/api/model/options`). Committed + pushed + VPS rebuilt +
  redeployed (`af4405b`).
- Found via a _real_ smoke test (not just code review): four routes wrapped array responses in an
  object envelope (`{jobs:[...]}`, `{artifacts:[...]}`, `{confirmations:[...]}`, `{commands:[...]}`)
  when `ipcBridge.ts` expects raw arrays. The slash-commands one crashed the whole renderer
  (`AppErrorBoundary: "(i ?? []) is not iterable"`) the instant a real session existed. Fixed +
  redeployed (`5d674c7`). Also fixed `resolvePython()` to check the Windows venv layout
  (`venv/Scripts/python.exe`) so the gateway's own test suite runs on Windows dev boxes, not just
  Linux prod (recovered 4 previously-"failing" tests that were actually just spawn failures).
- **Still open, not investigated further:** intermittent `/api/sessions/<id>` 404 right after a
  message send — likely the Python worker persisting the session lazily (after the first turn
  completes) rather than immediately, so an eager client poll can race it. Not confirmed with worker
  logs. Low priority — chat works end-to-end now, this only matters if it's still visibly broken (not
  just console noise) on a future test.

**Console consolidation — one repo now, `github.com/mutvayzz-sys/gcaplabs-console`:**

- Discovered 4 local clones of the _same_ GitHub repo under different folder names (`gcap-console`,
  `gcaplabs-console`, `gcaplabs-console2`, a timestamped `gcaplabs-console.partial-from-gcap-console-*`
  scratch folder) — all confirmed via `git remote -v` to point at the one repo. Deleted the three
  redundant/stale ones (verified no unique uncommitted work first), renamed `gcaplabs-console2` →
  `gcaplabs-console`. **This is now the only local console checkout — use it, don't recreate others.**
- Pushed the console2 redesign work: per-agent workspace routing
  (`/dashboard/agents/{id}/{chat,files,integrations,settings}`), admin-gated top-level screens
  (Agents list / Members / Settings redirect non-admins straight to their own agent's chat — gate is
  `src/lib/auth.ts`'s `isConsoleAdmin`/`requireConsoleAdminOrRedirect`, backed by the existing
  `memberships` table role, **not** the HermesHQ per-user capability role — those are two different
  role systems, don't conflate them).
- **Found and flagged, not fixed:** `.env.example` has real (not placeholder) Supabase keys
  including `SUPABASE_SERVICE_ROLE_KEY` committed to git history since the July 1 scaffold commit.
  User said they'll rotate after testing settles — **check this got done**, and that `.env.example`
  itself got scrubbed to placeholders.

**Composio integration — real API, not the Agent37-Cloud-hosted proxy the old starter-kit used:**

- The demo GIF's "Integrations" tab (`agent37-platform/starter-kit`, `screenshots/demo.gif`) calls
  Agent37 Cloud's _private_ hosted API (`agent37.connectIntegration()` etc, `/instances/{id}/integrations/*`)
  — GCAP Labs deliberately moved off Agent37 Cloud (`2470af3`, "The console runs on HermesHQ (/v1) now"),
  so that code was already correctly deleted before this session started. It is **not open source** —
  the starter-kit repo is just a thin BFF client for Agent37's closed hosted execution engine, so
  "replicate everything, it's open source" does NOT get you that engine for free. Confirmed via
  `git remote add upstream https://github.com/agent37-platform/starter-kit.git && git fetch upstream`
  (this remote is now on the console repo — use `git log upstream/main -- <path>` /
  `git show upstream/main:<path>` to check what the original had before assuming something's missing).
- Built a real Composio integration from scratch calling `https://backend.composio.dev/api/v3`
  directly (server-only, `COMPOSIO_API_KEY` in `.env.local` + Vercel project env — **not** committed;
  `.env.example` only has a placeholder). New files: `src/lib/composio.ts`,
  `src/app/api/chat/integrations/{toolkits,connections,connect}/route.ts`,
  `src/components/integrations/ComposioApps.tsx`. Browse (search + infinite scroll + sort by
  usage/alphabetically), connect (OAuth via Composio-managed auth configs, created lazily per
  toolkit), disconnect — all working and deployed. Deleted the dead `/api/chat/integrations` combined
  MCP+Google stub route and the "Google (runtime)"/"MCP servers" placeholder sections in
  `AgentWorkspace.tsx` — they never showed real data. Reference for the exact API contracts used
  (OpenAPI spec pulled from `https://backend.composio.dev/api/v3/openapi.json`, live-verified against
  the real key): toolkits (`GET /toolkits?search=&sort_by=usage|alphabetically&cursor=`), connected
  accounts (`GET /connected_accounts?user_ids=`), auth configs (`GET/POST /auth_configs`), connect
  (`POST /connected_accounts/link` → `redirect_url`).
- **Gotcha hit and fixed:** a custom `ComposioError` class didn't extend `ApiError`/`RuntimeError`,
  so `handleError()` (`src/lib/http.ts`) collapsed every real Composio failure into an opaque
  "Internal server error" — masked what turned out to be a false alarm (both the old and new
  Composio keys tested valid directly; likely just trailing whitespace from a dashboard paste).
  Fixed the class hierarchy + added `.trim()` on the key read (`b7e46e8`, `a6c960c`).

### ⛔ Gap found, NOT yet built: connecting an app doesn't give the agent a tool

Connecting Gmail via Composio only creates a Composio-side OAuth connection — it does **not** wire
anything into the Hermes agent's actual tool-calling. Confirmed live: asked the connected agent to
list 3 emails, it had no email tool at all. Two separate things got conflated in the demo GIF because
Agent37 Cloud's proprietary hosted runtime does this wiring invisibly server-side; self-hosted Hermes
has no such magic and needs it built explicitly.

**Also confirmed real and buildable (not proprietary) — this is the fix:**

- Composio has its own first-class MCP server product (separate from the toolkit-connection API
  above): `POST /api/v3/mcp/servers` (create a server bound to one or more `auth_config_ids`, returns
  a server `id`), `POST /api/v3/mcp/servers/{serverId}/instances` (per-`user_id` instance → a
  connectable MCP URL, format `https://backend.composio.dev/v3/mcp/{serverId}?user_id={userId}`),
  `PATCH /api/v3/mcp/{id}` (add more `auth_config_ids`/toolkits to an existing server later).
- Hermes Agent (the actual open-source runtime GCAP self-hosts,
  [github.com/NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)) has **native
  MCP support** — confirmed via
  [MCP docs](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp),
  [MCP config reference](https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference),
  and the actual source
  [`hermes_cli/mcp_config.py`](https://github.com/NousResearch/hermes-agent/blob/main/hermes_cli/mcp_config.py).
  MCP servers live under the `mcp_servers` key in `$HERMES_HOME/config.yaml` (same file
  `hermes_worker.py:288` already reads for model credentials). HTTP-transport entry shape:
  `{"url": "...", "headers": {...}, "enabled": true}`. CLI equivalent: `hermes mcp` /
  `hermes mcp install <name>`.
- **The bug:** `gcaplabs-hermeshq`'s `/api/mcp/servers` compat route (`server/routes/api.ts`) is a
  fake stub — it reads/writes a local `api-compat.json` file that **nothing else reads**. Confirmed
  via `grep -rl "api-compat\|mcpServers" server/workers/ server/adapters/` → zero hits. It was built
  purely to stop the desktop client's Settings/MCP page from 404ing, not to actually register
  anything with the running agent.

**Scoped plan — DONE (2026-07-02, code committed + pushed, pending VPS deploy + E2E test):**

1. ✅ **Gateway** (`gcaplabs-hermeshq/third_party/agent37/gateway`): rewrote the `/mcp/servers`
   GET/POST/PUT/DELETE/toggle handlers to read/write the real `$HERMES_HOME/config.yaml`'s
   `mcp_servers` key via a new `server/mcpConfigStore.ts` module (read-modify-write, atomic
   rename, preserves all other config keys). Added `yaml` npm dependency. HTTP response shape
   unchanged (IMcpServer contract preserved — desktop client needs no changes). 8 tests pass
   (5 unit + 3 integration). Commits: `532cf8a`, `16ba9fc`, `7c8738c`. Pushed to `origin/main`.
   **VPS deploy pending**: pull + rebuild `headmaster-hermes-runtime:latest` + recreate
   provisioned containers (can't SSH to VPS from this machine — SSH unreachable).
2. ✅ **Console** (`gcaplabs-console2`): after Composio OAuth redirect, the console now calls
   `POST /api/chat/integrations/register-mcp` which creates/updates a shared Composio MCP server
   (`headmaster-shared`), creates a per-user instance (`user_id` = Supabase user id), then POSTs
   the MCP URL to the user's runtime gateway `/api/mcp/servers` → `config.yaml`. On disconnect,
   removes the auth_config from the shared server and removes the MCP server from the gateway.
   New: `src/lib/composio.ts` (MCP server/instance management), `src/lib/hermeshq.ts`
   (registerMcpServer/removeMcpServer), `src/app/api/chat/integrations/register-mcp/route.ts`,
   updated `ComposioApps.tsx` (calls register-mcp after OAuth redirect), updated disconnect route.
   Typecheck + build PASS. Commits: `db91a73`, `b80f10e`, `80bbd81`. Pushed to `origin/main`.
   Vercel auto-deploy triggered (route returns 307 = auth gate, not 404).
3. ⏳ **Verify end-to-end**: connect Gmail → ask the agent to list emails → it actually calls a
   Gmail MCP tool. **Blocked on VPS deploy** (Task 1 above) — the runtime image must be rebuilt
   with the new gateway code before the `/api/mcp/servers` route writes to `config.yaml`.

### Also discussed, NOT scoped/started: admin fleet management (create/manage multiple agents)

User asked about replicating the starter-kit's multi-agent admin panel (`AgentsView.tsx` /
`ActiveAgentSwitcher.tsx`, deleted in `2470af3` because it called Agent37 Cloud's private instance
API). Unlike the Composio gap, this **is** replicable self-hosted — `gcaplabs-hermeshq`'s own backend
already has an unused agent CRUD API for exactly this (`backend/hermeshq/routers/agents_crud.py`:
`GET/POST /agents`, `GET/PUT/DELETE /agents/{agent_id}`). Console currently only supports a single
managed agent per user (`MANAGED_AGENT_ID` constant in `src/lib/managed-agent.ts`) — turning this
into real fleet management means: a new admin-only agent-list/create/delete UI in console (parallel to
the existing single-agent dashboard, not a replacement — regular users still just get their one
agent), wired to `agents_crud.py` instead of Agent37 Cloud. **Not scoped in detail — do this only
after the Composio/MCP fix above, and re-scope it properly (read `agents_crud.py` fully, decide how
it interacts with the existing `MANAGED_AGENT_ID` single-agent assumption baked into
`managed-agent.ts`/`dashboard-tabs.ts` before writing UI) rather than guessing.**

## ✅ RESOLVED 2026-07-02: console/desktop identity linking — verified live end-to-end

Console (Supabase-authenticated) and desktop (HermesHQ-native username/password) were found to
resolve to the same `HermesHQ.users` table already via `combined_auth.get_authenticated_user` —
but nothing linked a Supabase account to a HermesHQ user unless an admin manually gave a User row
a matching `email`. Brand-new console signups (`gcap-console`'s Supabase `signUp()`) never touched
HermesHQ at all, so they got a session but could never get a runtime provisioned. This is now
fully fixed, deployed, and confirmed working live against `console.gcaplabs.com` — a real chat
turn streamed and rendered correctly (see "Live smoke test" below). Three separate bugs had to be
found and fixed to get there; all are pushed and deployed.

**1. `gcaplabs-hermeshq` — identity linking (`c2f03e2`, `6212159`):**

- `verify_supabase_token` auto-provisions a `User` (role=`pending`, same queue as native
  open-signup) when a verified Supabase JWT has no matching email, instead of returning `None`.
- `UserUpdate`/`update_user` gained `username`/`email` fields with uniqueness checks — previously
  there was no way to rename/relink an existing user via the API at all.
- Bootstrap admin relinked live: username/email both set to `admin@gcaplabs.com`, password
  `Lana2003!!` — same account now used on both console and desktop.
- **Real bug found via live testing:** `verify_supabase_token` hardcoded
  `algorithms=["RS256"]`, but this Supabase project signs with ES256 (EC) keys — every JWT
  verification silently failed with "Could not validate Supabase token with any JWKS key" → 401
  on every console API call. Fixed to read each JWKS key's own `alg` field (`6212159`).
- `hq.gcaplabs.com`'s own native `/register` page removed (`deb0453`) — console/Supabase is now
  the only signup front door; `OPEN_SIGNUP` confirmed already `false` on the live box.
- 13 new/changed backend tests, full suite green (344 passed, 23 skipped, one pre-existing
  Windows-only `fcntl` exclusion in `test_regressions.py`).

**2. `gcap-console` — chat rendering bug (`1f0ce02`):** once auth was fixed, the first real
end-to-end chat turn streamed correctly server-side (confirmed by reading the raw SSE response
directly) but rendered as a blank assistant bubble in the UI. Root cause:
`src/app/dashboard/page.tsx`'s SSE parser read `evt.delta` for
`response.output_text.delta`/`response.reasoning.delta` events, but the gateway sends the chunk
as `{"text": "..."}` — `evt.delta` never existed, so every turn silently accumulated an empty
string. Also fixed `response.failed` reading `evt.error` as a string when it's actually
`{message}`. Confirmed fixed live — a full turn with real reasoning + output text now renders.

**Live smoke test (2026-07-02, done via browser automation against the real production URLs):**
signed up `admin@gcaplabs.com` on `console.gcaplabs.com` → hit the Supabase "Confirm email"
redirecting to `localhost` (Supabase project's Site URL was still the default — owner fixed via
dashboard: Site URL → `https://console.gcaplabs.com`, confirm-email disabled to match what the
app code already assumed) → logged in → container provisioned → sent a real chat message → it
streamed and rendered correctly end-to-end.

**Still open:** desktop-side confirmation — log into the desktop app with
`admin@gcaplabs.com` / `Lana2003!!` and confirm it shows the same session history as console
(same container, so it should, but not yet manually verified from the desktop client itself).

## ✅ RESOLVED 2026-07-02: `gcaplabs-hermeshq` branch `wip` (60dd361) + full VPS rebuild/smoke

**Update:** the VPS Claude session handled this correctly on its own — orientation caught that a
direct `git pull` would have collided with local uncommitted changes. It split them: the part that
was a straight revert of `d1391a5` (re-adding the legacy `NOUS_API_KEY` injection `d1391a5` removed)
was **dropped**; the part that was real, unrelated WIP (human-in-the-loop interactive callbacks —
approval/clarify/sudo/secret — across the `agent37` gateway's Python worker + TS adapters) was
**preserved** on the `wip` branch (`60dd361`) rather than lost or force-merged. `wip` is still stale
relative to `main` and should be rebased (not merged directly) before it's picked up again — that
guidance below is unchanged, just no longer urgent since main is clean.

The VPS session then completed its full assigned task:

1. Pulled `main` clean to `593d5b5` (later `769393f`/`fa8974e`); confirmed the legacy NOUS key
   injection is gone from the running container.
2. Rebuilt `headmaster-hermes-runtime:latest` with the chown perf fix (`c258d59`) and the
   `runtime-entrypoint.sh` `config.yaml` materialization; recreated the provisioned container onto it.
3. **Full smoke test passed**: 401 without bearer → 200 with bearer on `/v1/health`; `/v1/models`
   returns the kimi catalog with `kimi-k2.7-code` as default; `/v1/responses` streamed a real
   end-to-end kimi turn (reasoning deltas → output text → "hello beta").
4. Cold-VPS rehearsal: `provision-host.sh` referenced in the original brief doesn't exist in this
   repo (the only file by that name on the box is a stale unrelated `openclaw-host-kit` artifact) —
   but the actual Headmaster equivalent (compose build+up, runtime image build,
   provision-container create, external health check) was exercised end-to-end multiple times
   already, with no impact to existing beta data.
5. **Found and fixed a real bug that would have silently broken every beta chat:**
   `hermes-agent` treats the `anthropic` Python client as an optional extra, but kimi-code (the
   beta default model) needs it for `anthropic_messages` API mode — every provisioned container was
   failing on the first turn with an import error. Fixed via
   `769393f fix(runtime): install hermes-agent's anthropic extra for kimi-code`, now on `main`
   (`fa8974e`, `2026.7.2.4`).

This resolves the "Live runtime smoke" and "For Hermes (VPS)" sections below — check marks added
there; the wip-branch guidance stays in place for whenever that feature gets finished properly.

## veeplan.md (Agent37-aligned, 2026-06-30)

The beta roadmap is `veeplan.md` (Phases 0–7) +
`.hermes/plans/2026-06-30_222130-headmaster-beta-readiness.md` (bite-sized task breakdown).
This file is the single source of truth for per-phase status and outstanding work.

## ⏭️ NEXT SESSION — Verification pass + gap fixes (audit 2026-07-02)

A 3-agent static audit confirmed the bulk of Phases 0–7 is **genuinely done**. What follows is a
self-contained work order for a fresh context to fix the four residual gaps, verify, and reconcile
the trackers. Repos live at `C:\Users\Matve\Desktop\GCAP-Labs\{gcaplabs-hermeshq, gcap-console, gcaplabs-headmasterUI}`.

**Already correct — DO NOT redo:** HermesHQ Phase 3 (provision `/v1` metadata, Supabase JWKS trust
w/ no shared secret, kimi injection in `containers.py::_runtime_env` `:70-77`, host-kit/Traefik
supervisor + caps + `no-new-privileges`, `PUBLIC_BASE_URL`, `runtime-entrypoint.sh`, open-signup);
Console Phase 4 (Next 16 + Supabase SSR + Tailwind v4; chat/files/models/sessions on `/v1`;
`/v1/responses` SSE; single-container-by-design); Desktop Phase 5 (**remote mode already on `/v1`
SSE**, WS hard-disabled remotely via `getWsUrl` throw + `connectRpcWs` reject; provision snapshot
carries subdomain/forward-auth-token/`/v1` base/model catalog). The `x-headmaster-container-id`
"gap" is a **non-issue** — Traefik injects it per route; the client only sends the bearer.

### Gaps to fix — G1–G3 DONE, COMMITTED, AND VERIFIED (2026-07-02)

> The prior session crashed before committing/verifying, but a re-check this session found all
> three repos' working trees already clean — the commits had landed. This session ran the actual
> verification (previously skipped) and it passed clean everywhere.

- [x] **G1 — HermesHQ: drop legacy nous injection.** DONE and committed —
      `d1391a5 fix(containers): drop legacy NOUS_API_KEY injection from admin provision`, now on
      `gcapslab/main` (fast-forwarded past a version-bump commit from another machine, `593d5b5`).
- [x] **G2 — Console: remove dead Agent37 cloud residue.** DONE and committed —
      `2470af3 chore: remove dead Agent37 hosted-cloud residue`, pushed to `origin/main`.
- [x] **G3 — Desktop: finish dark-mode branding.** DONE and committed —
      `fe9886c fix(theme): rebrand desktop dark mode to GCAP + tracker updates`, on `origin/main`.
- [x] **G4 — Note only:** desktop token is `--primary`/`--color-primary`, not `--theme-primary` —
      intentional; do not rename.

**Cleanup done this session (2026-07-02):**

- [x] Deleted the dead `gcap-console/src/lib/agent37.ts` shim (zero import sites remained) and
      fixed the stale `lib/agent37.ts` comment in `src/components/files/types.ts` → now points at
      `lib/hermeshq.ts`. Commits `ecb5283` + `3219f21`, pushed to `origin/main`.
      Note: a local formatter hook reformatted that one file to single quotes, inconsistent with the
      rest of the console repo's double-quote convention — cosmetic only (typecheck/build still pass),
      worth a follow-up `prettier`/`oxfmt` pass on that file if it bothers anyone.

### Verify — RUN 2026-07-02, all clean

- [x] Desktop (`gcaplabs-headmasterUI`): `bunx tsc --noEmit` clean; `bun run test` → **1332 passed,
      3 skipped** (175 test files passed, 1 skipped).
- [x] Console (`gcap-console`): `npm run typecheck` clean; `npm run build` → compiled successfully
      (Next.js 16.2.9 / Turbopack).
- [x] HermesHQ (`gcaplabs-hermeshq/backend`): `pytest` (via the repo's own `.venv`, not the global
      Python — that's what made the first attempt fail with `ModuleNotFoundError: hermeshq`) →
      **335 passed, 23 skipped**, excluding `tests/test_regressions.py` (the one known-bad file: it
      imports `fcntl`, a Unix-only stdlib module, so it can never collect on Windows — not a real
      failure, just a platform gap). Only one bad file surfaced, not three as the tracker guessed;
      update that number if a future session finds the other two.

### Live runtime smoke (remote mode against `hm-<id>.gcaplabs.com/v1/*`) — DONE 2026-07-02

- [x] Provision → `GET /v1/health` 200 through Traefik+forward-auth (401 w/o bearer, 200 with token).
- [x] `GET /v1/models` returns kimi catalog (`kimi-k2.7-code` as default).
- [x] `/v1/responses` streamed a real end-to-end kimi turn (reasoning deltas → output text).
- [ ] Desktop remote: create session → prompt → stream kimi turn → cancel → list sessions → browse
      files; approval/clarify round-trips via `POST /v1/responses/{id}/interactive`; status shows Active.
      (Backend side is proven; still need the desktop client itself exercised against it — in
      progress, see below.)
- [ ] Console: signup → approve → dashboard → chat streams a kimi turn.

**Rebuild done 2026-07-02:** `headmaster-hermes-runtime:latest` rebuilt with the entrypoint +
Dockerfile perf fix (`c258d59`) and the `anthropic`-extra fix (`769393f`); provisioned container
recreated onto it. `provision-host.sh` doesn't exist in this repo (the file by that name on the box
is a stale, unrelated `openclaw-host-kit` artifact) — the actual Headmaster cold-start equivalent
(compose build+up, image build, provision-container create, external health check) was exercised
end-to-end instead, repeatedly, with no data impact.

### Tracker updates

- [x] `mastertodo.md`: Phase 5 desktop flipped off 🔴 (see resolved note below); G1–G3 checked.
- [x] `masterlog.md`: 2026-07-02 entry appended (audit, gap fixes, architecture direction, AionUI re-homing).
- [x] `mastertodo.md`: 2026-07-02 follow-up session — reconciled the G1–G3 "uncommitted" framing
      (all three were already committed), ran the verification that was skipped, pushed
      hermeshq/console to their remotes, deleted the dead `agent37.ts` shim.

---

## 🧭 Architecture: client model (decided 2026-07-02)

**Remote-first thin client + HeadmasterCore for local hands.**

- **Client = thin, `/v1/responses` SSE only.** Local vs remote is just a URL. Long-term retire the
  WS-RPC path + `hermesBootstrap` + `binaryResolver` + `bundled-hermes/`. Unify on _transport_, not
  location — if a local runtime is ever wanted, run the gateway locally and still speak `/v1`.
- **Brain = remote Hermes container** — model, orchestration, sessions, memory, heavy tools.
- **HeadmasterCore = local daemon giving the remote brain hands on the user's machine.** Dials OUT
  to the VPS (reverse/outbound tunnel; no inbound ports), exposes local capabilities (fs, shell/PTY,
  browser/computer-use, Office) as **MCP servers** the remote Hermes registers as tools — per-user
  scoped, forward-auth HMAC gated, coarse-grained to beat latency. Degrades to a cloud-sandbox agent
  when not connected.
- **HeadmasterCore is built FROM the AionCore binary** (`_support/upstream/aioncore`): it already
  ships `aionui-mcp`, `aionui-shell`, `aionui-file`, `aionui-office` (OfficeCLI), `aionui-team`
  (Council), `aionui-cron`, `aionui-realtime`. Take it / re-skin it → AionCore _is_ HeadmasterCore.

**⚠️ Branding (white-label rule — mandatory):** everything taken from AionCore/AionUI must be
**renamed to Headmaster branding** — no `AionUI`/`AionCore`/`AOU`/`aionui-*`/`officecli` strings
surfaced. Target names: **HeadmasterCore** (the binary/daemon), **HeadmasterMCP** (the MCP surface),
Headmaster Office (OfficeCLI), Headmaster Council (Council/team). Rename crates, binaries, CLI names,
env vars, log tags, and every user-facing string; keep `hermes`/`Nous`/`AionUi` out of the UI.
This also applies to build/package scripts and their terminal output: scripts may keep upstream
runtime identifiers only when they are internal compatibility plumbing, never as visible product
branding or user-facing status text.

**Roadmap (post-beta / parallel track):**

- [ ] Collapse desktop client to a single `/v1` transport; delete WS-RPC + local-bundled-Hermes path.
- [ ] Fork/vendor AionCore → **HeadmasterCore**; rebrand all names (crates, binary, CLI, env, UI
      strings) to Headmaster before shipping (HeadmasterCore / HeadmasterMCP / Headmaster Office /
      Headmaster Council).
- [ ] Stand up HeadmasterCore: expose `shell`/`file`/`office`/`team` over **HeadmasterMCP**; add the
      outbound tunnel + forward-auth handshake so a remote container can reach it.
- [ ] Remote Hermes: register HeadmasterMCP tools per session, behind explicit user consent.

## 🔁 AionUI features to bring back — RE-HOME, don't re-add (they're still in-tree)

All three are present and wired in the current app but assume **local** processes — which collides
with remote-first. The work is re-homing, not re-adding.

- [ ] **Preview panel** — pure renderer (`renderer/pages/conversation/Preview/`, mounted in
      `ChatLayout`, `PreviewProvider` in chain). **Stays client-side**; source file bytes from the
      container via `/v1/files*` (as the console already does). Easiest — mostly already works.
- [ ] **OfficeCLI** — `OfficeWatchViewer.tsx` spawns a local `officecli watch`. Provided by AionCore
      (`aionui-office`). **Re-home into the container image / HeadmasterCore**, expose as a Hermes
      tool/skill (`package-assistant`). Live `watch` → `/v1/files` polling / change events in remote mode.
- [ ] **Councils** — Team feature via the local AionCore sidecar (`aioncoreBootstrap`,
      `useCouncilSidecar`, `CouncilSidecarBanner`; native in-process fallback exists). Provided by
      AionCore (`aionui-team`). **Re-home** so orchestration runs server-side or via HeadmasterCore MCP.

Consolidation: OfficeCLI + Council + local execution all come from **one AionCore/HeadmasterCore
binary**; the preview panel stays in the thin client. **All three must be rebranded** on the way in
(Headmaster Office, Headmaster Council, HeadmasterMCP) — strip `officecli`/`aionui`/`AOU` from every
surfaced string, including the existing `officecliNotFound` i18n keys and `--aou-*` token names.

---

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
- [x] Phase 5: desktop remote runtime — **DONE (audit 2026-07-02)**. In remote mode the full chat
      path is on `/v1`: streaming (`/v1/responses` SSE + cancel/reconnect), prompt submit, sessions, and
      interactive/approval flows (`POST /v1/responses/{id}/interactive`, commit `31074cf`). WS-RPC is
      hard-disabled remotely (`getWsUrl` throws / `connectRpcWs` rejects, `f1ad6da`); status probe uses
      `/v1/health` (`d3d9566`). Legacy WS survives ONLY for local-dashboard mode, **by design** — not a
      bug. See the resolved note below.
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

## ✅ Desktop remote-runtime /v1 migration — RESOLVED (audit 2026-07-02)

**Status:** DONE for remote mode. What was flagged 🔴 on 2026-07-01 has since been fixed by commits
`d3d9566` (status probe → `/v1/health`), `f1ad6da` (fail-fast on WS in remote mode + verified no
WS-RPC in the renderer), and `31074cf` (interactive/approval flows → `POST /v1/responses/{id}/interactive`).
In remote mode the full chat path — session create, prompt submit, streaming, cancel, sessions,
files, approval/clarify — runs on `/v1`; WS-RPC is hard-disabled remotely (`getWsUrl` throws,
`connectRpcWs` rejects). Legacy WS-RPC remains **only** for local-dashboard mode, by design (see the
Architecture decision above — long-term the client collapses to a single `/v1` transport). The
`x-headmaster-container-id` header is a non-issue (Traefik injects it per route; client sends bearer).

The original problem write-up is retained below for history.

**[HISTORICAL — now fixed] Problem (2026-07-01):** Phase 5's `/v1` migration was only PARTIAL.
Response _streaming_ moved to `/v1/responses` SSE, but the desktop still drove sessions + prompt
submission over the **legacy Hermes WebSocket JSON-RPC** (`gatewayRpcRequest` → `wss://<runtime>/api/ws`,
built by `getWsUrl()`/`connectRpcWs()` in `common/adapter/httpBridge.ts`). The Agent37 runtime is
**REST-only** (`/v1/*`) and has no `/api/ws`, so in remote mode the WS never connected →
"Headmaster: Inactive" and remote chat couldn't send prompts or create sessions.

**Legacy WS-RPC call sites to migrate → Agent37 `/v1` surface** (surface per gateway `AGENTS.md`:
responses, sessions, models, files):

- `common/adapter/hermesChatAdapter.ts`:
  - `session.create` → `POST /v1/responses` (start a response/session)
  - `session.resume` → `GET /v1/sessions/{id}` (transcript) + `GET /v1/responses/{id}/stream` (reattach)
  - `prompt.submit` (send message) → `POST /v1/responses` (`session_id` + input)
  - `session.interrupt` → `POST /v1/responses/{id}/cancel`
  - `approval.respond` / `clarify.respond` / `sudo.respond` / `secret.respond` → map to the `/v1`
    interactive/tool-call response flow (check gateway `README.md` — likely a follow-up
    `POST /v1/responses` carrying the tool/approval result)
- `renderer/hooks/system/useRuntimeConnectionState.ts`: status probe `session.list` →
  `GET /v1/health` (or `/v1/models`) so "Active/Inactive" reflects real runtime health.
- Session list / history & file browser: confirm they hit `GET /v1/sessions` + `/v1/files*`,
  not WS RPC.

**Supporting cleanup:**

- `common/adapter/httpBridge.ts`: retire `connectRpcWs`/`gatewayRpcRequest`/`/api/ws` for remote
  mode (keep only if local-dashboard mode still needs WS); remove the `9119`/`9120`/`8080` port
  fallbacks (veeplan Phase 5 "remove brittle port logic").
- Ensure every remote `/v1` call attaches the forward-auth `Authorization: Bearer <token>` +
  `x-headmaster-container-id` (Traefik injects the container-id header per route; the client sends
  the bearer). Confirm `applyProvisionGlobals` wires `__runtimeBearerToken` into httpBridge auth.

**Quick win (do first):** fix `useRuntimeConnectionState.probe()` to a `/v1/health` GET — makes the
indicator accurate and unblocks the "is it connected" UX even before the full chat-path migration.

**Verification (remote mode against `hm-<id>.gcaplabs.com/v1/*`):** create session → send prompt →
stream a kimi turn → cancel → list sessions → browse files; approval/clarify prompts round-trip;
status indicator shows **Active**.

### Runtime image rebuild (pending — infra)

- [ ] Rebuild `headmaster-hermes-runtime:latest` on the VPS with the entrypoint + Dockerfile perf
      fix (`c258d59`) and recreate provisioned containers. **Blocked 2026-07-02 by flaky SSH-over-tunnel**
      under build load (repeated `websocket: bad handshake`). The live container already works via a
      manual kimi `config.yaml`; the rebuild makes it automatic. Retry when the tunnel is stable, or
      build via Portainer/Cockpit on the box.

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
- [x] **End-to-end flow test (routing layer)** — done 2026-07-01: provision → `hm-<id>.gcaplabs.com` → **HTTP 200** over the full public path, forward-auth 401 without token, valid TLS. Fixed 2 bugs en route: multi-instance Traefik route file (`c50713b`) + backend dir-mount (`41d6478`).
- [x] **FIXED: Hermes worker used wrong model config** — root cause: the worker reads model settings ONLY from `$HERMES_HOME/config.yaml` (`hermes_cli.config.load_config`); it ignores the `HERMES_DEFAULT_*` env our provision injects. The baked config was `nous-api`, so kimi containers ran nous-api with no key → worker hung ("did not respond within 10000ms") → `/v1/models` 502. Fix: `backend/runtime-entrypoint.sh` materializes `config.yaml` from `HERMES_DEFAULT_PROVIDER/MODEL/BASE_URL/API_MODE` at startup (hermeshq `2111f0c`). Verified in-container: `/v1/models` returns the kimi catalog; `KIMI_API_KEY` read from env (no api_key in config).
  - [ ] Rebuild `headmaster-hermes-runtime:latest` on VPS + recreate provisioned containers so they pick up the entrypoint (build in progress).
  - [ ] Full chat smoke: `/v1/responses` streams a real kimi turn end-to-end.
- [x] **Desktop app built** — `out/win-unpacked/Headmaster.exe` (v0.2.4, signed) + `C:\Users\Matve\Desktop\Headmaster.lnk` shortcut created 2026-07-01.
- [ ] **Beta cold-VPS rehearsal** — provision-host.sh + build image + create instance from clean box (blocked on the worker fix above for a fully working instance)
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
