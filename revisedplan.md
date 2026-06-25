# Revised Plan

## Goal

Ship Headmaster as a two-mode platform:

- `HeadmasterUI` for full local deployment and trusted power users
- `HeadMaster+` for managed, school-safe thin client deployments on demand

Both modes are provisioned by `HermesHQ`, and both use the same unified auth system.

## Delivery Priority

Full deployment is the primary build path.

Priority order:

1. `HeadmasterUI` full deployment for beta/demo users
2. `HermesHQ` provisioning and cloud continuity needed by full deployment
3. Local container support for file access and terminal workflows
4. School/staff capability controls inside the same provisioning model
5. `HeadMaster+` thin client only when a school or managed deployment explicitly needs it

`HeadMaster+` should not pull focus from the full local deployment. Build the backend and provisioning contracts so `HeadMaster+` can be enabled later without re-architecting the system.

## Product Split

### 1. HeadmasterUI

This is the desktop app with the full local deployment model.

- Runs on the user device
- Can use a local Hermes binary
- Can manage a local Docker container for local file access and terminal work
- Can also connect to the always-on cloud container on the Mac Mini for continuity and iOS

This is the product for trusted beta users, power users, and local-first workflows.

### 2. HeadMaster+

This is the thin client / browser-style deployment for schools and managed environments.

- No local Hermes binary
- No local Docker
- No local file access
- Talks only to `HermesHQ`
- `HermesHQ` provisions the client into a restricted capability profile

This is the on-demand product for school deployments, staff-managed classrooms, and other environments where jailbreak resistance matters more than local execution.

## Runtime Architecture

### Local deployment

User device:

- HeadmasterUI
- Hermes local binary
- Local Docker container

Purpose:

- File access on the user machine
- Terminal access on the user machine
- Local CoWork / agent workflows

### Cloud deployment

Mac Mini:

- Always-on Hermes container
- Conversation memory and continuity
- iOS connectivity

Purpose:

- Persistent agent runtime
- Background availability
- Cross-device session continuity

### School / managed deployment

Student device:

- HeadMaster+ thin client only
- No local runtime
- No local container

Server side:

- `HermesHQ` controls auth, role, prompt, limits, and audit

Purpose:

- Students cannot tamper with local agent binaries because there are none
- Terminal access can be enabled for staff and disabled for students
- The server decides the capability level per user / role

## Auth Model

Auth is unified across desktop, iOS, and web.

- All clients use `POST /api/auth/login`
- `HermesHQ` issues the session/JWT
- The same account system is used everywhere
- Provisioning decides what mode and capability set the client receives

This is the right model for:

- desktop users
- iOS users
- school staff
- school students
- managed demo users

## Security Model

### Hermes exposure rule

Hermes should never be treated as a front-facing product surface.

Product rule:

- users interact with HeadmasterUI or HeadMaster+
- Hermes runs as an internal runtime sidecar
- Hermes dashboard/API ports are not publicly exposed
- Hermes credentials are provisioned by HermesHQ and never chosen by the user
- direct dashboard access is a debug/admin path, not a supported user path

### What can be secured

- User-to-user isolation in `HermesHQ`
- Server-side system prompt control
- Role-based access control
- Rate limiting
- Full audit log of messages and actions
- Capability gating per provisioned client
- HermesHQ-mediated access to cloud containers
- loopback-only local runtime exposure
- dashboard basic auth and session-token checks

### What cannot be guaranteed in local mode

Local mode is not a hard security boundary.

- A user with local machine access can reach local services directly
- A user with Docker access can inspect or exec into their own local container
- Secrets on the local machine are not equivalent to centralized server controls

That is acceptable for trusted beta users, but not for adversarial school deployments.

### Local hardening target

Full local deployment should still reduce casual bypasses.

Required controls:

- bind local Hermes to `127.0.0.1` only
- prefer an ephemeral provisioned port over a predictable fixed port where possible
- require dashboard basic auth for every local dashboard/API request
- require `X-Hermes-Session-Token` or equivalent session token checks
- disable permissive CORS; allow only the Electron app origin / localhost bridge path
- store JWTs and runtime credentials in OS keychain where possible
- keep only non-secret metadata in `connection-config.json`
- make local mounted folders explicit and visible to the user
- do not expose Docker daemon TCP endpoints
- do not expose Mac Mini Docker or container ports directly to the public internet

Preferred longer-term control:

- route renderer runtime calls through Electron main-process IPC/proxy
- keep Hermes port and credentials out of renderer globals when practical
- let main process inject credentials into runtime requests

This does not stop a local administrator or a user with Docker access, but it prevents the easy path where someone simply opens the Hermes dashboard URL and bypasses HeadmasterUI.

### Revocation model for local Hermes

Use the minimal server validation model first.

Local Hermes should authenticate against HermesHQ before meaningful work. This is enough for beta/full deployment and keeps implementation scope small.

Required behavior:

