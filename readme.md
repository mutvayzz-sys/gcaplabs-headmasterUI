<p align="center">
  <img src="./resources/headmaster-banner-1.png" alt="Headmaster — Work Along with AI Specialists" width="100%">
</p>

<p align="center">
  <a href="https://gcaplabs.com/headmaster"><img src="https://img.shields.io/badge/Headmaster-by%20GCAP%20Labs-32CD32?style=for-the-square" alt="GCAP Labs"></a>
  &nbsp;
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-32CD32?style=flat-square&logo=apache&logoColor=white" alt="License: Apache-2.0"></a>
  &nbsp;
  <a href="https://gcaplabs.com/headmaster"><img src="https://img.shields.io/badge/website-gcaplabs.com-6C757D?style=flat-square" alt="Website"></a>
</p>

<p align="center">
  <strong>Headmaster is a Work Along desktop app for AI agents.</strong><br>
  <em>Built-in agent · Multi-agent · 17 messaging platforms · Scheduled automations · 24/7 unattended · Cross-platform</em>
</p>

<p align="center">
  <a href="https://github.com/mutvayzz-sys/gcaplabs-headmasterUI/releases">
    <img src="https://img.shields.io/badge/⬇️%20Download-Latest%20Release-32CD32?style=for-the-badge&logo=github&logoColor=white" alt="Download Latest Release" height="44">
  </a>
</p>

<p align="center">
  <strong>English</strong> | <a href="./docs/readme/readme_ch.md">简体中文</a> | <a href="./docs/readme/readme_tw.md">繁體中文</a> | <a href="./docs/readme/readme_jp.md">日本語</a> | <a href="./docs/readme/readme_ko.md">한국어</a> | <a href="./docs/readme/readme_es.md">Español</a> | <a href="./docs/readme/readme_pt.md">Português</a> | <a href="./docs/readme/readme_tr.md">Türkçe</a> | <a href="./docs/readme/readme_ru.md">Русский</a> | <a href="./docs/readme/readme_uk.md">Українська</a>
</p>

---

## What is Headmaster?

**Headmaster** is a desktop app that lets you work *alongside* AI agents on your computer. You see everything the agent does, approve the moves that matter, and let the rest run on autopilot. It's built for people who want the power of an autonomous agent without giving up control.

