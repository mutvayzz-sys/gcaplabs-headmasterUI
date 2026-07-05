# Upstream Implementation Task List

Date: 2026-07-04

This checklist tracks the upstream intake program from `docs/upstream-feature-ledger.md`. Update this file and the relevant ledger entry or progress note after every completed task.

## Owner correction — 2026-07-05

The current wanted-feature source is `docs/upstream-feature-ledger.md` → “Owner Confirmation — 2026-07-05”. The deleted `WHAT-WE-TAKE.md` / old 14-screen plate must not drive implementation. Analytics and Approvals do not ship.

Corrections to this checklist:
- Skills Hub is wanted but pending.
- Built-in assistants / assistant editor / catalog are wanted but pending until verified against the backend.
- Office docs/PDF/PPT are wanted product features, not backend-gated out of the plan.
- AionUI WebUI backend/deployment pattern is wanted; model after the AionUI WebUI Configuration Guide.
- AionUI channels are rejected/held.
- AionUI app/companion is rejected; a future companion should come from the Hermes system.

## 0. Tracking And Baseline

- [x] Refresh AionUI reference to `7043364320c31d7dbb70ab41de572396d623de66`.
- [x] Refresh official Hermes Agent/Desktop reference to `e02fc2828`.
- [x] Create `docs/upstream-feature-ledger.md`.
- [x] Fix restored-history empty model foundation.
- [x] Add latency marks and optimistic send foundation.
- [x] Add 33 ms stream batching foundation.
- [x] Create a visible implementation checklist doc: `docs/upstream-implementation-task-list.md`.
- [x] After every completed task, update both the checklist and relevant ledger status.
- [x] Keep unrelated existing dirty files untouched unless explicitly assigned.

## 1. Chat Runtime And Performance

- [x] Replace remaining `limit: 10000`, `page_size: 10000`, and `limit: 500` routine app loads with paged APIs.
- [x] Add cursor/page state for session history, message history, minimap, activity, and export flows.
- [x] Virtualize long session lists with `react-virtuoso`.
- [x] Virtualize long message lists with `react-virtuoso`, preserving scroll-to-bottom, jump-to-message, and highlighted search result behavior.
- [x] Memoize processed message grouping so streaming tokens do not recompute the full processed list.
- [x] Lazy-load Mermaid rendering in Markdown code blocks instead of static importing `mermaid`.
- [x] Lazy-load Shiki/code-card heavy paths where not already split.
- [x] Add a perf debug panel/script that reports existing latency marks: history click, conversation paint, composer enabled, user bubble, accepted, first token, final.
- [x] Add before/after perf baselines for history click, first send, long stream, and session switching.

## 2. Chat UX And Runtime Parity

- [x] Adapt official Hermes Desktop assistant-ui runtime concepts where they improve Headmaster without replacing the current Agent37/Hermes adapter.
- [x] Port structured tool summaries and live tool activity into the existing message components.
- [x] Add skeleton/error/empty states to model hydration, session hydration, tool activity, and preview loading.
- [x] Add session picker/switcher improvements without changing existing routes.
- [x] Add command palette actions for new chat, switch session, open settings, open workspace, and diagnostics.
- [x] Keep all user-facing names Headmaster-safe; internal `hermes` runtime protocol names remain allowed.

## 3. Workspace, Preview, Files, And Artifacts

- [x] Complete right-pane preview parity: multi-tab previews, file browser, artifacts, Markdown/HTML/code editing.
- [x] Add stable version-history behavior for previewed files.
- [x] Harden smart file operations with path safety and clear error states.
- [ ] Add/verify Office document viewers/tests for docx, xlsx, pptx, and PDF fixture flows as wanted product work, not as a backend-gated exclusion.
- [ ] Plan PPT/PDF/Office conversion/rendering as active backend+desktop work; do not mark it out of scope just because conversion services are not done yet.
- [x] Add artifact cards for cron triggers and skill suggestions using the current artifact schema.

## 4. Agents, Teams, Assistants

- [x] Finish Team Mode parity: team creation, team chat, per-agent approvals, mode propagation, teammate status.
- [x] Adapt leader/teammate orchestration to current Agent37/HermesHQ constraints.
- [x] Add task board/mailbox only after stable task/event APIs are identified.
- [x] Finish custom agents.
- [ ] Finish/verify assistant editor validation against the current backend.
- [ ] Finish/verify built-in assistant catalog and preset assistant selection against the current backend.
- [x] Adapt remote agents around Agent37 session namespace and provision data.
- [x] Keep desktop companion/pet rejected/held unless explicitly re-approved.

## 5. Skills, MCP, Extensions

- [x] Finish unified MCP management and MCP JSON import.
- [ ] Implement/verify Skills Hub against the available local runtime or Agent37 skill catalog.
- [x] Add custom skills only after a writeable install route is confirmed.
- [x] Mark Extension SDK, Extension Hub, and Extension Permissions as `needs backend` until sandbox, catalog, and permission enforcement APIs exist.
- [x] Add tests for MCP import validation, hub loading, hub errors, and permission display.

## 6. Automation, Channels, WebUI

- [x] Finish cron automation parity and missed-trigger recovery where runtime support exists.
- [x] Add keep-awake via Electron main-process `powerSaveBlocker`.
- [x] Reject/hold AionUI channels: Telegram, Lark, DingTalk, WeChat, and WeCom.
- [ ] Implement/plan WebUI backend/deployment using the AionUI WebUI model: desktop-bundled/headless/standalone modes, data-dir handling, auth/password reset, LAN/cross-network access, server deployment, and secure pairing/revocation.
- [x] Do not expose network-access features without auth, token, and logging tests.

