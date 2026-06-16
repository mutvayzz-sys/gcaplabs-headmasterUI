# The Headmaster Build — The Simple Plan

> _Explain Like I'm 5. We have 3 LEGO sets. We have 12 pictures of what we want to build. We take the bricks we need, throw away the rest, and make our own bricks for the parts nobody has built._

---

## What we have

**3 open-source apps** (people who already built similar things):

| App | What's in it | Good for |
|---|---|---|
| **Nous** (NousResearch) | The cleanest, most stable base. Deep settings, chat, file browser, MCP/tools, voice. | **Our base** — we start here |
| **fathah's fork** | 12-screen UI grid, clean installer. Has PostHog tracking, crypto token badge, and Atlas Cloud sponsor (we drop those). | Almost nothing — too much cruft |
| **workspace** (outsourc-e) | Multi-agent Swarm, terminal, memory, cron, theme system, skills marketplace. Has 3D Office, Greek god avatars, Claude assets (we drop those). | We cherry-pick a few screens |

**12 design pictures** (`References/01-12`) that show exactly what we want to build. The real spec. These are the boss.

---

## What we're building (14 screens)

The 14 sidebar items in the real Headmaster design. Each one has a single source:

| # | Screen | Where it comes from | How |
|---|---|---|---|
| 1 | **Dashboard** | 🔨 Build it | Nobody has it. 4 KPI cards + 6 panels. Custom. |
| 2 | **Chat** | 📋 Nous | Already built, just rename it |
| 3 | **Workflows** | 📋 workspace | Already built, just rename + restyle |
| 4 | **Kanban** | 📋 workspace | Already built, just rename + restyle |
| 5 | **Runs** | 📋 workspace | Already built, just rename + restyle |
| 6 | **Approvals** | 🔨 Build it | Nobody has the ✓/✗/💬 queue UI. Custom. |
| 7 | **Documents** | 📋 Nous | Already built, just rename + restyle |
| 8 | **Memory** | 📋 workspace | Already built, just rename + restyle |
| 9 | **Automations** | 📋 workspace | Already built, just rename + restyle |
| 10 | **Agents** | 🔨 Build it | workspace has the config, but the Paperclip-style roster UI is custom. |
| 11 | **Integrations** | 📋 Nous | Already built (MCP/Tools), just rename |
| 12 | **Channels** | 📋 Nous | Already built (messaging), just rename |
| 13 | **Analytics** | 🔨 Build it | Custom — the 4-panel metrics + the 5 status indicators |
| 14 | **Settings** | 📋 Nous | Already built (deepest settings), just rename |

Plus one more thing: the **persistent chat composer at the bottom of every screen**. The "Ask Headmaster anything..." input + the 4 quick chips. Use Nous's chat composer, just restyle.

---

## The numbers

- **🔨 4 things we build from scratch:** Dashboard, Approvals, Agents UI, Analytics
- **📋 10 things we copy from other apps and rename:** Chat, Workflows, Kanban, Runs, Documents, Memory, Automations, Integrations, Channels, Settings
- **1 shared piece:** The chat composer (Nous)

Total: **14 screens + 1 shared composer.**

---

## What we throw away (don't need it)

| Thing | From | Why we drop it |
|---|---|---|
| 3D Office scene (the office3d folder) | workspace | Not in the design. Heavy. |
| Greek god characters (apollo, artemis, **hermes**, iris, nike, pan) | workspace | Replacing with Sorting Hat. The `hermes.png` one specifically is a direct upstream name leak. |
| Claude assets (claude-avatar, claude-logo, claude-caduceus, claude-banner, claude-favicon) | workspace | Branding leak from an old Claude fork. 13 files. |
| Conductor name | workspace | We call it "Orchestrator" not "Conductor." |
| PostHog tracking | fathah | Compliance red flag. |
| $HD token badge (bankr.bot) | fathah | Crypto shilling in the README. |
| Atlas Cloud sponsor block | fathah | Third-party endorsement we don't have. |
| "v2 — zero-fork" admission | workspace | Public README literally admits we're a fork. |
| RAZSOC codename | workspace | Internal name. Don't leak it. |
| gbrain, gstack-for-hermes skills | workspace | Don't exist in the parent. |
| Old unnumbered reference images | References/ | Same screens, older versions. Ignore. |

