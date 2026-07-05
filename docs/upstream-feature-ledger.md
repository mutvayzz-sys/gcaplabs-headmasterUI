# Upstream Feature Ledger

Date: 2026-07-04

This ledger tracks upstream feature intake for Headmaster Desktop. Active code changes still happen only in `gcaplabs-headmasterUI`; upstream folders are read-only references except for refreshes.

## Reference Snapshots

| Source | Local path | Snapshot used | Notes |
| --- | --- | --- | --- |
| AionUI | `../_support/upstream/aionui` | `7043364320c31d7dbb70ab41de572396d623de66` | Refreshed with `git pull --ff-only` on 2026-07-04. Preferred source for broad product modules. |
| Hermes Agent/Desktop | `../runtime/hermes-agent` and `../_support/upstream/hermes-agent-desktop` | `e02fc2828` | Refreshed with `git pull --ff-only` on 2026-07-04. This is newer than the prior target `09693cd3`; preferred source for Hermes-native runtime/chat UX. |

## Status Legend

| Status | Meaning |
| --- | --- |
| `port now` | Fits current Agent37/HermesHQ constraints and should be implemented in the current beta-readiness stream. |
| `adapt` | Valuable, but must be reshaped for Headmaster architecture, vocabulary, or runtime contracts. |
| `pending` | Owner-confirmed wanted feature, but not done yet; plan and implement it rather than treating it as stale or rejected. |
| `needs backend` | Requires HermesHQ, Agent37, or runtime API work before desktop can expose it safely. |
| `reject/hold` | Do not ship by default. Keep visible for explicit future approval or because it conflicts with current product direction. |

## Owner Confirmation — 2026-07-05

Use this section as the current source of truth for wanted vs. rejected upstream intake. It supersedes the deleted `docs/white-label/WHAT-WE-TAKE.md` and the stale 14-screen plate. **Analytics and Approvals do not ship.**

Wanted from AionUI / current app work:
- Team Mode.
- CLI agent detection.
- ACP sessions.
- Custom Agents.
- MCP management and JSON import.
- Skills Hub — wanted, pending.
- Assistants/editor/catalog — wanted, pending.
- File Workspace, previews, and editors.
- Office docs/PDF/PPT — wanted, not backend-gated out of the product plan.
- Cron/Automation.
- AionUI WebUI backend/deployment pattern — wanted; model after <https://github.com/iOfficeAI/AionUi/wiki/WebUI-Configuration-Guide>.
- Provider/Model Settings, as long as they line up with and work against Headmaster's backend.

Not wanted from AionUI:
- AionUI channels: Telegram, Lark, DingTalk, WeChat, WeCom.
- AionUI app/companion/pet; if a companion ships later, take it from the Hermes system instead.

Wanted from official Nous Hermes Desktop:
- assistant-ui concepts.
- stream batching.
- tool activity/summaries.
- virtualization.
- command palette.
- previews/files/artifacts.
- gateway diagnostics/logs.
- onboarding/update/boot overlays.
- voice input/output fail-closed.
- terminal/git/share/timeline remain backend-gated.

## Implementation Progress

| Date | Area | Status | Notes |
| --- | --- | --- | --- |
| 2026-07-04 | Tracking | implemented | Added `docs/upstream-implementation-task-list.md` as the visible source of checklist progress. |
| 2026-07-04 | Chat paged loading | implemented | Session history, grouped history, restored message hydration, minimap, activity, and export flows now load through bounded cursor/page helpers instead of routine `10000`/`500` caps. Added unit coverage for paged message hydration and paged session loading. |
| 2026-07-04 | Mermaid code splitting | implemented | Markdown Mermaid code blocks now dynamically import `mermaid` on render instead of statically pulling it into the Markdown path. Added DOM coverage for on-demand initialization/rendering. |
| 2026-07-04 | Chat virtualization/perf | implemented | Added `react-virtuoso` virtualization for session and message lists, streaming-tail processed-list memoization, lazy syntax-highlighter imports for markdown code paths, DOM virtualization coverage, `ChatPerfDebugPanel`, and `scripts/debug-performance.ts`. |
| 2026-07-04 | Backend-gated contracts | superseded | Added `docs/backend-contracts.md` covering channels, WebUI remote access, extension install/permissions, terminal/PTY, git/worktree/review, share/timeline, and office conversion. Owner correction on 2026-07-05: channels are rejected from AionUI intake, while WebUI backend/deployment and Office docs/PDF/PPT are wanted active product work. |
| 2026-07-04 | Backend feature gates | superseded | Renderer feature gates were added for pending backend contracts. Owner correction on 2026-07-05: do not treat WebUI/Office as permanently backend-gated out of scope; convert those gates into implementation plans/work where needed. |
| 2026-07-04 | Stream batching tests | implemented | Added bursty token regression coverage for the 33 ms stream flush window. |
| 2026-07-04 | Verification | partial | Focused pagination test, TypeScript, and Electron/Vite build pass. Full `bun run test` is blocked by existing `buildWithBuilder.test.ts` arm64 sidecar spawn failure. |

