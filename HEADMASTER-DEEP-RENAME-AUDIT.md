# Headmaster Deep Rename Audit

Generated after 5 parallel/batched subagent audits across the desktop app.

## Executive summary

The first pass fixed obvious `AionUi` branding, but the app still has a lot of upstream/product vocabulary debt.

There are four buckets:

1. **Safe visible copy fixes** — i18n and docs strings. Do these now.
2. **Safe-ish internal identifier renames** — component names like `SkillsMarketBanner`, `AgentSettings`, etc. Do with import updates.
3. **Durable/runtime contracts** — protocol schemes, storage keys, DB values, package names, backend binary names. Do not blindly rename; add migration/compat first.
4. **Legal/release/public repo decisions** — LICENSE, GitHub owner/repo, changelog, app store IDs, Homebrew cask. Needs decision.

## High-priority safe visible copy

### Agency / market copy

- `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json:971`
  - `Install from Market` → `Install from The Agency` or `Hire from The Agency`
- `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json:976`
  - `Want a new Agent listed here?` → `Want a new Specialist listed here?`
- `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json:977`
  - `Open a PR on AionHub` → `Submit to Open Casting` / `Open a PR for Open Casting`
- `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json:978`
  - `AionHub market is coming soon.` → `The Agency is coming soon.`
- `packages/desktop/src/renderer/pages/settings/AssistantSettings/SkillConfirmModals.tsx:78`
  - `Add Skills` → `Hire a Specialist` / `Add from The Agency`

### Agent / assistant user-facing copy

Use `Specialist` for user-facing role labels.

Main hot files:

- `packages/desktop/src/renderer/services/i18n/locales/en-US/guid.json`
- `packages/desktop/src/renderer/services/i18n/locales/en-US/agent.json`
- `packages/desktop/src/renderer/services/i18n/locales/en-US/conversation.json`
- `packages/desktop/src/renderer/services/i18n/locales/en-US/cron.json`
- `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json`

Examples:

- `No Main Agent is available` → `No Main Specialist is available`
- `No agents available` → `No Specialists available`
- `The agent could not reply` → `The Specialist could not reply`
- `Please select an agent` → `Please select a Specialist`
- `AI agent` → `Headmaster Specialist`

### Built-in/custom assistant metaphor split

Desired vocabulary:

- Built-in assistants → **Your Team**
- Custom assistants → **Your Hires**
- Extension/community submissions → **Open Casting**
- Marketplace/surface → **The Agency**

Hot strings in `settings.json`:

- `System` → `Your Team`
- `Custom` → `Your Hires`
- `Official` → `Your Team` / `Headmaster Team`
- `Cannot delete builtin specialists` → `You can't delete Specialists from Your Team`
- `Official Managed Content` → `Headmaster Team Content`
- `Custom Presets (Rules)` → `Your Hires (Rules)`

### Team Mode / Council copy

Hot file:

- `packages/desktop/src/renderer/services/i18n/locales/en-US/team.json`

Examples:

- `Delete this team?` → `Delete this Council?`
- `New Agent` → `New Council Member`
- `Select team leader` → `Select Council leader`
- `Select sub agents` → `Select Council members`
- `Sub Agents` → `Council Members`
- `Please enter a team name` → `Please enter a Council name`
- `Failed to create team` → `Failed to create Council`
- `Describe your goal and I'll get the team working on it` → `Describe your goal and I'll convene The Council`

Also:

- `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json:695`
  - `team creation, leader or teammate coordination...` → `Council creation, leader or member coordination...`

### App description / coworking

Multiple locale files still contain:

- `One desktop. Your AI agents, actually coworking.`

Recommended:

- `One desktop. Your Specialists, actually working together.`
- or `One desktop. Your Headmaster Specialists in sync.`

Files:

- `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json:653`
- same key in `ja-JP`, `ko-KR`, `ru-RU`, `tr-TR`, `uk-UA`, `zh-CN`, `zh-TW`

## Safe-ish internal identifier rename candidates

Do with imports updated. These are not runtime contracts by themselves.

### Agency / marketplace components

- `packages/desktop/src/renderer/pages/guid/components/SkillsMarketBanner.tsx`
  - `SkillsMarketBanner` → `OpenCastingBanner` or `AgencyBanner`
  - `SKILLS_MARKET_DETAILS_ZH/EN` → `OPEN_CASTING_DETAILS_ZH/EN`
  - console strings: `Skills Market` → `The Agency` / `Open Casting`

Keep persisted/API contracts for now:

- `skillsMarket.enabled`
- `/api/skills/market/enable`
- `/api/skills/market/disable`

### Agent settings component layer

Potential rename set:

- `AgentSettings/` → `SpecialistSettings/`
- `AgentCard` → `SpecialistCard`
- `InlineAgentEditor` → `InlineSpecialistEditor`
- `AgentHubModal` → `AgencyHubModal` / `OpenCastingModal`
- `RemoteAgentManagement` → `RemoteSpecialistManagement`
- `LocalAgents` → `LocalSpecialists`

Requires updates in:

- `packages/desktop/src/renderer/components/layout/Router.tsx`
- `packages/desktop/src/renderer/components/settings/SettingsModal/contents/AgentModalContent.tsx`

### Team/Council component layer

Potential rename set if we want internals to match the product:

- `TeamPage` → `CouncilPage`
- `TeamTabs` → `CouncilTabs`
- `TeamCreateModal` → `CouncilCreateModal`
- `TeamSiderSection` → `CouncilSiderSection`
- `TeamAgentIdentity` → `CouncilMemberIdentity`
- `TeammateMessageAvatar` → `CouncilMemberMessageAvatar`

But keep backend/API route names unless doing migration.

## Runtime contracts — do not blindly rename

These are ugly but durable. Rename only with migration/compat.

### Package/workspace imports

- `@aionui/desktop`
- `@aionui/web-host`
- `@aionui/*` in `bun.lock`

Keep for now unless doing a full package scope migration.

### Backend/runtime

- `aioncore`
- `bundled-aioncore`
- `aionrs`
- `aioncoreVersion`
- scripts like `prepareAioncore.js`, `resolveAioncoreVersion.js`

User-facing descriptions can say **Adonis Core**, but code-level artifact names should stay unless coordinated.

### Protocol/deep links

- `PROTOCOL_SCHEME = 'aionui'`
- `aionui://...`

Needs decision:

- Option A: keep legacy protocol hidden.
- Option B: register `headmaster://` and keep `aionui://` as legacy fallback.

Do not single-rename without dual support.

### Storage/local data keys

Examples:

- `aionui_workspace_collapse_state`
- `aionui_sider_collapsed`
- `aionui_theme`
- `aionui_language`
- `.aionui-cdp-registry.json`
- `.aionui`, `.aionui-config`
- `aionui-config.txt`
- `aionui-chat-history`
- `aionui.dir`
- `_aionui_` timestamp separator

Needs migration/backward-read if renamed.

### DB/source values

- DB enum/source value `'aionui'`

Do not rename without DB migration.

### Telemetry/Sentry

- `aionui.failure`
- `aionui.backend_startup.*`
- `aionui.installation_integrity`
- `aionui.runtime_resource`
- `aionui-logs.log.gz`

Can be dual-tagged later, but don't break dashboards blindly.

### Built-in MCP/tool names

- `aionui_image_generation`
- `aionui-image-generation`

Rename only with legacy aliases.

## Installer / OS-facing decisions

### Already good

`packages/desktop/electron-builder.yml` is mostly branded:

- `appId: com.gcaplabs.headmaster`
- `productName: Headmaster`
- `executableName: Headmaster`
- `copyright: Copyright © 2026 GCAP Labs`

### Still needs work/decision

- `resources/windows-installer-x64.nsh`
- `resources/windows-installer-arm64.nsh`

Findings:

- `AIONUI_APP_EXECUTABLE_FILENAME "AionUi.exe"`
- `aionui-installer-process-check.log`
- `AionUi-fixed-uninstaller.exe`
- macros and vars prefixed `AIONUI_` / `AionUi...`

Recommended:

- Add `Headmaster.exe` process check.
- Keep `AionUi.exe` legacy process check for upgrade cleanup if needed.
- Rename logs/temp artifacts to Headmaster where safe.

## Non-renderer/public-adjacent leftovers

### Assets

- `resources/headmaster-banner-1.png`
- `resources/aionui_logo_black_bg.svg`
- `resources/aionui_logo_no_border.png`
- `resources/aionui_readme_header_0807.png`
- `resources/offica-ai BANNER-function.png`

Rename assets and update docs references.

### Docs/readmes

Stale anchors:

- `#-cowork-in-action`
- `#-why-choose-headmaster-over-claude-cowork`

Stale promo alt/captions:

- `Hermes + Aion UI is Insane (FREE)!`
- `OpenClaw + Aion UI is Insane (FREE!)`

Localized readmes repeat these.

### Hub metadata

- `resources/hub/index.json`
  - `Aionui Official` → `GCAP Labs` / `Headmaster Official`

### Homebrew

- `homebrew/aionui.rb.example`

Needs Headmaster cask naming if used publicly.

### Mobile

- `mobile/app.config.ts`
  - slug/scheme/bundle/package IDs still AionUi-flavored.

Bundle IDs require release decision.

### Legal/release

- `LICENSE:189` old copyright attribution.
- GitHub links still point to `iOfficeAI/Headmaster` in many docs/workflows/changelog.
- `CHANGELOG.md` has historical upstream links.

These need legal/release/public repo decision before rewriting.

## Recommended execution order

### Phase 1 — safe visible polish now

- en-US i18n visible vocabulary fixes.
- hub metadata author.
- README stale anchors/captions.
- app description/coworking lines.
- console-only strings like `Skills Market`.

### Phase 2 — safe internal UI rename

- `SkillsMarketBanner` → `AgencyBanner` / `OpenCastingBanner`.
- `AgentSettings` UI layer → `SpecialistSettings` if we want React/devtools/internal names clean.
- `Team*` UI layer → `Council*` if we want internals clean.

### Phase 3 — migrations

- localStorage keys.
- custom event names.
- protocol dual registration.
- installer legacy process support.
- Sentry dual tags.

### Phase 4 — legal/release/public repo

- LICENSE attribution.
- GitHub owner/repo links.
- Homebrew cask.
- mobile app IDs.
- public package names.

## One open decision

For Phase 1, should I apply **English-visible copy + safe metadata/docs only** first, or also do the bigger internal React identifier rename (`AgentSettings`/`Team*`/`SkillsMarketBanner`) in the same pass?
