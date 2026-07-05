# Master Log

## 2026-07-05

### Vendored HermesHQ tree removed from the desktop repo

Removed the tracked `gcaplabs-headmasterUI/hermeshq/` legacy backend copy after re-running the
removal audit. Confirmed before deletion: no nested `.git`; 504 tracked files; root workspaces only
include `packages/*`; `electron-builder.yml`, `electron.vite.config.ts`, `scripts/build-with-builder.js`,
`scripts/afterPack.js`, package manifests, and lockfiles have no `hermeshq` dependency; active
`packages/desktop/src` has zero `VITE_HERMESHQ`, `__hermeshq`, `hermeshq:`, or `getHermeshq*` hits.

Also replaced the stale `packages/desktop/.env.example` `VITE_HERMESHQ_URL` sample with
`VITE_CONSOLE_URL=https://www.console.gcaplabs.com` and removed obsolete `hermeshq/` artifact ignores
from `.gitignore`. The separate workspace-root `gcaplabs-hermeshq/` repo remains untouched and
HermesHQ VPS teardown stays owner-owned/manual.

### Kanban review batch: desktop duplicate-send, remote-mode gates, Console CORS/OAuth, board closeout

Owner shifted the artifact-derived Kanban workflow into explicit human-in-the-loop mode: workers
block with `review-required`, operator asks, owner confirms, then operator moves the cards. Review
queue and hold routing were applied first: iOS + manual desktop smoke were scheduled/on hold, while
desktop duplicate-send, desktop remote-mode gating, Console OAuth/logout regression, and marketing
screenshot truthiness stayed in review until accepted.

**Desktop / `gcaplabs-headmasterUI`:**
- Fixed the web-created/desktop-resumed duplicate-send bug by changing `submitResponseAndStream()`
  to preserve Agent37 response/session ids from nested SSE envelopes and reattach dropped streams via
  `GET /v1/responses/{responseId}/stream` instead of replaying the original `POST /v1/responses`.
  Focused regression coverage proves only one POST is made across stream recovery.
- Added cloud-mode guards for desktop-local `/api/*` surfaces so Agent37 remote mode stops fetching
  unsupported Skills/MCP/providers/cron/assistant/local-dashboard endpoints from the Console host.
  Unsupported panels now fail closed without noisy fetches instead of 404ing repeatedly.
- Fixed a follow-up localhost dev CORS loop reported from the desktop console:
  `X-Hermes-Session-Key` was being sent on `GET /api/v1/health`, but health is not scoped to a
  conversation/memory namespace. `probeRemoteHealth()` now sends bearer auth only; a new unit test
  locks that behavior.
- Added/kept evidence files from the Kanban lanes: manual E2E smoke checklist,
  `hermeshq-removal-audit.md`, focused cloud-mode/integration/sendbox tests, and the desktop UI
  polish plan under `.hermes/plans/`.

**Console / `gcaplabs-console`:**
- Added explicit CORS support to `/api/v1/[...path]` for the desktop dev origins and custom runtime
  headers: `Authorization`, `Content-Type`, `X-Hermes-Session-Key`, `X-Hermes-Session-Token`.
  Route now handles `OPTIONS` and wraps proxied/error responses with CORS headers. Pushed to
  `gcaplabs-console/main` as `33a879f`; Vercel auto-deployed and live production preflight now
  returns the expected `Access-Control-Allow-*` headers for `localhost:5173`.
- Kept the reviewed logout/Gmail OAuth fixes: global authenticated logout control regression test
  alignment and Composio OAuth popup/callback/cancel handling.
- Accepted the final Console branding cleanup review: the only remaining `agent37` strings are
  required legacy SQL identifiers in the forward migration that renames old columns/indexes; active
  UI/source copy is neutralized.
- Added launch/runtime docs: `LAUNCH_READINESS_CHECKLIST.md` and
  `docs/runtime-provisioning-and-admin.md`.

**Verification before commit/push:**
- `gcaplabs-headmasterUI`: `bunx vitest run tests/unit/common-adapter/httpBridge.test.ts --reporter=dot`
  → 32 passed; `bunx tsc --noEmit` → clean.
- `gcaplabs-console`: `npm run typecheck` → clean; `npm run build` → clean Next production build;
  live production `OPTIONS https://www.console.gcaplabs.com/api/v1/health` from
  `Origin: http://localhost:5173` returns `Access-Control-Allow-Headers` with
  `X-Hermes-Session-Key`.

**Board movement:** review-required implementation cards were marked done after owner asked to push;
iOS stays on hold for Mac/Xcode logs; manual desktop smoke stays on hold for a human login/approved
saved-login session; docs board is complete; Console and desktop synthesis cards can continue from
the pushed state.

### gcaplabs-console: re-themed off the retired green/gold/parchment tokens

Owner confirmed the old brand-token system should be actually retired in code, not just
documented as superseded — asked specifically to re-theme `gcaplabs-console` now, in a follow-up
to the logo-decision work below.

**Implementation:** `src/app/layout.tsx` now loads Space Grotesk (display) and Inter (body) via
`next/font/google` — previously neither was actually loaded, both were named in CSS and silently
falling back to system fonts. `src/app/globals.css` got a full token replacement: light mode is
white `#ffffff` background / `#0d0f14` ink / `#2563ff` blue primary / `#7c3aed` purple accent;
dark mode is `#0d0f14` background / `#15181f` cards / same blue primary / lighter `#9b6bff`
accent for contrast. Added two token groups the old system never had: `--gradient-brand` (a
blue→purple→pink→orange CSS gradient for future CTA/progress-bar use) and
`--pill-{priority,processing,connected,warning}` status-pill tint pairs — both sourced from
owner-supplied UI reference mockups of the target Headmaster product direction (see below).
`src/config/branding.ts`'s theme object updated to match. The old `gcap-brand-tokens.*` files
under `gcaplabs-headmasterUI/docs/theming/` were left on disk (still valid history of what
shipped before), just no longer current — not deleted.

