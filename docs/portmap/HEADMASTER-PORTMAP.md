# Headmaster Port Map

> Authoritative index of every surface that was renamed from AionUi/AionCore to Headmaster, with the old→new mapping, current state, and what is intentionally left untouched.
>
> Maintained by Vic (Hermes). Updated each rename pass. Last pass: 2026-06-13.

---

## 1. Tier 1 — Buyer-visible (DONE)

| # | Surface | Old | New | File(s) |
|---|---|---|---|---|
| 1 | OS deep-link protocol scheme | `aionui://` | `headmaster://` | `process/utils/deepLink.ts`, `index.ts`, `common/config/storage.ts` |
| 2 | HTTP Referer header (LLM gateway) | `https://aionui.com` | `https://gcaplabs.com` | `common/api/ClientFactory.ts:79,130` |
| 3 | Auto-update CDN host | `static.aionui.com` | `static.gcaplabs.com` | `process/bridge/updateBridge.ts:60` |
| 4 | CSS overlay variables (7 tokens, 19 refs) | `--aion-overlay-*` | `--headmaster-overlay-*` | `renderer/styles/arco-override.css` |
| 5 | CSS class `.aion-model-menu--sticky-group` (3) | aion | headmaster | `arco-override.css` + 2 selector files |
| 6 | CSS class `aionui-modal*` (7) | aionui-modal | headmaster-modal | `components/base/AionModal.tsx`, `ModalWrapper.tsx` |
| 7 | CSS class `aionui-steps*` (3) | aionui-steps | headmaster-steps | `components/base/AionSteps.tsx`, `StepsWrapper.tsx` |
| 8 | CSS class `aion-select*` (4) | aion-select | headmaster-select | `components/base/AionSelect.tsx` |
| 9 | CSS class `aion-url-viewer-toolbar` (12) | aion | headmaster | `components/media/WebviewHost.tsx` |
| 10 | CSS class `aion-dir-input` (1) | aion | headmaster | `settings/.../DirInputItem.tsx` |
| 11 | CSS class `aionui-markdown` (1) | aionui | headmaster | `pages/conversation/Preview/.../MarkdownViewer.tsx` |
| 12 | CSS class `aion-file-changes-panel` (7) | aion | headmaster | `AppearanceSettings/presets/discourse-horizon.css`, `retroma-y2k.css` |
| 13 | On-disk Chromium CDP registry | `~/.aionui-cdp-registry.json` | `~/.headmaster-cdp-registry.json` | `process/utils/configureChromium.ts:80` |
| 14 | Sentry tags (25) | `aionui.backend_startup.*`, `aionui.failure` | `headmaster.*` | `src/sentry.ts:86,189-278` |
| 15 | Sentry context keys (5) | `aioncore_*` | `backend_*` | `src/sentry.ts:285-291` |
| 16 | Sentry domain tag | `aionui.com` | `gcaplabs.com` | `src/sentry.ts:86` |
| 17 | Env var (startup flag) | `AIONUI_MULTI_INSTANCE` | `HEADMASTER_MULTI_INSTANCE` | `electron.vite.config.ts:290`, `src/index.ts`, `scripts/build-with-builder.js` |
| 18 | Hub modal repo constant | `AION_HUB_REPO_URL` | `HEADMASTER_HUB_REPO_URL` | `settings/AgentSettings/AgentHubModal.tsx` |
| 19 | Node platform name fallback | `'aionui'` | `'headmaster'` | `common/platform/NodePlatformServices.ts:32,45` |
| 20 | Node platform data dir | `~/.aionui-server/` | `~/.headmaster-server/` | `common/platform/NodePlatformServices.ts:38,41` |
| 21 | localStorage key | `aionui_cron_unread` | `headmaster_cron_unread` | `renderer/pages/cron/useCronJobs.ts` |
| 22 | localStorage key | `aionui_workspace_expansion` | `headmaster_workspace_expansion` | `pages/conversation/GroupedHistory/hooks/useWorkspaceExpansionState.ts` |
| 23 | localStorage key prefix | `aionui_preview_*` | `headmaster_preview_*` | `pages/conversation/Preview/context/PreviewContext.tsx` |
| 24 | Image asset filenames (4) | `aionui-banner-1.png`, `aionui_logo_*.svg/png`, `aionui_readme_header_0807.png` | `headmaster-*` | `resources/` |
| 25 | Copyright header lines (~40 files) | `Copyright 2025 Headmaster (aionui.com)` | `Copyright 2025 Headmaster (gcaplabs.com)` | every `.ts/.tsx/.css/.js` in `packages/` |
| 26 | Icon library swap (visible chrome) | `@icon-park/react` | `@phosphor-icons/react` | 6 surfaces: SiderToolbar, SiderScheduledEntry, SiderFooter, ConversationSearchPopover, GuidActionRow, QuickActionButtons |
| 27 | `package.json` productName | `AionUi` | `Headmaster` | root `package.json:273` |
| 28 | `package.json` name + author | `AionUi`, `service@aionui.com` | `headmaster`, `GCAP Labs <hello@gcaplabs.com>` | root `package.json:2-10` |
| 29 | `package.json` author in sub-packages | `@aionui/desktop`, `@aionui/web-host` | `@aionui/desktop`, `@aionui/web-host` (deferred — see §3) | workspace packages |
**Status after pass 2026-06-13:**
- Tier 1 buyer-visible: **0 hits** for `AionUi / AionUI / AionCore / iOfficeAI` in built `out/main` + `out/renderer` (except backend binary manifest, see §3)
- `bun run i18n:types` ✅ | `node scripts/check-i18n.js` ✅ | `bun run package` ✅