- HeadmasterUI logs into HermesHQ and receives an access token
- HeadmasterUI passes that token to local Hermes
- local Hermes calls a fixed HermesHQ validation endpoint before privileged actions
- validation returns allowed capabilities for the current user/session
- if the user, account, or backend/cloud container is revoked, validation returns `401` or `403`
- local Hermes refuses chat, terminal, file, and CoWork actions when validation fails
- HeadmasterUI shows the access revoked / login state when Hermes returns the auth failure

Suggested API:

- `POST /api/runtime/validate`
- request: access token, runtime id, requested capability, optional container id
- response: allowed boolean, capabilities, role, organization id, expiry/cache ttl

Caching:

- cache successful validation for a short window such as 5 minutes
- validate immediately before higher-risk actions like terminal and file writes
- fail closed when the validation cache expires and HermesHQ cannot be reached

Spoofing protection for the minimal version:

- use HTTPS
- keep the HermesHQ validation URL fixed for managed builds
- do not let users point local Hermes at an arbitrary validation URL
- keep model provider keys server-side where possible, or issue only scoped credentials

This does not stop someone with local admin/Docker access from inspecting Hermes, but it does stop them from continuing to use GCAP-provisioned capabilities after revoke.

## Implementation Plan

### Phase 0: Lock the provisioning contract

Define the `HermesHQ` response before changing the desktop runtime code.

The contract should include:

- user id, username, role, and organization id
- provisioned mode
- capabilities
- local container config when full deployment is allowed
- cloud container config when remote continuity is enabled
- dashboard auth credentials for local Hermes access

Initial modes:

- `headmaster_local` for full local deployment
- `headmaster_remote` for cloud continuity / Mac Mini runtime
- `headmaster_plus_thin` for on-demand managed deployments

Initial capabilities:

- `chat`
- `terminal`
- `local_files`
- `cowork`
- `admin_audit`
- `model_selection`
- `runtime_settings`

Acceptance check: one fake provision payload can drive a full local user, a staff user with terminal access, and a student thin-client user.

### Phase 1: `HermesHQ` auth and provisioning

Keep `POST /api/auth/login` as the single login path. After login, clients call `POST /api/provision`.

Backend work:

- add roles: `beta_user`, `school_admin`, `staff`, `student`
- add organization / school tenancy
- add capability profiles
- add `POST /api/provision`
- add `GET /api/provision/current` for app resume
- store provision decisions server-side
- audit login, provision, container start, terminal enablement, and mode changes

Acceptance check: changing a user from `student` to `staff` server-side changes their returned capabilities without changing the app build.

### Phase 2: Redesign `AgentContainerSupervisor`

This is the backend core for cloud continuity and later managed deployments.

Backend work:

- manage per-user cloud containers on the Mac Mini
- track container states: `missing`, `creating`, `starting`, `ready`, `failed`, `stopped`
- health check Hermes dashboard `/api/status`
- isolate per-user volumes for memory/session data
- avoid exposing the Docker daemon or direct container ports publicly
- return only HermesHQ-mediated endpoint/token data
- add cleanup and restart logic for failed containers
- expose logs per container and per user

Acceptance check: Demo1 and Demo2 get separate cloud containers and cannot fetch each other's provision or runtime token.

### Phase 3: Desktop provision client

Add a small provision client in the Electron main process.

Likely file placement:

- shared provision types: `packages/desktop/src/common/types/provision.ts`
- main-process client: `packages/desktop/src/process/services/ProvisionService.ts`
- IPC bridge: `packages/desktop/src/process/bridge/provisionBridge.ts`
- stored non-secret config: `packages/desktop/src/process/connection/connectionConfig.ts`
- preload exposure: `packages/desktop/src/preload/main.ts`
- renderer bridge type: `packages/desktop/src/common/types/platform/electron.ts`

Desktop work:

- store the HermesHQ JWT in the OS keychain instead of plain `connection-config.json`
- keep non-secret provision metadata in `connection-config.json`
- add IPC for `provision:get-current`, `provision:refresh`, `runtime:start`, and `runtime:stop`
- make `AuthContext` call provision after successful login
- keep existing local/remote connection config as compatibility until provision fully replaces it

Acceptance check: after login, the renderer can ask Electron for the provisioned mode and capability set.

### Phase 4: HeadmasterUI runtime bootstrap

Refactor the current startup branch in `packages/desktop/src/index.ts` into provision-driven runtime selection.

Runtime behavior:

- `headmaster_local`: start or verify the local container, then start/connect to Hermes at `127.0.0.1:9119`
- `headmaster_remote`: connect to the Mac Mini cloud container
- `headmaster_plus_thin`: do not start local Hermes or Docker; use only HermesHQ APIs

Compatibility rule:

- keep `window.__backendHost`, `window.__backendPort`, and `window.__hermesSessionToken` working
- avoid changing existing renderer pages unless a capability gate is required

Acceptance check: Conversation, Settings, model loading, and status polling still work because the existing bridges see the same runtime globals.

### Phase 4.5: Make Hermes an internal sidecar

Do this before broader demo distribution.

Desktop/runtime work:

