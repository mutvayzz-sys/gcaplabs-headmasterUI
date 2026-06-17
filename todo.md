# Headmaster — TODO

Working backlog for upcoming sessions. Current version: **v0.1.2**.

---

## 1. Settings page cleanup + restructure
- [ ] **Remove all "Hermes" mentions** from the UI (labels, tab names, copy). It's just "Headmaster" now.
- [ ] The current Settings view shows a "keep / port" comparison list — replace that.
- [ ] **Port over ALL Hermes settings** and make those the settings shown under the main **Settings** category.
- [ ] Move every other ported feature/setting under a new separate tab called **"Advanced Settings"**.
- [ ] Remove old/dead settings entries left over from the white-label base.

## 2. CLI agent detection is broken
- [ ] No CLI agents are being detected at all. Should detect **Claude, Grok, Codex, Hermes** (and others).
- [ ] Investigate the agent detection path (`fetchDetectedAgents` / detected-agents SWR + backend `/api/agents`) and fix so installed CLI agents show up.

## 3. Memory: panel should be the app, settings should be settings
- [ ] The **Memory tab/panel** (main left-nav) should render the Memory **app** directly — not the current placeholder content.
- [ ] The Memory in the actual panel is the one that should show the app UI.
- [ ] The Memory entry under **Settings** should contain only this app's memory **settings**, and be **renamed to "Memory Settings"**.
- [ ] Memory should NOT open as / behave like a separate app.

## 4. Remove features
- [ ] **Remove Desktop Pet** entirely (settings tab + feature).
- [ ] **Remove Skills** entirely.
- [ ] Review **Appearance** settings — clean up / remove old items.

## 5. Remove persistent Composer
- [ ] Remove the always-on bottom Composer (`BottomComposer`).
- [ ] A chat input should appear **only on the Chat screen**, not on every screen.

## 6. File / document explorer not showing
- [ ] The file explorer / document explorer / workspace panel is **not rendering** next to the chat window.
- [ ] Fix so the workspace/file panel shows next to the chat as expected.

---

## Notes / context from this session
- Removed the "installation incomplete" startup check (main process + dead renderer dialog).
- Added `AppErrorBoundary` around the Outlet + sidebar so crashes are recoverable and show a real error instead of a white screen.
- Fresh signed build produced at `out/win-unpacked/Headmaster.exe`; shortcut at `GCAP-Labs/Headmaster.lnk`.
