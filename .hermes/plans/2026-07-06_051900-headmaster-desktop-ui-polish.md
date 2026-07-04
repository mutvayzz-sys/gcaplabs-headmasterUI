# Headmaster Desktop UI Polish — Mockup-Driven Alignment Plan

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Apply the owner-supplied Headmaster Desktop UI reference direction (light/dark chat UI mockups, gradient primary CTAs, pill status badges, blurred-glow hero) to the existing `gcaplabs-headmasterUI/packages/desktop` components while preserving the current component architecture and without introducing a new CSS framework.

**Architecture:** Keep the existing React component boundaries (`Sider/*`, `SendBox`, `GuidPage`, `QuickActionButtons`, `GuidInputCard`) and the existing styling stack (Arco Design tokens, per-component CSS modules, the `colors.ts` helper). The change is **token/CSS-only plus a few small layout/prop adjustments** to match the mockup’s colors, radii, spacing, and status-pill style. No new dependencies.

**Tech Stack:** Electron + Vite + React + TypeScript; Arco Design; `@arco-design/web-react` tokens; CSS modules; `colors.ts` for color helpers. No Tailwind/UnoCSS in the desktop package.

---

## Context & Assumptions

- The owner confirmed the mockups are **artistic direction**, not a literal 1:1 redesign. Extract the established colors/branding/artistic direction (already captured in `gcap-brand-logo-decision` memory and `mastertodo.md` / `masterlog.md` for 2026-07-05).
- Exact confirmed palette:
  - black `#0D0F14`
  - blue `#2563FF`
  - purple `#7C3AED`
  - pink `#FF2D8F`
  - orange `#FFB020`
  - grey `#E5E7EB`
- Existing desktop color helpers live in `packages/desktop/src/renderer/styles/colors.ts` (e.g., `iconColors`, `primaryColors`, `textColors`, `statusColors`).
- The current desktop uses Arco CSS variables like `--color-primary`, `--color-bg-1`, `--color-text-1`, `--color-fill-2`, etc. The Arco light/dark themes are configured in `packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/default.css` and `dark.css`.
- No image assets exist in the repo; the blurred-glow hero effect must be CSS-only (radial gradients + `backdrop-filter` or pure CSS gradients).
- Status-pill colors are already partly present in the code (e.g., `rgb(var(--success-6))`, `var(--primary-3)`); we will standardize them to the confirmed Headmaster palette.

---

## Mockup → Code Mapping

| Mockup Region | Existing Component(s) | Primary File(s) |
|---|---|---|
| Left sidebar nav (collapsed/expanded) | `Sider`, `SiderToolbar`, `Phase2Nav`, `SiderNavEntry`, `SiderItem`, `SiderSearchEntry`, `SiderFooter` | `packages/desktop/src/renderer/components/layout/Sider/index.tsx` |
| Sidebar status/version pills | `SiderFooter`, `GatewayStatusIndicator`, `UpdateChecker`, `AppUpdateChecker` | `packages/desktop/src/renderer/components/layout/Sider/SiderFooter.tsx` |
| Hero chat landing ("Hi, what's your plan for today?") | `GuidPage` + `GuidInputCard` + `QuickActionButtons` | `packages/desktop/src/renderer/pages/guid/GuidPage.tsx` |
| Chat input / send button | `SendBox` | `packages/desktop/src/renderer/components/chat/SendBox/index.tsx` |
| Guid composer action row (model/agent pills) | `GuidActionRow` | `packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx` |

---

## Task 1: Add Brand Gradient Tokens to the Theme Presets

**Objective:** Add the confirmed brand gradient and status-pill tint variables to the desktop Arco theme presets so components can reference them with CSS variables.

**Files:**
- Modify: `packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/default.css`
- Modify: `packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/dark.css` (verify it exists and update if so)

**Step 1: Inspect dark.css**

Read `packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/dark.css`.

**Step 2: Add CSS variables to both presets**

