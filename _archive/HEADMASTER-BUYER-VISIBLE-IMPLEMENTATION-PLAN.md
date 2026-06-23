# Headmaster Buyer-Visible Rebrand Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Do **not** chase internal source purity. Only change things a buyer, demo viewer, installer user, support recipient, or public repo visitor can see.

**Goal:** Make the Headmaster desktop app feel like Headmaster in the UI, packaged artifact, public docs, and demo/support surfaces without touching fragile runtime internals.

**Architecture:** This is a frontstuff-only white-label pass. We update visible i18n copy, public metadata, hub/agency metadata, public docs/assets, and artifact verification. We leave package names, DB values, backend binary names, protocol/storage keys, and internal React filenames alone unless they visibly leak.

**Tech Stack:** AionUi-derived Electron/Vite desktop app, Bun workspaces, React renderer, JSON i18n, electron-builder.

---

## Current buyer-visible scan baseline

Latest focused scan across English i18n, public metadata, hub resources, mobile visible config, and public README:

```txt
files with buyer-visible-ish hits: 16
matches: 337

113 packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json
100 readme.md
60  packages/desktop/src/renderer/services/i18n/locales/en-US/conversation.json
14  packages/desktop/src/renderer/services/i18n/locales/en-US/cron.json
11  packages/desktop/src/renderer/services/i18n/locales/en-US/agent.json
10  packages/desktop/src/renderer/services/i18n/locales/en-US/team.json
8   packages/desktop/src/renderer/services/i18n/locales/en-US/guid.json
5   resources/hub/manifest.json
4   mobile/app.config.ts
4   packages/desktop/src/renderer/services/i18n/locales/en-US/acp.json
3   packages/desktop/src/renderer/services/i18n/locales/en-US/index.ts
1   mobile/src/i18n/locales/en-US.json
1   packages/desktop/electron-builder.yml
1   packages/desktop/src/renderer/services/i18n/locales/en-US/common.json
1   packages/desktop/src/renderer/services/i18n/locales/en-US/messages.json
1   resources/hub/index.json
```

This scan intentionally ignores source filenames/components unless they leak into UI/public artifacts.

---

## Do not touch in this pass

These are not buyer-visible enough or require migrations:

- `@aionui/*` package names and imports.
- `aioncore`, `aionrs`, `bundled-aioncore`, `aioncoreVersion` runtime names.
- `aionui://` protocol unless implementing dual protocol support later.
- DB/source enum values like `'aionui'`.
- localStorage/user data keys like `aionui_theme`, `.aionui`, `aionui.dir`.
- Sentry tags like `aionui.backend_startup.*`.
- React component/file names like `AgentSettings.tsx`, `TeamPage.tsx`, `SkillsMarketBanner.tsx` unless visible copy inside them changes.
- Installer source macro names unless the actual built installer/user-facing artifact shows them.

---

## Vocabulary decisions for this pass

Use these exact mappings for visible English copy:

| Current visible term                          | Replacement                                                                         |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Agent / AI agent / agents                     | Specialist / Headmaster Specialist / Specialists                                    |
| Main Agent                                    | Lead Specialist or Main Specialist; use `Lead Specialist` for UI labels             |
| assistant / assistants                        | Specialist / Specialists, unless the sentence refers to a technical CLI assistant   |
| built-in specialist / builtin                 | part of Your Team                                                                   |
| System / Official preset group                | Your Team                                                                           |
| Custom preset group                           | Your Hires                                                                          |
| Skills Market / Marketplace / Market          | The Agency                                                                          |
| Skill / Skills as capability inventory        | Agency item(s), or `skill` only when the singular plain-language ability is natural |
| Add Skills                                    | Hire a Specialist / Add from The Agency depending context                           |
| AionHub contribution                          | Open Casting                                                                        |
| Team Mode / team feature                      | The Council                                                                         |
| sub agents                                    | Council Members                                                                     |
| team leader                                   | Council Leader                                                                      |
| cowork / coworking                            | working together / Work Along                                                       |
| Settings, when user-facing account/app config | My Headmaster                                                                       |
| Advanced/developer/system settings            | Library later; don't restructure in this pass                                       |

Keep technical terms:

- MCP
- Claude CLI / Codex CLI / Gemini CLI
- API key
- model provider
- WebUI if the actual feature name remains WebUI for v1

---

## Task 1: Fix English settings copy

**Objective:** Remove the biggest chunk of visible upstream/generic vocabulary from `settings.json`.