---

## 2. Tier 2 — Internal CSS dev tokens (PENDING)

Visible only to devs/themes/customizers, but cheap to do.

| # | Surface | Old | New | File(s) |
|---|---|---|---|---|
| 30 | UnoCSS preset color tokens | `--aou-1` … `--aou-10`, `aouColors` | `--headmaster-1` … `--headmaster-10`, `headmasterColors` | `uno.config.ts:65-66` and ~31 references in `.css`/`.tsx` |
| 31 | UnoCSS class prefix `aou-` (31 files) | `aou-` | `headmaster-` | many renderer `.css` and `.tsx` files |

**Why deferred:** out of scope for "buyer-visible" demo. If user pushes for full source-clean: 1 hour mechanical pass.

---

## 3. Tier 3 — Backend runtime (DO NOT TOUCH per scope rules)

Per locked Scope Rules in `claude-notes.md`: frontstuff only, do not fork the Python runtime. These are intentionally Aion. (Backend binary directory + a single code comment are the only 39 hits remaining in built output after Pass 5.)

| Surface | Where | Why not renamed |
|---|---|---|
| `bundled-aioncore/` directory on disk | `resources/bundled-aioncore/` | Backend binary directory — rename requires Hermes Python wiring (separate phase, see binaryResolver.ts) |
| `BUNDLED_AIONCORE_DIR = "bundled-aioncore"` | `src/index.ts:630` | Source for §3 above — comment in `ensureAdminUser` chunk also references aioncore's SQLite users table |
| `BUILTIN_IMAGE_GEN_NAME = "aionui-image-generation"` | `src/index.ts:4143` | Backend MCP image-gen tool ID — wired to runtime |
| `aionui_image_generation` tool | `out/win-unpacked/.../builtin-mcp-image-gen.js` | Runtime tool name — runtime only |
| `_aionui_<timestamp>` file marker regex | `out/.../index-*.js` | Backend file marker |
| `AIONUI_MULTI_INSTANCE` in `builtin-mcp-image-gen.js` | runtime bundled JS | Backend runtime — frontstuff rename done, runtime keeps old name (env var still parsed) |
| `X-Title: AionUi` in MCP image-gen HTTP headers | `out/win-unpacked/.../builtin-mcp-image-gen.js` | Backend HTTP client — runtime, not frontstuff |

---

## 4. Tier 4 — Documented exceptions (now resolved for hub URL, runtime URL still pending)