**Verification:** `npm run typecheck` and `npm run build` both clean. Actually rendered `/login`
in a browser against a real production server to confirm the fonts and colors render (not just
compile) — found the project's existing dev server (a separate, pre-existing session on port
3001) had an unrelated stale/broken import error from before today; left that owner session
alone rather than touching it, and verified instead via a scratch `next start` on port 3055,
screenshotted, then shut that scratch server down. Screenshot confirmed: white background,
Space Grotesk heading actually rendering, `#2563ff` blue primary button.

**Explicitly out of scope for this pass:** no actual component (button, badge, sidebar,
composer) uses the new gradient/pill tokens yet — this pass only reached CSS custom properties.
Owner separately shared several detailed UI reference mockups of light/dark Headmaster Desktop
chat screens (sidebar nav, gradient send button, pill status badges, blurred-glow hero behind
"Hi, what's your plan for today?"). Clarified with the owner: those mockups are reference/
direction for a future **Headmaster Desktop** UI pass specifically (the sidebar footer literally
reads the desktop app's own version string), not a literal console redesign brief — the ask was
to extract the colors/branding/artistic direction generally, which is now captured in the
`gcap-brand-logo-decision` memory for whenever either a deeper console component pass or an
actual desktop redesign is scoped.

### Brand: logo decision confirmed with full spec sheets; docs-mintlify removed

Owner supplied two finished logo spec sheets (not just raw marks): `gcap-labs/brand-logos/
gcaplabs-logo-specsheet.png` and `headmaster-logo-specsheet.png`. These confirm and add exact
hex values to the logo decision already recorded 2026-07-04 (memory `gcap-brand-logo-decision`):

- **GCAP Labs (company mark):** folded/origami "G" glyph (angular blue/white/orange facets) on a
  black rounded-square icon, "GCAP LABS" wordmark, tagline "Intelligence. Engineered." in a small
  blue→purple→pink→orange gradient, Inter Medium/SemiBold.
- **Headmaster (product mark):** hexagonal node/circuit glyph (6 corner nodes + center, connected,
  blue→purple→pink gradient) on a black rounded-square app icon, "HEADMASTERUI" wordmark (UI
  suffix gradient-styled), tagline "AI Interface," Space Grotesk Medium/SemiBold. Exact palette:
  black `#0D0F14`, blue `#2563FF`, purple `#7C3AED`, pink `#FF2D8F`, orange `#FFB020`, grey
  `#E5E7EB`. The sheet also specs a fuller product-UI direction on top of the logo: gradient
  primary buttons, dark model/status cards, and colored status pills (pink=High Priority,
  purple=Processing, blue=Connected, orange=Warning).

This formally supersedes the green `#1a4d2e` / gold `#c9a96e` / parchment `#f4f1ea` token system
in `gcaplabs-headmasterUI/docs/theming/gcap-brand-tokens.json`, despite that system already being
applied in `gcaplabs-console` — it's dead now, not a fallback. Updated the `gcap-brand-logo-
decision` memory and `mastertodo.md` with the confirmed hexes. Rebrand execution (app icon,
README banner, theme-picker thumbnails, mascot, docs wordmark, `docs.json` theme, site logo/
imagery) has not started yet — this was the blocking decision, now unblocked.

Also removed `gcap-labs/docs-mintlify/` at the owner's request — confirmed stale/superseded
duplicate of `gcaplabs-docs/` (dated 2026-06-23 vs. `gcaplabs-docs`'s 2026-07-04/05 content),
working tree was clean before deletion (`git status` verified, nothing lost).

### gcaplabs-headmasterUI + gcaplabs-console: "chats not loading" incident — root-caused + fixed live

Owner reported 100+ dev-console errors in the desktop app and chat history not loading at all.
Investigated live rather than from logs alone: connected to the running dev instance via Chrome
DevTools Protocol (port 9230, the desktop's own CDP debug port), dumped `window.__agent37Provision`,
and cross-checked against production with `vercel logs www.console.gcaplabs.com` and direct `curl`
calls to both the console's proxy and the Agent37 instance host directly.

**Root cause:** the account's Agent37 runtime instance (`gcl8ku74ch`) was in a `container_unreachable`
state (per the Agent37 API's documented error codes: VM/compute up, agent process not answering its
port — distinct from `container_unavailable`/stopped or `instance_suspended`/billing). Confirmed by
calling `https://www.console.gcaplabs.com/api/v1/health` with the account's real bearer token (same
path the desktop uses) and getting back a faithfully-proxied `502 {"error":"container_unreachable"}`
— i.e. `gcaplabs-console`'s `/api/v1/[...path]` proxy route and `instanceFetch()` in
`managed-runtime.ts` were working exactly as designed; the bug was purely in the instance itself, not
in either repo's code.

**Fix:** `POST https://api.agent37.com/v1/instances/gcl8ku74ch/restart` (explicit owner approval
obtained before touching a live production instance). Verified immediately: instance's own
`GET /v1/health` → `{"ok":true,"agent":"hermes","healthy":true}`; console's proxied
`GET /api/v1/sessions/1440202f` → `200` with the conversation's history intact. No code changed —
this was purely an infra/instance-health incident.