**Files:**

- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/settings.json`

**Steps:**

1. Open `settings.json` and update visible copy only. Do not rename JSON keys.
2. Apply these specific high-priority changes:

```txt
Settings -> My Headmaster where it is the page title / navigation label.
Agent / Agents -> Specialist / Specialists for visible role labels.
Main Agent -> Lead Specialist.
Custom ACP Agents -> Your Hires, or Custom Specialists if the section is technical.
Agent Name -> Specialist Name.
No agents detected -> No Specialists detected.
AI agent -> Headmaster Specialist.
One desktop. Your AI agents, actually coworking. -> One desktop. Your Specialists, actually working together.
Install from Market -> Install from The Agency.
Want a new Agent listed here? -> Want a new Specialist listed here?
Open a PR on AionHub -> Submit to Open Casting.
AionHub market is coming soon. -> The Agency is coming soon.
System -> Your Team.
Custom -> Your Hires.
Official -> Your Team.
Cannot delete builtin specialists -> You can't delete Specialists from Your Team.
Official Managed Content -> Headmaster Team Content.
Custom Presets (Rules) -> Your Hires (Rules).
team creation, leader or teammate coordination... -> Council creation, leader or member coordination...
```

3. Keep `MCP`, CLI names, model provider copy, API copy.
4. Do not change keys like `agent`, `skillsHub`, `remoteAgent`, etc.

**Verification:**

Run:

```bash
bun run i18n:types
node scripts/check-i18n.js
```

Expected:

- i18n type generation succeeds.
- check-i18n passes. Existing warning noise is acceptable if exit code is `0`.

---

## Task 2: Fix English conversation/guid/agent/acp/messages copy

**Objective:** Clean the visible chat/start/error surfaces.

**Files:**

- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/conversation.json`
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/guid.json`
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/agent.json`
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/acp.json`
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/messages.json`
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/common.json`

**Steps:**

1. In visible values only, replace:

```txt
No Main Agent is available -> No Lead Specialist is available
No Main Agent available -> No Lead Specialist available
Current Agent is unavailable -> Current Specialist is unavailable
Scanning local available agents -> Scanning local available Specialists
Agent -> Specialist where it is a visible label
No agents available -> No Specialists available
The agent could not reply -> The Specialist could not reply
Try another agent -> Try another Specialist
Failed to switch agent -> Failed to switch Specialist
agent is requesting permission -> Specialist is requesting permission
Agent Mode -> Specialist Mode or Permission Mode, depending context
```

2. For Agency text:

```txt
Search and activate community Agency on demand. Configure once, available for all agents.
-> Browse The Agency and activate community capabilities on demand. Configure once, use across all Specialists.

Generate Skill/Rule -> Generate Agency Item / Rule
Skill (Python) -> Agency Item (Python)
Load Rule/Skill -> Load Rule / Agency Item
```

3. Do not change protocol/JSON keys.

**Verification:**

Run:

```bash
bun run i18n:types
node scripts/check-i18n.js
```

Expected exit code: `0`.

---

## Task 3: Fix cron and Council/team visible copy

**Objective:** Make scheduled tasks and Council screens match the Headmaster vocabulary.

**Files:**

- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/cron.json`
- Modify: `packages/desktop/src/renderer/services/i18n/locales/en-US/team.json`

**Steps:**

1. In `cron.json`, update visible values:

```txt
No scheduled task yet. Create one with your Agent! -> No scheduled task yet. Create one with your Specialist!
Agent -> Specialist
Instructions for the agent to execute -> Instructions for the Specialist to execute
Please select an agent -> Please select a Specialist
Select the agent to execute this task -> Select the Specialist to execute this task
Turn this task into a skill -> Save this task to The Agency
Save as Skill -> Save to The Agency
Preview skill content -> Preview Agency content
Skill saved — future executions will use it -> Saved to The Agency — future executions will use it
Failed to save skill -> Failed to save Agency item
```

2. In `team.json`, update visible values:

```txt
Delete this team? -> Delete this Council?
New Agent -> New Council Member
Agent not configured yet. -> Council member not configured yet.
Message dispatch agent... -> Message the Council leader...
Select team leader -> Select Council Leader
Select sub agents -> Select Council Members
No supported agents installed -> No supported Specialists installed
Currently supports Claude and Codex. More agents coming soon. -> Currently supports Claude and Codex. More Specialists coming soon.
Understands your goals and coordinates agents to complete tasks -> Understands your goals and coordinates The Council to complete tasks
Sub Agents -> Council Members
Please enter a team name -> Please enter a Council name
Please select a team leader -> Please select a Council Leader
Failed to create team -> Failed to create Council
Describe your goal and I'll get the team working on it -> Describe your goal and I'll convene The Council
Organize a debate with agents taking different sides -> Organize a debate with Council Members taking different sides
Plan an in-depth interview between agents -> Plan an in-depth interview between Council Members
```