| # | Surface | Old | New | Status | File(s) |
|---|---|---|---|---|---|
| 32 | Hub registry URL | `https://github.com/iOfficeAI/AionHub/` | `https://github.com/mutvayzz-sys/gcaplabs-headmaster` (user provided) | **DONE 2026-06-13** | `resources/hub/index.json`, `resources/hub/manifest.json` |
| 33 | Hub package URLs (`aionext-*` extensions) | `aionext-{auggie,codebuddy,opencode,qwen}.zip` | `headmaster-ext-{auggie,codebuddy,opencode,qwen}.zip` | **DONE 2026-06-13** | `resources/hub/manifest.json` |
| 34 | Auto-update repo (default) | `iOfficeAI/Headmaster` | `mutvayzz-sys/gcaplabs-headmaster` | **DONE 2026-06-13** | `scripts/build-with-builder.js`, `updateBridge.ts:57`, `updateTypes.ts:38`, `electron-builder.yml:224`, `prepare-aioncore.js:21` |
| 35 | Backend binary download URL | `https://github.com/iOfficeAI/AionCore/...` | `https://github.com/mutvayzz-sys/gcaplabs-headmaster-runtime/...` | **DONE 2026-06-13** (URL only — directory stays `bundled-aioncore/` until binaryResolver.ts swap) | `resources/bundled-aioncore/.../manifest.json` |
| 36 | Hub modal "open repo" URL | `https://gcaplabs.com` | `https://github.com/mutvayzz-sys/gcaplabs-headmaster` | **DONE 2026-06-13** | `settings/AgentSettings/AgentHubModal.tsx:16,22,101` |
| 37 | Sentry `server_name` | `aionui.com` | `gcaplabs.com` | **DONE 2026-06-13** | `src/sentry.ts:86` |

---

## 5. Out of scope (separate workstreams)

These are NOT frontstuff and NOT in the buyer-visible rename pass. Each is its own phase:

- `binaryResolver.ts` — replace `aioncore` binary with Hermes Python gateway spawn
- `@aionui/desktop` / `@aionui/web-host` → `@headmaster/desktop` / `@headmaster/web-host` package namespace
- 78 media assets replacement (9 app icons + 21 Sorting Hat SVGs are P0)
- 4 custom screens (Dashboard, Approvals, Agents, Analytics)
- 10 screen ports from hermes-workspace + hermes-agent
- `hermes-agent` Python runtime white-label
- `hermes-desktop` and `hermes-workspace` cleanup

---

## 6. Verification commands

After any pass, run:

```bash
# Built artifact scan (what a buyer sees in `out/`)
python - <<'PY'
import os
from pathlib import Path
skip={'node_modules','.git','win-unpacked','mac-unpacked','linux-unpacked'}
def walk(p):
    try:
        for x in os.listdir(p):
            full=os.path.join(p,x)
            if os.path.isdir(full):
                if x not in skip: yield from walk(full)
            else: yield full
    except OSError: pass
terms=['AionUi','AionUI','aionui-','aionui_','.aionui','AionHub','aionhub','AionCore','aioncore','iOfficeAI']
for t in terms:
    cnt=0
    for p in walk('out'):
        if not p.endswith(('.js','.css','.html','.json')): continue
        try: cnt+=open(p,encoding='utf-8',errors='ignore').read().count(t)
        except: pass
    if cnt: print(f'{t!r:20} -> {cnt} hits in out/')
PY

# Source scan (what shows up in the repo)
search_files for: aionui|AionUi|AionUI|AionCore|aioncore|iOfficeAI
```

Both should show zero hits in buyer-visible surfaces (Tier 3 hits are expected and listed in §3).

---

## 7. Pass history

| Date | Pass | Tiers touched | Verified by |
|---|---|---|---|
| 2026-06-13 | Pass 1 — English i18n + visible hub metadata | English i18n, hub modal | Subagents + Claude |
| 2026-06-13 | Pass 2 — "Aion CLI" display name sweep | 13 agents × 172 tool uses, then 10 agents × 185 tool uses visual sweep | Haiku + Claude |
| 2026-06-13 | Pass 3 — Phosphor icon swap | Tier 1:26 | Vic |
| 2026-06-13 | Pass 4 — Tier 1 buyer-visible frontstuff | §1 (1-29) | Vic |
| 2026-06-13 | Pass 5 — Hub/repo URL sweep using `mutvayzz-sys/gcaplabs-headmaster` | §4 (32-37) | Vic |

---

## 8. One open decision

**None.** All hub/repo URLs now point at `mutvayzz-sys/gcaplabs-headmaster`. The `gcaplabs-headmaster-runtime` repo doesn't exist yet (it's the planned Python runtime, separate workstream) — when it does, the URL swap is one find-and-replace against `bundled-aioncore/.../manifest.json`.