**Side investigation — audited every other endpoint the desktop was also failing on** (`/api/agents`,
`/api/skills`, `/api/providers`, `/api/mcp/servers`, `/api/model/options`, `/api/google/*`,
`/api/assistants`, `/api/conversations/:id/*`, `/api/cron/jobs`, `/api/extensions/acp-adapters` — all
404ing against `console.gcaplabs.com`). Traced each to its call site in the desktop renderer:
`/api/providers`/`/api/model/options` turned out to be a dead fallback — providers already ship in
the provision response itself (`useModelProviderList.ts` prefers `window.__agent37Provision.providers`,
built by `groupModelsByProvider()` in the console's `provision/current/route.ts`) — so that one call
is pure noise with zero functional impact. Everything else (Skills Hub, MCP servers, the local
multi-agent/assistant roster, cron Scheduled Tasks, Google Auth models, ACP adapters, and the
conversation artifacts/confirmations/mode/slash-command side panels) has **no cloud/remote-mode
backend at all yet** — real, unbuilt feature gaps, not migration debt. Logged as an open item in
`mastertodo.md` to gate these behind `isRemoteContainerMode()` so they stop producing console-error
noise while remaining honestly "not yet available" instead of silently 404ing.

**New bug filed, not yet fixed:** owner opened a conversation that had been created on the web
console inside the desktop app, sent one message, and it was sent 5 times with a final "chat response
failed" surfaced in the UI. Not reproduced under my own testing session (my test session
`1440202f` had empty history and wasn't used to send a message). Filed in `mastertodo.md` with the
suspected area (`submitResponseAndStream`'s reconnect/replay loop in `httpBridge.ts`) for whoever
picks it up next — needs an actual repro with request-level logs, ideally on the exact
web-created/desktop-resumed session shape.

## 2026-07-04

### gcaplabs-headmasterUI: upstream parity pass + sidecar/warning audit

Committed and pushed the upstream parity/performance pass to `main` as
`63c0133 perf: complete upstream parity pass`, then fixed the pre-existing sidecar test failure and
pushed `ff2ffde test: skip sidecar packaging in builder unit test`.

**What shipped in the parity pass:** chat/session virtualization with `react-virtuoso`, stream update
batching coverage, lazy Markdown/code rendering paths, command palette actions, backend feature gates
for UI without runtime contracts, and docs/tests for upstream feature parity and backend contracts.

**Sidecar diagnosis:** the immediate failure was in `tests/unit/bootstrap/buildWithBuilder.test.ts`.
That unit test was meant to verify builder argument handling, but on Windows arm64 it still allowed
the builder to reach the GCAPCore packaging/spawn path and touch a stale
`resources/bundled-aioncore/win32-arm64/aioncore.exe`. The test now passes `--skip-gcapcore` so it
stays hermetic. Follow-up root audit found a deeper resolver risk: packaged production builds could
still fall back to legacy `bundled-aioncore` if present. The working tree now tightens
`gcapcoreBinaryResolver.ts` so packaged builds only resolve `bundled-gcapcore`; dev staging remains
compatible with legacy upstream layout. New resolver tests cover this split.

**Warning cleanup performed in the working tree:** removed a bogus tracked `packages/desktop/src/main.ts`
stub (real Electron main is `packages/desktop/src/index.ts`), fixed active lint errors, scoped `bun run
lint` to active desktop code (`packages tests scripts`) instead of scanning unrelated root folders,
cleared React `act(...)` warnings in cron/ACP/feedback tests, added local i18n mocks to tests that
were missing them, fixed the virtualized session key warning by giving `ChatHistory` a stable
`computeItemKey`, and removed the Feedback modal test's jsdom-only `NaN` height warning by mocking
Arco TextArea autosize in that focused content test.

**Verification after cleanup:** full `bun run test` is green (184 passed, 1 skipped; 1356 tests passed,
3 skipped), `bunx tsc --noEmit` is green, `bun run lint` exits 0, and Electron/Vite build succeeds
with only the existing chunk-size warnings. Remaining warnings are tracked in `mastertodo.md`: React
19 `element.ref` dependency warnings, dependency `punycode` deprecations, and warning-level lint debt.

### gcaplabs-console: admin/org/security overhaul + DNS/perf fixes

All in `mutvayzz-sys/gcaplabs-console`, all committed + pushed to `main`, each step verified with
`npm run typecheck && npm run build` before pushing, deployed via Vercel auto-deploy. Supersedes the
"uncommitted" framing of the beta-approval fix recorded in `mastertodo.md`'s 2026-07-03 entry — that
work is long since committed, and a second, deeper bug in the same area was found and fixed today.

**DNS / infra:**
- `www.gcaplabs.com` and `www.console.gcaplabs.com` added as real Vercel domains (A → `76.76.21.21`,
  DNS-only) with valid certs; `gcaplabs.com` and `console.gcaplabs.com` now 308-redirect to their
  `www.` counterparts (Vercel domain-level redirect, not a Cloudflare rule).
- Deleted 5 stale Cloudflare tunnel/wildcard DNS records (`*.gcaplabs.com`, `*.run.gcaplabs.com`,
  `hermesq.gcaplabs.com`, `headscale.gcaplabs.com`, `hq.gcaplabs.com`) at the owner's request,
  confirmed via the Cloudflare API before/after.
- Fixed the real cause of "console feels slow": `gcap-console`'s Vercel `serverlessFunctionRegion`
  was `iad1` (Virginia) while the Supabase project is `ap-south-1` (Mumbai) — moved it to `bom1`
  (Mumbai), confirmed live via the `X-Vercel-Id` response header.
- Deduped 3x redundant `getSession()`/`isConsoleAdmin()` calls per page load (layout + page +
  `requireUser()` each re-checking) down to 1 via React's per-request `cache()`; parallelized the
  two sequential Agent37 API calls in `getManagedAgent()` (`getAgent` + `listTemplates`).

**Admin model — `profiles.is_admin` split from `profiles.beta_approved`:**
- Previously `isConsoleAdmin()` read `beta_approved`, so any approved beta signup would see the full
  admin nav. Added `profiles.is_admin` (migration `0004_admin_role.sql`) as the real, separate
  source of truth for console-admin access; `beta_approved` now only ever gates whether a signup
  gets an Agent37 runtime. `admin@gcaplabs.com` is `is_admin=true`; `mutvayzz@gmail.com` was swapped
  to the pending/testing account per owner request.

**🔴 Real security bug found + fixed: revoking `beta_approved` didn't revoke access.**
`getCurrentAgent37Runtime()` (`src/lib/agent37.ts`) only checked `beta_approved` on the
first-time-provisioning branch — once `profiles.agent37_id` existed, a user kept full
chat/files/integrations/settings access forever, even after being revoked. Caught live: after
revoking `mutvayzz@gmail.com`, she still had full working access to her existing runtime via the
console. Fixed by moving the check above both branches so it gates every access, not just creation.
Separately confirmed (per the owner's direct question) that accepting an org invite never touches
agent provisioning at all — only ever writes `organization_id`/`org_role`.

**Agent naming:** new runtimes are named `Gcaplabs-{email}` (was `{displayName}'s Headmaster`); the
two live instances were renamed via the Agent37 API to match (`Gcaplabs-admin@gcaplabs.com`,
`Gcaplabs-mutvayzz@gmail.com`).

**Console redesign — cherry-picked patterns from `jonradoff/lastsaas` (a different, Go+Mongo SaaS
boilerplate — nothing ported as code, only UX/structure; kept gcaplabs-console's existing shadcn
visual style throughout, never lastsaas's dark theme):**
- **Nav split**: `DashboardShell.tsx` now has `USER_NAV` (everyone: Agent, Account) plus an additive
  `ADMIN_NAV` section (console admins only: Users, Organizations, Messages, Announcements, Health,
  Config) and an `ORG_NAV` section (org admins only: My Organization) — replacing the old
  all-or-nothing single nav.
- **User settings** (`/dashboard/settings`): Profile tab (display name) + Security tab (password
  change, TOTP MFA enroll/verify, sign-out-other-devices, message-an-admin form) — all via the
  existing browser Supabase client (`src/lib/supabase/client.ts`), not the service-role admin
  client. Confirmed there's no Supabase Admin API to list/revoke individual sessions — only a
  single "sign out everywhere else" action is possible.
- **Admin Users**: search + pagination on `GET /api/admin/users` (search term sanitized before
  embedding in a PostgREST `.or()` filter), plus a per-user detail page.
- **Generic Config page**: new `app_config` table (string/number/boolean/enum/json typed values),
  ships empty — for future feature flags.
- **Organizations ("school" model)**: new `organizations`/`org_invitations` tables plus
  `profiles.organization_id`/`org_role`. Deliberately lighter than lastsaas's literal
  workspace-owns-agents model — agent ownership stays exactly 1:1 per user, `agent37.ts` untouched.
  Two independent admin axes: `is_admin` (site-wide, all orgs) vs. `org_role='admin'` (scoped to
  one's own org only). Org admins manage their org's members + issue invite links from
  `/dashboard/org`; site admins get a per-org detail page (`/dashboard/admin/organizations/[id]`)
  to do the same for any org, plus create orgs and assign the first admin by email.
- **Health** (`/dashboard/admin/health`): point-in-time Supabase ping, Agent37 control-plane ping,
  aggregate `agent37_status` counts. No history/charts yet (would need a snapshot table + cron).
- **Announcements + messaging**: admin broadcasts a dismissible per-user banner (tracked via
  `announcement_reads`); users message admins from Settings; unread-count badge on the admin nav's
  Messages item, sourced from a `cache()`-deduped count so it doesn't add a query for non-admins.

**Admin runtime control — parity check against the actual Agent37 dashboard:** logged into the
real `agent37.com/dashboard/cloud` and compared its per-instance "⋯" menu (Restart/Stop/Delete/
Re-pull image/rename/Copy dashboard-terminal-files links) against what the admin panel could already
do. Added what was missing: `update` (re-pull image), rename, and "open Dashboard/Terminal/Files"
via signed URLs (reusing `agent37.signedUrl()` + the existing `PORT_LABELS` map) — all on
`/dashboard/admin/users/[id]`'s new `RuntimeControlPanel`, gated by `requireConsoleAdmin()`.
Deliberately did **not** port Agent37's Config/System/Keys screens (raw YAML editing, credential
pool, backup/restore) — too deep and risky to wrap in a customer-facing admin panel; that stays
native. Then, per the owner's explicit "Hermes is back-facing, never user-facing" rule, **removed**
the equivalent Dashboard/Terminal/Files buttons from the regular user's own agent Settings tab
(`RuntimeSettingsTab.tsx`'s `AppsSection`) — that capability had existed there since before this
session and is now admin-only. Deleted the now-unused `OpenPortButtons.tsx`.

**headmasterUI (desktop) — verified, not modified this session:** traced the full auth/session/chat
chain end-to-end from the console side (no HermesHQ SDK — logs in via console's `/api/auth/login`,
which does a real Supabase `signInWithPassword` against the same project; loads the real
`profiles.agent37_id` via `/api/desktop/provision/current`; chats go straight to
`{instanceId}.agent37.app/v1/*` with the forwarded bearer token). Confirmed not stale or mocked —
whatever real users exist in the console's `profiles` table are exactly who loads in desktop.

## 2026-07-03

### Agent37 migration review decisions + interactive prompt cleanup

Reviewed `Migration.md` and applied the owner's follow-up decisions:

- Rebased `gcaplabs-headmasterUI/main` onto `origin/main`; upstream had bumped the desktop version, so the Agent37 desktop commits now sit on top of the latest version bump.
- Kept the existing Agent37 runtime as the smoke-test target. Do not create a new runtime unless explicitly asked.
- Kept the local Headmaster runtime path. The app still ships/owns local runtime support for app/dev/fallback use; the Agent37 cutover does not delete `hermesBootstrap.ts` or local runtime UI.
- Kept `applyProvisionToRuntime.ts` for the local runtime path. It remains the right place to write local `SOUL.md`, model/provider env/config, and memory/provider settings. It does not customize Agent37 cloud instances; use Agent37 templates or a future Agent37 API for that.
- Removed HermesHQ VPS teardown from the tracked product task list. The owner will handle destructive infra teardown manually.
- Preserved STT as a future todo only: `isSttAvailable()` stays false until a real runtime endpoint exists.

Code follow-up: the Agent37 pending-request path now resumes by cancelling the active `/v1/responses/{id}` turn and submitting the human decision as a fresh `/v1/responses` turn on the same session. The resume stream uses the normal Agent37 render callbacks, so the resumed answer/tool events actually show in the UI. Added focused unit coverage for this cancel+submit behavior.

Docs follow-up: refreshed `ARCHITECTURE.md` and prepended current migration decisions to `mastertodo.md`. NotebookLM/home tracker refresh should be regenerated after this commit.

## 2026-07-02

### Stub removal + Composio MCP reload implementation

Implemented the remaining code path needed for Composio OAuth connects to become usable by the
running agent without a container restart.

- **gcaplabs-hermeshq / gateway:** `/api/mcp/servers/import` now writes real `config.yaml` MCP config;
  added `POST /api/mcp/reload`; added worker protocol type `mcp.reload`; `HermesWorkerAdapter` calls
  the Python worker with a 130s timeout; `hermes_worker.py` invokes `tools.mcp_tool.reload_mcp_from_config()`.
- **Runtime image:** `backend/runtime.Dockerfile` applies `backend/hermes-agent-patches/*.patch` after
  cloning upstream Hermes Agent. Patch `0001-reload-mcp-from-config.patch` adds the reload helper to
  `tools/mcp_tool.py` during Docker build.
- **gcaplabs-console2:** `register-mcp` now registers Composio with `x-api-key`, calls runtime MCP
  reload, and returns the reload summary; `removeToolkitFromSharedMcp()` no longer deletes the shared
  Composio MCP server; dead `src/config/agents.ts` removed; single-agent heading fixed.
- **gcaplabs-headmasterUI:** deleted unused `stubProvider` from `httpBridge.ts` and removed helper/test
  references.

Pushed all three repos. VPS deploy completed: pulled `gcaplabs-hermeshq`, rebuilt
`headmaster-hermes-runtime:latest`, backed up control-plane + runtime homes, recreated both active
runtime containers on the new image while preserving their `hermes-home-*` named volumes, and verified
both live `/v1/health` and `/api/mcp/reload`. Also smoke-tested disabled MCP server create → reload →
delete on `hm-18016c48-cda.gcaplabs.com`.

Remaining manual E2E: reconnect/refresh Gmail OAuth if needed, then ask the agent to list recent
emails and confirm Gmail MCP tools are available/called.

### Verification pass: audit + gap fixes (G1–G3 done, uncommitted) + architecture direction

**Static audit (3 agents) confirmed Phases 0–7 are genuinely done**, with four small residual
gaps. Findings and the resulting work order are captured in `mastertodo.md` → "⏭️ NEXT SESSION".

- **Desktop Phase 5 is NOT half-done anymore — it's done + hardened.** Correcting the 2026-07-01
  entry below: in **remote** mode the desktop now speaks `/v1` exclusively. Commits `d3d9566`
  (probe `/v1/health` for the status indicator), `f1ad6da` (fail-fast on WS in remote mode + verify
  no WS-RPC in the renderer), and `31074cf` (interactive/approval flows on
  `POST /v1/responses/{id}/interactive`) landed the full chat path. WS-RPC is hard-disabled remotely
  (`getWsUrl()` throws, `connectRpcWs` rejects). WS survives ONLY for local-dashboard mode, by design.
  The `x-headmaster-container-id` "gap" is a non-issue — Traefik injects it per route; the client
  only sends the bearer.

- **Gap fixes — Hermes executed G1–G3 in the working tree, then crashed BEFORE committing or
  running the build/test verification. All three sit uncommitted:**
  - **G1 (hermeshq `containers.py`)** — legacy `NOUS_API_KEY` override deleted from the admin
    provision endpoint; `_runtime_env` already injects kimi unconditionally (confirmed by prior
    commit `aee2dc9`). _Uncommitted working-tree change._
  - **G2 (gcap-console)** — dead Agent37 cloud residue removed: `AgentsView.tsx`, `AgentNameCell.tsx`,
    `ActiveAgentSwitcher.tsx`, `AgentWorkspace.tsx` deleted; `config/agents.ts` templates cleaned;
    `agent37.ts` gutted to a re-export shim; `RuntimeError` is now canonical in `http.ts` with
    `Agent37Error` as a back-compat alias. One stale _comment_ mention of `lib/agent37.ts` remains
    in `components/files/types.ts` (cosmetic). _Uncommitted._
  - **G3 (desktop `AppearanceSettings/presets/default.css`)** — the `[data-theme='dark']` block is
    fully rebranded to GCAP: `--primary #74a981` (green), green brand vars, `--aou-*` remapped to a
    parchment-dark slate. Light `:root` was already correct. _Uncommitted._
  - **G4** — note only: desktop token is `--primary`/`--color-primary`, not `--theme-primary`;
    intentional (renaming risks Uno/Arco breakage).

- **Still outstanding after the crash:** commit G1–G3; run build/typecheck/tests
  (`bunx tsc --noEmit` + `bunx vitest run`; console `npm run typecheck && npm run build`; hermeshq
  `pytest`); live runtime smoke (blocked on the VPS image rebuild Hermes is driving).

### Architecture direction locked — remote-first thin client + HeadmasterCore

Decision from a design discussion this session (rationale in `mastertodo.md` → "Architecture: client
model"):

- **Client = thin, `/v1/responses` SSE only.** Local vs remote is just a URL; no bundled Hermes
  brain long-term. This lets us eventually retire the WS-RPC path, `hermesBootstrap`,
  `binaryResolver`, and `bundled-hermes/`. Unify on **transport**, not location — if a local runtime
  is ever wanted, run the gateway locally and still speak `/v1`.
- **Brain = remote Hermes container** (model, orchestration, sessions, memory, heavy tools) —
  always-on, centrally upgradeable, isolated.
- **HeadmasterCore = a local daemon that gives the remote brain hands on the user's machine.** It
  dials OUT to the VPS (reverse/outbound tunnel — no inbound ports, matches the Cloudflare-tunnel
  philosophy) and exposes local capabilities (fs, shell/PTY, browser/computer-use, Office) as **MCP
  servers** that the remote Hermes registers as tools, scoped per-user + gated by the existing
  forward-auth HMAC. Keep tools coarse-grained to beat round-trip latency. Degrades cleanly to a
  cloud-sandbox agent when HeadmasterCore isn't connected.
- **HeadmasterCore is built FROM the AionCore binary.** `_support/upstream/aioncore` already ships
  the exact crates we need — `aionui-mcp`, `aionui-shell`, `aionui-file`, `aionui-office` (OfficeCLI),
  `aionui-team` (Council), `aionui-cron`, `aionui-realtime`. So "take it or recreate it" → AionCore
  _is_ HeadmasterCore; expose its surface over the tunnel as MCP. One binary provides Office + Council
  - local execution.

### AionUI features to bring back — they're already in-tree; the real work is RE-HOMING them

The three features the owner named are **not deleted** — all present and wired in the current app,
but all assume **local processes/binaries**, which collides with the remote-first pivot:

- **Preview panel** (`renderer/pages/conversation/Preview/`, `PreviewProvider` in the chain,
  mounted in `ChatLayout`) — pure renderer UI. **Stays in the thin client**; source file bytes from
  the remote container via `/v1/files*` (as the console already does). Easy.
- **OfficeCLI** — used by `OfficeWatchViewer.tsx` which spawns a local `officecli watch` child
  process. Provided by AionCore (`aionui-office`). **Re-home into the container image and/or
  HeadmasterCore**, exposed as a Hermes tool/skill (see `package-assistant` skill). Live `watch`
  preview becomes `/v1/files` polling / file-change events in remote mode.
- **Councils** — Team feature backed by the local AionCore sidecar (`aioncoreBootstrap`,
  `useCouncilSidecar`, `CouncilSidecarBanner`; falls back to a native in-process team layer when the
  binary is missing). Provided by AionCore (`aionui-team`). **Re-home** into the container /
  HeadmasterCore so Council orchestration runs server-side or via the local MCP daemon.

Net: OfficeCLI + Council + local execution all consolidate into **one AionCore/HeadmasterCore
binary**, reachable by the remote brain over MCP. The preview panel stays client-side.

### Follow-up session: verification, cleanup, and VPS wip-branch resolution

The G1–G3 "uncommitted" framing above turned out to be stale — re-checking all three repos found
working trees already clean:

- `gcaplabs-hermeshq` — G1 committed as `d1391a5`.
- `gcap-console` — G2 committed as `2470af3`.
- `gcaplabs-headmasterUI` — G3 committed as `fe9886c`.

Ran the verification that never happened before the earlier crash — **all clean**:

- Desktop: `bunx tsc --noEmit` clean; `bun run test` → 1332 passed, 3 skipped.
- Console: `npm run typecheck` clean; `npm run build` → compiled successfully.
- HermesHQ: `pytest` (had to run via the repo's own `.venv`, not the ambient global Python, which
  is why the first attempt failed with `ModuleNotFoundError: hermeshq`) → 335 passed, 23 skipped,
  excluding `tests/test_regressions.py` (imports `fcntl`, Unix-only, can never collect on Windows —
  not a real failure).

Cleanup: deleted the dead `gcap-console/src/lib/agent37.ts` re-export shim (confirmed zero import
sites) and fixed the stale comment referencing it in `components/files/types.ts`. Pushed all three
repos to their remotes — each needed a simple fast-forward past unrelated version-bump commits from
other machines, no real conflicts.

**`gcaplabs-hermeshq` branch `wip` (60dd361):** while pulling `origin/main`, the VPS Claude session
found local uncommitted changes that would have collided. It split them correctly on its own: a
direct revert of `d1391a5` (re-adding the legacy `NOUS_API_KEY` injection) was dropped; genuine,
unrelated WIP (human-in-the-loop interactive callbacks — approval/clarify/sudo/secret — across the
`agent37` gateway's Python worker and TS adapters) was preserved on the `wip` branch instead of lost
or force-merged. `wip` is stale relative to `main` (rooted 8 commits back) and needs a rebase before
it's picked up again — flagged in `mastertodo.md`, not merged.

The VPS session then finished its assigned task in full: pulled `main` clean, rebuilt
`headmaster-hermes-runtime:latest` with the chown perf fix + `runtime-entrypoint.sh` materialization,
recreated the provisioned container, and ran a full live smoke test — 401→200 on `/v1/health` with a
bearer token, `/v1/models` returning the kimi catalog, `/v1/responses` streaming a real kimi turn
end-to-end. It also found and fixed a real bug: `hermes-agent` treats the `anthropic` Python client
as optional, but kimi-code needs it for `anthropic_messages` mode — every provisioned container was
failing on the first turn with an import error. Fixed via `769393f`, now on `main` (`fa8974e`).

### Console/desktop identity linking — three bugs found and fixed via live E2E testing

Follow-up to the wip-branch session above. The owner asked for console (Supabase auth) and desktop
(HermesHQ native auth) to resolve to the same account/chat for `admin`. Traced the actual auth
code: `combined_auth.get_authenticated_user` already tries Supabase JWT then falls back to native
JWT, resolving both to the same `HermesHQ.users` row keyed by `user.id` → one container. The only
gap was that `verify_supabase_token` returned `None` when no `User.email` matched, instead of
linking or creating one — so brand-new console signups could never get a runtime, and existing
native accounts (the bootstrap admin) had no `email` set at all.

**Fix 1 (`c2f03e2`):** auto-provision a `pending` `User` on first Supabase login with no email
match (same approval queue as native open-signup); added `username`/`email` to the admin
`UserUpdate` API so an existing account can be relinked. Also removed `hq.gcaplabs.com`'s own
native `/register` page (`deb0453`) — console/Supabase is now the sole front door.

Handed off to the VPS session to deploy + relink the admin row to `admin@gcaplabs.com`. It also
caught and correctly resolved a second uncommitted-work collision on `main` on its own (same
defensive pattern as the wip-branch handling above) before completing the deploy.

**Live testing then surfaced two more real bugs**, found by actually signing up, logging in, and
chatting via browser automation against `console.gcaplabs.com` (not just unit tests):

- **Fix 2 (`6212159`):** `verify_supabase_token` hardcoded `algorithms=["RS256"]` in
  `jwt.decode`, but this Supabase project's JWKS keys are ES256 (EC) — every key failed
  validation regardless of token validity, 401'ing every console API call. Root-caused via VPS
  session confirming JWKS URL/config/network were all fine and pulling the exact log line
  ("Could not validate Supabase token with any JWKS key"). Fixed to read each key's own `alg`.
- **Fix 3 (`1f0ce02`, gcap-console):** with auth fixed, the first real chat turn streamed
  correctly server-side (verified by reading the raw SSE response directly in-browser) but
  rendered as a blank bubble. `dashboard/page.tsx`'s SSE parser read `evt.delta`; the gateway
  actually sends `{"text": ...}`. One-field-name bug, silently ate every response.

Also found mid-flow: the Supabase project's "Confirm email" was on (console's code assumes it's
off) and its Site URL was still the default `localhost` — confirmation emails pointed nowhere
useful. Owner fixed both in the Supabase dashboard directly.

**End state, verified live:** sign up/login as `admin@gcaplabs.com` on console → container
provisions → real chat turn streams and renders correctly. Desktop-side confirmation (same
credentials should show the same session history) still pending manual check.

## 2026-07-01

### "Headmaster: Inactive" → desktop /v1 migration is only half-done

Investigating why the desktop shows "Headmaster: Inactive" surfaced a bigger issue.

- **Runtime is genuinely healthy:** the user's container (`hermes-a48f4b18-…`) has
  `provider: kimi-coding` (my earlier manual write survived the VPS reboot) and internal
  `/v1/health` → `{"ok":true,"healthy":true,"hermes":true}`; `/v1/models` returns the kimi catalog.
- **Why it shows Inactive:** `GatewayStatusIndicator` reads `useRuntimeConnectionState`, whose
  probe calls `gatewayRpcRequest('session.list')`. In remote mode `getWsUrl()` builds
  `wss://hm-<id>.gcaplabs.com/api/ws` — the **legacy Hermes WebSocket JSON-RPC**. The Agent37
  runtime is **REST-only** (`/v1/*`); it has no `/api/ws`, so the probe never connects → false
  "Inactive".
- **Bigger finding:** the WS-RPC path isn't just the status probe — `hermesChatAdapter.ts` still
  drives the core chat over `gatewayRpcRequest`: `prompt.submit` (send message), `session.create`,
  `session.resume`, `session.interrupt`, and `approval/clarify/sudo/secret.respond`. Only response
  _streaming_ was moved to `/v1/responses` SSE. So **remote chat can't send prompts or manage
  sessions** against the Agent37 gateway — Phase 5's migration is partial. Full desktop `/v1`
  migration scoped in `mastertodo.md` (see "Desktop remote-runtime /v1 migration").
- **Also fixed this session:** the stale `hermeshq.gcaplabs.com` stored URL that blocked login
  (file-patched on this machine + code migration `4bcbd24`); runtime image Dockerfile perf
  (chown scoped to `/home/hermes`, `c258d59`) — VPS image rebuild still PENDING (SSH-over-tunnel
  was too flaky to drive the build reliably; the running container already works via the manual
  kimi config).

### Hermes worker fix (wrong model config) + desktop bootstrap hang fix

**Hermes worker "did not respond within 10000ms" — root cause found & fixed.** The gateway
served `/v1/health` 200 but chat/model calls failed. The Hermes worker
(`third_party/agent37/gateway/server/workers/hermes_worker.py`) reads model settings ONLY from
`$HERMES_HOME/config.yaml` via `hermes_cli.config.load_config` — it does **not** read the
`HERMES_DEFAULT_PROVIDER/MODEL/BASE_URL/API_MODE` env that `routers/desktop_runtime.py` injects.
The image's baked `config.yaml` was `nous-api`, so provisioned kimi containers ran nous-api with
no key and the worker hung. Verified by writing a kimi `config.yaml` into a live container: the
worker selftest then reported `provider: kimi-coding` and `/v1/models` returned the live kimi
catalog (`kimi-k2.7-code`, `kimi-k2.6`, …) — `KIMI_API_KEY` is read from env, no `api_key` in
config needed. Fix: `backend/runtime-entrypoint.sh` materializes `config.yaml` from the injected
`HERMES_DEFAULT_*` env before starting the gateway; wired as the image CMD (hermeshq `2111f0c`).
Added `.gitattributes` (`*.sh eol=lf`) so the entrypoint shebang survives Windows checkouts.
Remaining: rebuild `headmaster-hermes-runtime:latest` on the VPS + recreate containers, then a
full `/v1/responses` chat smoke.

**Desktop app hung on "Preparing your workspace…" (packaged build).** Renderer threw
`ReferenceError: process is not defined` from `AuthContext.provisionDesktopSession()` using
`process.platform` — Vite shims `process.env.*` but not bare `process`, so it throws in the
packaged renderer, aborting `refresh()` before `setReady(true)`. The `ws://127.0.0.1:9119` WS
storm was the same bug's symptom (`window.__backendPort` is only set once `Layout` mounts, after
`ready`). Fixed by deriving platform from `navigator.userAgent` (headmasterUI `f30ba79`).
Note: dev mode provides `process`, so it only reproduced in the packaged `.exe`.

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
within 10000ms"). So `/v1/models` → 502 and chat won't work until the worker boots. KIMI*\* +
HERMES_DEFAULT*\* env are all present in the container, so it's a runtime-image / worker-launch
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
- Added all new env vars to VPS `.env` from `gcaplabs-headmasterUI/vps.env` (KIMI*API_KEY, SUPABASE_JWKS_URL, RESEND_API_KEY, FROM_EMAIL, SENTRY_DSN, OPEN_SIGNUP=true, OIDC*\*)
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

## 2026-07-03 — HermesHQ → Agent37 Cloud cutover (verified complete)

**Repos touched:** `gcaplabs-headmasterUI`, `gcaplabs-console`.

Full write-up lived in root `Migration.md`; superseded and deleted after this entry landed
(the plan is done, not a live tracker — verification below is the durable record).

**Decision:** Agent37 Cloud (`api.agent37.com` / `{instanceId}.agent37.app`) is now the only backend.
The self-hosted HermesHQ control plane and local Hermes process-spawning are retired from the
active code path. "Hermes" survives as the *agent runtime identity* only (`HERMES_HOME`, the
`agent37-hermes` template) — see `CLAUDE.md`'s white-label table, unchanged.

**gcaplabs-console** — commit `e66869d`: cherry-picked upstream `agent37-platform/starter-kit`
improvements onto the fork's single-managed-agent architecture: `BudgetDialog.tsx`,
`OpenPortButtons.tsx`, `agent37.ts`/`http.ts` fixes, `0003_profile_rls_hardening.sql`. Explicitly
did **not** pull upstream's fleet/workspace/membership tables — those stay commented out in
`0001_init.sql` pending a real multi-agent product decision. `npm run typecheck && npm run build`
clean; zero `hermeshq`/`hq.gcaplabs.com` refs outside caches.

**gcaplabs-headmasterUI** — landed as five commits (`010886a` cut desktop provision shims to
Agent37, `26a8b20` route desktop sessions through Agent37 v1, `15276e7` drop AionCore-named shadow
sidecar files, `3851264` consolidate base URL routing + STT-unavailable guard, `d3e68dc` extract
`isSttAvailable` predicate), all now pushed to `origin/main` along with follow-up cleanup —
Migration.md's "local-only, not pushed" status was stale by the time of this entry; verified via
`git status`/`git log` that these are on GitHub.

Verified 2026-07-03 (re-check after Migration.md claimed done):
- `grep -rniE "hermeshq" packages/desktop/src` → zero hits; same for `HermeshqConfig`/`hermeshq:`
  channel strings.
- `bunx tsc --noEmit` clean.
- `preload/main.ts` has no legacy `getHermeshq*`/`setHermeshq*`/`provisionHermeshq` aliases.
- `httpBridge.ts` speaks `/v1/responses` SSE (`response.output_text.delta` etc.); session CRUD
  lives in `hermesSessionAdapter.ts` against `/v1/sessions`.
- Remaining `9119`/`13400` hits are the intentional local-dashboard default port and comments
  documenting the removed fallback — not migrated-path residue.

**Kept on purpose (owner decisions, not migration debt):**
- Local Headmaster runtime path (`hermesBootstrap.ts`, `hermesChatAdapter.ts`,
  `applyProvisionToRuntime.ts`) — retained for app/dev/fallback use.
- GCAPCore/Council sidecar (`aioncoreBridge.ts`, `gcapcoreBootstrap.ts`) — unrelated to HermesHQ;
  only dead AionCore-named shadow files were removed (`8a03444`).
- Vendored `gcaplabs-headmasterUI/hermeshq/` tree — optional/manual deletion later, not automated.
- `gcaplabs-hermeshq` VPS teardown — explicitly owner-owned manual infra work, not tracked here.

**Supabase identity (already unified, confirmed during this pass, not new work):** `gcaplabs-console`,
`gcaplabs-headmasterUI`, and `gcaplabs-ios` (via console's BFF) already share one Supabase project
(`profiles` table keyed by `auth.users.id`, carrying `email` + the assigned `agent37_id`/status/token
fields from `0002_agent37_managed_runtime.sql`). `gcaplabs-hermeshq`'s separate self-hosted Postgres
(users/orgs/OIDC/etc.) is not being merged in — that data is abandoned per the HermesHQ retirement
decision, not migrated.

**Remaining follow-ups (see `mastertodo.md`):** manual end-to-end desktop smoke against a live
Agent37 instance, interactive mid-turn prompt rewire (cancel+resubmit), optional vendored
`hermeshq/` deletion, NotebookLM bundle refresh, future STT support.