3. Leave JSON keys and route/API names unchanged.

**Verification:**

Run:

```bash
bun run i18n:types
node scripts/check-i18n.js
```

Expected exit code: `0`.

---

## Task 4: Fix public Agency hub metadata

**Objective:** Remove AionHub/Aionui branding from visible hub/agency metadata used by the app.

**Files:**

- Modify: `resources/hub/index.json`
- Modify: `resources/hub/manifest.json`

**Steps:**

1. In `resources/hub/index.json`, replace visible author/brand text:

```txt
Aionui Official -> GCAP Labs
AionHub -> The Agency / Open Casting where visible
```

2. In `resources/hub/manifest.json`, inspect whether URLs point to `iOfficeAI/AionHub`.
   - If these URLs are runtime download sources needed for actual install, do **not** invent a new URL.
   - If they are visible metadata only, reword labels to Headmaster/The Agency.
   - If a real GCAP/Headmaster hub URL does not exist yet, leave URL as runtime source but remove visible display text if possible.

**Verification:**

Run:

```bash
python - <<'PY'
from pathlib import Path
for p in ['resources/hub/index.json','resources/hub/manifest.json']:
    s = Path(p).read_text(encoding='utf-8')
    for bad in ['Aionui Official', 'AionHub market']:
        if bad in s:
            raise SystemExit(f'{p} still contains {bad}')
print('hub metadata visible branding ok')
PY
```

Expected: `hub metadata visible branding ok`.

---

## Task 5: Fix public README/demo copy if repo/docs are public-facing

**Objective:** Remove stale upstream marketing fingerprints from public README surfaces.

**Files:**

- Modify: `readme.md`
- Modify: `README.md` if present and tracked separately
- Optional later: `docs/readme/*.md` localized docs

**Steps:**

1. Update stale anchors:

```txt
#-cowork-in-action -> #-work-along-in-action
#-why-choose-headmaster-over-claude-cowork -> #-why-choose-headmaster
```

2. Remove/replace stale captions:

```txt
Hermes + Aion UI is Insane (FREE)!
OpenClaw + Aion UI is Insane (FREE)!
```

Suggested replacement if the section remains:

```txt
Headmaster demo walkthrough
Headmaster Work Along workflow
```

3. Replace visible `Agent/Skills/Team` language where the README is customer-facing.
4. Do not erase required legal/upstream attribution if the repo is public and needs license disclosure. Put that in a short `INHERITANCE.md` or private engineering note later if needed.

**Verification:**

Run:

```bash
python - <<'PY'
from pathlib import Path
for p in ['readme.md','README.md']:
    path = Path(p)
    if not path.exists():
        continue
    s = path.read_text(encoding='utf-8', errors='ignore')
    bad = ['Aion UI', 'AionUi', 'claude-cowork', '#-cowork-in-action']
    found = [b for b in bad if b in s]
    if found:
        raise SystemExit(f'{p} still has {found}')
print('public README fingerprint check ok')
PY
```

Expected: `public README fingerprint check ok`.

---

## Task 6: Explicitly defer mobile for this pass

**Objective:** Keep this pass desktop-only. Mobile is not part of the current demo/shipping scope.

**Files:**

- No edits to `mobile/**` in this pass.

**Decision:**

Mobile is **deferred** for now. Do not spend implementation time on:

```txt
mobile/app.config.ts
mobile/src/i18n/**
mobile bundle IDs
mobile schemes
mobile storage keys
```

**Reason:** The current goal is the desktop buyer/demo experience. Mobile can be cleaned in a later mobile-specific pass when it is actually being shown or shipped.

**Verification:**

No mobile verification required in this pass. Exclude `mobile/**` from the final buyer-visible scan baseline for desktop-only coverage.

---

## Task 7: Build and artifact-level verification

**Objective:** Prove the app builds and inspect the buyer-visible output, not source internals.

**Files:**

- Generated: `out/main/*`
- Generated: `out/renderer/*`
- Optional generated installer: `out/Headmaster-*-win-x64.exe`, `out/win-unpacked/Headmaster.exe`

