# GCAP-Labs Deep Wiki

> Comprehensive documentation for the GCAP-Labs monorepo workspace. This document provides a complete overview of the architecture, build processes, dependencies, and development workflows across all projects in the workspace.

---

## Table of Contents

1. [Workspace Overview](#workspace-overview)
2. [Project Architecture](#project-architecture)
3. [Directory Structure](#directory-structure)
4. [Headmaster Desktop](#headmaster-desktop)
5. [GCAP Labs Marketing Site](#gcap-labs-marketing-site)
6. [Headmaster Hub](#headmaster-hub)
7. [Hermes Runtime](#hermes-runtime)
8. [Runtime Recon](#runtime-recon)
9. [Build Processes](#build-processes)
10. [Development Workflows](#development-workflows)
11. [Cross-Project Dependencies](#cross-project-dependencies)
12. [Key Conventions](#key-conventions)
13. [Troubleshooting](#troubleshooting)
14. [UI Panels & Navigation Audit](#ui-panels--navigation-audit)
15. [Upstream Assets & Reference Implementations](#upstream-assets--reference-implementations)
16. [Hermes Runtime — Configurable Options](#hermes-runtime--configurable-options)
17. [Browser Tool Capabilities (Hermes)](#browser-tool-capabilities-hermes)
18. [Recent Changes Log](#recent-changes-log)

---

## Workspace Overview

### Purpose

The GCAP-Labs workspace is the development root for the **Headmaster** product line — a white-label implementation of the Hermes Agent (by Nous Research) under the GCAP Labs brand. This monorepo contains multiple products that share common infrastructure but serve different purposes:

1. **Headmaster Desktop** — The main Electron application (primary build target)
2. **Headmaster Hub** — Web-based companion application
3. **GCAP Labs Marketing Site** — Public-facing website (gcaplabs.com)
4. **Hermes Runtime** — Python backend agent runtime
5. **Runtime Recon** — Reconnaissance and reconciliation documentation

### Product Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    GCAP-Labs Workspace                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │ Headmaster       │    │ Headmaster Hub   │               │
│  │ Desktop          │    │ (Web App)        │               │
│  │ (Electron + TS)  │    │ (Extensions)     │               │
│  └────────┬─────────┘    └────────┬─────────┘               │
│           │                       │                          │
│           └───────────┬───────────┘                          │
│                       │                                      │
│           ┌───────────▼───────────┐                          │
│           │   Hermes Runtime      │                          │
│           │  (Python Dashboard)   │                          │
│           └───────────────────────┘                          │
│                                                               │
│  ┌──────────────────┐    ┌──────────────────┐               │
│  │ Marketing Site   │    │ Runtime Recon    │               │
│  │ (Next.js 15)     │    │ (Documentation)  │               │
│  └──────────────────┘    └──────────────────┘               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Git Remotes

| Project | Local Path | GitHub Remote | Visibility |
|---------|-----------|---------------|------------|
| Headmaster Desktop | `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/` | `gcaplabs-headmasterUI` | Private |
| Headmaster Hub | `headmaster-hub/` | `mutvayzz-sys/gcaplabs-headmasterhub` | Private |
| Marketing Site | `gcaplabs-site/` | `mutvayzz-sys/gcaplabs-site` | Private |
| Hermes Runtime | `runtime/hermes-agent/` | `NousResearch/hermes-agent` | Public |

---

## Project Architecture

### Technology Stack

#### Headmaster Desktop
- **Framework**: Electron 37.10.3
- **Build**: Vite 6.4.1 + electron-vite 5.0.0
- **UI Framework**: React 19.1.0 + Arco Design 2.66.1
- **Language**: TypeScript 5.8.3
- **Styling**: UnoCSS 66.3.3 + CSS Modules
- **State**: SWR 2.3.6 + React hooks
- **Database**: better-sqlite3 12.4.1
- **Testing**: Vitest 4.0.18 + Playwright 1.59.1

#### Marketing Site
- **Framework**: Next.js 16.2.6 (App Router)
- **UI**: React 19.2.4 + Fumadocs UI
- **Styling**: Tailwind CSS 4
- **Animation**: GSAP 3.15.0 + Framer Motion 12.40.0
- **Language**: TypeScript 5

#### Hermes Runtime
- **Language**: Python 3.x
- **Framework**: FastAPI (dashboard server)
- **Server**: Uvicorn
- **Architecture**: Agent-core with plugin system

### Process Architecture (Headmaster Desktop)

Headmaster Desktop follows Electron's multi-process architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Process                              │
│  (packages/desktop/src/process/)                             │
│  - Window management                                         │
│  - Backend spawning (Hermes dashboard)                       │
│  - File system access                                        │
│  - Native modules                                            │
│  - IPC bridge to renderer                                    │
└────────────────────┬────────────────────────────────────────┘
                     │ IPC Bridge
                     │ (packages/desktop/src/preload/)
┌────────────────────▼────────────────────────────────────────┐
│                  Renderer Process                            │
│  (packages/desktop/src/renderer/)                            │
│  - React UI components                                       │
│  - Arco Design components                                    │
│  - State management (SWR)                                    │
│  - WebSocket client (Hermes dashboard)                       │
│  - No Node.js APIs                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
GCAP-Labs/
├── gcaplabs-headmaster/repo/gcaplabs-headmasterUI/          # Main Electron app (build target)
│   ├── packages/
│   │   ├── desktop/            # Electron main + renderer
│   │   ├── web-host/           # Web hosting package
│   │   ├── web-cli/            # Web CLI tools
│   │   └── shared-scripts/     # Shared build scripts
│   ├── docs/                   # Documentation
│   │   ├── white-label/        # Branding & naming conventions
│   │   ├── contributing/       # Contribution guidelines
│   │   ├── guides/             # User & dev guides
│   │   └── theming/            # Theme documentation
│   ├── scripts/                # Build & utility scripts
│   ├── tests/                  # Test suites
│   └── out/                    # Build output
│
├── gcaplabs-site/              # Marketing site (Next.js 15)
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # React components
│   ├── docs/                   # Documentation content
│   └── public/                 # Static assets
│
├── headmaster-hub/             # Headmaster Hub web app
│   ├── extensions/             # Hub extensions
│   └── scripts/                # Hub scripts
│
├── runtime/                    # Runtime references
│   └── hermes-agent/           # Canonical Hermes Python runtime
│       ├── agent/              # Agent internals
│       ├── gateway/            # Messaging gateway
│       ├── hermes_cli/         # CLI commands
│       ├── plugins/            # Plugin system
│       ├── skills/             # Built-in skills
│       ├── tools/              # Tool implementations
│       └── web/                # Web dashboard
│
├── runtime-recon/               # Runtime reconnaissance
│   ├── RECON.md                # Hermes runtime ground truth
│   └── reconcile.md            # Plan vs reality reconciliation
│
├── .claude/                    # Claude AI tool config
├── .devin/                     # Devin AI tool config
│
├── AGENTS.md                   # Workspace directory map
├── INDEX.md                    # Project overview & where to start
└── DEEP-WIKI.md                # This file
```

---

## Headmaster Desktop

### Overview

Headmaster Desktop is the primary build target — an Electron application that provides a desktop interface for the Hermes AI agent. It's a white-label implementation based on AionUi (Apache-2.0) with the Hermes Python runtime.

### Key Features

- **Multi-agent collaboration** — "The Council" mode for team-based AI work
- **Work Along mode** — Interactive AI assistance
- **Hands-Off mode** — Autonomous AI execution
- **Skills Marketplace** — "The Agency" for skill discovery
- **Memory integration** — Persistent context across sessions
- **Document processing** — Support for various file formats
- **Terminal integration** — Embedded terminal for command execution
- **Browser embedding** — Webview for web-based tasks

### Package Structure

#### `packages/desktop/`
The main Electron application package containing:

- **`src/process/`** — Main process code
  - Backend spawning and management
  - Window lifecycle
  - IPC handlers
  - File system operations
  - Native module loading

- **`src/renderer/`** — Renderer process code
  - React components and pages
  - State management (SWR)
  - WebSocket client for Hermes dashboard
  - UI components (Arco Design)
  - Theme system

- **`src/preload/`** — Preload scripts
  - IPC bridge between main and renderer
  - Exposed APIs via contextBridge
  - Security sandbox

- **`src/common/`** — Shared code
  - Type definitions
  - Utility functions
  - Configuration
  - Internationalization (i18n)

### Build Configuration

#### Electron Vite Config
Located at `packages/desktop/electron.vite.config.ts`:
- Builds main process, preload, and renderer separately
- Handles TypeScript compilation
- Configures asset copying
- Sets up development vs production builds

#### Package.json Scripts

```bash
# Development
bun run dev                  # Start Electron dev server
bun run start                # Alias for dev
bun run start:multi          # Multi-instance mode

# Building
bun run package              # Build with electron-vite
bun run dist                 # Package for current platform
bun run dist:win             # Windows build
bun run dist:mac             # macOS build
bun run dist:linux           # Linux build

# Code Quality
bun run lint                 # Run oxlint
bun run lint:fix             # Auto-fix lint issues
bun run format               # Format with oxfmt
bunx tsc --noEmit            # Type check

# Testing
bun run test                 # Run Vitest tests
bun run test:coverage        # With coverage report
bun run test:e2e             # Playwright E2E tests

# Internationalization
bun run i18n:types           # Generate i18n types
node scripts/check-i18n.js   # Validate i18n keys
```

### UI Framework & Components

#### Arco Design
- Primary UI component library
- Components: Button, Input, Modal, Table, Form, etc.
- Theme overrides in `src/renderer/styles/arco-override.css`
- Global styles in `src/renderer/styles/`

#### Icons
- Library: `@icon-park/react`
- Additional: `@iconify/react`, `@phosphor-icons/react`
- Icon usage: Import and use as React components

#### Styling System
- **Primary**: UnoCSS utility classes
- **Complex styles**: CSS Modules (`ComponentName.module.css`)
- **Semantic tokens**: Defined in `uno.config.ts`
- **Colors**: Use CSS variables, no hardcoded values

### Code Conventions

#### Naming
- **Components**: PascalCase (`Button.tsx`, `Modal.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Hooks**: camelCase with `use` prefix (`useTheme.ts`)
- **Constants**: camelCase file (`constants.ts`) with UPPER_SNAKE_CASE values
- **Types**: camelCase (`types.ts`)
- **Style files**: kebab-case or `ComponentName.module.css`

#### TypeScript
- Strict mode enabled
- No `any` types
- No implicit returns
- Path aliases: `@/*`, `@process/*`, `@renderer/*`
- Prefer `type` over `interface`
- JSDoc for public functions

#### File Structure
- Maximum 10 direct children per directory
- Split by responsibility when approaching limit
- Follow the `architecture` skill guidelines

### Internationalization (i18n)

#### Configuration
- Languages and modules: `packages/desktop/src/common/config/i18n-config.json`
- All user-facing text must use i18n keys
- No hardcoded strings in UI

#### Workflow
1. Add i18n key to configuration
2. Use key in components via `t()` function
3. Run `bun run i18n:types` to generate TypeScript types
4. Run `node scripts/check-i18n.js` to validate

#### Key Naming
- Use dot notation: `module.category.key`
- Be descriptive and specific
- Follow existing patterns

### Architecture Constraints

#### Process Separation
- **Main process** (`src/process/`): No DOM APIs
- **Renderer process** (`src/renderer/`): No Node.js APIs
- **IPC bridge** (`src/preload/`): Cross-process communication

#### Security
- Context isolation enabled
- Node integration disabled in renderer
- Sandbox for untrusted content
- Secure IPC communication

### White-Label Compliance

#### Forbidden Terms (in UI)
- AionUi, aionui, AionUi Desktop
- iOfficeAI
- aionrs, aioncore, Adonis Core (user-facing)
- Cowork, Cowork Mode
- Team Mode
- Run (as noun), YOLO Mode, Full-Auto Mode
- New Chat, Teammates
- Specific specialist names (Patrick, Marco, Maya, etc.)

#### Required Terms
- **Headmaster**, **Headmaster Desktop** (app name)
- **GCAP Labs** (company)
- **Adonis** (backend, technical only)
- **Work Along** (mode), "work along" (verb)
- **The Council** (multi-agent mode)
- **Run It Yourself** (mode), "run it" (verb)
- **Hands-Off** (mode), **Autopilot** (mode)
- **New Mission** (button)
- **Specialists** (agents)
- **The Headmaster** (orchestrator)
- **The Council Chamber** (shared task board)
- **The Agency** (skills marketplace)
- **Founding Skills** (built-in), **Your Skills** (custom)
- Specific specialist titles (The Writer, The Storyteller, etc.)

#### Allowed Hermes References
- Env var names: `HERMES_HOME`, `HERMES_DESKTOP_*`
- URL scheme: `hermes-media://`
- Directory: `~/.hermes/hermes-agent/`
- Commands: `hermes dashboard`, `hermes gateway`, etc.
- Python entrypoint: `hermes` console script

### Testing

#### Framework
- **Unit tests**: Vitest 4.0.18
- **E2E tests**: Playwright 1.59.1
- **Coverage target**: ≥ 80%

#### Test Structure
```
tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
├── contract/          # Contract tests
└── e2e/              # End-to-end tests
    └── cases/        # E2E test cases
```

#### Running Tests
```bash
bun run test                 # All tests
bun run test:coverage        # With coverage
bun run test:e2e             # E2E tests
bun run test:integration     # Integration tests
```

---

## GCAP Labs Marketing Site

### Overview

The marketing site is the public-facing website for GCAP Labs, built with Next.js 15 App Router. It serves as the primary web presence for the Headmaster product.

### Technology Stack

- **Framework**: Next.js 16.2.6 (App Router)
- **UI**: React 19.2.4
- **Documentation**: Fumadocs UI 16.9.3
- **Styling**: Tailwind CSS 4
- **Animation**: GSAP 3.15.0 + Framer Motion 12.40.0
- **Smooth Scroll**: Lenis 1.3.23
- **Icons**: Lucide React 1.16.0 + React Icons 5.6.0
- **Font**: Geist 1.7.2

### Directory Structure

```
gcaplabs-site/
├── app/                    # Next.js App Router
│   ├── (marketing)/        # Marketing pages
│   ├── docs/              # Documentation pages
│   └── layout.tsx          # Root layout
├── components/             # React components
├── docs/                   # Documentation content
├── public/                 # Static assets
└── package.json           # Dependencies
```

### Build Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Key Features

- **Marketing pages**: Product information, features, pricing
- **Documentation**: Integrated docs with Fumadocs
- **Responsive design**: Mobile-first approach
- **Performance**: Optimized with Next.js App Router
- **Analytics**: Vercel Analytics integration

---

## Headmaster Hub

### Overview

Headmaster Hub is a separate web application that extends the Headmaster ecosystem. It has its own git repository and serves as a companion to the desktop application.

### Directory Structure

```
headmaster-hub/
├── extensions/             # Hub extensions
└── scripts/                # Hub utility scripts
```

### Purpose

- Extend Headmaster functionality
- Provide web-based features
- Support integration workflows

---

## Hermes Runtime

### Overview

The Hermes runtime is the Python-based AI agent that powers Headmaster. It's the canonical checkout from NousResearch/hermes-agent and serves as the backend for the desktop application.

### Key Components

#### Core Agent
- **`run_agent.py`** — AIAgent class, core conversation loop (~12k LOC)
- **`model_tools.py`** — Tool orchestration and function call handling
- **`toolsets.py`** — Toolset definitions and core tools list
- **`cli.py`** — HermesCLI class, interactive CLI orchestrator (~11k LOC)

#### State & Storage
- **`hermes_state.py`** — SessionDB, SQLite session store with FTS5 search
- **`hermes_constants.py`** — Profile-aware path utilities
- **`hermes_logging.py`** — Profile-aware logging setup

#### Dashboard Server
- **`hermes_cli/web_server.py`** — FastAPI HTTP+WS server (169 routes + 4 WS)
- **Entry point**: `hermes dashboard` command
- **Default port**: 9119 (configurable via `--port`)
- **Auth**: Per-launch session token

#### Gateway
- **`gateway/run.py`** — Multi-platform messaging daemon
- **Platforms**: Telegram, Discord, Slack, WhatsApp, Signal, and more
- **Note**: Separate from dashboard, not required for Headmaster v1

### Directory Structure

```
hermes-agent/
├── agent/                  # Agent internals
│   ├── memory/            # Memory providers
│   ├── providers/         # Model provider adapters
│   └── caching/           # Caching and compression
├── gateway/                # Messaging gateway
│   ├── platforms/         # Platform adapters
│   └── builtin_hooks/     # Gateway extension points
├── hermes_cli/             # CLI commands
│   ├── web_server.py      # Dashboard server
│   └── subcommands/       # CLI subcommands
├── tools/                  # Tool implementations
│   ├── environments/      # Terminal backends
│   └── registry.py       # Tool discovery
├── plugins/                # Plugin system
│   ├── memory/            # Memory plugins
│   ├── context_engine/    # Context engine plugins
│   ├── model-providers/   # Provider plugins
│   └── kanban/            # Multi-agent board
├── skills/                 # Built-in skills
├── optional-skills/        # Optional/niche skills
├── ui-tui/                 # Terminal UI (Ink/React)
├── tui_gateway/            # TUI backend
├── acp_adapter/            # VS Code/Zed/JetBrains integration
├── cron/                   # Scheduler
├── scripts/                # Utility scripts
├── tests/                  # Pytest suite (~17k tests)
└── web/                    # Dashboard React SPA
```

### API Endpoints

#### HTTP Routes (169 total)
Key endpoint categories:
- **Files & Media**: 10 routes
- **Status & System**: 8 routes
- **Audio**: 3 routes
- **Actions**: 1 route
- **Sessions**: 12 routes
- **Config**: 12 routes
- **Messaging/Channels**: 6 routes
- **Providers/OAuth**: 7 routes
- **Logs**: 1 route
- **Cron/Schedules**: 10 routes
- **MCP**: 6 routes
- **Pairing/Auth**: 4 routes
- **Webhooks**: 5 routes
- **Gateway control**: 3 routes
- **Credentials pool**: 3 routes
- **Memory**: 3 routes
- **Skills Hub**: 5 routes

#### WebSocket Endpoints (4 total)
- **`/api/ws`** — Main chat WebSocket (primary for desktop)
- **`/api/pty`** — Embedded terminal over WebSocket
- **`/api/pub`** — Pub/sub event bus
- **`/api/events`** — Generic event stream

### CLI Commands

Key commands exposed via `hermes --help`:
- `hermes chat` — Interactive TUI chat
- `hermes dashboard` — FastAPI HTTP+WS server (primary for Headmaster)
- `hermes gateway` — Messaging daemon (separate product)
- `hermes model` — Model picker
- `hermes setup/config/env` — Configuration management
- `hermes cron` — Scheduled task management
- `hermes skills` — Skill management
- `hermes memory` — Memory provider management
- `hermes mcp` — MCP server management
- `hermes webhooks` — Webhook management
- `hermes providers` — Model provider management
- `hermes credentials` — API key pool management
- `hermes voice/listen/speak` — Voice integration
- `hermes update` — Self-update
- `hermes service` — System service management

### Configuration

#### User Config
- **Settings**: `~/.hermes/config.yaml`
- **API Keys**: `~/.hermes/.env` (secrets only)
- **Logs**: `~/.hermes/logs/` (profile-aware)

#### Environment Variables
- `HERMES_HOME` — Root data directory
- `HERMES_DASHBOARD` — Enable dashboard mode
- `HERMES_DASHBOARD_PORT` — Port override
- `HERMES_DASHBOARD_FILES_ROOT` — File browser root
- `HERMES_DASHBOARD_SESSION_TOKEN` — Per-launch auth token

### Installation

#### Bootstrap
The `hermes_bootstrap.py` script handles first-time installation:
1. Clones the hermes-agent repository
2. Creates Python virtual environment
3. Runs `pip install -e .`
4. Generates `hermes` console script

#### Binary Resolution
Search order for Headmaster:
1. `HERMES_HOME` environment variable
2. `HERMES_HOME/venv/bin/hermes` (POSIX) or `venv/Scripts/hermes.exe` (Windows)
3. `HERMES_HOME/hermes-agent/` source directory + venv pattern
4. Emit "not installed" if not found

---

## Runtime Recon

### Overview

The runtime-recon directory contains reconnaissance and reconciliation documentation for the Hermes runtime. These documents provide ground truth about the actual Hermes implementation versus planned assumptions.

### Key Documents

#### RECON.md
- **Purpose**: Ground truth for Hermes runtime
- **Content**: 
  - Process architecture (gateway vs dashboard)
  - Complete endpoint catalog (169 routes)
  - WebSocket endpoints (4 total)
  - CLI command surface
  - Binary resolution details
  - Spawn patterns for Headmaster integration

#### reconcile.md
- **Purpose**: Audit trail of plan vs reality corrections
- **Content**:
  - 14 findings with corrections
  - Path corrections (chat, assistants, teams, etc.)
  - Open items deferred to live probe
  - Live probe plan for verification

### Key Corrections from Recon

1. **Wrong process**: Plan assumed `hermes gateway`, should be `hermes dashboard`
2. **Port flag**: Uses `--port` not `--port-pool`
3. **Chat endpoint**: No REST, uses WebSocket only
4. **Missing endpoints**: No `/api/assistants`, `/api/agents`, `/api/teams`
5. **Model endpoints**: Different shape than planned
6. **Tool endpoint**: No `/api/tools`, use MCP catalog instead
7. **Auth**: Requires per-launch session token
8. **Runtime**: Python venv, not single binary
9. **Browser CDP**: No browser event stream in Hermes
10. **Endpoint count**: 169 routes, not 140+

---

## Build Processes

### Headmaster Desktop Build

#### Type Check
```bash
bunx tsc --noEmit
```

#### Development Build
```bash
bun run dev
```
- Starts Electron with hot reload
- Runs Vite dev server for renderer
- Enables source maps
- Watches for file changes

#### Production Build
```bash
# Build renderer + main + preload
bunx electron-vite build --config packages/desktop/electron.vite.config.ts

# Package as installer
node scripts/build-with-builder.js auto --win
```

#### Build Output
Located in `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/out/`:
- `out/win-unpacked/Headmaster.exe` — Portable executable
- `out/Headmaster-0.1.2-win-x64.exe` — NSIS installer
- `out/Headmaster-0.1.2-win-x64.zip` — Portable archive

#### Build Wrapper
Uses `run-headmaster-dist-win-hermes.bat` which sets:
```bash
HEADMASTER_RUNTIME=hermes
```

### Marketing Site Build

#### Development
```bash
npm run dev
```
- Starts Next.js dev server
- Hot module replacement
- Source maps enabled

#### Production
```bash
npm run build        # Build with Webpack
npm run start        # Start production server
```

### Quality Checks

#### Linting
```bash
# Headmaster Desktop
bun run lint         # Check lint
bun run lint:fix     # Auto-fix issues

# Marketing Site
npm run lint         # ESLint
```

#### Formatting
```bash
# Headmaster Desktop
bun run format           # Format all files
bun run format:check     # Check formatting

# Uses oxfmt (Prettier-compatible)
# - Single-element arrays inline
# - Trailing commas in multi-line
# - Single quotes for strings
```

#### Type Checking
```bash
# Headmaster Desktop
bunx tsc --noEmit    # Verify no type errors
```

#### Testing
```bash
# Headmaster Desktop
bun run test                 # Unit tests
bun run test:coverage        # With coverage
bun run test:e2e             # E2E tests
```

### Pre-commit Hooks

Headmaster Desktop uses Husky for pre-commit hooks:
- Lint staged files
- Format staged files
- Run checks before commit

---

## Development Workflows

### Headmaster Desktop Development

#### Initial Setup
```bash
cd gcaplabs-headmaster/repo/gcaplabs-headmasterUI
bun install                  # Install dependencies
```

#### Development Cycle
```bash
# 1. Start development server
bun run dev

# 2. Make changes
# - Edit files in packages/desktop/src/
# - Changes hot-reload automatically

# 3. Auto-fix issues
bun run lint:fix
bun run format

# 4. Type check
bunx tsc --noEmit

# 5. If touching i18n
bun run i18n:types
node scripts/check-i18n.js
```

#### Before Pushing
```bash
# Use just push instead of git push
just push                    # Lint → format → typecheck → test → push
just push -u origin feat/branch  # With extra args
```

#### PR Workflow
1. Create feature branch
2. Make changes and commit
3. Run `just push` for quality checks
4. Create PR via GitHub
5. Wait for CI approval
6. Merge after review

### Marketing Site Development

#### Initial Setup
```bash
cd gcaplabs-site
npm install                  # Install dependencies
```

#### Development Cycle
```bash
# 1. Start development server
npm run dev

# 2. Make changes
# - Edit files in app/ or components/
# - Changes hot-reload automatically

# 3. Build for production
npm run build

# 4. Test production build
npm run start
```

### Hermes Runtime Development

#### Initial Setup
```bash
cd runtime/hermes-agent
python -m venv .venv         # Create virtual environment
source .venv/bin/activate    # Activate (POSIX)
# or .venv\Scripts\activate (Windows)
pip install -e .             # Install in development mode
```

#### Testing
```bash
# Run tests
./scripts/run_tests.sh       # Probes .venv automatically

# Specific test categories
pytest tests/unit/
pytest tests/integration/
```

#### Dashboard Testing
```bash
# Start dashboard
hermes dashboard --no-open --port 0

# Probe endpoints
curl http://127.0.0.1:9119/api/status
curl http://127.0.0.1:9119/api/sessions
```

---

## Cross-Project Dependencies

### Headmaster Desktop → Hermes Runtime

#### Integration Points
1. **Backend Spawning**
   - Headmaster spawns `hermes dashboard` process
   - Resolves binary from `HERMES_HOME/venv/bin/hermes`
   - Parses stdout for `HERMES_DASHBOARD_READY port={N}`

2. **WebSocket Communication**
   - Renderer connects to `ws://127.0.0.1:{port}/api/ws?token={token}`
   - Uses per-launch session token for authentication
   - Real-time chat streaming

3. **HTTP API Calls**
   - REST API calls to `/api/*` endpoints
   - Includes `Authorization: Bearer {token}` header
   - Fetches sessions, config, profiles, etc.

#### Critical Dependencies
- **Dashboard Process**: Must be running for desktop to function
- **Session Token**: Required for WebSocket and HTTP auth
- **Port Discovery**: Dynamic port assignment via stdout parsing
- **HERMES_HOME**: Must be set correctly for binary resolution

### Marketing Site → Headmaster Desktop

#### Integration Points
1. **Documentation Links**
   - Site links to desktop documentation
   - Cross-references features and capabilities

2. **Download Links**
   - Site provides download links for desktop installers
   - Links to GitHub releases

3. **Brand Consistency**
   - Shared vocabulary and terminology
   - Consistent visual identity

### Headmaster Hub → Headmaster Desktop

#### Integration Points
1. **Extension System**
   - Hub extends desktop functionality
   - Shared extension APIs

2. **Data Sync**
   - Potential sync of user data
   - Shared authentication

---

## Key Conventions

### File Naming

#### Headmaster Desktop
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Hooks: `useCamelCase.ts`
- Constants: `camelCase.ts` with `UPPER_SNAKE_CASE` values
- Types: `camelCase.ts`
- Styles: `kebab-case.css` or `ComponentName.module.css`

### Directory Organization

#### Size Limits
- Maximum 10 direct children per directory
- Split by responsibility when approaching limit
- Use subdirectories to organize

#### Process Separation
- Main process: `packages/desktop/src/process/`
- Renderer process: `packages/desktop/src/renderer/`
- Preload: `packages/desktop/src/preload/`
- Common: `packages/desktop/src/common/`

### Code Style

#### TypeScript
- Strict mode enabled
- No `any` types
- Path aliases: `@/*`, `@process/*`, `@renderer/*`
- Prefer `type` over `interface`
- JSDoc for public functions

#### React/JSX
- Functional components preferred
- Hooks for state management
- Arco Design components for UI
- UnoCSS for styling utilities

#### CSS
- UnoCSS utility classes preferred
- CSS Modules for complex styles
- Semantic color tokens
- No hardcoded values

### Git Conventions

#### Commit Format
```
<type>(<scope>): <subject>
```

Types: feat, fix, refactor, chore, docs, test, style, perf

#### No AI Signatures
- Do NOT add "Co-Authored-By"
- Do NOT add "Generated with"
- Clean commit messages only

### Internationalization

#### All User-Facing Text
- Must use i18n keys
- No hardcoded strings
- Centralized in `i18n-config.json`

#### Key Format
- Dot notation: `module.category.key`
- Descriptive and specific
- Follow existing patterns

### White-Label Compliance

#### Forbidden Terms (User-Facing)
- AionUi, aionui, iOfficeAI
- aionrs, aioncore, Adonis Core (user-facing)
- Cowork, Team Mode, YOLO Mode
- New Chat, Teammates
- Specific specialist names

#### Required Terms
- Headmaster, Headmaster Desktop
- GCAP Labs
- Work Along, The Council
- Run It Yourself, Hands-Off, Autopilot
- New Mission, Specialists
- The Headmaster, The Council Chamber
- The Agency, Founding Skills, Your Skills

---

## Troubleshooting

### Common Issues

#### Headmaster Desktop Won't Start

**Symptoms**: Application fails to launch or shows errors

**Solutions**:
1. Check if Hermes dashboard is running
2. Verify `HERMES_HOME` environment variable
3. Check logs in `%APPDATA%\Headmaster\logs\YYYY-MM-DD.log`
4. Ensure Python venv exists at `HERMES_HOME/venv/bin/hermes`
5. Try running `hermes dashboard` manually to test runtime

#### Hermes Dashboard Not Found

**Symptoms**: "Hermes not installed" error

**Solutions**:
1. Run `hermes_bootstrap.py` to install Hermes
2. Verify `HERMES_HOME` is set correctly
3. Check if venv exists: `HERMES_HOME/venv/bin/hermes`
4. Manual install: `cd HERMES_HOME && python -m venv venv && venv/bin/pip install -e .`

#### WebSocket Connection Failed

**Symptoms**: Chat not connecting, WebSocket errors

**Solutions**:
1. Verify dashboard is running: `curl http://127.0.0.1:9119/api/status`
2. Check session token is valid
3. Ensure correct port is used
4. Check firewall/antivirus settings
5. Verify WebSocket URL format: `ws://127.0.0.1:{port}/api/ws?token={token}`

#### Build Failures

**Symptoms**: Build errors during `bun run dist`

**Solutions**:
1. Run `bunx tsc --noEmit` to check type errors
2. Run `bun run lint:fix` to fix lint issues
3. Run `bun run format` to format code
4. Clear node_modules and reinstall: `rm -rf node_modules && bun install`
5. Check Electron version compatibility

#### i18n Errors

**Symptoms**: Missing translation keys, type errors

**Solutions**:
1. Run `bun run i18n:types` to regenerate types
2. Run `node scripts/check-i18n.js` to validate keys
3. Check `i18n-config.json` for missing keys
4. Ensure all user-facing text uses i18n keys

### Testing Issues

#### Test Failures

**Symptoms**: Tests failing unexpectedly

**Solutions**:
1. Run tests in verbose mode: `bun run test --verbose`
2. Clear test cache: `rm -rf node_modules/.vitest`
3. Update test snapshots if needed
4. Check test environment setup
5. Verify dependencies are up to date

#### E2E Test Failures

**Symptoms**: Playwright tests failing

**Solutions**:
1. Run headed mode to see browser: `bun run test:e2e --headed`
2. Check if application is built: `bun run package`
3. Verify test selectors are correct
4. Check timeouts and waiting strategies
5. Update Playwright if needed

### Performance Issues

#### Slow Startup

**Symptoms**: Application takes long to start

**Solutions**:
1. Check if Hermes dashboard is slow to start
2. Disable extensions if any
3. Clear application cache
4. Check system resources
5. Run startup benchmark: `bun run bench:startup`

#### High Memory Usage

**Symptoms**: Application using excessive memory

**Solutions**:
1. Check for memory leaks in renderer
2. Monitor WebSocket connections
3. Clear old sessions
4. Check database size
5. Profile with DevTools

### Platform-Specific Issues

#### Windows-Specific

**Symptoms**: Windows-specific errors

**Solutions**:
1. Check Windows Defender/antivirus exclusions
2. Verify Python scripts have execute permissions
3. Check Windows path length limits
4. Ensure correct venv Scripts directory
5. Run as administrator if needed

#### macOS-Specific

**Symptoms**: macOS-specific errors

**Solutions**:
1. Check code signing if built
2. Verify macOS permissions
3. Check Gatekeeper settings
4. Ensure correct venv bin directory
5. Check macOS security settings

#### Linux-Specific

**Symptoms**: Linux-specific errors

**Solutions**:
1. Check library dependencies
2. Verify execute permissions
3. Check SELinux/AppArmor settings
4. Ensure correct venv bin directory
5. Check display server settings

### Log Analysis

#### Headmaster Desktop Logs
- **Location**: `%APPDATA%\Headmaster\logs\YYYY-MM-DD.log` (Windows)
- **Content**: Application logs, errors, debug info
- **Use**: Check for startup issues, runtime errors

#### Hermes Logs
- **Location**: `~/.hermes/logs/` (profile-aware)
- **Files**: `agent.log`, `errors.log`, `gateway.log`
- **Content**: Runtime logs, API requests, agent activity
- **Use**: Check dashboard issues, API errors

#### Browser Console
- **Access**: Open DevTools in renderer
- **Content**: JavaScript errors, network requests
- **Use**: Debug UI issues, WebSocket problems

### Getting Help

#### Documentation
- **AGENTS.md**: Workspace directory map
- **INDEX.md**: Project overview
- **DEEP-WIKI.md**: This comprehensive guide
- **Headmaster docs**: `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/docs/`
- **Hermes docs**: `runtime/hermes-agent/docs/`

#### Knowledge Base
- **Location**: `G:\Vault\KBs\headmasterui-kb\`
- **Index**: `_MOC.md`
- **Content**: Structured knowledge base, decisions, context

#### Honcho Memory
- **Auto-injected**: Long-term facts about user and project
- **Context**: Project decisions, user preferences

---

## Appendix

### Quick Reference

#### Headmaster Desktop Commands
```bash
cd gcaplabs-headmaster/repo/gcaplabs-headmasterUI
bun run dev                  # Start dev server
bun run lint:fix             # Fix lint issues
bun run format               # Format code
bunx tsc --noEmit            # Type check
bun run test                 # Run tests
just push                    # Push with checks
```

#### Marketing Site Commands
```bash
cd gcaplabs-site
npm run dev                  # Start dev server
npm run build                # Build for production
npm run start                # Start production server
```

#### Hermes Commands
```bash
hermes dashboard --no-open --port 0    # Start dashboard
hermes logs --follow                   # Follow logs
hermes setup                           # Run setup wizard
```

### File Locations

#### Configuration Files
- **Headmaster config**: `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/packages/desktop/src/common/config/`
- **Hermes config**: `~/.hermes/config.yaml`
- **i18n config**: `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/packages/desktop/src/common/config/i18n-config.json`
- **UnoCSS config**: `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/uno.config.ts`

#### Build Outputs
- **Headmaster**: `gcaplabs-headmaster/repo/gcaplabs-headmasterUI/out/`
- **Marketing site**: `gcaplabs-site/.next/`

#### Logs
- **Headmaster**: `%APPDATA%\Headmaster\logs\` (Windows)
- **Hermes**: `~/.hermes/logs/`

### Environment Variables

#### Headmaster Desktop
- `HEADMASTER_RUNTIME=hermes` — Use Hermes runtime
- `AIONUI_MULTI_INSTANCE=1` — Allow multiple instances
- `PERF_MONITOR=1` — Enable performance monitoring
- `ACP_PERF=1` — Enable ACP performance tracking

#### Hermes
- `HERMES_HOME` — Root data directory
- `HERMES_DASHBOARD` — Enable dashboard mode
- `HERMES_DASHBOARD_PORT` — Port override
- `HERMES_DASHBOARD_SESSION_TOKEN` — Auth token
- `PYTHONUNBUFFERED=1` — Unbuffered Python output

### Ports

#### Headmaster Desktop
- **Development**: Vite dev server (dynamic)
- **Production**: No network server needed

#### Hermes Dashboard
- **Default**: 9119
- **Configurable**: Via `--port` flag
- **Dynamic**: Use `--port 0` for OS-assigned

#### Marketing Site
- **Development**: 3000 (Next.js default)
- **Production**: Configured via hosting

### Version Information

#### Current Versions
- **Headmaster Desktop**: 0.1.2 (reset from inherited 2.1.18)
- **Electron**: 37.10.3
- **React**: 19.1.0 (desktop), 19.2.4 (site)
- **Next.js**: 16.2.6
- **Hermes**: Latest from NousResearch/hermes-agent

#### Runtime Compatibility
- **Node.js**: >=22 <25 (Headmaster)
- **Node.js**: >=20.0.0 (Marketing site)
- **Python**: 3.x (Hermes)

---

## Document History

- **2026-06-17**: Initial creation — comprehensive workspace documentation
- **Based on**: AGENTS.md, INDEX.md, RECON.md, reconcile.md, and project analysis
- **2026-06-17**: Added UI Panels Audit, Settings Audit, Upstream Assets, and Hermes Config sections
- **2026-06-18**: Updated settings structure, version, recent changes log, and planned items to reflect the 16-task TODO backlog completion

---

## UI Panels & Navigation Audit

> Current status of every panel, tab, and navigation item in the Headmaster Desktop app. Use this before adding or removing UI surface to understand what's live vs dead.

### Left Sidebar Navigation

**File:** `packages/desktop/src/renderer/components/layout/Sider/SiderNav/Phase2Nav.tsx`

All 12 items are hardcoded in a `NAV_ITEMS` constant. No dynamic discovery. All routes are wired in `Router.tsx`.

| Path | Sidebar Label | Status | Notes |
|------|--------------|--------|-------|
| `/dashboard` | Dashboard | Active | Stats cards, session overview |
| `/guid` | Chat | Active | Main conversation interface |
| `/activity` | Activity | Active | Session tracking |
| `/documents` | Documents | Active | File management |
| `/memory` | Memory | Active | Persistent context viewer |
| `/scheduled` | Automations | Active | Cron job scheduler |
| `/workflows` | Skills | Active | Skill/workflow management |
| `/agents` | Agents | Active | Agent configuration |
| `/integrations` | Integrations | Active | External tool connections |
| `/browser` | Browser | Active | Browser session management |
| `/assets` | Assets | Active | Media/asset manager |
| `/kanban` | Kanban | Active | Task board |
| `/settings/model` | Settings | Active | Entry point to settings |

**Toolbar items above nav:**
- New chat button
- Batch mode toggle (`SiderToolbar`)
- Search/filter conversations (`SiderSearchEntry`)
- Scheduled tasks shortcut (`SiderScheduledEntry`)

---

### Conversation Right-Panel Slot

The conversation layout (`ChatLayout/index.tsx`) has **one right-side panel slot** between the chat column and the workspace panel. Only one panel can occupy this slot at a time. The slot is driven by a context provider's `isOpen` state.

#### BrowserPanel — ACTIVE (added 2026-06-17)

**Files:**
- `renderer/pages/conversation/BrowserPanel/BrowserPanelContext.tsx`
- `renderer/pages/conversation/BrowserPanel/BrowserPanel.tsx`
- `renderer/hooks/chat/useBrowserSessionWatch.ts`

**Behaviour:** Auto-opens when the Hermes agent uses any `browser_*` tool (detected by scanning recent messages via `ipcBridge.database.getConversationMessages`). Displays the live noVNC view of Camofox at `http://localhost:6080`. Closes automatically 2.5 seconds after the agent stops processing. User can also close manually.

**Trigger:** `useBrowserSessionWatch(id)` is called at the conversation route level (`conversation/index.tsx`).

**Provider:** `BrowserPanelProvider` — nested inside `PreviewProvider` in `main.tsx`.

**Requires:** Camofox running with `ENABLE_VNC=1`.

#### PreviewPanel — PENDING REMOVAL

**File:** `renderer/pages/conversation/Preview/components/PreviewPanel/PreviewPanel.tsx`

**What it is:** A tabbed preview system with support for markdown, diff, code, HTML, PDF, PPT, Word, Excel, image, and URL content types. Had a full tab bar with unsaved-indicator (dirty flag) and per-viewer toolbars.

**Status:** BrowserPanel has taken its slot in `ChatLayout`. `PreviewProvider` and `PreviewPanel` code still exists but the slot no longer renders it. **Do not add features to this system.** Plan is to remove it entirely.

**Still present in codebase:**
- `Preview/context/PreviewContext.tsx` — `PreviewProvider` still in `main.tsx` provider chain
- `Preview/components/PreviewPanel/` — full tab/toolbar system
- `Preview/components/viewers/` — URLViewer, CodeViewer, ImageViewer, etc.

---

### Settings Page Structure

**File:** `packages/desktop/src/renderer/pages/settings/components/SettingsSider.tsx`

Settings is organized into groups with tab IDs. Extensions can anchor new tabs relative to existing ones via `position.relativeTo`.

#### Built-in Tabs

| Tab ID | Label | Group | File | Backend Wiring |
|--------|-------|-------|------|----------------|
| `hermes` | Runtime | AI Core | `RuntimeSettings.tsx` | **Full** — fetches `/api/config` + `/api/config/schema`, saves via `PUT /api/config` |
| `agent` | Agents | AI Core | `AgentSettings/` | Full — agent detection & config |
| `model` | Model | AI Core | `ModeSettings.tsx` | Full — provider APIs, model list |
| `assistants` | Assistants | AI Core | `AssistantSettings/` | Full — preset storage |
| `appearance` | Appearance | App | `AppearanceSettings/` | Full — theme, font, UI prefs |
| `memory` | Memory Settings | Memory | `MemorySettings.tsx` | **Partial** — memory provider config |
| `system` | System | About | `SystemSettings.tsx` | Full |
| `advanced` | Advanced Settings | About | `AdvancedSettings.tsx` | **Full** — tabbed container for WebUI/Capabilities/Integrations |
| `about` | About | About | `SystemSettings.tsx` | Full |

**Removed tabs:** `pet` (Desktop Pet removed), `webui` (moved under Advanced), `capabilities` (moved under Advanced), `integrations` (moved under Advanced).

**Advanced Settings sub-tabs:**
- Web UI — `WebuiSettings.tsx`
- Capabilities — `CapabilitiesSettings.tsx` (includes SkillsHubSettings)
- Integrations — `IntegrationsPage`

#### Extension Tab System

- Third-party and internal extensions add tabs via `position.relativeTo` + anchor tab ID
- Legacy anchors redirect automatically: `skills-hub` → `capabilities`, `tools` → `capabilities`, `display` → `appearance`
- Icon: custom URL or fallback to Puzzle icon
- URL: `?tab=<tabId>` query param for deep linking

#### What's Wired vs What's Not

**Fully wired (real backend integration):**
- Model/provider selection — calls real provider APIs
- Agent configuration — reads/writes agent detection state (now includes local CLI scanner)
- Appearance — writes to persistent user preferences
- Capabilities — manages MCP servers and skills (now under Advanced Settings)
- **RuntimeSettings** — fetches `/api/config` + `/api/config/schema`, saves via `PUT /api/config` (rewritten 2026-06-18)

**Partially wired:**
- `MemorySettings` — memory provider config UI exists, backend integration is stub-like.

**AIONUI / legacy naming:**
- There is no dedicated "AIONUI settings" section in Headmaster
- All user-facing settings have been renamed to Headmaster branding
- "Hermes" tab label was renamed to "Runtime" (2026-06-18)

#### Settings Restructure — COMPLETED (2026-06-18)

The settings restructure is done:
1. **Runtime tab** (formerly "Hermes") — Primary runtime config, fetches from real Hermes `/api/config` endpoints
2. **Advanced Settings tab** — New tab containing WebUI, Capabilities, and Integrations as sub-tabs
3. **System / About** — unchanged
4. **Desktop Pet** — removed entirely
5. **Memory** — renamed to "Memory Settings" in the sidebar

---

## Upstream Assets & Reference Implementations

> These live in `_support/upstream/` — reference codebases to pull patterns and components from, not to ship directly.

### `_support/upstream/aionui/`

**What:** Full snapshot of AionUI — the open-source upstream that Headmaster was forked from. Same stack: Electron, React 18, Arco Design, UnoCSS, TypeScript strict.

**Use for:** Pulling any UI pattern, component, or convention that existed pre-fork. This is the authoritative source for the "original" shape of any component that's been modified in gcaplabs-headmaster/repo/gcaplabs-headmasterUI.

**Key difference from gcaplabs-headmaster/repo/gcaplabs-headmasterUI:** All naming uses "aionui" throughout. Headmaster has rebranded everything.

---

### `_support/upstream/hermes-desktop/`

**What:** The official Hermes desktop Electron app (symlinked from `runtime-recon/hermes-agent/apps/desktop`). This is what the Hermes team ships independently.

**Use for:** Understanding how Hermes itself expects its desktop UI to look and behave. Patterns here are the authoritative "what Hermes intends" reference.

**Screens (all real, not stubs):**

| Screen | Purpose |
|--------|---------|
| Agents | Agent management |
| Chat | Conversation interface |
| Discover | Model discovery |
| Gateway | Connection setup |
| Install | Installation wizard |
| Kanban | Task board |
| Layout | Window structure |
| Memory | Context storage |
| Models | Model configuration |
| Office | Document tools |
| Providers | LLM provider setup |
| Schedules | Cron jobs |
| Sessions | Chat history |
| Settings | Hermes config (see below) |
| Setup | Initial setup |
| Skills | Skill management |
| Soul | Agent personality |
| SplashScreen | Startup screen |
| Tools | Tool configuration |
| Welcome | Onboarding |

**Hermes Settings screen** (`Settings.tsx`) covers:
- Hermes home path (`HERMES_HOME`)
- Theme / font / locale
- API key input
- Version info + update management
- Doctor / health checks
- OpenClaw migration tool
- SSH connection config
- Backup / import
- Log viewer
- Analytics consent

**Config health screen** (`ConfigHealth.tsx`): visual health check display for each Hermes subsystem.

---

### `_support/upstream/hermes-webui/`

**What:** The Hermes web UI — a Python Flask + React app that can run standalone or alongside the desktop app. Exposes Hermes over HTTP with a browser-based UI.

**Use for:** Understanding the Hermes HTTP API surface (`/api/` routes), which is the same API that `RuntimeSettings.tsx` probes in gcaplabs-headmaster/repo/gcaplabs-headmasterUI.

---

### `_support/upstream/hermes-workspace/`

**What:** Full-stack Hermes workspace orchestration — Docker support, Electron packaging, skill management. Reference for deployment and skill system architecture.

---

## Hermes Runtime — Configurable Options

> What Hermes actually exposes for configuration. Source: `runtime/hermes-agent/website/docs/reference/environment-variables.md` and upstream desktop settings.

### LLM Provider

| Setting | What it does |
|---------|-------------|
| Provider selection | OpenRouter, OpenAI, Anthropic, Azure, Google Gemini, and others |
| API keys | Per-provider API key |
| Base URL overrides | Custom endpoints for each provider |
| Response caching | OpenRouter-specific caching |
| Model fallback chains | Ordered fallback if primary model fails |
| `HERMES_MODEL` | Process-level model override |

### Browser & Automation

| Setting | Env Var | Default |
|---------|---------|---------|
| Camofox endpoint | `CAMOFOX_URL` | `http://localhost:9377` |
| Camofox shared session | `CAMOFOX_USER_ID` | — |
| Camofox auth key | `CAMOFOX_SESSION_KEY` | — |
| Camofox tab reuse | `CAMOFOX_ADOPT_EXISTING_TAB` | — |
| VNC live view | `ENABLE_VNC=1` | off | Enables noVNC at `http://localhost:6080` |
| Chromium launch flags | `AGENT_BROWSER_ARGS` | — |
| Browserbase | `BROWSERBASE_*` | — | Cloud browser alternative |
| Browser Use | `BROWSER_USE_*` | — | Cloud browser alternative |
| Firecrawl | `FIRECRAWL_*` | — | Cloud scraping alternative |
| CDP URL | `CDP_URL` | — | Custom Chrome DevTools Protocol |

### Web Search

| Provider | Env Var |
|---------|---------|
| Tavily | `TAVILY_API_KEY` |
| Exa | `EXA_API_KEY` |
| Parallel AI | `PARALLELAI_API_KEY` |
| SearXNG | `SEARXNG_URL` |

### Agent Runtime

| Setting | Env Var | Notes |
|---------|---------|-------|
| Config directory | `HERMES_HOME` | Default: `~/.hermes` |
| Timezone | `HERMES_TIMEZONE` | IANA timezone string |
| Kanban config | `HERMES_KANBAN_*` | Board configuration |
| IPv4 only | — | Network restriction |
| HTTP proxy | — | Outbound proxy |
| MCP server discovery | — | Auto-registers local MCP servers |

### Authentication Providers

| Provider | Method |
|---------|--------|
| Anthropic | OAuth (requires Claude Max + extra credits) |
| GitHub Copilot | OAuth or personal access token |
| Google Gemini | OAuth (client ID / secret) |
| Azure / Entra ID | Service principal |
| Azure Managed Identity | Workload identity |

### Speech & Tools

| Setting | Options |
|---------|--------|
| Speech-to-text | Local (Whisper) or OpenAI API |
| Tool availability | Per-session enable/disable |
| Skill registration | Auto-discovery or manual |

---

## Browser Tool Capabilities (Hermes)

> What the Hermes browser tools can do — relevant for understanding what the BrowserPanel is showing and what future browser-related features might need.

All tool names start with `browser_` — this is the pattern `useBrowserSessionWatch` uses for detection.

| Tool | What it does |
|------|-------------|
| `browser_navigate` | Navigate to a URL; response includes VNC URL if Camofox+VNC enabled |
| `browser_click` | Click an element |
| `browser_type` | Type text into a field |
| `browser_scroll` | Scroll the page |
| `browser_press` | Press a key |
| `browser_back` | Navigate back |
| `browser_snapshot` | Take a DOM/accessibility snapshot |
| `browser_vision` | Visual screenshot (for cloud providers without VNC) |
| `browser_console` | Read browser console output |
| `browser_cdp` | Raw Chrome DevTools Protocol command |
| `browser_dialog` | Handle alert/confirm/prompt dialogs |
| `browser_get_images` | Extract images from the page |

**VNC live view:** Only available with Camofox + `ENABLE_VNC=1`. Cloud providers (Browserbase, Browser Use, Firecrawl) fall back to `browser_vision` (screenshots) rather than live stream.

---

## Recent Changes Log

> Major structural changes to the UI — quick reference for what moved, what was removed, and why.

### 2026-06-18 — TODO backlog cleared (16 tasks, 8 commits)

#### Settings restructure
- "Hermes" tab renamed to "Runtime" (all 9 locales)
- `RuntimeSettings.tsx` rewritten — now fetches from real `/api/config` + `/api/config/schema` endpoints, saves via `PUT /api/config`
- New "Advanced Settings" tab created — contains WebUI, Capabilities, and Integrations as sub-tabs
- Desktop Pet removed (settings tab + route + sider entry)
- Memory settings entry renamed to "Memory Settings"
- Dead i18n keys from the old keep/port comparison view removed
- `groupHeadmasterUI` label changed from "HeadmasterUI" to "Headmaster" across all locales

#### Agent detection fix
- Local CLI agent scanner implemented in the Electron main process
- `process/agent/agentScanner.ts` — probes `$PATH` for `claude`, `codex`, `grok`, `hermes` binaries
- `process/bridge/agentBridge.ts` — IPC bridge for the scanner
- `getAvailableAgents` in `ipcBridge.ts` rewritten to merge local scanner results with backend adapters

#### Gateway status checker
- `Sider/SiderNav/GatewayStatusIndicator.tsx` — polls `GET /api/status` every 30s
- Shows green/red dot + restart button in sidebar footer
- Restart button calls `POST /api/gateway/restart`

#### Headmaster update checker
- `Sider/SiderNav/UpdateChecker.tsx` — polls `GET /api/hermes/update/check` every 6h
- Shows "Headmaster update available" badge when update is available
- Clicking triggers `POST /api/hermes/update` and shows notification

#### Memory page
- `renderer/pages/memory/index.tsx` — now embeds `https://memory.gcaplabs.com` via iframe
- No longer shows a local provider list

#### BottomComposer removed
- `components/layout/BottomComposer.tsx` deleted
- Chat input only appears on the Chat screen, not on every screen

#### Workspace panel fix
- `ChatSlider.tsx` — renders workspace panel for ALL conversation types that have a workspace path
- Previously only worked for `acp`, `codex`, `aionrs` types — now works for any type

#### White-label audit
- All "Hermes" and "HeadmasterUI" mentions in user-visible UI strings replaced across all 9 locales
- Internal/env var/IPC references to "Hermes" left intact (allowed per white-label rules)

### 2026-06-17 — BrowserPanel replaces PreviewPanel slot

- The right-side panel slot in `ChatLayout` now shows `BrowserPanel` (driven by `useBrowserPanelContext`)
- `PreviewPanel` (tabbed file preview) still exists in code but no longer renders in this slot
- `BrowserPanel` auto-triggers from `browser_*` tool use; shows Camofox VNC at `localhost:6080`
- `PreviewProvider` kept in provider chain for now; planned for removal with the rest of the Preview system
- All 9 locale `conversation.json` files updated with `browser.title` and `browser.close` keys

### Planned (not yet started)

- Remove `PreviewPanel`, `PreviewProvider`, `PreviewContext` and all Preview viewers
- Polish `RuntimeSettings` UX (field grouping, descriptions, validation) based on real `/api/config/schema` output

---

**This document is a living reference. Update it as the workspace evolves.**
