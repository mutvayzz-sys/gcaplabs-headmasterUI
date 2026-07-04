# Headmaster Direction Notes

## Product framing

The preferred framing is **Work Along**.

Headmaster should feel like an AI specialist working alongside the user, not like a dense technical control panel. The school-facing version should stay simple for now: clear, plain language, minimal product jargon, and no overly detailed runtime/computer explanations unless the user explicitly opens those surfaces.

Good user-facing language:

- Work Along
- Computer View
- Browser View
- Specialists
- Skills, renamed into school/admin-friendly capabilities

Avoid making this too technical for schools at this stage.

## Computer View and Browser View

**Computer View** and **Browser View** are good enough names.

They should be treated as simple surfaces the user can open when they want to watch or guide the work. They do not need deep explanations in the UI yet.

Use them like this:

- **Computer View**: the visible agent workspace / machine view.
- **Browser View**: the agent's browser surface for web tasks.
- **Work Along**: the broader product mode where the user and specialist work through a task together.

Computer View and Browser View are not the whole product. They are optional views inside the Work Along experience.

## Mobile direction

The mobile direction matters for the whole product model.

The app in `gcaplabs-ios/` should be replaced / taken over by a white-labelled, Headmaster-branded fork of:

- `https://github.com/uzairansaruzi/hermex`

This supersedes the older mobile direction currently represented in the folder.

Mobile should follow the same default runtime rule as the rest of the product:

- Mobile uses the Agent37 equivalent runtime by default.
- Browser uses the Agent37 equivalent runtime by default.
- PC uses the Agent37 equivalent runtime by default.
- PC local machine access only happens inside the Cowork tab / local Work Along surface.

The mobile app should not become a separate local-machine-control product. It should feel like the mobile version of the same Headmaster/Agent37 experience.

## Skills direction

The old AionUi assistant/skill idea is useful, but the names need to be changed.

Keep the practical school/admin skills, renamed for Headmaster. Drop weird or irrelevant upstream concepts.

Keep / adapt ideas like:

- Document workflows
- Spreadsheet workflows
- Presentation workflows
- Form workflows
- Report generation
- Data cleanup
- Attendance workflows
- Gradebook workflows
- Parent communication workflows
- Planning with files
- Scheduled recurring work

Do not carry forward useless upstream items like:

- moltbook
- OpenClaw Setup
- random social/roleplay assistants
- upstream novelty assistants that do not fit school operations

Skills should feel like school-office capabilities, not a generic AI marketplace dump.

## Deliverables are not Files

**Deliverables are not the same thing as Files or Explorer.**

This distinction matters.

- **Files / Explorer** means the workspace file browser: uploaded docs, spreadsheets, source files, folders, intermediate files, and runtime workspace contents.
- **Deliverables** means polished artifacts from the actual Nous/Hermes desktop app experience: final outputs, generated documents, reports, slide decks, spreadsheets, summaries, or other finished work products.

So the app should not collapse Deliverables into a file explorer.

Deliverables should feel like the finished work tray.
Files / Explorer should feel like the workspace storage view.

## Local mode and Remote mode

The default product behavior should work basically like Claude works, but with the Agent37 equivalent behind it.

By default:

- On **mobile**, Headmaster uses the Agent37 equivalent runtime.
- In the **browser**, Headmaster uses the Agent37 equivalent runtime.
- On **PC**, Headmaster also uses the Agent37 equivalent runtime.

The exception is the **Cowork tab / Work Along local surface**.

That is where local machine access belongs.

The distinction:

- **Default mode across mobile, browser, and PC**: Agent37 equivalent managed runtime.
- **Cowork tab / local Work Along mode on PC**: local machine access and local desktop context, subject to permissions and safety boundaries.
- **Remote Mode**: managed Agent37 runtime work, matching the mobile/browser/default PC behavior.

Do not describe Remote Mode as if it can automatically access the user's local files/apps unless those files are uploaded, synced, or explicitly bridged.

Do not overpromise "working on your machine" for the default Agent37-backed experience. The local machine path is specifically the Cowork tab / local Work Along surface on PC.

## School-facing UX rule

Keep the school version simple.

The user should understand:

1. Ask Headmaster what to do.
2. Headmaster works along with them.
3. If needed, they can open Computer View or Browser View.
4. Files are where source/workspace materials live.
5. Deliverables are where finished artifacts appear.

That is enough for now.

Do not expose the full backend/runtime model to schools unless needed for support or admin settings.

## Current direction summary

Headmaster should move toward:

- **Work Along** as the main experience language.
- **Computer View / Browser View** as simple watchable work surfaces.
- Renamed, school-relevant skills instead of inherited AionUi novelty assistants.
- A clear separation between workspace files and polished deliverables.
- Agent37 equivalent runtime by default on mobile, browser, and PC.
- Local machine access only inside the PC Cowork tab / local Work Along surface.

The goal is not to build a complex technical cockpit yet.

The goal is a clean school-friendly product where staff can say what they need done, watch when necessary, and receive finished deliverables without learning the runtime architecture.
