# Backend Contract Notes For Upstream-Gated Features

Date: 2026-07-04

These contracts block active UI only for items still marked `needs backend` in `docs/upstream-feature-ledger.md`. Owner correction 2026-07-05: WebUI backend/deployment and Office docs/PDF/PPT are **wanted active product work**, not rejected or backend-gated out of the plan. Their contracts below describe what to build safely, not reasons to defer them indefinitely.

## Channels: Telegram, Lark, DingTalk, WeChat, WeCom — rejected from AionUI intake

Owner correction 2026-07-05: do **not** take AionUI channels. This section is historical reference only unless channels are re-approved separately.

Required backend surface:
- `GET /v1/channels`: list configured channel connections and health.
- `POST /v1/channels/{kind}/connect`: begin OAuth/QR/token pairing flow.
- `POST /v1/channels/{id}/disconnect`: revoke local and remote channel credentials.
- `GET /v1/channels/{id}/events`: stream connection status and delivery errors.

Security requirements:
- Secrets never enter renderer state or chat transcript.
- Every channel action is scoped to the current Agent37/Headmaster session namespace.
- Audit log records connect, disconnect, send failure, and credential refresh.

Acceptance tests:
- Connect flow cannot persist a token without user confirmation.
- Disabled UI is shown when the route is absent or returns 404.
- Delivery errors are visible and do not crash chat.

## WebUI Backend Deployment, Remote Access, QR Access, Password Access — wanted

Owner correction 2026-07-05: take the AionUI WebUI backend/deployment pattern, similar to <https://github.com/iOfficeAI/AionUi/wiki/WebUI-Configuration-Guide>. Include desktop-bundled WebUI, standalone/headless WebUI, data-dir behavior, auth/password reset, LAN/cross-network access, and server deployment concepts, adapted to Headmaster naming and security.

Required backend surface:
- `POST /v1/webui/sessions`: create a remote WebUI session with expiry.
- `GET /v1/webui/sessions/{id}`: read URL, pairing state, and expiry.
- `DELETE /v1/webui/sessions/{id}`: revoke access.
- `POST /v1/webui/sessions/{id}/rotate`: rotate token/password.

Security requirements:
- Remote access requires short-lived tokens, explicit expiry, and revocation.
- QR payload contains only opaque session IDs, never raw dashboard tokens.
- All remote access attempts are logged.

Acceptance tests:
- No network-access UI becomes active without auth, token, and logging tests.
- Expired/revoked sessions cannot reconnect.
- Password/QR paths do not reveal runtime host secrets in renderer logs.

## Extension Install And Permissions

Required backend surface:
- `GET /v1/extensions/catalog`: signed extension catalog.
- `POST /v1/extensions/install`: install by signed package/version.
- `DELETE /v1/extensions/{id}`: uninstall.
- `GET /v1/extensions/{id}/permissions`: declared + granted permissions.
- `POST /v1/extensions/{id}/permissions`: grant/revoke permission set.

Security requirements:
- Extensions require signed manifests and version pinning.
- Permission grants are explicit and revocable.
- Extension MCP/settings tabs cannot bypass permission checks.

Acceptance tests:
- Unsigned or permission-escalating updates fail closed.
- Permission display matches manifest exactly.
- Extension tabs stay hidden/disabled when permission data is unavailable.

## Terminal / PTY

Required backend surface:
- `POST /v1/terminal/sessions`: create scoped PTY session.
- `GET /v1/terminal/sessions/{id}/events`: stream stdout/stderr/exit.
- `POST /v1/terminal/sessions/{id}/input`: write input.
- `DELETE /v1/terminal/sessions/{id}`: terminate.

Security requirements:
- Explicit workspace/root scope; no implicit host filesystem access.
- Approval gate for commands with destructive or credential-risk patterns.
- Output redaction for secrets before renderer display.

Acceptance tests:
- PTY cannot start outside allowed workspace.
- Kill/reconnect handles orphaned processes.
- Secret-like output is redacted in logs and UI.

## Git / Worktree / Review Tools

Required backend surface:
- `GET /v1/git/status`: repo status for scoped workspace.
- `POST /v1/git/worktrees`: create worktree from branch/base.
- `POST /v1/git/review`: run review/check pipeline.
- `GET /v1/git/diff`: read diff with path filters.

Security requirements:
- No commit, push, or history rewrite without explicit user action.
- Path filters must prevent reading files outside workspace.
- Review output must preserve provenance and command logs.

Acceptance tests:
- Dirty-tree detection protects unrelated user changes.
- Worktree paths are normalized and scoped.
- Review flow handles large diffs without freezing renderer.

## Share / Timeline

Required backend surface:
- `POST /v1/share`: create share artifact from conversation/timeline selection.
- `GET /v1/share/{id}`: read share state and URL.
- `DELETE /v1/share/{id}`: revoke share.
- `GET /v1/timeline/{conversation_id}`: normalized timeline events.

Security requirements:
- Shares default private and expiring.
- Redaction pass for secrets, local paths, and hidden messages.
- Revocation must invalidate public URLs.

Acceptance tests:
- Hidden/internal messages never appear in shared output.
- Revoked share returns unauthorized/not found.
- Timeline can paginate large conversations.

## Office Conversion — wanted

Owner correction 2026-07-05: Office docs/PDF/PPT are wanted product features, not backend-gated out of the plan. This section describes the needed safe conversion/rendering surface.

Required backend surface:
- `POST /v1/office/convert`: convert docx/xlsx/pptx/pdf to previewable artifact.
- `GET /v1/office/jobs/{id}`: conversion status.
- `GET /v1/office/jobs/{id}/artifact`: fetch converted preview artifact.

Security requirements:
- Conversion runs in sandbox with file size/type limits.
- Source files and generated artifacts inherit workspace permissions.
- Failed conversions return clear safe errors, not stack traces.

Acceptance tests:
- Fixture coverage for docx, xlsx, pptx, and PDF.
- Unsupported/malformed files fail safely.
- PPT morph/Morph 3D remain disabled until explicit converter support exists.
