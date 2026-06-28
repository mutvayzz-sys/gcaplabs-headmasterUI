# Master Log

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