## AionUI Intake

| Feature | Source files / areas | Dependencies | Headmaster status | Backend requirement | White-label risk | Test coverage |
| --- | --- | --- | --- | --- | --- | --- |
| Team Mode | `packages/desktop/src/renderer/pages/team`, team hooks | Existing Headmaster team page | `port now` | Existing conversation/team APIs | Medium: replace upstream labels | Existing team e2e plus add restored model/send smoke |
| Leader/teammate orchestration | `pages/team`, team runtime hooks | Team sessions, permission propagation | `adapt` | May need Agent37 team session metadata | Medium | Add unit coverage for delegation state |
| Task board/mailbox | Team/cron/task surfaces | Cron and conversation list | `adapt` | Needs stable task/event API | Low | Add page-level smoke |
| Per-agent permission prompts | Team permission context, mode selector | Permission stream | `port now` | Existing stream permissions | Low | Extend permission-mode e2e; do not create an Approvals product surface |
| CLI agent auto-detection | `process/agent/agentScanner.ts`, settings agents | Local process scanning | `port now` | None for local; remote needs provision catalog | Low | Unit scan parser tests |
| ACP sessions | Conversation ACP platform | ACP runtime | `port now` | Existing ACP bridge | Low | Existing ACP conversation e2e |
| Custom agents | Assistant settings/editor | Assistant config storage | `port now` | Existing assistant endpoints | Medium | Editor validation tests |
| Remote agents | Agent settings, remote config | Remote runtime settings | `adapt` | Agent37 remote session namespace | Medium | Remote smoke tests |
| Unified MCP management | Settings tools/MCP pages | MCP catalog/config | `port now` | Existing MCP config endpoints | Low | MCP config unit/e2e |
| MCP JSON import | MCP settings import flow | JSON schema validation | `port now` | Existing MCP config write | Low | Import parser tests |
| Skills hub | Skills settings/hub | Skill catalog | `pending` | Needs Agent37 skill catalog or local runtime catalog | Medium | Owner-confirmed wanted; pending implementation/verification |
| Custom skills | Assistant/skills editor | File/system skill storage | `adapt` | Needs writeable skill install route | Medium | Skill install tests |
| Built-in assistants | Assistant settings home | Preset assistant catalog | `pending` | Existing preset assistant data or backend catalog | Medium | Owner-confirmed wanted; keep pending until verified working end-to-end |
| Assistant editor | Assistant settings editor | Assistant persistence | `pending` | Existing assistant endpoints or backend catalog | Medium | Owner-confirmed wanted; keep pending until verified working end-to-end |
| Office assistants | Office/workflow pages | File preview/editors | `adapt` | May require office conversion services | Medium | Office fixture tests |
| PPT/Morph PPT/Morph 3D | Office/PPT modules | Office renderer/conversion | `pending` | Office conversion/render workers are part of wanted backend plan | Medium | Owner-confirmed wanted; do not treat as rejected/backend-gated out of scope |
| Word/docx | Preview office viewers | Document conversion | `pending` | Local or backend converter is part of wanted backend plan | Low | Owner-confirmed wanted; build/verify preview/edit flow |
| Excel/xlsx | Preview Excel viewer | Spreadsheet parsing | `pending` | Converter/parser is part of wanted backend plan | Low | Owner-confirmed wanted; build/verify preview/edit flow |
| PDF tools | Preview PDF viewer/tools | PDF renderer | `pending` | PDF renderer/conversion/extraction is part of wanted backend plan | Low | Owner-confirmed wanted; build/verify preview/edit flow |
| Mermaid | Markdown/preview modules | Mermaid bundle | `adapt` | None | Low | Markdown Mermaid DOM render test added; code-split implemented for Markdown code blocks |
| UI/UX assistant | Assistant presets | Assistant definitions | `adapt` | Preset catalog | Medium | Assistant preset tests |
| Planning with files | Guid/conversation send with files | Attachment pipeline | `port now` | Existing file attach APIs | Low | File attach e2e |
| File workspace | Conversation workspace | Workspace bridge | `port now` | Existing workspace API | Low | Workspace e2e |
| Smart file operations | Workspace file ops | Workspace bridge | `adapt` | Existing plus safety policy | Low | File operation unit tests |
| Multi-tab previews | Preview panel/tabs | Preview store | `port now` | Existing preview APIs | Low | Preview e2e |
| Version history | Preview history dropdown | File history source | `adapt` | Needs stable version source | Low | History fixture test |
| Live code/Markdown/HTML edit | Preview editors | Monaco/preview sync | `port now` | Existing save path | Low | Editor smoke |
| Image generation/editing/recognition | Tools/MCP/image flows | Image model config | `adapt` | Needs provider/tool support | Medium | Provider capability tests |
| Cron automation | Cron pages/service | Scheduler/runtime | `port now` | Existing cron APIs | Low | Cron unit/e2e |
| Keep-awake | Startup/system settings | OS power APIs | `adapt` | Main-process powerSaveBlocker | Low | Main process unit |
| Missed-trigger recovery | Cron recovery logic | Scheduler state | `adapt` | Runtime scheduler support | Low | Recovery tests |
| WebUI backend/deployment | Web server/embed pages, standalone/headless host | Runtime web server + auth + data-dir model | `pending` | Wanted backend deployment pattern modeled after AionUI WebUI guide | High: avoid Hermes/Aion text | Owner-confirmed wanted; include desktop-bundled and standalone/headless deployment concepts |
| QR/password remote access | WebUI/remote access | Auth and network exposure | `pending` | Secure pairing/auth is part of wanted WebUI deployment plan | High | Owner-confirmed wanted only as part of secure WebUI backend design |
| Telegram | Channel settings | Channel bridge/runtime | `reject/hold` | Not wanted from AionUI | Medium | Do not take AionUI channels |
| Lark | Channel settings | Channel bridge/runtime | `reject/hold` | Not wanted from AionUI | Medium | Do not take AionUI channels |
| DingTalk | Channel settings | Channel bridge/runtime | `reject/hold` | Not wanted from AionUI | Medium | Do not take AionUI channels |
| WeChat | Channel settings | Channel bridge/runtime | `reject/hold` | Not wanted from AionUI | Medium | Do not take AionUI channels |
| WeCom | Channel settings | Channel bridge/runtime | `reject/hold` | Not wanted from AionUI | Medium | Do not take AionUI channels |
| Provider catalog | Settings model provider pages | Provision/provider cache | `port now` | Agent37 provision snapshot | Medium | Model fallback tests |
| Protocol detection | Settings add provider | Detection helper | `port now` | Provider test endpoint | Low | Protocol tests |
| Model health | Settings/model status | Health check route | `adapt` | Runtime/provider health endpoint | Low | Health parser tests |
| NewAPI/Bedrock/local model support | Provider platform definitions | Provider adapters | `adapt` | Backend/provider adapter support | Medium | Provider conversion tests |
| Extension SDK | Extension process area | Sandbox/manifest | `needs backend` | Extension permission/runtime APIs | High | Contract added; backend gate defaults inactive |
| Extension hub | Extension settings/hub | Marketplace/catalog | `needs backend` | Catalog/install API | High | Contract added; backend gate defaults inactive |
| Extension permissions | Extension permission UI | Permission model | `needs backend` | Permission enforcement | High | Contract added; backend gate defaults inactive |
| Custom CSS/display settings | Appearance settings | Theme storage | `adapt` | None | Low | CSS validation tests |
| Benchmarks | Perf scripts | Test harness | `adapt` | Optional | Low | Benchmark scripts |
| Perf debug scripts | Scripts/perf | Dev tooling | `port now` | None | Low | `ChatPerfDebugPanel` plus `scripts/debug-performance.ts` baseline reporter added |
| E2E coverage | `tests/e2e` | Playwright | `port now` | Test fixtures | Low | Expand smoke suite |
| Desktop companion/pet | Pet/desktop companion surfaces | 3D/assets | `reject/hold` | If companion ships later, source from Hermes system instead | High: removed product surface | Do not take AionUI companion/app |

