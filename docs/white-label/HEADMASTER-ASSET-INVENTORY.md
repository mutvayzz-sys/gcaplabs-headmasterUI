# Headmaster — Asset Inventory

**Source:** AionUi clone (Apache-2.0) at `C:\Users\Matve\Desktop\Gcaplabs.com\desktop\gcaplabs-headmaster\`
**Date:** 2026-06-12
**Status:** v1 inventory — placeholder for v2 final media

---

## Categories

### A. App icons (highest priority — brand identity)

| # | File | What it is | Status | What we need |
|---|---|---|---|---|
| A1 | `resources/app.ico` | Windows app icon | PLACEHOLDER | GCAP shield / Sorting Hat icon (multi-resolution .ico) |
| A2 | `resources/app.png` | macOS app icon | PLACEHOLDER | GCAP shield / Sorting Hat icon (1024x1024 source + 16/32/64/128/256/512) |
| A3 | `resources/app.icns` | macOS multi-res icon | PLACEHOLDER | Regenerate from PNG source |
| A4 | `public/pwa/icon-180.png` | iOS PWA icon | PLACEHOLDER | 180x180 GCAP icon |
| A5 | `public/pwa/icon-192.png` | Android PWA icon | PLACEHOLDER | 192x192 GCAP icon |
| A6 | `public/pwa/icon-512.png` | Splash PWA icon | PLACEHOLDER | 512x512 GCAP icon |
| A7 | `mobile/assets/images/icon.png` | Mobile app icon | PLACEHOLDER | Same GCAP icon, mobile-sized |
| A8 | `packages/desktop/src/renderer/assets/logos/brand/app.png` | Brand app icon (in-app) | PLACEHOLDER | Same as A1 |
| A9 | `packages/desktop/src/renderer/assets/logo.svg` | In-app logo (vector) | PLACEHOLDER | GCAP shield vector logo |

**Total: 9 app icon assets. All need replacement.**

### B. Mascot assets (the Sorting Hat character)

| # | File | What it is | Status | What we need |
|---|---|---|---|---|
| B1 | `public/pet-states/working.svg` | Pet state: working | REPLACE | Sorting Hat with a quill in "writing" pose |
| B2 | `public/pet-states/yawning.svg` | Pet state: yawning | REPLACE | Sorting Hat yawning / sleepy eyes |
| B3 | `public/pet-states/waking.svg` | Pet state: waking | REPLACE | Sorting Hat just waking up |
| B4 | `public/pet-states/thinking.svg` | Pet state: thinking | REPLACE | Sorting Hat pondering (the deliberation pose — connects to The Council) |
| B5 | `public/pet-states/sweeping.svg` | Pet state: sweeping | REPLACE | Sorting Hat "sorting" motion (very on-brand) |
| B6 | `public/pet-states/sleeping.svg` | Pet state: sleeping | REPLACE | Sorting Hat with ZZZ / "Z's" |
| B7 | `public/pet-states/random-read.svg` | Pet state: reading | REPLACE | Sorting Hat reading a scroll |
| B8 | `public/pet-states/random-look.svg` | Pet state: looking around | REPLACE | Sorting Hat eyes darting |
| B9 | `public/pet-states/poke-left.svg` | Pet state: poked from left | REPLACE | Sorting Hat flinching left |
| B10 | `public/pet-states/poke-right.svg` | Pet state: poked from right | REPLACE | Sorting Hat flinching right |
| B11 | `public/pet-states/juggling.svg` | Pet state: juggling | REPLACE | Sorting Hat juggling scrolls (multi-task) |
| B12 | `public/pet-states/notification.svg` | Pet state: notification | REPLACE | Sorting Hat with an alert bubble |
| B13 | `public/pet-states/idle.svg` | Pet state: idle | REPLACE | Sorting Hat at rest |
| B14 | `public/pet-states/error.svg` | Pet state: error | REPLACE | Sorting Hat looking concerned |
| B15 | `public/pet-states/happy.svg` | Pet state: happy | REPLACE | Sorting Hat smiling |
| B16 | `public/pet-states/dozing.svg` | Pet state: dozing | REPLACE | Sorting Hat half-asleep |
| B17 | `public/pet-states/dragging.svg` | Pet state: dragging | REPLACE | Sorting Hat dragging something |
| B18 | `public/pet-states/done.svg` | Pet state: done | REPLACE | Sorting Hat with a checkmark or thumbs up |
| B19 | `public/pet-states/carrying.svg` | Pet state: carrying | REPLACE | Sorting Hat carrying scrolls |
| B20 | `public/pet-states/attention.svg` | Pet state: attention | REPLACE | Sorting Hat with raised brow |
| B21 | `public/pet-states/building.svg` | Pet state: building | REPLACE | Sorting Hat with blueprints |

**Total: 21 mascot state SVGs.** This is the magic centerpiece — needs design.

### C. UI icons (in-app)

| # | File | What it is | Status | What we need |
|---|---|---|---|---|
| C1 | `packages/desktop/src/renderer/assets/icons/send-arrow.svg` | Send button arrow | KEEP | Same — universal |
| C2 | `packages/desktop/src/renderer/assets/icons/icon-star.svg` | Star icon | KEEP | Same |
| C3 | `packages/desktop/src/renderer/assets/icons/icon-catalogue.svg` | Catalogue icon | REPLACE | Headmaster-themed (e.g., wizard hat) |
| C4 | `packages/desktop/src/renderer/assets/icons/icon-message.svg` | Message icon | KEEP | Universal |
| C5 | `packages/desktop/src/renderer/assets/icons/file-icon.svg` | File icon | KEEP | Universal |
| C6 | `packages/desktop/src/renderer/assets/icons/add-chat.svg` | Add chat button | REPLACE | "+ New Mission" themed (e.g., scroll + plus) |
| C7 | `packages/desktop/src/renderer/assets/icons/cowork.svg` | Cowork icon | REPLACE | "Work Along" icon (e.g., two people walking) |

**Total: 7 UI icons. 4 keep, 3 replace.**

### D. Channel / integration logos (in-app, for connections)

| # | File | What it is | Status | What we need |
|---|---|---|---|---|
| D1 | `packages/desktop/src/renderer/assets/channel-logos/wecom.svg` | WeCom logo | DROP | Don't expose |
| D2 | `packages/desktop/src/renderer/assets/channel-logos/weixin.svg` | WeChat logo | DROP | Don't expose |
| D3 | `packages/desktop/src/renderer/assets/channel-logos/slack.svg` | Slack logo | KEEP | Universal |
| D4 | `packages/desktop/src/renderer/assets/channel-logos/telegram.svg` | Telegram logo | KEEP | Universal |
| D5 | `packages/desktop/src/renderer/assets/channel-logos/lark.svg` | Lark logo | DROP | Don't expose |
| D6 | `packages/desktop/src/renderer/assets/channel-logos/discord.svg` | Discord logo | KEEP | Universal |
| D7 | `packages/desktop/src/renderer/assets/channel-logos/dingtalk.svg` | DingTalk logo | DROP | Don't expose |

**Total: 7 channel logos. 4 keep, 3 drop (WeChat/WeCom/Lark/DingTalk are China-specific).**

### E. Theme preview images (theme picker in Settings)

| # | File | What it is | Status | What we need |
|---|---|---|---|---|
| E1 | `packages/desktop/src/renderer/assets/themes/default-theme.png` | Default theme preview | REPLACE | Headmaster default theme preview |
| E2 | `packages/desktop/src/renderer/assets/themes/hello-kitty.png` | Hello Kitty theme preview | DROP or keep | Decision: keep as easter egg theme? |
| E3 | `packages/desktop/src/renderer/assets/themes/misaka-mikoto-theme.png` | Misaka Mikoto theme preview | DROP or keep | Decision: keep as easter egg? |
| E4 | `packages/desktop/src/renderer/assets/themes/obsidian-book-cover.png` | Obsidian theme preview | DROP | Generic |
| E5 | `packages/desktop/src/renderer/assets/themes/retro-windows.png` | Retro Windows theme preview | DROP | Niche |
| E6 | `packages/desktop/src/renderer/assets/themes/y2k-ledger-cover.png` | Y2K theme preview | DROP | Niche |

**Total: 6 theme previews. Replace 1, decide on others.**

### F. Marketing / readme media (dropped for v1, will regenerate)

| Original | Size | Why dropped |
|---|---|---|
| `resources/aionui_readme_header_0807.png` | 436K | Has "AionUi" branding — regenerate |
| `resources/aionui_logo_no_border.png` | (small) | Has "AionUi" branding |
| `resources/aionui_logo_black_bg.svg` | (small) | Has "AionUi" branding |
| `resources/aionui-banner-1.png` | 112K | Demo |
| `resources/screenshot_1.png` | (med) | Demo |
| `resources/screenshot_2.png` | (med) | Demo |
| `resources/bannerimage.png` | 332K | Demo |
| `resources/homepage.png` | 392K | Demo |
| `resources/multi-model.png` | 196K | Demo |
| `resources/assitants.png` | 380K | Demo |
| `resources/ai-assistants-experts.png` | 256K | Demo |
| `resources/contactus-x.png` | (small) | China-specific (WeChat/X?) |
| `resources/openclawvia.png` | 256K | OpenClaw-specific — drop |
| `resources/llm_newapi.png` | 188K | Third-party service |
| `resources/wx-11.png` | 536K | WeChat specific — drop |
| `resources/linuxdo.png` | (small) | Chinese community |
| `resources/packycode.png` | (small) | Sponsorship |
| `resources/offica-ai BANNER-function.png` | 612K | Demo |
| `resources/alart-task.png` | 616K | Demo |
| `resources/bug-report-button.png` | 324K | Demo |
| `resources/webui banner.png` | 512K | Demo |
| `resources/webui-remote.png` | 356K | Demo |
| `resources/webui-remote-example.png` | 368K | Demo |
| `resources/file_generation_preview.png` | 1.1M | Demo |
| `resources/remote.png` | 4.0M | Demo |
| `resources/remote-telegram.png` | 1.2M | Demo |
| `resources/remote-telegram copy.png` | 1.2M | Demo (duplicate) |
| All the GIFs | (~500MB total) | Demo GIFs — will be regenerated |

**Total: ~28 marketing/readme assets. All dropped, will be regenerated with Headmaster branding + Headmaster screenshots when the product is ready.**

---

## Summary

| Category | Total | Action |
|---|---|---|
| App icons (A) | 9 | REPLACE all (placeholder for now) |
| Mascot states (B) | 21 | REPLACE all (the magic) |
| UI icons (C) | 7 | 4 keep, 3 replace |
| Channel logos (D) | 7 | 4 keep, 3 drop |
| Theme previews (E) | 6 | 1 replace, 5 decide |
| Marketing (F) | ~28 | DROP all, regenerate later |
| **TOTAL** | **78 media assets** | |

**For v1, we only need the 9 app icons (A) and 21 mascot states (B) replaced.** The rest can be placeholder or existing for now.

---

## What we need from design (or a design tool like Figma/Canva)

| Priority | Asset | Quantity | Source | Notes |
|---|---|---|---|---|
| P0 | GCAP shield logo (square) | 1 logo | brand mark | Multi-resolution export: 16, 32, 64, 128, 256, 512, 1024, .ico + .icns + .png |
| P0 | Sorting Hat mascot (21 states) | 21 SVGs | designer or AI gen | Each is a different pose. Style: friendly, slightly magical, dark green/black palette |
| P1 | Updated UI icons (3) | 3 SVGs | designer | Add-chat (scroll+plus), catalogue (hat), cowork (two people) |
| P2 | New marketing banner | 1 | when ready | Headmaster brand banner for the site |

---

## Notes for the designer / generation

- **Sorting Hat style guide:** friendly cartoon hat with eyes + a mouth, slight magical shimmer, dark green/black/cream palette (Slytherin-coded but not Hogwarts)
- **GCAP shield style:** simple geometric shield, "GCAP" text inside, dark green on cream, with a hint of gold/amber for "premium"
- **All vector (SVG) preferred** for mascot, PNG/ICO export for app icons
- **Keep them warm + accessible** — Lina-coded (meticulous, friendly, not corporate)

---

**Status: v1 inventory, ready for design handoff.**