It is a white-label product by **GCAP Labs**, derived from the open-source [AionUi](https://github.com/iOfficeAI/AionUi) project (Apache-2.0). We add the Hermes Python runtime, the Headmaster palette and vocabulary, and the GCAP Labs identity.

- **Built-in agent** — zero setup. Paste an API key and you have a working agent with file access, web search, image generation, and MCP tools.
- **Multi-agent** — bring your own. Claude Code, Codex, Qwen Code, Hermes Agent, OpenClaw, Cursor Agent and more. Auto-detected, unified UI.
- **Multi-platform messaging** — Telegram, Discord, Slack, Lark, WeChat and 17+ more, all from one app.
- **Scheduled automations** — cron-driven, unattended 24/7. Define a task, set a schedule, walk away.
- **Persistent memory** — Honcho-backed, with an OpenConcho dashboard.
- **Cross-platform** — macOS, Windows, Linux.

---

## Quick start

### Install

Download the latest release for your platform:

| Platform | File |
|---|---|
| Windows | `Headmaster-2.1.18-win-x64.exe` (NSIS installer) or `Headmaster-2.1.18-win-x64.zip` (portable) |
| macOS | `Headmaster-2.1.18-macOS-*.dmg` |
| Linux | `Headmaster-2.1.18-linux-*.AppImage` |

Headless / web mode: `Headmaster-2.1.18-web-host-*.zip`.

### First run

1. Launch the app.
2. Paste an API key for any provider (OpenAI, Anthropic, Google, etc.) in **Settings → Providers**.
3. Open **New Mission** (the chat button) and start talking to the agent.

### Build from source

```bash
# Clone
git clone https://github.com/mutvayzz-sys/gcaplabs-headmasterUI.git
cd gcaplabs-headmasterUI

# Install
bun install

# Typecheck + bundle
bunx tsc --noEmit
bunx electron-vite build --config packages/desktop/electron.vite.config.ts

# Package (Windows)
node scripts/build-with-builder.js auto --win

# Or on macOS / Linux
node scripts/build-with-builder.js auto --mac
node scripts/build-with-builder.js auto --linux
```

Output lands in `out/`:

- `out/win-unpacked/Headmaster.exe` — portable (run this for testing)
- `out/Headmaster-2.1.18-win-x64.exe` — NSIS installer
- `out/Headmaster-2.1.18-win-x64.zip` — portable zip

The Hermes runtime is the default. AionCore is preserved as a legacy fallback only and is **not** required at build time.

---

## Runtime

Headmaster talks to a backend. The default is the **Hermes Python runtime** (`NousResearch/hermes-agent`), installed as part of first-run bootstrap. The runtime provides:

- A local HTTP/WS API on `127.0.0.1:9119` (default; `--port 0` to let the OS pick)
- 169 FastAPI routes + 4 WebSocket routes
- The same Hermes Agent CLI, gateway, and skills, packaged as a desktop front-end

If the Hermes venv is not found, Headmaster falls back to the legacy `aioncore` backend. The aioncore binary is **no longer shipped** — it lives only in older `aionui` releases. If you see an "installation incomplete" dialog, click **Continue Anyway** to proceed without the legacy backend; all Settings tabs (Memory, Runtime, Channels) work without it.

See [`docs/white-label/WHITE-LABEL-AUDIT.md`](./docs/white-label/WHITE-LABEL-AUDIT.md) for the full frontstuff-vs-runtime boundary.

---

## What's in this repo

- `packages/desktop/` — the Electron app (main + renderer + preload)
- `packages/web-host/` — headless web mode
- `packages/web-cli/` — CLI wrapper
- `packages/shared-scripts/` — build helpers (aioncore prepare, verify)
- `docs/` — architecture, contributing, white-label audit
- `resources/` — app icons, banners, mascot states
- `out/` — build artifacts (gitignored)
- `tests/` — Vitest unit + Playwright E2E

See [`AGENTS.md`](./AGENTS.md) for the full directory map.

---

## White-label notes

If you're forking this for your own company:

1. Run `bun run i18n:types` to regenerate the i18n key types after renaming anything in `locales/`.
2. Read [`docs/white-label/WHITE-LABEL-AUDIT.md`](./docs/white-label/WHITE-LABEL-AUDIT.md) before touching anything in `packages/desktop/src/process/`.
3. The Headmaster vocabulary (Work Along, The Council, The Specialists, etc.) is locked. See [`docs/white-label/HEADMASTER-VOCABULARY.csv`](./docs/white-label/HEADMASTER-VOCABULARY.csv).
4. The brand assets (Sorting Hat mascot, GCAP shield, custom icons) are placeholders. See [`docs/white-label/HEADMASTER-ASSET-INVENTORY.md`](./docs/white-label/HEADMASTER-ASSET-INVENTORY.md).

---

## Contributing

- Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) before opening a PR.
- Use `just push` (or `just push -u origin feat/branch`) for the full lint → format → typecheck → test → push pipeline.
- Don't add AI co-author signatures.
- See [`AGENTS.md`](./AGENTS.md) for the AI agent conventions.

---

## License

Apache-2.0. See [`LICENSE`](./LICENSE).

This is a white-label derivative of [AionUi](https://github.com/iOfficeAI/AionUi), originally Copyright 2025 AionUi (aionui.com), also Apache-2.0.

---

## About GCAP Labs

GCAP Labs builds AI agent products for organizations. Headmaster is our persistent desktop agent. Learn more at [gcaplabs.com](https://gcaplabs.com).