## Official Hermes Desktop Intake

| Feature | Source files / areas | Dependencies | Headmaster status | Backend requirement | White-label risk | Test coverage |
| --- | --- | --- | --- | --- | --- | --- |
| assistant-ui chat runtime | `apps/desktop/src/app/session`, `components/assistant-ui` | assistant-ui runtime/store | `adapt` | Align with Agent37 sessions | Medium | Chat runtime unit/e2e |
| Incremental external store | Session/message stores | React external store | `port now` | None | Low | Store update tests |
| Structured tool summaries | `components/assistant-ui/tool`, tool summary libs | Tool event schema | `port now` | Existing stream schema | Low | Tool summary tests |
| Live tool activity | Tool components/status rows | Tool status stream | `port now` | Existing stream schema | Low | Stream fixture tests |
| 33 ms stream batching | Message stream hooks | Batched renderer updates | `port now` | None | Low | Bursty token batching unit added |
| `streamdown` markdown | Markdown components | `streamdown` dependency | `adapt` | None | Low | Markdown render tests |
| Shiki/code cards | Chat code components | Shiki bundle | `adapt` | None | Low | Syntax highlighter now lazy-loads in Markdown code and Mermaid source paths; code render tests; code-split |
| Terminal output | Chat/log-tail/terminal | xterm/log streams | `needs backend` | Terminal runtime route | Medium | Contract added; backend gate defaults inactive |
| Virtual session list | Sidebar session list | Virtualizer | `adapt` | Paged list API foundation implemented; virtualization implemented | Low | Paged loader unit coverage plus long-list DOM virtualization tests added |
| Session picker/switcher | Session switcher | Session list store | `adapt` | Existing sessions list | Low | Switcher smoke |
| Command palette | Command palette app | Routing/actions | `adapt` | None | Low | Ctrl/Cmd+K palette with primary actions plus DOM action test added |
| Right-pane previews | Right sidebar/preview | Preview store | `port now` | Existing preview APIs | Low | Preview e2e |
| Overlay split layout | Overlay split components | Layout store | `adapt` | None | Low | Layout DOM tests |
| File browser | Right sidebar files | Filesystem bridge | `adapt` | Workspace file APIs | Low | File browser tests |
| Git/worktree/review/diff tools | Review/file tree/diff | Git bridge | `needs backend` | Git/worktree service | Medium | Git fixture tests |
| xterm terminal | Terminal instance | PTY backend | `needs backend` | Secure terminal service | Medium | Contract added; backend gate defaults inactive |
| Onboarding | Onboarding flow | Auth/provision | `adapt` | Agent37 provision/login | High | Login/provision e2e |
| Provider/model picker | Shell model menu | Provider cache | `port now` | Agent37 provision | Medium | Model fallback tests |
| Model visibility | Model visibility dialog | Config storage | `adapt` | Provider model config | Low | Visibility tests |
| Profiles | Profiles settings/store | Runtime profile support | `adapt` | Runtime profile APIs | Medium | Profile switch tests |
| Skills/MCP hub | `app/skills`, `mcp-tab` | Skills/MCP catalog | `adapt` | Runtime catalog | Medium | Hub tests |
| Artifacts | `app/artifacts`, artifact utils | Artifact schema | `port now` | Existing artifacts/events | Low | Artifact fixture tests |
| Voice input/output | Speech/STT/TTS components | Audio APIs, STT/TTS config | `adapt` | Runtime STT/TTS endpoints | Medium | Speech policy tests |
| Boot/install/update overlays | Install/update components | Main boot/update bridges | `adapt` | Existing update bridge | High | Boot/update DOM tests |
| Gateway diagnostics | Gateway menu/status panels | Runtime status APIs | `port now` | Existing dashboard status | Medium | Diagnostics tests |
| Boot failure reauth | Boot failure/auth flow | Auth refresh | `adapt` | Agent37 auth | Medium | Auth failure tests |
| Logs | Log tail/components | Log bridge | `port now` | Existing log bridge | Low | Log bridge tests |
| Updates/rebuild flow | Update store/components | Update bridge | `adapt` | Existing release proxy | Medium | Update tests |
| UI component system | `components/ui` | Design system alignment | `adapt` | None | Low | Visual/DOM smoke |
| Empty/error/skeleton states | UI primitives | Component usage | `port now` | None | Low | State render tests |
| Starmap | `app/starmap` | Visualization/state | `reject/hold` | Optional sharing backend | Medium | Hold unless approved |
| Timeline/share views | Timeline/share utilities | Share backend | `needs backend` | Share endpoint | High | Contract added; backend gate defaults inactive |
| Latency measurement scripts | Perf scripts/hooks | Performance marks | `port now` | None | Low | `getChatLatencyReport`, debug overlay, and CLI baseline reporter added |
| Desktop companion/pet | `components/pet`, pet store | Assets/3D | `reject/hold` | None | High: removed product surface | No new coverage unless re-approved |