---

## How to do the merge (simple 5 steps)

1. **Start with Nous as the base.** It's the cleanest.
2. **Rename the front stuff.** App name → "Headmaster." All "Hermes" → "Headmaster" in user-facing places. "Nous" → "GCAP" in the company fields. (Don't touch the runtime stuff — env vars, port numbers, Python CLI commands.)
3. **Port in the screens we want from workspace.** Terminal, Memory, Cron, Skills, Kanban, Runs. Just copy the screens, rename the visible text, repaint with our purple/dark theme.
4. **Build the 4 new screens.** Dashboard (4 KPI + 6 panels), Approvals (queue with ✓/✗/💬), Agents (the Paperclip-style roster), Analytics (the 4 metrics + 5 status indicators). Add the persistent chat composer at the bottom.
5. **Draw the Sorting Hat mascot.** SVG. Dark green leather, eye slit, slight grin. Sits in the center of the Dashboard.

---

## Brand stack (final)

| Element | Name | Tribute to | Notes |
|---|---|---|---|
| **Product** | **Headmaster** | **Lina** (your mum) | Her thought process is the inspiration. Plan a month ahead. Multiple Linas deliberating. Meticulous. The whole product is the tribute. |
| **Mascot** | **Sorting Hat** | **Harry Potter** | Magical authority. Sorts the student. The brand's visual identity. |
| **Multi-agent feature** | **The Council** | **Lina** (her process) | Multi-perspective deliberation = the "talking to multiple Linas" pattern. Inside Headmaster. |
| **Model** | **Adonis** | **Lebanese** heritage (name only) | Phoenician, died-and-resurrected. No Cedar in the visual brand. |
| **Brand color** | **#1A4D2E** (dark green) | Slytherin-coded, fits the Sorting Hat | Accent color, not background |

### The tribute map in one line

> **Headmaster** (product) is a tribute to **Lina's thought process**.
> **The Council** (feature) is a tribute to **Lina's "talking to multiple Linas" pattern**.
> **The Sorting Hat** (mascot) is a tribute to **Harry Potter**.
> **Adonis** (model) is a tribute to **your Lebanese heritage** (name only).

All three tributes (Lina, HP, Lebanese) sit together without conflicting.

---

## The 4 KPIs the spec shows

- **Active Runs** (count, with ↗% vs yesterday)
- **Pending Approvals** (count)
- **Tasks Completed** (count)
- **Time Saved** (hours)

## The 5 system status indicators

- **Model Layer (Adonis)** — operational / degraded / down
- **Memory Engine** — operational / degraded / down
- **Integrations** — operational / degraded / down
- **Automations** — operational / degraded / down
- **Data Pipeline** — operational / degraded / down

## The 6 panels on the dashboard

- Active Runs (top-left)
- Approvals (top-center)
- Top Workflows (top-right)
- System Status (bottom-left)
- Memory Updates (bottom-center)
- Automation Schedule (bottom-right)

## The 4 quick-action chips in the composer

- Create launch plan
- Analyze competitors
- Draft investor update
- Optimize landing page

---

## Decisions still needed

- The 5 unnumbered reference images in `References/` are old duplicates of screens 04, 06, 07, 08, 09. Delete them so the folder is clean?
- The model is named **Adonis** (Phoenician/Lebanese god who died and was resurrected — fitting, since a fine-tuned open-source model is "resurrected" as your own). Tiers: Adonis Mini (1-3B edge), Adonis (7-14B flagship, beats gpt-4o-mini on narrow tasks like tool calling), Adonis Pro (32-70B when funded), Adonis X (experimental). Lebanese heritage expressed through the name only — no Cedar in the visual brand.

---

*See `WHITE-LABEL-AUDIT.md` in this folder for the line-by-line scrub plan (Parts 1-2: branding touchpoints in the source code, Part 3: corrected design intent).*
