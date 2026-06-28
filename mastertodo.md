# Master To-Do

## Done

- [x] Container provisioning: admin provisions Hermes container per user via GUI
- [x] Domain routing: containers proxied through `hq.gcaplabs.com/runtime/{name}` via nginx + Docker DNS (no exposed ports)
- [x] WebSocket support for container proxy
- [x] Domain migration: all `hermeshq.gcaplabs.com` → `hq.gcaplabs.com`
- [x] Open sign-up: `POST /api/auth/register` public endpoint (requires `OPEN_SIGNUP=true`)
- [x] Pending role: new sign-ups (password + OAuth) get `pending` role with zero capabilities
- [x] Admin approval UI: Approve / Approve+Provision buttons in UsersPage for pending users
- [x] OAuth buttons on HermesHQ login page (Google, Microsoft) — already existed, now also on register page
- [x] Desktop app: OAuth login via popup BrowserWindow (Google, Microsoft)
- [x] Desktop app: sign-up form inline in login page
- [x] Desktop app: "Hello, {username}" + logout button in sidebar
- [x] Tracker files: masterlog.md + mastertodo.md

## Next / Pending

- [ ] Set `OPEN_SIGNUP=true` in VPS `.env` to enable registrations
- [ ] Configure Google OAuth credentials: `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI=https://hq.gcaplabs.com/api/auth/oidc/callback` in VPS `.env`
- [ ] Add Google/Microsoft as DB-backed OIDC providers via HermesHQ admin (or env vars)
- [ ] Build and distribute desktop app: `node scripts/build-with-builder.js auto --win`
- [ ] Verify `hermes:latest` image exists on VPS before provisioning containers
- [ ] MFA email setup (optional): configure `RESEND_API_KEY` + `FROM_EMAIL` for MFA codes
- [ ] Password reset email flow (optional): same email config required