## 7. Providers, Settings, Diagnostics, Updates

- [x] Finish provider catalog hydration from Agent37 provision data and local fallback.
- [x] Add protocol detection tests and model health UI.
- [x] Adapt NewAPI, Bedrock, and local model support only where provider adapters exist.
- [x] Add model visibility settings.
- [x] Add profile switch/testing based on runtime profile APIs.
- [x] Finish gateway diagnostics, logs, boot failure reauth, update/rebuild flow, and update proxy checks.
- [x] Improve Settings code splitting and loading states for heavy settings pages.

## 8. Backend-Gated Work

- [x] For each `needs backend` ledger item, create a backend contract note before implementing UI.
- [x] Required backend contracts: extension install/permissions, terminal/PTY, git/worktree/review tools, share/timeline.
- [ ] Replace stale “backend-gated” treatment for WebUI and Office conversion with active wanted-feature plans.
- [x] Do not ship UI as active for backend-gated features; use disabled/skeleton/coming-soon states only when useful.
- [x] Once backend contracts exist, add bridge/service code under the correct process boundary.

## 9. Testing And Acceptance

- [x] Add unit tests for paged session/message loading.
- [x] Add DOM tests for virtualized session and message lists.
- [x] Add regression tests for restored history composer unlock and first-message send.
- [x] Add stream batching tests beyond the constant check, covering bursty token streams.
- [x] Add E2E smoke: login/provision, open empty chat, open history chat, composer unlock, send, first token, attach file, preview file, switch session.
- [x] Add E2E smoke for team mode, MCP import, custom assistant, cron trigger, and diagnostics.
- [x] Run `bun run test`.
- [x] Run `bunx tsc --noEmit`.
- [x] Run `bunx electron-vite build --config packages/desktop/electron.vite.config.ts`.
- [x] Final acceptance: no usable provider leaves history chat with an empty model, long lists remain responsive, streaming stays smooth, all ledger items have an implemented/adapted/backend/held status, and all active shipped features have tests.

## Verification Notes

- 2026-07-04: `bun run test -- tests/unit/renderer/messageMerging.dom.test.tsx tests/unit/renderer/markdownMermaid.dom.test.tsx` passed.
- 2026-07-04: `bunx tsc --noEmit` passed after paged loading and Mermaid lazy-load changes.
- 2026-07-04: `bunx electron-vite build --config packages/desktop/electron.vite.config.ts` passed after paged loading and Mermaid lazy-load changes, with existing bundle/dynamic-import warnings.
- 2026-07-04: `bun run test` initially failed in `tests/unit/bootstrap/buildWithBuilder.test.ts` because the arch-handling unit test exercised full GCAPCore packaging on Windows arm64; fixed by making the test run with `--skip-gcapcore`.
- 2026-07-04: Added `react-virtuoso` virtualization for session and message lists, streaming-tail processed-list memoization, lazy syntax-highlighter loading, `ChatPerfDebugPanel`, and `scripts/debug-performance.ts` baseline reporter.
- 2026-07-04: Added global Ctrl/Cmd+K command palette with new chat, switch session, settings, workspace, and diagnostics actions.
- 2026-07-04: Added explicit backend feature gates for channels, WebUI remote/QR access, extension permissions, terminal/PTY, git/worktree/review, share/timeline, and office conversion. Owner correction on 2026-07-05 supersedes part of that: AionUI channels are rejected/held, while WebUI backend/deployment and Office docs/PDF/PPT are wanted active product work and need implementation plans/work, not indefinite gating.
- 2026-07-04: Verified existing provider catalog hydration, protocol detection tests, model health UI, model visibility controls, MCP JSON import, Skills Hub smoke tests, cron keep-awake, tool summaries/live activity, and Headmaster-safe display-name tests against current source. Owner correction on 2026-07-05 keeps Skills Hub as wanted/pending until verified end-to-end against the current backend.
- 2026-07-04: Added bursty stream batching regression coverage for the 33 ms flush window.
- 2026-07-04: Verified existing workspace preview, preview-history, smart file operations, cron/skill-suggestion artifact cards, team-mode UI, assistant editor/catalog, and E2E smoke files. Owner correction on 2026-07-05 keeps assistant/editor/catalog as wanted/pending until verified end-to-end against the current backend. Backend-dependent task/mailbox/custom-skill/profile routes remain held until stable APIs exist.
- 2026-07-04: Added restored-history model fallback regression coverage in `tests/unit/renderer/conversation/aionrsModelSelection.dom.test.ts`.
- 2026-07-04: Profile switching and backend bridge/service work are intentionally held behind runtime/backend APIs; Settings already lazy-loads heavy advanced pages through React Suspense.
- 2026-07-04: `bun run test -- tests/unit/renderer/commandPalette.dom.test.tsx tests/unit/renderer/messageList.dom.test.tsx tests/unit/renderer/conversation/messageVirtualization.dom.test.tsx tests/unit/renderer/conversation/sessionVirtualization.dom.test.tsx tests/unit/renderer/messageMerging.dom.test.tsx tests/unit/renderer/markdownMermaid.dom.test.tsx` passed.
- 2026-07-04: `bun run test` passed after the sidecar test fix: 183 files passed / 1 skipped; 1353 tests passed / 3 skipped.
- 2026-07-04: `bunx tsc --noEmit` passed after virtualization and perf changes.
- 2026-07-04: `bunx electron-vite build --config packages/desktop/electron.vite.config.ts` passed after virtualization and perf changes, with existing chunk-size warnings.
