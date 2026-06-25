# Changelog

All notable changes to HeadmasterUI will be documented in this file.

## v0.2.2 — 2026-06-25

### Added
- **Multi-tenant provision modes** — `headmaster_local` (full local Hermes), `headmaster_remote` (cloud container bridge), `headmaster_plus_thin` (student/basic role)
- **HermesHQ provision client** — Full-stack desktop provision: login → `/api/desktop/provision` → IPC bridge → runtime state injection
- **Cloud container auto-switch** — Desktop auto-detects `cloud_container_config` from provision response and switches to remote mode
- **Remote runtime bridge** — HTTP/WS bridge to cloud container endpoints with token auth
- **Capability gating** — `useCapabilities()` hook for role/mode/capability-aware UI (sidebar items, feature gates, admin views)
- **Bootstrap preparing screen** — Post-login "preparing your workspace" state while provision resolves
- **System prompt override** — Server-controlled system prompt injection per organization
- **Phase 2 navigation** — New sidebar nav structure with capability-gated sections
- **i18n coverage** — 9 new locale modules (activity, agents, browser, documents, integrations, kanban, memory, sidebar, workflows) + 39 keys in 9 new modules (plus updates to existing modules)
- **SWR dependency** — For HQ frontend data fetching

### Fixed
- **Frozen lockfile CI failure** — Regenerated `bun.lock` after react-query addition
- **i18n validation** — 319 missing keys resolved, type definitions regenerated
- **TypeScript type errors** — `Phase2Nav` icon types, `useCapabilities` role access, `AuthContext` cloud_container_config property
- **AGENTS.md stale paths** — Removed deprecated `gcaplabs-headmaster/repo/` prefix from all paths

### Changed
- **Version** — 0.2.1 → 0.2.2
- **Branch** — `codex/headmaster-v0.2.0` merged into `main`
- **GitHub workflows** — Removed `aioncore` references, updated `iOfficeAI` → `GCAP-Labs`

### Security
- **Local Hermes loopback bind** — Backend only accessible via 127.0.0.1
- **JWT keychain storage** — Access tokens stored in OS keychain instead of localStorage
- **Runtime validation** — Privileged actions require active provision validation
- **MFA**: Multi-factor authentication is not yet supported in the desktop app. MFA-enabled accounts will see an unsupported account message.

---

## v0.2.1 — 2026-06-23

### Added
- Initial HeadmasterUI release
- Electron desktop app with React renderer
- Settings navigation restructure

---

## v0.1.6 — 2026-06-19

### Added
- Settings nav restructure