Append to `:root` (or the Arco theme selector) in both `default.css` and `dark.css`:

```css
  /* Headmaster brand gradients (new) */
  --gradient-brand: linear-gradient(135deg, #2563FF 0%, #7C3AED 45%, #FF2D8F 75%, #FFB020 100%);
  --gradient-brand-soft: linear-gradient(135deg, color-mix(in srgb, #2563FF 80%, #fff) 0%, color-mix(in srgb, #7C3AED 80%, #fff) 45%, color-mix(in srgb, #FF2D8F 80%, #fff) 75%, color-mix(in srgb, #FFB020 80%, #fff) 100%);

  /* Headmaster status pills (new) */
  --pill-priority: #FF2D8F;
  --pill-priority-soft: color-mix(in srgb, #FF2D8F 16%, var(--color-bg-1));
  --pill-processing: #7C3AED;
  --pill-processing-soft: color-mix(in srgb, #7C3AED 16%, var(--color-bg-1));
  --pill-connected: #2563FF;
  --pill-connected-soft: color-mix(in srgb, #2563FF 16%, var(--color-bg-1));
  --pill-warning: #FFB020;
  --pill-warning-soft: color-mix(in srgb, #FFB020 16%, var(--color-bg-1));
```

For dark mode, adjust the `-soft` variants to mix against `var(--color-bg-2)` or the dark card background instead of `var(--color-bg-1)`.

**Step 3: Verify via grep**

Run: `grep -n "gradient-brand" packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/default.css`

Expected: output shows the new variables.

**Step 4: Commit**

```bash
git add packages/desktop/src/renderer/pages/settings/AppearanceSettings/presets/default.css
# add dark.css if it exists and was modified
git commit -m "feat(desktop): add Headmaster brand gradient and status-pill tokens to Arco presets"
```

---

## Task 2: Update Primary Button & Send Button to Use the Brand Gradient

**Objective:** Replace the flat black primary send button in `GuidActionRow` and `SendBox` with the Headmaster brand gradient for the enabled state, while preserving disabled/stop states.

**Files:**
- Modify: `packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx:336-349`
- Modify: `packages/desktop/src/renderer/components/chat/SendBox/sendbox.css:1-28`
- Create: (if needed) gradient helper class in `sendbox.css`

**Step 1: Update `GuidActionRow` send button**

Replace the inline `style` block on the send button:

```tsx
        <Button
          shape='circle'
          type='primary'
          loading={loading}
          disabled={isButtonDisabled}
          className='send-button-custom'
          style={{
            background: isButtonDisabled
              ? undefined
              : 'var(--gradient-brand)',
            borderColor: isButtonDisabled ? undefined : 'transparent',
          }}
          icon={<ArrowUp size={14} weight='bold' color='white' />}
          onClick={onSend}
          data-testid='guid-send-btn'
        />
```

Note: `background` (not `backgroundColor`) accepts the gradient CSS variable.

**Step 2: Update `sendbox.css` for conversation send button**

Replace the first two selectors so the enabled state uses the gradient and the disabled state remains the current gray override:

```css
/* Send button enabled state */
.send-button-custom:not(:disabled),
.send-button-custom.arco-btn:not(:disabled),
.send-button-custom.arco-btn-primary:not(:disabled) {
  background: var(--gradient-brand) !important;
  border-color: transparent !important;
}

/* Send button disabled state - override Arco Design default disabled styles */
.send-button-custom:disabled,
.send-button-custom.arco-btn:disabled,
.send-button-custom.arco-btn-primary:disabled {
  background: #d3d4d9 !important;
  border-color: #d3d4d9 !important;
  opacity: 1 !important;
}

/* Dark mode: keep the gradient (the Arco variable is already dark-aware) */
[data-theme='dark'] .send-button-custom:not(:disabled) {
  background: var(--gradient-brand) !important;
  border-color: transparent !important;
}
```

**Step 3: Update dark mode disabled selector**

Replace the existing dark disabled selector with the same disabled background but keep the gradient on enabled:

