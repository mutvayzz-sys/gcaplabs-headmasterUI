# Headmaster Beta Readiness — Phases 3–7 + VPS Infra

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Finish the control plane (Phase 3), update the console (Phase 4), migrate iOS (Phase 5), harden for beta (Phase 6), and roll out brand tokens (Phase 7) — plus wire the remaining VPS host-kit scripts.

**Architecture:** HermesHQ (FastAPI) is the control plane. VPS runs Traefik + forward-auth + per-user containers. Console is the existing Wasp app at `gcaplabs-console/` (updated in place, not scaffolded fresh). Desktop + iOS speak `/v1/responses` SSE to their provisioned container. Supabase is the single identity SoT; HermesHQ verifies user JWTs against the public JWKS. Default model is kimi-code (replaces legacy nous_api_key).

**Tech Stack:** Python/FastAPI/PostgreSQL (HermesHQ), Wasp/React/TypeScript (console), TypeScript/Electron (desktop), Swift (iOS), Docker/Traefik (VPS runtime), bun (desktop build).

**Repos (all at workspace root `C:\Users\Matve\Desktop\gcap-labs\`):**
- `gcaplabs-hermeshq/` — control plane + runtime (FastAPI, commit `402b433`)
- `gcaplabs-headmasterUI/` — Electron desktop (build target, bun/TS)
- `gcaplabs-console/` — existing Wasp console (updated in place, NOT scaffolded from starter-kit)
- `gcaplabs-ios/` — iOS app (Swift, Xcode project at `gcaplabs-ios/scarf/`)
- `gcaplabs-site/` — marketing site (Next.js, for Phase 7 brand rollout)

**Execution mode: Checkpointed — I execute in my own context and stop after each task for your "continue." Slower wall-clock, but you can course-correct between any two tasks.**

---

## Critical Notes for Implementer

1. **vps.env is gitignored. NEVER commit it or copy secrets into tracked files.** Read values from `gcaplabs-headmasterUI/vps.env` and write them into the appropriate also-gitignored `.env` files per repo. Verify exact var NAMES against each repo's config.py / SETUP.md before wiring.

2. **Beta is FREE — no Stripe/payment gate.** Access is gated by the approval pipeline + per-container resource caps. Stripe is deferred to GA. Do NOT wire billing now.

3. **Default model is kimi-code** (NOT Nous Portal). Provider `kimi-coding`, model `kimi-k2.7-code`, `base_url https://api.kimi.com/coding`, `api_mode anthropic_messages`. `KIMI_API_KEY` replaces the legacy per-org `nous_api_key` injection.

4. **Supabase uses the new asymmetric-key system.** HermesHQ verifies user JWTs against `SUPABASE_JWKS_URL` (no shared `SUPABASE_JWT_SECRET`). There is already JWKS caching infrastructure in `routers/auth.py` for OIDC id_tokens — reuse the pattern, not the same function.

5. **Cloudflare/DNS is handled by the owner directly.** `hq.gcaplabs.com` already points at the Cloudflare tunnel. `console.gcaplabs.com` and `*.run.gcaplabs.com` may need DNS records — STOP and ask owner before deploy tasks that depend on them.

6. **White-label rules apply** (CLAUDE.md): never surface Hermes/Nous/AionUi in UI strings. `hermes` is fine in env var names, URL schemes, Python venv dirs, and console script names.

7. **VPS hosts beta** (decided): the VPS (`ssh vps`) has the new Traefik + forward-auth stack at `hermeshq@402b433`. The Mac mini has the OLDER proxy-based HermesHQ stack. Beta runs on the VPS.

8. **The console is NOT scaffolded from starter-kit.** The existing `gcaplabs-console/` is a Wasp app (OpenSaaS template) with React + Vite + Wasp auth. We update it in place — migrate its chat from `/v1/runs` to `/v1/responses` SSE, rewire its backend to HermesHQ provision API, and add Supabase auth (or wire HermesHQ to trust the console's tokens).

9. **The iOS app is at `gcaplabs-ios/scarf/`.** Swift package structure: `Packages/HeadmasterCore/` (models, transport), `Packages/HeadmasterIOS/` (RunsAPIClient, CloudContainerTransport, HermesHQLoginViewModel), `Headmaster iOS/` (app UI). Currently uses `/v1/runs` — needs migration to `/v1/responses`.

---

## Phase 3 — Finish the Control Plane

### Task 1: Add Supabase JWT verification dependency

**Objective:** Create a FastAPI dependency that verifies Supabase-issued JWTs against the public JWKS, returning a HermesHQ User object. This runs alongside the existing local admin auth — it doesn't replace it.

**Files:**
- Create: `gcaplabs-hermeshq/backend/hermeshq/core/supabase_auth.py`
- Modify: `gcaplabs-hermeshq/backend/hermeshq/config.py:38` (add `supabase_jwks_url` setting)
- Create: `gcaplabs-hermeshq/backend/tests/test_supabase_auth.py`

**Context from codebase:**
- `config.py` uses pydantic-settings `BaseSettings` with `env_file=".env"`, `case_sensitive=False`, `extra="ignore"`.
- `routers/auth.py:111` has `_JWKS_CACHE` pattern with 1h TTL — reuse the caching approach.
- `core/security.py:120` has `get_current_user` which decodes HS256 JWTs with `settings.jwt_secret` — Supabase JWTs are RS256 (asymmetric), so we need a different decode path.
- The User model (`models/user.py`) has `email` and `auth_source` fields — Supabase users should be matched by `email` (Supabase JWTs carry `email` claim).
- HermesHQ already has kimi-coding provider normalization in `main.py:148-156` — it knows about kimi.

**Step 1: Add `supabase_jwks_url` to Settings**

In `config.py`, add after line 37 (`oidc_provider_login_url_microsoft`):
```python
    supabase_jwks_url: str | None = None
```

**Step 2: Create `core/supabase_auth.py`**

```python
"""Supabase JWT verification — asymmetric key (RS256) via public JWKS.

Separate from the local HS256 admin auth in core/security.py.
Supabase is the single identity source of truth for end users; HermesHQ verifies
their JWTs against the project's public JWKS endpoint (no shared secret).
"""
import logging
import time
from typing import Any

import httpx
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from hermeshq.config import get_settings
from hermeshq.models.user import User

logger = logging.getLogger(__name__)

_JWKS_CACHE: dict[str, Any] = {"keys": None, "fetched_at": 0.0}
_JWKS_CACHE_TTL = 3600  # 1 hour


async def _fetch_supabase_jwks(jwks_url: str) -> list[dict]:
    now = time.time()
    if _JWKS_CACHE["keys"] is not None and (now - _JWKS_CACHE["fetched_at"]) < _JWKS_CACHE_TTL:
        return _JWKS_CACHE["keys"]
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(jwks_url)
        response.raise_for_status()
        data = response.json()
    _JWKS_CACHE["keys"] = data.get("keys", [])
    _JWKS_CACHE["fetched_at"] = now
    return _JWKS_CACHE["keys"]


async def verify_supabase_token(token: str, db: AsyncSession) -> User | None:
    """Verify a Supabase-issued JWT against the public JWKS and return the matching User.

    Returns None if the token is invalid, expired, or the user doesn't exist in HermesHQ.
    """
    settings = get_settings()
    jwks_url = settings.supabase_jwks_url
    if not jwks_url:
        logger.warning("SUPABASE_JWKS_URL not configured — cannot verify Supabase JWTs")
        return None

    try:
        keys = await _fetch_supabase_jwks(jwks_url)
    except Exception:
        logger.exception("Failed to fetch Supabase JWKS from %s", jwks_url)
        return None

    # Try each key until one validates. Supabase JWTs are RS256.
    for key in keys:
        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience="authenticated",
            )
            email = payload.get("email")
            if not email:
                continue
            result = await db.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar_one_or_none()
            if user and user.is_active:
                return user
            return None
        except JWTError:
            continue
    logger.warning("Could not validate Supabase token with any JWKS key")
    return None
```

**Step 3: Write tests**

Create `gcaplabs-hermeshq/backend/tests/test_supabase_auth.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch
from types import SimpleNamespace

from hermeshq.core.supabase_auth import verify_supabase_token


@pytest.mark.asyncio
async def test_verify_supabase_token_no_jwks_url_returns_none(monkeypatch):
    monkeypatch.setattr("hermeshq.core.supabase_auth.get_settings",
                        lambda: SimpleNamespace(supabase_jwks_url=None))
    result = await verify_supabase_token("fake-token", db=None)
    assert result is None


@pytest.mark.asyncio
async def test_verify_supabase_token_fetch_failure_returns_none(monkeypatch):
    async def _fail(url):
        raise Exception("network error")
    monkeypatch.setattr("hermeshq.core.supabase_auth.get_settings",
                        lambda: SimpleNamespace(supabase_jwks_url="https://example.com/.well-known/jwks.json"))
    monkeypatch.setattr("hermeshq.core.supabase_auth._fetch_supabase_jwks", _fail)
    result = await verify_supabase_token("fake-token", db=None)
    assert result is None
```

**Step 4: Run tests**

```bash
cd gcaplabs-hermeshq && python -m pytest backend/tests/test_supabase_auth.py -v --timeout=30
```
Expected: 2 passed (install `python-jose[cryptography]` if missing).

**Step 5: Commit**

```bash
cd gcaplabs-hermeshq && git add backend/hermeshq/core/supabase_auth.py backend/hermeshq/config.py backend/tests/test_supabase_auth.py && git commit -m "feat: add Supabase JWT verification via public JWKS"
```

---

### Task 2: Wire Supabase auth into provision endpoint

**Objective:** The desktop/iOS/console provision endpoint (`POST /api/desktop/provision`) should accept EITHER a local HermesHQ JWT (existing) OR a Supabase JWT (new). Create a combined auth dependency that tries Supabase first, falls back to local.

**Files:**
- Create: `gcaplabs-hermeshq/backend/hermeshq/core/combined_auth.py`
- Modify: `gcaplabs-hermeshq/backend/hermeshq/routers/desktop_runtime.py` (provision + validate endpoints)

**Context from codebase:**
- `routers/desktop_runtime.py:257` has `current_user: User = Depends(get_current_user)` on the provision endpoint.
- `core/security.py:120` `get_current_user` reads Bearer token from `oauth2_scheme` + cookie, decodes with `settings.jwt_secret` (HS256), looks up User by subject.
- The provision endpoint is at `POST /api/desktop/provision` (line 253).
- The validate endpoint is at `POST /api/desktop/runtime/validate`.

**Step 1: Create `core/combined_auth.py`**

```python
"""Combined auth: try Supabase JWT first, fall back to local HS256.

Used by endpoints that serve both console (Supabase-authenticated) and
desktop (local JWT) callers.
"""
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from hermeshq.core.security import decode_access_token_subject, get_user_by_subject
from hermeshq.core.supabase_auth import verify_supabase_token
from hermeshq.database import get_db_session
from hermeshq.models.user import User


async def get_authenticated_user(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    """Try Supabase JWT → fall back to local JWT → 401 if neither works."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()

        # Try Supabase first (RS256, asymmetric JWKS)
        user = await verify_supabase_token(token, db)
        if user:
            return user

        # Fall back to local auth (HS256, shared secret)
        subject, subject_kind = decode_access_token_subject(token)
        if subject:
            user = await get_user_by_subject(db, subject, subject_kind)
            if user and user.is_active:
                return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
```

**Step 2: Use combined auth on provision + validate endpoints**

In `routers/desktop_runtime.py`:

1. Add import: `from hermeshq.core.combined_auth import get_authenticated_user`
2. On the provision endpoint (line ~257), change:
   ```python
   # old:
   current_user: User = Depends(get_current_user),
   # new:
   current_user: User = Depends(get_authenticated_user),
   ```
3. Do the same on the validate endpoint.

**Step 3: Run existing tests**

```bash
cd gcaplabs-hermeshq && python -m pytest backend/tests/test_desktop_runtime.py -v --timeout=30
```
Expected: existing tests still pass (they override `get_current_user`, which is fine — the test mocks don't send Supabase tokens, so the combined auth falls through to local and gets the mock).

**Step 4: Commit**

```bash
cd gcaplabs-hermeshq && git add backend/hermeshq/core/combined_auth.py backend/hermeshq/routers/desktop_runtime.py && git commit -m "feat: provision endpoint accepts Supabase + local JWTs"
```

---

### Task 3: Replace legacy nous_api_key with kimi-code model credential

**Objective:** Stop injecting `org.nous_api_key` as `NOUS_API_KEY` into runtime_env. Instead, inject `KIMI_API_KEY` + the kimi-coding provider config so the per-user container's Hermes profile authenticates with the kimi-k2.7-code model.

**Files:**
- Modify: `gcaplabs-hermeshq/backend/hermeshq/config.py` (add kimi settings)
- Modify: `gcaplabs-hermeshq/backend/hermeshq/routers/desktop_runtime.py:100-170` (the `nous_api_key` / `runtime_env` construction)
- Modify: `gcaplabs-hermeshq/docker-compose.yml` (add kimi + supabase + resend env vars)

**Context from codebase:**
- `desktop_runtime.py:102` reads `nous_api_key = org.nous_api_key or None`
- `desktop_runtime.py:169-170` injects `runtime_env["NOUS_API_KEY"] = nous_api_key`
- `container_supervisor.py:202-203` passes `**runtime_env` into the container env via `-e` flags
- `config.py` already has `open_signup` — we add `kimi_api_key` the same way
- The Organization model (`models/organization.py:21`) has `nous_api_key` field — we stop reading it for runtime env but don't remove the column (backward compat)
- `main.py:148-156` already normalizes kimi-coding provider URLs — the backend knows about kimi

**Step 1: Add kimi settings to `config.py`**

After `open_signup: bool = False` (line 56):
```python
    kimi_api_key: str | None = None
    kimi_provider: str = "kimi-coding"
    kimi_model: str = "kimi-k2.7-code"
    kimi_base_url: str = "https://api.kimi.com/coding"
    kimi_api_mode: str = "anthropic_messages"
```

**Step 2: Replace nous_api_key injection in `_build_provision_response`**

In `routers/desktop_runtime.py`, in `_build_provision_response` (around lines 100-170):

Replace the block that reads `nous_api_key = org.nous_api_key or None` and injects `runtime_env["NOUS_API_KEY"]`:

```python
    # OLD (remove):
    # nous_api_key = org.nous_api_key or None
    # ...
    # if nous_api_key:
    #     runtime_env["NOUS_API_KEY"] = nous_api_key

    # NEW: inject kimi-code model credential (replaces legacy nous_api_key)
    s = get_settings()
    if s.kimi_api_key:
        runtime_env["KIMI_API_KEY"] = s.kimi_api_key
        runtime_env["HERMES_DEFAULT_PROVIDER"] = s.kimi_provider
        runtime_env["HERMES_DEFAULT_MODEL"] = s.kimi_model
        runtime_env["HERMES_DEFAULT_BASE_URL"] = s.kimi_base_url
        runtime_env["HERMES_DEFAULT_API_MODE"] = s.kimi_api_mode
```

In the `DesktopProvisionResponse` construction, keep `nous_api_key` field for backward compat but set it to `None`:
```python
    nous_api_key=None,  # legacy — replaced by kimi-code runtime_env injection
```

**Step 3: Add env vars to `docker-compose.yml`**

In `docker-compose.yml`, in the `backend` service `environment:` block, after `OPEN_SIGNUP`:

```yaml
      KIMI_API_KEY: ${KIMI_API_KEY:-}
      KIMI_PROVIDER: ${KIMI_PROVIDER:-kimi-coding}
      KIMI_MODEL: ${KIMI_MODEL:-kimi-k2.7-code}
      KIMI_BASE_URL: ${KIMI_BASE_URL:-https://api.kimi.com/coding}
      KIMI_API_MODE: ${KIMI_API_MODE:-anthropic_messages}
      SUPABASE_JWKS_URL: ${SUPABASE_JWKS_URL:-}
      RESEND_API_KEY: ${RESEND_API_KEY:-}
      FROM_EMAIL: ${FROM_EMAIL:-}
      SENTRY_DSN: ${SENTRY_DSN:-}
```

Also update `CORS_ORIGINS_JSON` default to include console:
```yaml
      CORS_ORIGINS: '["http://localhost:3420","http://frontend","https://hq.gcaplabs.com","https://console.gcaplabs.com","http://localhost:3000"]'
```

**Step 4: Write VPS .env (NOT committed)**

Read values from `gcaplabs-headmasterUI/vps.env` and write to `gcaplabs-hermeshq/.env` (gitignored). Verify exact var names against `config.py` Settings class. Key mappings:
- `KIMI_API_KEY` → from vps.env `KIMI_API_KEY`
- `SUPABASE_JWKS_URL` → from vps.env `SUPABASE_JWKS_URL`
- `RESEND_API_KEY` → from vps.env `RESEND_API_KEY`
- `FROM_EMAIL` → from vps.env `FROM_EMAIL`
- `SENTRY_DSN` → from vps.env `SENTRY_DSN`
- `OPEN_SIGNUP` → `true` (from vps.env)
- `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / `OIDC_DISCOVERY_URL` → from vps.env

**Step 5: Run tests**

```bash
cd gcaplabs-hermeshq && python -m pytest backend/tests/test_desktop_runtime.py backend/tests/test_containers_runtime.py -v --timeout=30
```
Expected: existing tests pass (they mock settings, won't break on new fields).

**Step 6: Commit**

```bash
cd gcaplabs-hermeshq && git add backend/hermeshq/config.py backend/hermeshq/routers/desktop_runtime.py docker-compose.yml && git commit -m "feat: replace legacy nous_api_key with kimi-code model credential + add console CORS"
```

---

### Task 4: Deploy HermesHQ to VPS and run approve→provision→runtime smoke

**Objective:** Deploy the updated HermesHQ stack to the VPS and run the full smoke test: approve a user, provision, confirm the container answers tokens from kimi-k2.7-code.

**This task is interactive — requires SSH to VPS and DNS to be ready.**

**Prerequisites:**
- `hq.gcaplabs.com` already points at the Cloudflare tunnel (confirmed from prior work).
- `*.run.gcaplabs.com` must point at the Cloudflare tunnel for runtime routes. **STOP and ask owner if not done.**
- VPS `.env` at `/opt/hermeshq/.env` needs the new vars appended (KIMI_API_KEY, SUPABASE_JWKS_URL, RESEND_API_KEY, etc.).

**Step 1: Push code to VPS**

```bash
cd gcaplabs-hermeshq && git push origin main
ssh vps "cd /opt/hermeshq && git pull"
```

**Step 2: Update VPS .env with new vars**

Read values from `gcaplabs-headmasterUI/vps.env`, append to VPS `/opt/hermeshq/.env`:
```bash
ssh vps "cat >> /opt/hermeshq/.env << 'EOF'
KIMI_API_KEY=<from-vps.env>
KIMI_PROVIDER=kimi-coding
KIMI_MODEL=kimi-k2.7-code
KIMI_BASE_URL=https://api.kimi.com/coding
KIMI_API_MODE=anthropic_messages
SUPABASE_JWKS_URL=<from-vps.env>
RESEND_API_KEY=<from-vps.env>
FROM_EMAIL=noreply@gcaplabs.com
SENTRY_DSN=<from-vps.env>
OPEN_SIGNUP=true
EOF"
```

**Step 3: Deploy HermesHQ**

```bash
ssh vps "cd /opt/hermeshq && docker compose up -d --build"
```

**Step 4: Verify backend is healthy**

```bash
ssh vps "curl -s http://localhost:8000/health"
```
Expected: `{"status": "healthy"}` or similar.

**Step 5: Approve a test user and provision**

```bash
# Register a test user
curl -X POST https://hq.gcaplabs.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"beta-test","email":"beta@test.com","password":"TestPass123!"}'

# Admin login
ADMIN_TOKEN=$(curl -s -X POST https://hq.gcaplabs.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<admin-pass>"}' | jq -r .access_token)

# Approve the user
curl -X PATCH https://hq.gcaplabs.com/api/users/beta-test \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"user"}'

# Provision
curl -X POST https://hq.gcaplabs.com/api/desktop/provision \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client":"smoke-test","version":"0.2.2","platform":"cli"}' | jq
```
Expected: provision response with `runtime.base_url` pointing at `https://hm-<id>.run.gcaplabs.com`, `cloud_container_config.forward_auth_token` present, `runtime_env` containing `KIMI_API_KEY`.

**Step 6: Confirm container answers /v1/health + /v1/models + chat**

```bash
# Extract from provision response
TOKEN=$(... | jq -r .cloud_container_config.forward_auth_token)
BASE_URL=$(... | jq -r .runtime.base_url)

curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/v1/health" | jq
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/v1/models" | jq
# Should list kimi-k2.7-code

# Test chat via /v1/responses
curl -s -X POST "$BASE_URL/v1/responses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input":"Say hello in one word","stream":false}' | jq
```
Expected: model response from kimi-k2.7-code.

**Step 7: Update trackers**

Update `mastertodo.md` — tick Phase 3 items. Log to `masterlog.md`.

**Step 8: Commit tracker updates**

```bash
cd gcaplabs-headmasterUI && git add mastertodo.md masterlog.md && git commit -m "docs: Phase 3 complete — Supabase JWT + kimi-code + smoke passed"
```

**Gate: Phase 3 complete.** HermesHQ validates Supabase JWTs, injects kimi-code credentials, and the full approve→provision→runtime smoke passes on VPS.

---

## Phase 4 — Update the Console (existing Wasp app)

### Task 5: Migrate console chat from /v1/runs to /v1/responses SSE

**Objective:** The console's `runsApiClient.ts` currently talks to the old `/v1/runs` endpoint. Migrate it to the unified `/v1/responses` SSE contract (same as desktop's `hermesChatAdapter.ts`).

**Files:**
- Modify: `gcaplabs-console/app/src/user/dashboard/runsApiClient.ts`
- Modify: `gcaplabs-console/app/src/user/dashboard/DashboardChatPage.tsx` (if callback shape changes)

**Context from codebase:**
- `runsApiClient.ts` currently does: `POST /v1/runs` → gets `run_id` → `GET /v1/runs/{id}/events` (SSE)
- The new contract is: `POST /v1/responses` with `stream: true` → SSE stream directly (no separate events endpoint)
- SSE events: `response.created`, `response.output_text.delta`, `response.reasoning.delta`, `response.tool_call.started|completed|failed`, `response.completed`, `response.failed`
- Cancel: `POST /v1/responses/{id}/cancel`
- The desktop's `hermesChatAdapter.ts` already does this — use it as reference
- `DashboardChatPage.tsx` calls `submitRunAndStream(endpointUrl, apiKey, input, sessionId, callbacks, signal)`
- The `RunStreamCallbacks` interface (onChunk, onToolEvent, onReasoning, onDone, onError, onApprovalRequest) should stay the same — only the internal fetch/SSE parsing changes

**Step 1: Read the desktop adapter for reference**

```bash
cat gcaplabs-headmasterUI/packages/desktop/src/.../hermesChatAdapter.ts
```
Find the actual path first:
```bash
find gcaplabs-headmasterUI/packages/desktop/src -name "hermesChatAdapter*" -o -name "*ChatAdapter*" 2>/dev/null
```

**Step 2: Rewrite `runsApiClient.ts`**

Replace the `POST /v1/runs` + `GET /v1/runs/{id}/events` flow with:
- `POST /v1/responses` with `{"input": "...", "stream": true, "session_id": "..."}` 
- Parse the SSE stream directly from the response body
- Map SSE events to the existing `RunStreamCallbacks` interface
- Cancel via `POST /v1/responses/{id}/cancel`

Keep the same exported function signature so `DashboardChatPage.tsx` doesn't need changes (or minimal changes).

**Step 3: Update auth header**

Currently uses `Authorization: ${apiKey}` and `X-Hermes-Session-Key: ${apiKey}`. The new contract uses `Authorization: Bearer ${forwardAuthToken}`. Check how `apiKey` is obtained — it comes from `getContainerCredentials` Wasp query. That query needs to return the forward-auth token from the provision response (see Task 6).

**Step 4: Typecheck**

```bash
cd gcaplabs-console/app && npx tsc --noEmit
```

**Step 5: Commit**

```bash
cd gcaplabs-console && git add app/src/user/dashboard/runsApiClient.ts && git commit -m "feat: migrate console chat from /v1/runs to /v1/responses SSE"
```

---

### Task 6: Rewire console backend to HermesHQ provision API

**Objective:** The console currently gets container credentials via a Wasp query (`getContainerCredentials`). Wire this to call HermesHQ's `POST /api/desktop/provision` so the console gets the correct subdomain URL + forward-auth token + model catalog.

**Files:**
- Modify: `gcaplabs-console/app/src/server/` (Wasp server actions — find the `getContainerCredentials` query)
- Modify: `gcaplabs-console/app/main.wasp` (if the query is defined there)
- Modify: `gcaplabs-console/app/src/user/dashboard/DashboardChatPage.tsx` (if the provision flow changes)

**Context from codebase:**
- `DashboardChatPage.tsx:4` imports `getContainerCredentials` from `wasp/client/operations`
- The Wasp query returns `assignedInstanceUrl` and `assignedApiKey` (from `dbSeeds.ts:125-126`)
- We need it to instead call HermesHQ provision and return `{ endpointUrl, forwardAuthToken, sessionNamespace, models }`
- HermesHQ provision is at `POST /api/desktop/provision` with a Bearer token (local JWT or Supabase JWT)

**Step 1: Find the Wasp query definition**

```bash
cd gcaplabs-console && grep -rn "getContainerCredentials" app/ --include="*.ts" --include="*.tsx" --include="*.wasp" | head -10
```

**Step 2: Rewrite the query to call HermesHQ**

The Wasp server action should:
1. Get the current user's auth token (Wasp session token or Supabase JWT)
2. Call `POST https://hq.gcaplabs.com/api/desktop/provision` with that token
3. Return `{ endpointUrl, forwardAuthToken, sessionNamespace, models, providers }` from the provision response

**Step 3: Update the console to use the provision response**

In `DashboardChatPage.tsx`, the chat should use `endpointUrl` + `forwardAuthToken` from the provision response (not the seed data).

**Step 4: Typecheck**

```bash
cd gcaplabs-console/app && npx tsc --noEmit
```

**Step 5: Commit**

```bash
cd gcaplabs-console && git add -A && git commit -m "feat: rewire console to HermesHQ provision API"
```

---

### Task 7: Add Supabase auth to the console (or wire HermesHQ to trust Wasp tokens)

**Objective:** The veeplan says "Supabase is the single identity source of truth." The console currently uses Wasp's built-in auth. We need to decide: (a) add Supabase auth to the Wasp console, or (b) keep Wasp auth and have HermesHQ trust Wasp-issued JWTs.

**OPEN QUESTION — see Open Questions section.** The simplest path for beta:
- Keep Wasp auth on the console (it works, has email + password + OAuth)
- When the console calls HermesHQ provision, it passes the user's Wasp JWT
- HermesHQ already has the combined auth (Task 2) — but it tries Supabase first, local second
- We need HermesHQ to ALSO accept Wasp-issued JWTs

**Actually, simpler approach:** Have the console's server action call HermesHQ provision using an admin/service token (not the user's browser token). The console's backend is trusted; it proxies requests to HermesHQ with a service credential. This way we don't need to share auth between Wasp and Supabase at all.

**Step 1: Add a HermesHQ service token to the console's .env**

```bash
# In gcaplabs-console/app/.env (gitignored)
HERMESHQ_URL=https://hq.gcaplabs.com
HERMESHQ_SERVICE_TOKEN=<a local JWT minted on HermesHQ for the console>
```

**Step 2: Console server actions use the service token**

When the console calls HermesHQ provision, it uses `HERMESHQ_SERVICE_TOKEN` in the Authorization header. HermesHQ's combined auth (Task 2) will decode it as a local JWT and find the service user.

**Step 3: Map console users to HermesHQ users**

When a user signs up on the console, the console's server action also calls HermesHQ's `POST /api/auth/register` to create a matching user there. Or: the console passes the Wasp user's email/username to HermesHQ provision, and HermesHQ creates/finds the user by email.

**This is the most complex task — it needs design discussion. Flag as an open question and proceed with a service-token approach for beta.**

---

### Task 8: Apply GCAP brand kit to console

**Objective:** Replace "GCAP Labs Console" / "OpenSaaS" branding with Headmaster branding using the canonical brand tokens. Scrub any upstream references.

**Files:**
- Modify: `gcaplabs-console/app/main.wasp` (title, head meta)
- Modify: `gcaplabs-console/app/src/` (any UI strings, landing page copy)
- Modify: `gcaplabs-console/app/src/landing-page/` (landing page content)
- Reference: `gcaplabs-headmasterUI/docs/theming/gcap-brand-tokens.css` + `.ts` + `.json`

**Step 1: Grep audit for upstream references**

```bash
cd gcaplabs-console && grep -rni "opensaas\|open-saas\|wasp\|agent37" app/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".wasp"
```

**Step 2: Update app title + meta in main.wasp**

Already says "GCAP Labs Console" — verify. Update head meta tags to Headmaster.

**Step 3: Apply brand tokens to CSS**

Find the console's Tailwind config + globals.css, apply the GCAP brand tokens.

**Step 4: Update landing page copy**

Replace any OpenSaaS/Wasp template copy with Headmaster beta copy.

**Step 5: Typecheck + build**

```bash
cd gcaplabs-console/app && npx tsc --noEmit && npm run build
```

**Step 6: Commit**

```bash
cd gcaplabs-console && git add -A && git commit -m "feat: apply GCAP brand kit to console"
```

---

### Task 9: Deploy console to Vercel at console.gcaplabs.com

**Objective:** Deploy the updated console to Vercel using the VERCEL_TOKEN from vps.env, and point `console.gcaplabs.com` at it.

**Prerequisites:**
- DNS: `console.gcaplabs.com` must be configured. **STOP and ask owner if not done.**
- The console needs to be on GitHub (already at `mutvayzz-sys/gcaplabs-console`).

**Step 1: Push console to GitHub**

```bash
cd gcaplabs-console && git push origin main
```

**Step 2: Deploy to Vercel**

```bash
cd gcaplabs-console
npx vercel --prod --token=$VERCEL_TOKEN
```

**Step 3: Configure env vars on Vercel**

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production --token=$VERCEL_TOKEN
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --token=$VERCEL_TOKEN
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --token=$VERCEL_TOKEN
npx vercel env add HERMESHQ_URL production --token=$VERCEL_TOKEN
npx vercel env add HERMESHQ_SERVICE_TOKEN production --token=$VERCEL_TOKEN
npx vercel env add NEXT_PUBLIC_SENTRY_DSN production --token=$VERCEL_TOKEN
```

**Step 4: Configure custom domain**

In Vercel: add `console.gcaplabs.com` as a custom domain. Owner needs to add the CNAME in Cloudflare.

**Step 5: Verify the gate**

1. Open `https://console.gcaplabs.com`
2. Sign up with email + password
3. Admin approves at `https://hq.gcaplabs.com`
4. Console shows fleet (the user's provisioned container)
5. Launch chat → streaming works via `/v1/responses`

**Step 6: Update trackers**

```bash
cd gcaplabs-headmasterUI && git add mastertodo.md masterlog.md && git commit -m "docs: Phase 4 complete — console live at console.gcaplabs.com"
```

**Gate: Phase 4 complete.** New user signs up → approved → sees fleet → launches working chat.

---

## Phase 5 — iOS Client Migration

### Task 10: Migrate iOS RunsAPIClient from /v1/runs to /v1/responses SSE

**Objective:** iOS `RunsAPIClient.swift` currently talks to the old `/v1/runs` endpoint. Migrate it to the unified `/v1/responses` SSE contract, mirroring the desktop's `hermesChatAdapter.ts`.

**Files:**
- Modify: `gcaplabs-ios/scarf/Packages/HeadmasterIOS/Sources/HeadmasterIOS/RunsAPIClient.swift`
- Modify: `gcaplabs-ios/scarf/Packages/HeadmasterIOS/Sources/HeadmasterIOS/CloudContainerTransport.swift` (update auth header)
- Modify: `gcaplabs-ios/scarf/Packages/HeadmasterCore/Sources/HeadmasterCore/Models/ServerContext.swift` (update `CloudContainerConfig` if provision response shape changed)
- Modify: `gcaplabs-ios/scarf/Packages/HeadmasterIOS/Sources/HeadmasterIOS/HermesHQLoginViewModel.swift` (provision response parsing)

**Context from codebase:**
- `RunsAPIClient.swift:160` does `POST /v1/runs` → gets `run_id` → `GET /v1/runs/{id}/events` (SSE)
- `RunsAPIClient.swift` maps SSE events to `ACPEvent` (the iOS app's internal event type)
- `CloudContainerTransport.swift` returns baked config with `provider: nous-api, default: Hermes-3-Llama-3.1-70B` — needs updating to kimi-code
- `HermesHQLoginViewModel.swift:58` handles provision response
- `ServerContext.swift:67` defines `CloudContainerConfig` struct
- The desktop's `hermesChatAdapter.ts` already implements `/v1/responses` — use it as reference

**Step 1: Read the desktop adapter for reference**

```bash
find gcaplabs-headmasterUI/packages/desktop/src -name "hermesChatAdapter*" 2>/dev/null
```

**Step 2: Rewrite `RunsAPIClient.swift`**

Replace:
- `POST /v1/runs` → `POST /v1/responses` with `{"input": "...", "stream": true, "session_id": "..."}`
- `GET /v1/runs/{id}/events` → SSE stream comes directly from the POST response body
- Map SSE events: `response.created`, `response.output_text.delta`, `response.reasoning.delta`, `response.tool_call.*`, `response.completed`, `response.failed` → existing `ACPEvent` types
- Cancel: `POST /v1/responses/{id}/cancel`

Keep the same public actor interface (`start()`, `newSession()`, `sendPrompt()`, `stop()`, `events`) so `ChatView.swift` doesn't need major changes.

**Step 3: Update auth header in `CloudContainerTransport.swift`**

Change from `apiServerKey` (raw key) to `Authorization: Bearer ${forwardAuthToken}`.

**Step 4: Update baked config in `CloudContainerTransport.swift`**

Change from:
```swift
let defaultConfig = "model:\n  provider: nous-api\n  default: Hermes-3-Llama-3.1-70B\n"
```
To:
```swift
let defaultConfig = "model:\n  provider: kimi-coding\n  default: kimi-k2.7-code\n"
```

**Step 5: Update `HermesHQLoginViewModel.swift` for new provision response**

The provision response now includes `cloud_container_config.forward_auth_token` and `runtime.base_url`. Update parsing to extract these.

**Step 6: Update `ServerContext.swift` `CloudContainerConfig`**

Add `forwardAuthToken` and `forwardAuthExpiresAt` fields if not present. The struct currently has `endpointURL` and `apiServerKey` — add the new fields.

**Step 7: Build (if Xcode available)**

```bash
cd gcaplabs-ios/scarf && xcodebuild -project scarf.xcodeproj -scheme scarf -destination 'platform=iOS Simulator,name=iPhone 16' build 2>&1 | tail -20
```
(If no Xcode on this machine, note as blocked for build verification — the code changes can still be made.)

**Step 8: Commit**

```bash
cd gcaplabs-ios && git add -A && git commit -m "feat: migrate iOS RunsAPIClient from /v1/runs to /v1/responses SSE"
```

**Gate: Phase 5 complete.** iOS and desktop both chat via `/v1/responses` SSE against a remote provisioned instance.

---

## Phase 6 — Beta Hardening

### Task 11: Email MFA + password reset via Resend

**Objective:** Wire `RESEND_API_KEY` and `FROM_EMAIL` into HermesHQ's email service for MFA codes and password resets.

**Files:**
- Verify: `gcaplabs-hermeshq/backend/hermeshq/services/email_service.py`
- Already done: env vars added to docker-compose.yml (Task 3) and VPS .env (Task 4)

**Step 1: Verify email service supports Resend**

```bash
cd gcaplabs-hermeshq && cat backend/hermeshq/services/email_service.py | head -80
```
Check if it already uses Resend API or needs wiring.

**Step 2: If wiring needed, add Resend integration**

The email service should use `RESEND_API_KEY` to send emails via `https://api.resend.com/emails`.

**Step 3: Test MFA + password reset flows**

```bash
# Login triggers MFA code email
curl -X POST https://hq.gcaplabs.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"beta-test","password":"TestPass123!"}'
# Should return mfa_required: true and send email

# Password reset
curl -X POST https://hq.gcaplabs.com/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"beta@test.com"}'
# Should send reset email
```

**Step 4: Commit**

```bash
cd gcaplabs-hermeshq && git add -A && git commit -m "feat: wire Resend email for MFA + password reset"
cd gcaplabs-headmasterUI && git add mastertodo.md masterlog.md && git commit -m "docs: Phase 6 email MFA + reset wired"
```

---

### Task 12: Observability — container health dashboard + Sentry

**Objective:** Extend HermesHQ's health monitoring to show container health, and wire Sentry DSN into console + desktop.

**Files:**
- Modify: `gcaplabs-hermeshq/backend/hermeshq/routers/dashboard.py` (add container health)
- Modify: `gcaplabs-console/app/` (add Sentry)
- Verify: `gcaplabs-headmasterUI/packages/desktop/src/` (Sentry already wired?)

**Step 1: Check existing Sentry wiring on desktop**

```bash
cd gcaplabs-headmasterUI && grep -r "sentry\|Sentry" packages/desktop/src/ --include="*.ts" | head -10
```

**Step 2: Add Sentry to console**

```bash
cd gcaplabs-console/app && npm install @sentry/react
# Create sentry config files, set SENTRY_DSN from vps.env
```

**Step 3: Add container health to HermesHQ dashboard**

Check `routers/dashboard.py` for existing health endpoint, extend with container status from `container_supervisor`.

**Step 4: Commit**

```bash
cd gcaplabs-hermeshq && git add -A && git commit -m "feat: container health dashboard + Sentry"
cd gcaplabs-console && git add -A && git commit -m "feat: add Sentry error tracking"
```

---

### Task 13: Security hardening + lifecycle (idle reaper = H7)

**Objective:** Forward-auth token rotation, verify no-new-privileges, secrets out of images, idle reaper cron, restart policies, data-dir backups.

**Files:**
- Verify: `gcaplabs-hermeshq/backend/hermeshq/services/container_supervisor.py:234` (no-new-privileges already present)
- Create: VPS `/opt/headmaster/scripts/reap-idle-instances.sh`

**Step 1: Verify no-new-privileges**

```bash
grep "no-new-privileges" gcaplabs-hermeshq/backend/hermeshq/services/container_supervisor.py
```
Already present at line 234 — good.

**Step 2: Verify secrets not baked into image**

```bash
ssh vps "docker inspect headmaster-hermes-runtime:latest --format '{{.Config.Env}}'"
# Should NOT contain KIMI_API_KEY or any secret — those are injected at run time via -e
```

**Step 3: Create idle reaper script on VPS (covers H7)**

```bash
ssh vps "mkdir -p /opt/headmaster/scripts && cat > /opt/headmaster/scripts/reap-idle-instances.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail
TTL_SECONDS=\${RUNTIME_CONTAINER_IDLE_TTL_SECONDS:-3600}
CONTAINERS=\$(docker ps --filter 'label=hermeshq.runtime_container_id' --format '{{.ID}}')
for CID in \$CONTAINERS; do
  CREATED=\$(docker inspect -f '{{.Created}}' \"\$CID\")
  CREATED_EPOCH=\$(date -d \"\$CREATED\" +%s)
  NOW=\$(date +%s)
  AGE=\$((NOW - CREATED_EPOCH))
  if [ \$AGE -gt \$TTL_SECONDS ]; then
    echo \"Reaping idle container \$CID (age: \${AGE}s)\"
    docker stop \"\$CID\" && docker rm \"\$CID\"
  fi
done
SCRIPT
chmod +x /opt/headmaster/scripts/reap-idle-instances.sh"
```

**Step 4: Add cron entry**

```bash
ssh vps "echo '*/10 * * * * /opt/headmaster/scripts/reap-idle-instances.sh >> /var/log/headmaster-reaper.log 2>&1' | sudo tee /etc/cron.d/headmaster-reaper"
```

**Step 5: Verify restart policies**

```bash
grep "restart" gcaplabs-hermeshq/docker-compose.yml
# Should have restart: unless-stopped on all services — already confirmed
```

**Step 6: Commit + update trackers**

```bash
cd gcaplabs-headmasterUI && git add mastertodo.md masterlog.md && git commit -m "docs: Phase 6 hardening — security + lifecycle + reaper (H7)"
```

**Gate: Phase 6 complete.** 5-10 external beta testers can sign up, be approved, chat reliably in isolated containers, and be torn down cleanly.

---

## Phase 7 — Brand Rollout

### Task 14: Apply brand tokens to desktop (uno.config.ts + :root seeds)

**Objective:** Map the canonical GCAP brand tokens into the desktop app's UnoCSS theme + `:root`/`:root.dark` seed variables.

**Files:**
- Modify: `gcaplabs-headmasterUI/uno.config.ts`
- Modify: `gcaplabs-headmasterUI/packages/desktop/src/index.html` or equivalent (add `:root` CSS custom properties)
- Reference: `gcaplabs-headmasterUI/docs/theming/gcap-brand-tokens.css` + `.ts` + `.json`

**Step 1: Read the canonical brand tokens**

```bash
cat gcaplabs-headmasterUI/docs/theming/gcap-brand-tokens.css
cat gcaplabs-headmasterUI/docs/theming/gcap-brand-tokens.ts
```

**Step 2: Read current desktop theme**

```bash
cat gcaplabs-headmasterUI/uno.config.ts
cat gcaplabs-headmasterUI/docs/white-label/HEADMASTER-PALETTE-SNIPPET.css
```

**Step 3: Update uno.config.ts**

Map the brand tokens into the UnoCSS theme — update the color palette, fonts, radius to match the canonical tokens.

**Step 4: Update :root / :root.dark seed variables**

Replace the existing seed-variable system with the canonical GCAP brand tokens. The mechanism (seed vars + `color-mix`) stays the same — just the seed values change.

**Step 5: Typecheck + build**

```bash
cd gcaplabs-headmasterUI && bunx tsc --noEmit && bunx electron-vite build --config packages/desktop/electron.vite.config.ts
```

**Step 6: Visual QA**

Run `bun run dev` and verify the desktop renders the new palette in light + dark mode.

**Step 7: Commit**

```bash
cd gcaplabs-headmasterUI && git add uno.config.ts packages/desktop/src/ && git commit -m "feat: apply GCAP brand tokens to desktop"
```

---

### Task 15: Apply brand tokens to marketing site

**Objective:** Map the canonical GCAP brand tokens into `gcaplabs-site/tailwind.config.js` + `app/globals.css`.

**Files:**
- Modify: `gcaplabs-site/tailwind.config.js`
- Modify: `gcaplabs-site/app/globals.css`
- Reference: `gcaplabs-headmasterUI/docs/theming/gcap-brand-tokens.css`

**Step 1: Read current site theme**

```bash
cat gcaplabs-site/tailwind.config.js
cat gcaplabs-site/app/globals.css
```

**Step 2: Map canonical tokens into Tailwind config + globals.css**

Update `theme.extend.colors` to use the GCAP brand token values. Update `:root` CSS custom properties.

**Step 3: Build + visual QA**

```bash
cd gcaplabs-site && npm run build && npm run dev
# Open http://localhost:3000 and verify palette
```

**Step 4: Commit**

```bash
cd gcaplabs-site && git add -A && git commit -m "feat: apply GCAP brand tokens to marketing site"
```

---

### Task 16: Apply brand tokens to HermesHQ dashboard

**Objective:** Map the canonical GCAP brand tokens into HermesHQ's frontend (Tailwind v4 theme).

**Files:**
- Modify: `gcaplabs-hermeshq/frontend/` (locate Tailwind config + globals.css)

**Step 1: Locate HermesHQ frontend theme files**

```bash
find gcaplabs-hermeshq/frontend -name "tailwind*" -o -name "globals.css" -o -name "*.css" | head -10
```

**Step 2: Apply tokens**

Map the canonical GCAP brand tokens into the HermesHQ frontend's Tailwind theme + CSS custom properties.

**Step 3: Build**

```bash
cd gcaplabs-hermeshq && docker compose build frontend
```

**Step 4: Deploy + visual QA**

```bash
ssh vps "cd /opt/hermeshq && docker compose up -d frontend"
# Open https://hq.gcaplabs.com and verify palette
```

**Step 5: Commit**

```bash
cd gcaplabs-hermeshq && git add frontend/ && git commit -m "feat: apply GCAP brand tokens to HermesHQ dashboard"
```

**Gate: Phase 7 complete.** Site, console, desktop, and HermesHQ render the same palette, type, radius, and accent; a single token change propagates to all four; light/dark both correct.

---

## VPS Infrastructure (Hoster) — Wire host-kit scripts

### Task 17: H4 — create-instance.sh

**Objective:** Create the `create-instance.sh` script for manual container provisioning on the VPS.

**Files:**
- Create: VPS `/opt/headmaster/scripts/create-instance.sh`

**Step 1: Write the script on VPS**

```bash
ssh vps "cat > /opt/headmaster/scripts/create-instance.sh << 'SCRIPT'
#!/bin/bash
set -euo pipefail
# Usage: create-instance.sh <user-id> <container-id>
USER_ID=\"\$1\"
CONTAINER_ID=\"\$2\"
IMAGE=\"\${RUNTIME_CONTAINER_IMAGE:-headmaster-hermes-runtime:latest}\"
NETWORK=\"\${RUNTIME_CONTAINER_NETWORK:-hermes_runtime}\"
DATA_DIR=\"/var/lib/headmaster/instances/\${CONTAINER_ID}\"
RUN_DOMAIN=\"\${RUN_DOMAIN:-run.gcaplabs.com}\"
FORWARD_AUTH_URL=\"\${FORWARD_AUTH_URL:-http://127.0.0.1:18081/}\"

mkdir -p \"\$DATA_DIR\"

ROUTER_NAME=\"hm-\${CONTAINER_ID:0:12}\"
HOST=\"\${ROUTER_NAME}.\${RUN_DOMAIN}\"

docker run -d \\
  --name \"hm-\${CONTAINER_ID}\" \\
  --network \"\$NETWORK\" \\
  --cpus 2 --memory 4g --pids-limit 512 --shm-size 1g \\
  --security-opt no-new-privileges \\
  -v \"\${DATA_DIR}:/app/data\" \\
  --label \"hermeshq.runtime_container_id=\${CONTAINER_ID}\" \\
  --label \"hermeshq.user_id=\${USER_ID}\" \\
  --label \"traefik.enable=true\" \\
  --label \"traefik.http.routers.\${ROUTER_NAME}.rule=Host(\\\`\${HOST}\\\`)\" \\
  --label \"traefik.http.routers.\${ROUTER_NAME}.entrypoints=websecure\" \\
  --label \"traefik.http.routers.\${ROUTER_NAME}.tls=true\" \\
  --label \"traefik.http.services.\${ROUTER_NAME}.loadbalancer.server.port=3737\" \\
  --label \"traefik.http.routers.\${ROUTER_NAME}.middlewares=\${ROUTER_NAME}-forward-auth\" \\
  --label \"traefik.http.middlewares.\${ROUTER_NAME}-forward-auth.forwardauth.address=\${FORWARD_AUTH_URL}\" \\
  --label \"traefik.http.middlewares.\${ROUTER_NAME}-forward-auth.forwardauth.trustForwardHeader=true\" \\
  -e HERMES_MODE=headmaster_remote \\
  -e PORT=3737 \\
  -e GATEWAY_DEFAULT_AGENT=hermes \\
  \"\$IMAGE\"

echo \"Container hm-\${CONTAINER_ID} started at https://\${HOST}\"
SCRIPT
chmod +x /opt/headmaster/scripts/create-instance.sh"
```

**Step 2: Test**

```bash
ssh vps "/opt/headmaster/scripts/create-instance.sh test-user test-container-001"
ssh vps "docker ps --filter name=hm-test-container-001"
```

---

### Task 18: H5 — dashboard/terminal URL helpers

**Objective:** Create `dashboard-url.sh` and `terminal-url.sh` that print the public URL for a given container.

**Files:**
- Create: VPS `/opt/headmaster/scripts/dashboard-url.sh`
- Create: VPS `/opt/headmaster/scripts/terminal-url.sh`

**Step 1: Write both scripts on VPS**

```bash
ssh vps "cat > /opt/headmaster/scripts/dashboard-url.sh << 'SCRIPT'
#!/bin/bash
# Usage: dashboard-url.sh <container-id>
CONTAINER_ID=\"\$1\"
RUN_DOMAIN=\"\${RUN_DOMAIN:-run.gcaplabs.com}\"
ROUTER_NAME=\"hm-\${CONTAINER_ID:0:12}\"
echo \"https://\${ROUTER_NAME}.\${RUN_DOMAIN}\"
SCRIPT
chmod +x /opt/headmaster/scripts/dashboard-url.sh"

ssh vps "cat > /opt/headmaster/scripts/terminal-url.sh << 'SCRIPT'
#!/bin/bash
# Usage: terminal-url.sh <container-id>
CONTAINER_ID=\"\$1\"
RUN_DOMAIN=\"\${RUN_DOMAIN:-run.gcaplabs.com}\"
ROUTER_NAME=\"hm-\${CONTAINER_ID:0:12}\"
echo \"https://\${ROUTER_NAME}.\${RUN_DOMAIN}/terminal\"
SCRIPT
chmod +x /opt/headmaster/scripts/terminal-url.sh"
```

**Step 2: Test**

```bash
ssh vps "/opt/headmaster/scripts/dashboard-url.sh test-container-001"
# Should print https://hm-test-contai.run.gcaplabs.com
```

---

### Task 19: Final tracker update + commit

**Objective:** Update all trackers to reflect completion of Phases 3–7 + VPS infra.

**Files:**
- Modify: `gcaplabs-headmasterUI/mastertodo.md`
- Modify: `gcaplabs-headmasterUI/masterlog.md`
- Modify: `gcaplabs-headmasterUI/veeplan.md` (update progress section)

**Step 1: Update mastertodo.md**

Tick all completed items:
- [x] Phase 3: Supabase JWT trust
- [x] Phase 3: kimi-code model credential
- [x] Phase 3: approve→provision→runtime smoke
- [x] Phase 4: console
- [x] Phase 5: iOS
- [x] Phase 6: all items
- [x] Phase 7: all four consumers
- [x] H4, H5, H7

**Step 2: Update masterlog.md**

Append entries for each phase completion with what changed, what was verified, and what's still blocked.

**Step 3: Update veeplan.md progress section**

**Step 4: Commit**

```bash
cd gcaplabs-headmasterUI && git add mastertodo.md masterlog.md veeplan.md && git commit -m "docs: Phases 3-7 + VPS infra complete — beta readiness achieved"
```

---

## Open Questions

1. **DNS: `*.run.gcaplabs.com` wildcard** — does it already point at the Cloudflare tunnel? `hq.gcaplabs.com` is confirmed working. The wildcard for per-user container routing needs to be in place before Task 4 (smoke test). **I'll check before proceeding and tell you exactly what record to add if missing.**

2. **DNS: `console.gcaplabs.com`** — needs to point at Vercel (CNAME) before Task 9. **I'll check and tell you what to add if missing.**

3. **Console auth architecture** — the existing console uses Wasp auth (email + password + OAuth). The veeplan says "Supabase is the single identity SoT." Two paths:
   - (a) Keep Wasp auth, use a service token for HermesHQ calls (simpler for beta)
   - (b) Migrate console to Supabase auth (aligns with veeplan but bigger change)
   **DEFAULT: (a) service token for beta — migrate to Supabase auth post-beta.**

4. **HermesHQ admin password** — needed for the smoke test in Task 4. Read from VPS `.env` or ask owner. **DEFAULT: assume it's already set on the VPS from a prior deployment.**

5. **iOS build verification** — no Xcode on this Windows machine. Code changes can be made but build verification requires a Mac. **DEFAULT: make the code changes, commit, and note build verification as blocked until a Mac is available.**

6. **Supabase "publishable key" vs "anon key"** — vps.env has `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` but Supabase docs/Starter-kit uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`. These are the same thing (Supabase renamed the field). **DEFAULT: use the publishable key value for the anon key env var.**

7. **Supabase "secret key" vs "service role key"** — vps.env has `SUPABASE_SECRET_KEY` but starter-kit expects `SUPABASE_SERVICE_ROLE_KEY`. Same thing. **DEFAULT: use the secret key value for the service role key env var.**

---

## Verification Summary

After all tasks complete:

1. **Phase 3:** `cd gcaplabs-hermeshq && python -m pytest backend/tests/ -x --timeout=30` — new tests pass; smoke test on VPS passes with kimi-code streaming.
2. **Phase 4:** `cd gcaplabs-console/app && npx tsc --noEmit && npm run build` — both pass; `https://console.gcaplabs.com` serves signup → approve → fleet → chat.
3. **Phase 5:** iOS `RunsAPIClient.swift` chats via `/v1/responses` SSE (build verification requires Mac).
4. **Phase 6:** MFA email arrives; password reset works; Sentry captures errors; idle containers are reaped; no-new-privileges enforced.
5. **Phase 7:** All four surfaces (site, console, desktop, HermesHQ) render the same palette in light + dark.
6. **VPS:** `create-instance.sh`, `dashboard-url.sh`, `terminal-url.sh` all work; idle reaper cron runs.