**Steps:**

1. Run the lightweight build:

```bash
bun run package
```

Expected: exit code `0`.

2. Run buyer-visible output grep:

```bash
python - <<'PY'
from pathlib import Path
bad_terms = ['AionUi', 'AionUI', 'AIONUI', 'AionHub', 'coworking']
roots = [Path('out/main'), Path('out/renderer')]
found = []
for root in roots:
    if not root.exists():
        continue
    for p in root.rglob('*'):
        if p.suffix.lower() not in ['.js', '.html', '.json', '.css']:
            continue
        s = p.read_text(encoding='utf-8', errors='ignore')
        for term in bad_terms:
            if term in s:
                found.append((str(p), term))
if found:
    for item in found[:50]:
        print(item)
    raise SystemExit(f'Found {len(found)} buyer-visible upstream terms in build output')
print('built output visible branding check ok')
PY
```

Expected: `built output visible branding check ok`.

3. Optional if the installer is needed now:

```bash
bun run dist:win
```

Then verify:

```bash
python - <<'PY'
from pathlib import Path
candidates = list(Path('out').glob('Headmaster-*-win-x64.exe')) + list(Path('out').glob('Headmaster-*-win-x64.zip')) + [Path('out/win-unpacked/Headmaster.exe')]
missing = [str(p) for p in candidates if not p.exists()]
if missing:
    raise SystemExit('Missing expected artifacts: ' + ', '.join(missing))
for p in candidates:
    if p.exists():
        print(p, p.stat().st_size)
PY
```

Expected: installer/zip/unpacked exe exist and are non-empty.

---

## Task 8: Final buyer-visible scan and report

**Objective:** Report actual remaining visible misses and percent coverage after implementation.

**Files:**

- No edits unless scan reveals obvious safe copy misses.

**Steps:**

1. Run the focused buyer-visible scan:

```bash
python - <<'PY'
import os,re,json
root='.'
exclude={'.git','node_modules','out','dist','build','.next','.turbo','.claude','.github','.aionui','.specify','tests'}
include_prefixes=(
 './packages/desktop/src/renderer/services/i18n/locales/en-US',
 './packages/desktop/src/renderer/index.html',
 './packages/desktop/electron-builder.yml',
 './public',
 './resources/hub',
 './readme.md',
 './README.md',
)
terms={
 'upstream_brand': r'\b(AionUi|AionUI|AIONUI|aionui|AionHub)\b',
 'old_cowork': r'\b(cowork|Cowork|coworking|Coworking)\b',
 'agent_visible': r'\b(agent|agents|Agent|Agents)\b',
 'skill_visible': r'\b(skill|skills|Skill|Skills|Skills Market|Market)\b',
 'team_visible': r'\b(team|teams|Team|Teams|Team Mode)\b',
}
counts={k:0 for k in terms}
files=set()
for dp,dns,fns in os.walk(root):
    dns[:]=[d for d in dns if d not in exclude]
    for fn in fns:
        p=os.path.join(dp,fn).replace(os.sep,'/')
        if not any(p.startswith(pref) for pref in include_prefixes):
            continue
        if not fn.lower().endswith(('.json','.ts','.tsx','.html','.yml','.yaml','.webmanifest','.md')):
            continue
        s=open(p,encoding='utf-8',errors='ignore').read()
        hit=False
        for name,pat in terms.items():
            c=len(re.findall(pat,s))
            counts[name]+=c
            hit = hit or c > 0
        if hit:
            files.add(p)
print('files_with_hits',len(files))
print(json.dumps(counts, indent=2))
PY
```

2. Report coverage against this baseline:

```txt
Baseline: 337 buyer-visible-ish matches.
Target after Phase 1: under 75.
Ideal after Phase 1: under 40, with all remaining `agent/skill/team` hits either technical or intentionally deferred.
```

3. Include exact remaining buckets:

- `Done now`
- `Deferred because not visible`
- `Deferred because release/legal decision`
- `Deferred because migration needed`

---

## Success criteria

This phase is successful when:

- `bun run package` passes.
- `node scripts/check-i18n.js` passes with exit code `0`.
- Built output contains no direct `AionUi`, `AionHub`, or `coworking` strings.
- English demo path no longer feels like generic AionUi vocabulary.
- Remaining internal/runtime terms are explicitly deferred, not accidentally missed.

## One open decision: should README/public docs be included in this desktop pass, or only the built desktop app UI/artifact?