```css
[data-theme='dark'] .send-button-custom:disabled,
[data-theme='dark'] .send-button-custom.arco-btn:disabled,
[data-theme='dark'] .send-button-custom.arco-btn-primary:disabled {
  background: color-mix(in srgb, var(--color-fill-4) 82%, var(--color-bg-2)) !important;
  border-color: color-mix(in srgb, var(--color-fill-4) 88%, var(--color-bg-2)) !important;
}
```

**Step 4: Run typecheck and tests**

Run: `bunx tsc --noEmit`
Expected: clean.

Run: `bun run test -- --run` (or the repo's test command) and confirm no regressions.

**Step 5: Commit**

```bash
git add packages/desktop/src/renderer/pages/guid/components/GuidActionRow.tsx
packages/desktop/src/renderer/components/chat/SendBox/sendbox.css
git commit -m "feat(desktop): apply Headmaster brand gradient to send buttons"
```

---

## Task 3: Polish the Sidebar Status Pills

**Objective:** Apply the Headmaster status-pill palette to the Gateway status, update checker, and app version pill in the sidebar footer.

**Files:**
- Modify: `packages/desktop/src/renderer/components/layout/Sider/SiderFooter.tsx`
- Modify: `packages/desktop/src/renderer/components/layout/Sider/SiderNav/GatewayStatusIndicator.tsx`
- Modify: `packages/desktop/src/renderer/components/layout/Sider/SiderNav/AppUpdateChecker.tsx`
- Modify: `packages/desktop/src/renderer/components/layout/Sider/SiderNav/UpdateChecker.tsx`

**Step 1: Read current pill styles in each file**

Inspect the existing inline styles / Arco `Badge` / `Tag` props used for status, update checker, and version.

**Step 2: Standardize on CSS variables**

Where the status is "connected" / "running", set the pill color to `var(--pill-connected)` and background to `var(--pill-connected-soft)`.
Where the status is "processing" / "checking", use `var(--pill-processing)` / `var(--pill-processing-soft)`.
Where the status is a warning/error, use `var(--pill-warning)` / `var(--pill-warning-soft)`.
Where the status is a high-priority update, use `var(--pill-priority)` / `var(--pill-priority-soft)`.

Use the exact pill style already present in the codebase if one exists, e.g.:

```tsx
<span style={{
  color: 'var(--pill-connected)',
  background: 'var(--pill-connected-soft)',
  padding: '2px 8px',
  borderRadius: '999px',
  fontSize: 12,
  fontWeight: 500,
}}>
  {label}
</span>
```

If the existing component uses Arco `Badge` color, prefer mapping its `color` prop to the CSS variable via `style` or class. Avoid breaking the component's tooltip/click behavior.

**Step 3: Verify the SiderFooter still renders correctly**

Run the existing unit tests for the sidebar footer if any exist; otherwise do a visual smoke test by launching the app.

**Step 4: Commit**

```bash
git add packages/desktop/src/renderer/components/layout/Sider/SiderFooter.tsx
packages/desktop/src/renderer/components/layout/Sider/SiderNav/GatewayStatusIndicator.tsx
packages/desktop/src/renderer/components/layout/Sider/SiderNav/AppUpdateChecker.tsx
packages/desktop/src/renderer/components/layout/Sider/SiderNav/UpdateChecker.tsx
git commit -m "feat(desktop): apply Headmaster status-pill palette to sidebar footer"
```

---

## Task 4: Add a CSS-Only Blurred-Glow Hero Background

**Objective:** Give the empty `GuidPage` hero area a subtle, mockup-aligned blurred-glow backdrop without adding image assets.

**Files:**
- Modify: `packages/desktop/src/renderer/pages/guid/index.module.css`
- Modify: `packages/desktop/src/renderer/pages/guid/GuidPage.tsx` (only to add a container/wrapper class if one does not exist)

**Step 1: Identify the hero container**

In `GuidPage.tsx`, locate the rendered "Hi, ..." welcome area. Add a wrapper class `guidHero` if it is not already wrapped.

**Step 2: Add CSS-only glow**

Append to `packages/desktop/src/renderer/pages/guid/index.module.css`:

```css
.guidHero {
  position: relative;
  overflow: hidden;
}

.guidHero::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 30% 20%, color-mix(in srgb, #2563FF 22%, transparent) 0%, transparent 40%),
    radial-gradient(circle at 70% 80%, color-mix(in srgb, #FF2D8F 18%, transparent) 0%, transparent 40%),
    radial-gradient(circle at 50% 50%, color-mix(in srgb, #7C3AED 14%, transparent) 0%, transparent 50%);
  opacity: 0.6;
  filter: blur(60px);
  z-index: 0;
}

[data-theme='dark'] .guidHero::before {
  opacity: 0.35;
}

.guidHero > * {
  position: relative;
  z-index: 1;
}
```

**Step 3: Verify the CSS module is imported**

`GuidPage.tsx` already imports `styles from '../index.module.css'`. Ensure the new class is applied to the outer hero wrapper.

**Step 4: Commit**

```bash
git add packages/desktop/src/renderer/pages/guid/index.module.css
packages/desktop/src/renderer/pages/guid/GuidPage.tsx
git commit -m "feat(desktop): add CSS-only blurred-glow hero backdrop to guid page"
```

---

## Task 5: Re-Color Quick-Action Floating Buttons in the Hero

**Objective:** Apply the Headmaster brand color to the hover states of the three quick-action buttons in `QuickActionButtons`.

**Files:**
- Modify: `packages/desktop/src/renderer/pages/guid/components/QuickActionButtons.tsx`

**Step 1: Replace hardcoded hover colors with brand tokens**

Current code has hardcoded `#2C7FFF`, `#FE9900`, and a status-derived `webuiIconColor`. Replace the icon hover colors with brand-aligned tokens:

- Bug report icon hover: `var(--pill-connected)` (blue)
- Star/repo icon hover: `var(--pill-warning)` (orange)
- WebUI running icon: `var(--pill-connected)` (already mapped to success green; change to blue if the status is `running`, or keep the existing logic and just change the `running` branch)

Example diff for the running branch:

```tsx
const webuiIconColor =
  webuiQuickStatus === 'running'
    ? 'var(--pill-connected)'
    : ...
```

And for the hover classes:

```tsx
className='... group-hover:text-[var(--pill-connected)] ...'
```

```tsx
className='... group-hover:text-[var(--pill-warning)] ...'
```

**Step 2: Commit**

```bash
git add packages/desktop/src/renderer/pages/guid/components/QuickActionButtons.tsx
git commit -m "feat(desktop): align hero quick-action hover colors with brand tokens"
```

---

## Task 6: Tighten Input Border Radius & Active Glow to Match the Mockup

**Objective:** The mockup's chat input appears more rounded (≈20px radius) and has a subtle glow on focus. Ensure the existing radius is consistent and add a soft primary-colored shadow when focused.

**Files:**
- Modify: `packages/desktop/src/renderer/components/chat/SendBox/index.tsx` (around line 1360)
- Modify: `packages/desktop/src/renderer/components/chat/SendBox/sendbox.css`

**Step 1: Verify current radius**

The existing code already uses `rd-20px` on the sendbox panel. Confirm it is `rd-20px` (or `borderRadius: 20`) everywhere.

**Step 2: Add a focus/active shadow token**

In `sendbox.css`, add:

```css
.sendbox-panel {
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
}

.sendbox-panel:focus-within,
.sendbox-panel--active {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--pill-connected) 24%, transparent) !important;
}
```

The existing code already toggles `isInputActive` and sets `boxShadow`. If it sets `activeShadow`, update `activeShadow` to use the new soft-blue color:

```ts
const activeShadow = `0 0 0 3px ${color-mix(in srgb, var(--pill-connected) 24%, transparent)}`;
```

For `GuidInputCard`, apply the same `box-shadow` on focus using the same token.

**Step 3: Commit**

```bash
git add packages/desktop/src/renderer/components/chat/SendBox/index.tsx
packages/desktop/src/renderer/components/chat/SendBox/sendbox.css
git commit -m "feat(desktop): add soft brand-glow focus ring to chat input panel"
```

---

## Task 7: Update Sidebar New-Chat Button Hover Accent

**Objective:** In the mockup, the primary "+ New Chat" button likely uses the brand blue/purple gradient on hover. Apply a subtle gradient hover state to the new-chat trigger.

**Files:**
- Modify: `packages/desktop/src/renderer/components/layout/Sider/SiderNav/SiderToolbar.tsx`
- Modify: `packages/desktop/src/renderer/components/layout/Sider/Sider.module.css`

**Step 1: Inspect the new-chat button style**

Read the button class and hover styles.

**Step 2: Add a hover-only gradient background**

In the CSS module, add:

```css
.newChatButton:hover,
.newChatButton:focus-visible {
  background: var(--gradient-brand) !important;
  color: #fff !important;
  border-color: transparent !important;
}
```

Use the exact class name found in `SiderToolbar.tsx`. If the button uses a class from `SiderToolbar.module.css`, adjust accordingly.

**Step 3: Commit**

```bash
git add packages/desktop/src/renderer/components/layout/Sider/SiderNav/SiderToolbar.tsx
packages/desktop/src/renderer/components/layout/Sider/Sider.module.css
git commit -m "feat(desktop): brand-gradient hover state for new-chat button"
```

---

## Task 8: Verification & Final Build

**Objective:** Run the desktop typecheck, lint, and build to confirm the token/Css changes compile and don't regress existing tests.

**Files:**
- None to edit (verification only)

**Step 1: Typecheck**

Run: `bunx tsc --noEmit`
Expected: clean.

**Step 2: Lint**

Run: `bun run lint`
Expected: exits 0.

**Step 3: Tests**

Run: `bun run test`
Expected: existing test suite passes (no new failures).

**Step 4: Build**

Run: `CI=1 bunx electron-vite build --config packages/desktop/electron.vite.config.ts`
Expected: build succeeds with only existing chunk-size warnings.

**Step 5: Optional visual smoke test**

Launch the dev desktop or the built portable exe and confirm:
- Send button has the gradient in light/dark mode.
- Disabled send button is gray.
- Sidebar status pills show the new blue/purple/pink/orange colors.
- Guid hero page has a subtle glow behind the welcome text.
- Quick-action buttons hover in brand colors.

**Step 6: Commit final plan and update docs**

```bash
# If any fixes were needed from verification, commit them first.
# Then update masterlog.md/mastertodo.md with the work done.
git add masterlog.md mastertodo.md
git commit -m "docs: record Headmaster desktop UI polish pass"
```

---

## Risks, Tradeoffs, and Open Questions

1. **No actual mockup image is available in the repo.** The plan is based on the textual descriptions in `masterlog.md` / `mastertodo.md` and the confirmed hex palette. If the owner wants a literal 1:1 pixel match, they will need to provide the mockup image.
2. **Dark-mode gradient readability.** The same gradient may look too bright or too dull in dark mode. The plan keeps the gradient identical but lowers the hero glow opacity for dark mode; verify visually.
3. **Arco CSS variable overrides.** Using `!important` in `sendbox.css` is consistent with existing code but can make future overrides harder. Keep changes scoped to the existing selectors.
4. **Status pills already use semantic colors.** The new palette may conflict with user expectations (e.g., green = success). The owner confirmed the Headmaster palette supersedes the old green/gold/parchment system.
5. **Accessibility.** Ensure the gradient send button still has sufficient contrast against the white arrow icon. The `#fff` icon on a `#2563FF` → `#7C3AED` → `#FF2D8F` gradient is generally accessible; verify with a contrast checker if unsure.
