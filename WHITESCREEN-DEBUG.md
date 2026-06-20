# Headmaster White Screen — Debug Log

## Status: RESOLVED (2026-06-19)

## Root cause

The packaged renderer crashed before `main.tsx` could mount React:

```text
vendor-arco-*.js: TypeError: Cannot read properties of undefined (reading 'createContext')
```

The renderer `manualChunks` rule matched any dependency path containing
`/react/`. That incorrectly classified `@monaco-editor/react` as part of the
React vendor chunk. Combined with remaining imports through the heavy Preview
barrel, Rollup emitted this circular startup graph:

```text
vendor-react → vendor-editor → vendor-highlight → vendor-arco → vendor-react
```

Arco evaluated before React finished initializing, so `React.createContext`
was undefined and the root stayed empty.

## Resolution

- Added package-aware renderer chunk classification so only the real `react`
  and `react-dom` packages enter `vendor-react`.
- Classified `@monaco-editor/react` under `vendor-editor`.
- Replaced remaining startup imports through `Preview/index.ts` with direct
  context/component imports.
- Removed the temporary DevTools auto-open patch.
- Guarded portable builds from missing `app-update.yml` update checks.
- Made missing `SENTRY_DSN` a clean startup-log-report no-op.
- Removed startup calls to unsupported inherited Hermes endpoints and
  normalized the Hermes `{ servers: [] }` MCP response.

## Verification

- TypeScript typecheck passed.
- Focused regression and adapter tests passed.
- Production Electron bundle passed.
- Signed Windows `--dir` package passed.
- Packaged renderer mounted with `rootChildren: 1`.
- No uncaught renderer exceptions.
- DevTools did not auto-open.

## What's been verified

### 1. The Preview barrel fix (from prior session) — CORRECT
- `main.tsx` line 51: `import { PreviewProvider } from './pages/conversation/Preview/context'`
- `Preview/context/index.ts` re-exports `PreviewProvider` from `PreviewContext.tsx`
- `PreviewContext.tsx` only imports: `ipcBridge`, types, React — NO heavy editor/viewer components
- The old barrel `Preview/index.ts` has `export * from './components'` which pulls CodeMirror, PDFViewer, etc.
- Fix is valid: importing from `./Preview/context` avoids the heavy barrel

### 2. Build state — VALID
- `out/win-unpacked/Headmaster.exe` — 204MB, built 17:10
- `out/win-unpacked/resources/app.asar` — 400MB, built 17:10
- Vite build completed at 17:02-17:04 (main/preload/renderer)
- Shortcut `HeadmasterAlpha.lnk` → `out/win-unpacked/Headmaster.exe` (correct)

### 3. App launches — WHITE SCREEN CONFIRMED
- 4 Headmaster processes start, main window titled "Headmaster"
- Pixel analysis: 95% white, 3% dark, 1% color
- Some content renders (sidebar/logo area has dark pixels) but main React tree not mounting

### 4. RuntimeDetectionModal.tsx — DANGLING (not a crash cause)
- File exists at `renderer/components/RuntimeDetectionModal.tsx`
- NEVER imported anywhere in the React tree (grep confirmed: 0 imports outside itself)
- The IPC backend half IS wired:
  - `preload/main.ts` line 56: `checkHermesRuntime: () => ipcRenderer.invoke('runtime:check-and-prompt')`
  - `process/bridge/runtimeDetectionBridge.ts`: registers `runtime:check-and-prompt` handler
  - `process/bridge/index.ts` line 31: `initRuntimeDetectionBridge(deps.hermesBootstrap)`
- So: backend works, component never mounts. Dead code, not causing white screen.

### 5. DevTools auto-open patch — APPLIED (TEMPORARY)
- Patched `packages/desktop/src/index.ts` ~line 543 to add:
  `mainWindow.webContents.openDevTools({ mode: 'detach' });`
- Vite rebuild just completed (index-DQXhCJEQ.js is new main chunk)
- Still need to: rebuild packaging (electron-builder --dir) and relaunch to see console errors