- stop treating `localhost:9119` as a public user-facing dashboard
- bind local Hermes to loopback only
- use provisioned dashboard basic auth
- ensure every desktop request includes the provisioned session token
- tighten CORS to the Electron app / approved local bridge path
- avoid logging secrets in app logs
- add a runtime security status probe in Settings
- require HermesHQ runtime validation for privileged local runtime actions
- cache validation briefly and fail closed after revoke or expiry

Cloud work:

- keep cloud Hermes behind HermesHQ or a private network boundary
- do not expose container ports directly
- issue short-lived runtime session tokens
- rotate tokens on logout and reprovision
- return `401` or `403` from runtime validation when a backend/cloud container is revoked

Future hardening:

- move renderer-to-Hermes traffic behind Electron main-process IPC/proxy
- stop exposing raw backend port/session token to renderer globals once the proxy is in place

Acceptance check: opening the Hermes dashboard URL directly without provisioned credentials fails, and after server-side revoke the local runtime refuses privileged actions after validation fails or the short cache expires.

### Phase 5: Local Docker runtime for full deployment

This is the main product priority.

Desktop work:

- detect Docker Desktop availability
- pull or verify the Headmaster/Hermes runtime image
- create a per-user local container
- mount only approved folders
- inject dashboard basic auth into the local Hermes config
- start and stop the container with the app lifecycle
- report clear states: Docker missing, image missing, container starting, runtime ready, failed

Security stance:

- local mode is for trusted users
- do not promise jailbreak resistance
- use dashboard basic auth to prevent casual localhost access
- use keychain storage for JWTs and other client secrets where possible
- treat Docker access as equivalent to local admin access

Acceptance check: "organize my local folders" works only for mounted folders, and the user can see which folders are mounted.

### Phase 6: Renderer bootstrap UI

Keep this small.

Likely files:

- `packages/desktop/src/renderer/hooks/context/AuthContext.tsx`
- `packages/desktop/src/renderer/components/layout/Layout.tsx`
- `packages/desktop/src/renderer/components/RuntimeDetectionModal.tsx`

Renderer work:

- add a post-login bootstrap state
- show a minimal preparing screen while provision/runtime startup runs
- hide or disable UI by capability
- hide terminal/local file affordances when the provision does not include those capabilities
- keep existing routes and pages intact once bootstrap is ready

Acceptance check: a staff account can see terminal-enabled workflows, while a student-style provision cannot.

### Phase 7: School capability controls inside full deployment

Do this before building a separate `HeadMaster+` client.

Backend work:

- create staff/student capability presets
- make terminal access server-controlled
- make model selection server-controlled
- make system prompt and policy server-controlled
- add audit views for school admins

Desktop work:

- consume capability flags
- hide restricted settings and actions
- show only the allowed runtime status/actions for the provisioned role

Acceptance check: a school demo user can be shown both staff and student roles from the same provisioning system.

### Phase 8: `HeadMaster+` on-demand thin client

Only start this when a managed school deployment explicitly needs no local runtime.

Implementation path:

- first ship it as a provisioned mode inside the same app
- split branding/build target later if needed
- route all chat/task operations through HermesHQ or the cloud container adapter
- do not include local process supervision in the browser/thin build

Acceptance check: a student can use chat from a managed device without Docker, local Hermes, or local filesystem access.

### Phase 9: iOS adapter path

Treat iOS as a client of the same provisioning system.

Work:

- iOS logs in to HermesHQ
- iOS calls provision
- HermesHQ returns the cloud container endpoint/session token
- a small Hermes platform adapter in the container exposes chat streaming
- iOS builds only the chat UX and attachment flow

Acceptance check: the same user can continue a cloud conversation from desktop and iOS.

## HeadmasterUI Change Scope

The desktop app changes should stay small.

- Add a Hermes bootstrap / supervisor layer
- Add IPC for starting and stopping the runtime
- Add a boot screen or loading state while Hermes comes up
- Add provision-driven mode selection
- Add remote vs local runtime switching

Everything else should stay mostly intact.

## HeadMaster+ Change Scope

This client should be intentionally narrow and on demand.

- No local process supervision
- No local container lifecycle
- No file system access
- No local terminal by default
- Capability is dictated by the server

This keeps the school deployment model defensible.

## Rough Effort

- `HermesHQ` provisioning contract: small to moderate
- `AgentContainerSupervisor` redesign: moderate to large
- HeadmasterUI bootstrap layer: small
- Local container support: moderate
- Cloud Mac Mini continuity: moderate
- School capability controls: moderate
- `HeadMaster+` thin-client variant: on-demand after the core system works
- iOS adapter path: follow-on, relatively straightforward if the platform adapter approach is used

## Decision Summary

- Trusted local deployments use `HeadmasterUI`
- School and managed deployments can use `HeadMaster+` when no-local-runtime deployment is required
- `HermesHQ` chooses the mode through provisioning
- Unified auth stays in place for every mode
- Local deployments are convenience-first, not security-hardened
- School deployments are server-controlled and do not expose local agent binaries