## ROOT CAUSE FOUND — Circular vendor chunk dependency

The white screen is caused by a **circular import between vendor chunks** introduced by the `manualChunks` config in `electron.vite.config.ts`:

```
vendor-react (react/react-dom)
  → imports {l as lu} from vendor-editor (codemirror/monaco/tree-sitter)
    → imports from vendor-highlight (highlight.js/refractor)
      → imports from vendor-arco (arco-design)
        → imports {r as m} from vendor-react ← CYCLE! React not yet evaluated
```

When `vendor-arco` runs `m.createContext({prefixCls:"arco"})`, `m` is `undefined` because `vendor-react` hasn't finished evaluating — it's still waiting for the `vendor-editor → vendor-highlight → vendor-arco` chain.

**CDP console output (confirmed):**
```
EXCEPTION: Uncaught at line 0:1010
  TypeError: Cannot read properties of undefined (reading 'createContext')
    at vendor-arco-Cdx1eDW9.js:1:1011
```

**Page state:** `#root` exists, 0 children. React never mounts.

**The `l` imported by vendor-react from vendor-editor is a tree-sitter init** (`lu.init()` called in react-dom/related code). This is what creates the react→editor edge.

**The Preview barrel fix from the prior session was necessary but NOT sufficient** — the white screen is this chunk cycle, not (only) the barrel import.

## Fix approach

The cleanest fix: merge `vendor-react` and `vendor-editor` into one chunk so the react→editor edge is intra-chunk (no circular module boundary). OR move the tree-sitter WASM init out of the editor chunk.

### Step 1: Apply the chunk merge fix
In `packages/desktop/electron.vite.config.ts` manualChunks:
- Merge vendor-editor into vendor-react (both react and editor deps in one chunk)
- OR add the tree-sitter packages to a separate chunk that doesn't import from arco

### Step 2: Rebuild + relaunch + verify via CDP
```
bunx electron-vite build --config packages/desktop/electron.vite.config.ts
node scripts/build-with-builder.js auto --win --dir --skip-vite
HEADMASTER_CDP_PORT=9222 out/win-unpacked/Headmaster.exe
python cdp_check.py
```

### Step 3: Remove temp patches
- Remove `mainWindow.webContents.openDevTools({ mode: 'detach' });` from `packages/desktop/src/index.ts`
- Remove `app.commandLine.appendSwitch('remote-allow-origins', '*');` from `configureChromium.ts` (optional, harmless)

### Step 4: Final rebuild + verify

## Files of interest
- `packages/desktop/src/renderer/main.tsx` — entry point, AppProviders tree
- `packages/desktop/src/renderer/pages/conversation/Preview/index.ts` — the barrel (has `export * from './components'`)
- `packages/desktop/src/renderer/pages/conversation/Preview/context/index.ts` — safe import path
- `packages/desktop/src/renderer/pages/conversation/Preview/context/PreviewContext.tsx` — the actual provider
- `packages/desktop/src/index.ts` — main process, window creation (has temp DevTools patch now)
- `packages/desktop/src/preload/main.ts` — preload, exposes electronAPI
- `packages/desktop/src/process/bridge/runtimeDetectionBridge.ts` — runtime detection IPC (wired but unused)
- `packages/desktop/src/renderer/components/RuntimeDetectionModal.tsx` — dangling component (wired backend, never mounted)

## Git status
Modified (uncommitted):
- `packages/desktop/src/renderer/main.tsx` — Preview import fix
- `packages/desktop/src/preload/main.ts` — added checkHermesRuntime exposure
- `packages/desktop/src/process/bridge/index.ts` — added initRuntimeDetectionBridge call
- `packages/desktop/src/common/types/platform/electron.ts` — added checkHermesRuntime type
- `packages/desktop/src/index.ts` — TEMP DevTools auto-open (REMOVE BEFORE FINAL BUILD)
- `package.json`, `CHANGELOG.md`

Untracked:
- `packages/desktop/src/process/bridge/runtimeDetectionBridge.ts`
- `packages/desktop/src/renderer/components/RuntimeDetectionModal.tsx`
