/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// configureChromium sets app name (dev isolation) and Chromium flags — must run before
// ANY module that calls app.getPath('userData'), because Electron caches the path on first call.
import './process/utils/configureChromium';
import { installGpuCrashHandler } from './process/utils/gpuRecovery';
import { captureBackendStartupFailure, initSentry, scheduleStartupLogReport, setSentryDeviceId } from './sentry';

initSentry();

import './process/utils/configureConsoleLog';
import { app, BrowserWindow, ipcMain, nativeImage, powerMonitor } from 'electron';
import fixPath from 'fix-path';
import * as fs from 'fs';
import * as path from 'path';
import { initMainAdapterWithWindow } from './common/adapter/main';
import { ipcBridge } from './common';
import { initializeProcess } from './process';
import { startBackendOrExit } from './process/startup/backendStartup';
import { assertStartupArchitectureCompatible } from './process/startup/architectureCompatibility';
import { installQuitCleanup } from './process/startup/quitCleanup';
import { ProcessConfig } from './process/utils/initStorage';
import { registerWindowMaximizeListeners } from '@process/bridge';
import { BackendLifecycleManager } from '@aionui/web-host';
import { resolveBinaryPath } from '@process/backend';
import { HermesBootstrap } from '@process/backend/hermesBootstrap';
import { setHermesBootstrap } from '@process/utils/hermesBootstrapSingleton';
import { initBridges } from '@process/utils/initBridge';
import './process/bridge/feedbackBridge';
import { wasLaunchedAtLogin } from '@process/bridge/applicationBridge';
import { onLanguageChanged } from './process/bridge/systemSettingsBridge';
import { setInitialLanguage } from '@process/services/i18n';
import { setupApplicationMenu } from './process/utils/appMenu';
import { startWebHost } from '@aionui/web-host';
import { initializeZoomFactor, setupZoomForWindow } from './process/utils/zoom';
import {
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
  attachWindowBoundsPersistence,
  loadSavedWindowBounds,
  resolveInitialBounds,
} from './process/utils/windowBounds';
import {
  clearPendingDeepLinkUrl,
  getPendingDeepLinkUrl,
  handleDeepLinkUrl,
  PROTOCOL_SCHEME,
} from './process/utils/deepLink';
import {
  bindMainWindowReferences,
  showAndFocusMainWindow,
  showOrCreateMainWindow,
} from './process/utils/mainWindowLifecycle';
import {
  loadUserWebUIConfig,
  resolveRemoteAccess,
  resolveWebUIPort,
  restoreDesktopWebUIFromPreferences,
} from './process/utils/webuiConfig';
import {
  createOrUpdateTray,
  destroyTray,
  getCloseToTrayEnabled,
  getIsQuitting,
  refreshTrayMenu,
  setCloseToTrayEnabled,
  setIsQuitting,
} from './process/utils/tray';
import { readCloseToTraySetting } from './process/utils/closeToTraySetting';
// @ts-expect-error - electron-squirrel-startup doesn't have types
import electronSquirrelStartup from 'electron-squirrel-startup';

// ============ Single Instance Lock ============
// Acquire lock early so the second instance quits before doing unnecessary work.
// When a second instance starts (e.g. from protocol URL), it sends its data
// to the first instance via second-instance event, then quits.
const isE2ETestMode = process.env.HEADMASTER_E2E_TEST === '1';
const skipSingleInstanceLock = isE2ETestMode || process.env.HEADMASTER_MULTI_INSTANCE === '1';
const deepLinkFromArgv = process.argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
const gotTheLock = skipSingleInstanceLock ? true : app.requestSingleInstanceLock({ deepLinkUrl: deepLinkFromArgv });
if (!gotTheLock) {
  console.warn('[Headmaster] Another instance is already running; current process will exit.');
  app.quit();
} else {
  app.on('second-instance', (_event, argv, _workingDirectory, additionalData) => {
    // Prefer additionalData (reliable on all platforms), fallback to argv scan
    const deepLinkUrl =
      (additionalData as { deepLinkUrl?: string })?.deepLinkUrl ||
      argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
    if (deepLinkUrl) {
      handleDeepLinkUrl(deepLinkUrl);
    }
    // Focus existing window or recreate one if needed.
    if (isWebUIMode || isResetPasswordMode) {
      return;
    }

    // Skip window creation if app hasn't finished initializing
    if (!appReadyDone) return;

    if (app.isReady()) {
      showOrCreateMainWindow({
        mainWindow,
        createWindow: () => {
          console.log('[Headmaster] second-instance received with no active main window, recreating main window');
          createWindow();
        },
      });
    }
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// 修复 macOS 和 Linux 下 GUI 应用的 PATH 环境变量,使其与命令行一致
if (process.platform === 'darwin' || process.platform === 'linux') {
  fixPath();

  // Supplement nvm paths that fix-path might miss (nvm is often only in .zshrc, not .zshenv)
  const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME || '', '.nvm');
  const nvmVersionsDir = path.join(nvmDir, 'versions', 'node');
  if (fs.existsSync(nvmVersionsDir)) {
    try {
      const versions = fs.readdirSync(nvmVersionsDir);
      const nvmPaths = versions.map((v) => path.join(nvmVersionsDir, v, 'bin')).filter((p) => fs.existsSync(p));
      if (nvmPaths.length > 0) {
        const currentPath = process.env.PATH || '';
        const missingPaths = nvmPaths.filter((p) => !currentPath.includes(p));
        if (missingPaths.length > 0) {
          process.env.PATH = [...missingPaths, currentPath].join(path.delimiter);
        }
      }
    } catch {
      // Ignore errors when reading nvm directory
    }
  }
}

// Handle Squirrel startup events (Windows installer)
if (electronSquirrelStartup) {
  app.quit();
}

// Global error handlers for main process
// Sentry automatically captures these, but we keep the handlers to prevent Electron's default error dialog
process.on('uncaughtException', (_error) => {
  // Sentry captures this automatically
});

process.on('unhandledRejection', (_reason, _promise) => {
  // Sentry captures this automatically
});

const hasSwitch = (flag: string) => process.argv.includes(`--${flag}`) || app.commandLine.hasSwitch(flag);
const getSwitchValue = (flag: string): string | undefined => {
  const withEqualsPrefix = `--${flag}=`;
  const equalsArg = process.argv.find((arg) => arg.startsWith(withEqualsPrefix));
  if (equalsArg) {
    return equalsArg.slice(withEqualsPrefix.length);
  }

  const argIndex = process.argv.indexOf(`--${flag}`);
  if (argIndex !== -1) {
    const nextArg = process.argv[argIndex + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      return nextArg;
    }
  }

  const cliValue = app.commandLine.getSwitchValue(flag);
  return cliValue || undefined;
};
const hasCommand = (cmd: string) => process.argv.includes(cmd);

const isWebUIMode = hasSwitch('webui');
const isRemoteMode = hasSwitch('remote');
const isResetPasswordMode = hasCommand('--resetpass');
const isVersionMode = hasCommand('--version') || hasCommand('-v');

// Flag to distinguish intentional quit from unexpected exit in WebUI mode
let isExplicitQuit = false;

// Guard against premature window creation (e.g. macOS 'activate' firing during init).
// The activate event fires on first launch before handleAppReady finishes initializeProcess(),
// causing the renderer to load and compete with initStorage on the serial configFile queue,
// which blocks startup for 100-265 seconds.
let appReadyDone = false;

let mainWindow: BrowserWindow;
const backendManager = new BackendLifecycleManager(
  {
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath('userData'),
  },
  resolveBinaryPath
);

// Hermes Python dashboard bootstrap. This is the primary Headmaster runtime:
// Headmaster is a white-label/product shell on top of the real Hermes desktop
// backend surface (`/api/*`, `/api/ws`, `/v1/*`). The legacy aioncore process is
// retained only as a fallback for old builds that do not have Hermes installed.
const hermesBootstrap = new HermesBootstrap({
  version: app.getVersion(),
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
  userDataPath: app.getPath('userData'),
});
setHermesBootstrap(hermesBootstrap);
initBridges({ hermesBootstrap });
let disposeCronResumeListener: (() => void) | null = null;

// Flag tracking whether the backend subprocess started successfully. Read by
// the deferred runBackendMigrations trigger in createWindow().
let backendStartedOk = false;
let backendStartupFailed = false;
let rendererInitialLanguage: string | null = null;
let backendMigrationsScheduled = false;
let ensureAdminUserPromise: Promise<void> | null = null;

ipcMain.on('get-backend-port', (event) => {
  event.returnValue =
    (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort ?? hermesBootstrap.port ?? backendManager.port;
});

ipcMain.on('get-hermes-session-token', (event) => {
  event.returnValue =
    (globalThis as typeof globalThis & { __hermesSessionToken?: string }).__hermesSessionToken ??
    hermesBootstrap.sessionToken ??
    '';
});

ipcMain.on('get-initial-language', (event) => {
  event.returnValue = rendererInitialLanguage;
});

ipcMain.on('get-backend-startup-failed', (event) => {
  event.returnValue = backendStartupFailed;
});

ipcMain.on('get-backend-startup-failure', (event) => {
  // Installation-integrity / backend-startup-failure dialog removed: never surface
  // the failure info to the renderer so the "installation incomplete" screen
  // can no longer appear at launch.
  event.returnValue = null;
});

// ---------------------------------------------------------------------------
// runtime:get-status — single-round-trip snapshot of Hermes surface readiness
// for the Settings → Runtime page. The renderer could probe each endpoint
// directly, but doing it from the main process (where the session token lives)
// avoids 8 separate CORS-token round-trips and keeps latency consistent.
// ---------------------------------------------------------------------------

const RUNTIME_STATUS_ENDPOINTS: Array<{ id: string; endpoint: string; countKey: string }> = [
  { id: 'runtime.status', endpoint: '/api/status', countKey: '' },
  { id: 'runtime.sessions', endpoint: '/api/sessions', countKey: 'sessions' },
  { id: 'runtime.models', endpoint: '/api/model/options', countKey: 'options' },
  { id: 'runtime.skills', endpoint: '/api/skills', countKey: 'skills' },
  { id: 'runtime.mcp', endpoint: '/api/mcp/servers', countKey: 'servers' },
  { id: 'runtime.cron', endpoint: '/api/cron/jobs', countKey: 'jobs' },
  { id: 'runtime.providers', endpoint: '/api/providers/oauth', countKey: 'providers' },
  { id: 'runtime.platforms', endpoint: '/api/messaging/platforms', countKey: 'platforms' },
];

ipcMain.handle('runtime:get-status', async () => {
  const port =
    (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort ??
    hermesBootstrap.port ??
    backendManager.port;
  const token =
    (globalThis as typeof globalThis & { __hermesSessionToken?: string }).__hermesSessionToken ??
    hermesBootstrap.sessionToken ??
    '';

  if (!port) {
    return {
      generatedAt: Date.now(),
      porting: RUNTIME_STATUS_ENDPOINTS.map((e) => ({
        id: e.id,
        endpoint: e.endpoint,
        readiness: 'unavailable' as const,
        detail: 'Runtime not started',
      })),
    };
  }

  const headers: Record<string, string> = token ? { 'X-Hermes-Session-Token': token } : {};

  const probeResults = await Promise.all(
    RUNTIME_STATUS_ENDPOINTS.map(async (entry) => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}${entry.endpoint}`, { headers });
        if (res.status === 404) {
          return { id: entry.id, endpoint: entry.endpoint, readiness: 'unavailable' as const, detail: 'Not exposed by this runtime build' };
        }
        if (!res.ok) {
          return { id: entry.id, endpoint: entry.endpoint, readiness: 'unavailable' as const, detail: `HTTP ${res.status}` };
        }
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          return { id: entry.id, endpoint: entry.endpoint, readiness: 'partial' as const, detail: `Unexpected content-type: ${ct}` };
        }
        const data = (await res.json()) as Record<string, unknown>;
        let detail = 'OK';
        if (entry.countKey) {
          const list = data[entry.countKey];
          if (Array.isArray(list)) {
            detail = `${list.length} record${list.length === 1 ? '' : 's'}`;
          }
        }
        return { id: entry.id, endpoint: entry.endpoint, readiness: 'ready' as const, detail };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { id: entry.id, endpoint: entry.endpoint, readiness: 'unavailable' as const, detail: msg };
      }
    })
  );

  return { generatedAt: Date.now(), porting: probeResults };
});

function markBackendStartupFailed(_error: unknown): void {
  // The installation-integrity / startup-failure dialog has been removed, so we
  // no longer classify the failure for the renderer. Keep only the boolean flag
  // (used for Sentry noise filtering and the i18n language hint).
  backendStartupFailed = true;
  (globalThis as typeof globalThis & { __backendStartupFailed?: boolean }).__backendStartupFailed = true;
}

function registerCronResumeBridge(backendPort: number, runtime: 'hermes' | 'aioncore' = 'hermes'): void {
  disposeCronResumeListener?.();

  const onResume = () => {
    // Hermes Agent has no aioncore-internal resume route. Keep the hook only
    // for legacy aioncore fallback so sleep/wake doesn't spam 404s.
    if (runtime !== 'aioncore') return;
    void fetch(`http://127.0.0.1:${backendPort}/api/cron/internal/system-resume`, {
      method: 'POST',
      headers: {
        'x-aionui-internal': '1',
      },
    }).catch((error) => {
      console.error('[Headmaster] Failed to notify backend about system resume:', error);
    });
  };

  powerMonitor.on('resume', onResume);
  disposeCronResumeListener = () => {
    powerMonitor.removeListener('resume', onResume);
  };
}

/**
 * Run one-shot backend migrations after the renderer has loaded. Some steps
 * (ConfigStorage.get, ipcBridge.listProviders) route through the renderer via
 * BroadcastChannel, so invoking them before the renderer exists deadlocks the
 * main process. Called from did-finish-load.
 */
const scheduleBackendMigrations = (): void => {
  if (backendMigrationsScheduled || !backendStartedOk) return;
  backendMigrationsScheduled = true;
  void (async () => {
    try {
      const { runBackendMigrations } = await import('./process/utils/runBackendMigrations');
      await runBackendMigrations(ProcessConfig);
      console.info('[Headmaster] runBackendMigrations completed');
    } catch (error) {
      console.error('[Headmaster] Backend migration hook threw:', error);
    }
  })();
};

function exposeBackendPort(backendPort: number): void {
  // Expose the backend port to main-process callers of httpBridge (e.g. the
  // one-shot assistant migration hook below). Must land BEFORE any
  // ipcBridge.* invoke from the main process — the renderer side reads
  // window.__backendPort via preload, but main has no `window`.
  (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort = backendPort;
}

function ensureAdminUserOnce(backendPort: number): Promise<void> {
  if (!ensureAdminUserPromise) {
    ensureAdminUserPromise = (async () => {
      try {
        const { ensureAdminUser } = await import('./process/utils/ensureAdminUser');
        await ensureAdminUser(backendPort);
      } catch (err) {
        console.error('[WebUI] ensureAdminUser failed:', err);
      }
    })();
  }
  return ensureAdminUserPromise;
}

function markBackendReady(backendPort: number, source: string, runtime: 'hermes' | 'aioncore' = 'hermes'): void {
  if (backendStartedOk) return;
  console.log(`[Headmaster] ${source} ready (port=${backendPort})`);
  exposeBackendPort(backendPort);
  registerCronResumeBridge(backendPort, runtime);
  backendStartedOk = true;
  backendStartupFailed = false;
  (globalThis as typeof globalThis & { __backendStartupFailed?: boolean }).__backendStartupFailed = false;
  if (runtime === 'aioncore') {
    void ensureAdminUserOnce(backendPort);
    scheduleBackendMigrations();
  }
}

const createWindow = ({ showOnReady = true }: { showOnReady?: boolean } = {}): void => {
  console.log('[Headmaster] Creating main window...');
  const { x: windowX, y: windowY, width: windowWidth, height: windowHeight } = resolveInitialBounds();

  // Get app icon for development mode (Windows/Linux need icon in BrowserWindow)
  // In production, icons are set via forge.config.ts packagerConfig
  let devIcon: Electron.NativeImage | undefined;
  if (!app.isPackaged) {
    try {
      // Windows: app.ico (no dev version), Linux: app_dev.png (with padding)
      const iconFile = process.platform === 'win32' ? 'app.ico' : 'app_dev.png';
      const iconPath = path.join(process.cwd(), 'resources', iconFile);
      if (fs.existsSync(iconPath)) {
        devIcon = nativeImage.createFromPath(iconPath);
        if (devIcon.isEmpty()) devIcon = undefined;
      }
    } catch {
      // Ignore icon loading errors in development
    }
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    ...(windowX !== undefined && windowY !== undefined ? { x: windowX, y: windowY } : {}),
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false, // Hide until CSS is loaded to prevent FOUC
    backgroundColor: '#ffffff',
    autoHideMenuBar: true,
    // Set icon for Windows/Linux in development mode
    ...(devIcon && process.platform !== 'darwin' ? { icon: devIcon } : {}),
    // Custom titlebar configuration / 自定义标题栏配置
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hidden',
          // Align traffic-light vertical center with the titlebar button centers.
          // Titlebar is 45px; buttons are 36px flex-centered → button center y≈22.5.
          // Empirically y=13 places the traffic lights on the same horizontal line
          // as the sidebar / back / forward icons.
          // NOTE: requires a full app restart to take effect (BrowserWindow option).
          trafficLightPosition: { x: 10, y: 13 },
        }
      : { frame: false }),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      webviewTag: true, // 启用 webview 标签用于 HTML 预览 / Enable webview tag for HTML preview
    },
  });
  console.log(`[Headmaster] Main window created (id=${mainWindow.id})`);

  scheduleStartupLogReport(mainWindow);

  // Show window after content is ready to prevent FOUC (Flash of Unstyled Content)
  // Use 'ready-to-show' which fires when renderer has painted first frame,
  // combined with 'did-finish-load' as belt-and-suspenders approach.
  if (showOnReady) {
    const showWindow = () => {
      if (!mainWindow.isDestroyed() && !mainWindow.isVisible()) {
        console.log('[Headmaster] Showing main window');
        mainWindow.show();
        mainWindow.focus();
      }
    };
    mainWindow.once('ready-to-show', () => {
      console.log('[Headmaster] Window ready-to-show');
      showWindow();
    });
    // Belt-and-suspenders: also show on did-finish-load in case ready-to-show already fired
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('[Headmaster] Renderer did-finish-load');
      showWindow();
      scheduleBackendMigrations();
    });
    // Fallback: show window after 5s even if events don't fire (e.g. loadURL failure)
    setTimeout(showWindow, 5000);
  } else if (process.platform === 'darwin' && app.dock) {
    void app.dock.hide();
  }

  initMainAdapterWithWindow(mainWindow);
  bindMainWindowReferences(mainWindow);

  setupApplicationMenu();

  setupZoomForWindow(mainWindow);
  registerWindowMaximizeListeners(mainWindow);
  attachWindowBoundsPersistence(mainWindow, (bounds) => ProcessConfig.set('window.bounds', bounds));

  // Initialize auto-updater service (skip when disabled via env, e.g. E2E / CI)
  // 初始化自动更新服务（通过环境变量禁用时跳过，例如 E2E / CI 场景）
  const isCiRuntime = process.env.CI === 'true' || process.env.CI === '1' || process.env.GITHUB_ACTIONS === 'true';
  const disableAutoUpdater =
    process.env.HEADMASTER_DISABLE_AUTO_UPDATE === '1' || process.env.HEADMASTER_E2E_TEST === '1' || isCiRuntime;
  if (!disableAutoUpdater) {
    Promise.all([import('./process/services/autoUpdaterService'), import('./process/bridge/updateBridge')])
      .then(([{ autoUpdaterService }, { createAutoUpdateStatusBroadcast }]) => {
        // Create status broadcast callback that emits via ipcBridge (pure emitter, no window binding)
        const statusBroadcast = createAutoUpdateStatusBroadcast();
        autoUpdaterService.initialize(statusBroadcast);
        // Check for updates after 3 seconds delay
        // 3秒后检查更新
        setTimeout(() => {
          void autoUpdaterService.checkForUpdatesAndNotify();
        }, 3000);
      })
      .catch((error) => {
        console.error('[App] Failed to initialize autoUpdaterService:', error);
      });
  } else {
    console.log('[Headmaster] Auto-updater disabled via env/CI guard');
  }

  // Load the renderer: dev server URL in development, built HTML file in production
  const rendererUrl = process.env['ELECTRON_RENDERER_URL'];
  const fallbackFile = path.join(__dirname, '../renderer/index.html');

  if (!app.isPackaged && rendererUrl) {
    console.log(`[Headmaster] Loading renderer URL: ${rendererUrl}`);
    mainWindow.loadURL(rendererUrl).catch((error) => {
      console.error('[Headmaster] loadURL failed, falling back to file:', error.message || error);
      mainWindow.loadFile(fallbackFile).catch((e2) => {
        console.error('[Headmaster] loadFile fallback also failed:', e2.message || e2);
      });
    });
  } else {
    console.log(`[Headmaster] Loading renderer file: ${fallbackFile}`);
    mainWindow.loadFile(fallbackFile).catch((error) => {
      console.error('[Headmaster] loadFile failed:', error.message || error);
    });
  }

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('[Headmaster] did-fail-load:', { errorCode, errorDescription, validatedURL, isMainFrame });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Headmaster] render-process-gone:', details);

    // Reload the renderer to recover from the crash.
    // The isDestroyed() guard in adapter/main.ts prevents further sends
    // to the dead webContents while the reload is in progress.
    if (!mainWindow.isDestroyed()) {
      console.log('[Headmaster] Attempting to recover from renderer crash by reloading...');

      if (!app.isPackaged && rendererUrl) {
        mainWindow.loadURL(rendererUrl).catch((error) => {
          console.error('[Headmaster] Recovery loadURL failed:', error.message || error);
        });
      } else {
        mainWindow.loadFile(fallbackFile).catch((error) => {
          console.error('[Headmaster] Recovery loadFile failed:', error.message || error);
        });
      }
    }
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[Headmaster] Renderer became unresponsive');
  });

  mainWindow.on('closed', () => {
    console.log('[Headmaster] Main window closed');
  });

  // DevTools is no longer auto-opened at startup.
  // Use the DevTools toggle in Settings > System (dev mode only) to open it.

  // Listen to DevTools state changes and notify Renderer
  mainWindow.webContents.on('devtools-opened', () => {
    ipcBridge.application.devToolsStateChanged.emit({ isOpen: true });
  });

  mainWindow.webContents.on('devtools-closed', () => {
    ipcBridge.application.devToolsStateChanged.emit({ isOpen: false });
  });

  // 关闭拦截：当启用"关闭到托盘"时，隐藏窗口而非关闭
  // Close interception: hide window instead of closing when "close to tray" is enabled
  mainWindow.on('close', (event) => {
    if (mainWindow.isDestroyed()) return;
    if (getCloseToTrayEnabled() && !getIsQuitting()) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
};

const handleAppReady = async (): Promise<void> => {
  const t0 = performance.now();
  const mark = (label: string) => console.log(`[Headmaster:ready] ${label} +${Math.round(performance.now() - t0)}ms`);
  mark('start');

  if (!app.isPackaged) {
    try {
      const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer');
      await installExtension(REACT_DEVELOPER_TOOLS);
      console.log('[DevTools] React Developer Tools installed');
    } catch (e) {
      console.warn('[DevTools] Failed to install React DevTools:', e);
    }
  }

  // CLI mode: print app version and exit immediately (used by CI smoke tests)
  if (isVersionMode) {
    console.log(app.getVersion());
    app.exit(0);
    return;
  }

  // Set dock icon in development mode on macOS
  // In production, the icon is set via forge.config.ts packagerConfig.icon
  if (process.platform === 'darwin' && !app.isPackaged && app.dock) {
    try {
      const iconPath = path.join(process.cwd(), 'resources', 'app_dev.png');
      if (fs.existsSync(iconPath)) {
        const icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
          app.dock.setIcon(icon);
        }
      }
    } catch {
      // Ignore dock icon errors in development
    }
  }

  setSentryDeviceId();

  try {
    await initializeProcess();
    rendererInitialLanguage = ProcessConfig.getSync('language') ?? null;
    mark('initializeProcess');
  } catch (error) {
    console.error('Failed to initialize process:', error);
    app.exit(1);
    return;
  }

  // Start the real Hermes dashboard runtime first. Headmaster is a white-label
  // shell over Hermes Desktop/Workspace surfaces, so packaged builds should not
  // require the legacy bundled aioncore binary.
  const hermesStartup = await hermesBootstrap.start({ installIfMissing: false });
  if (hermesStartup.ok && hermesStartup.port) {
    (globalThis as typeof globalThis & { __hermesPort?: number; __hermesSessionToken?: string }).__hermesPort =
      hermesStartup.port;
    (globalThis as typeof globalThis & { __hermesSessionToken?: string }).__hermesSessionToken =
      hermesBootstrap.sessionToken;
    markBackendReady(hermesStartup.port, 'hermes.dashboard', 'hermes');
    mark('hermesBootstrap.start');
  } else {
    console.warn('[Headmaster] Hermes dashboard bootstrap failed; falling back to legacy aioncore:', hermesStartup.error);
  }

  // Legacy fallback: start aioncore only when the Hermes dashboard is not
  // available. This keeps old/dev installs usable but removes the packaging
  // dependency on a missing Adonis Core release asset.
  const backendStartup = await startBackendOrExit({
    startBackend: async () => {
      if (backendStartedOk) {
        return (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort ?? hermesStartup.port ?? 0;
      }
      assertStartupArchitectureCompatible({
        arch: process.arch,
        isPackaged: app.isPackaged,
        platform: process.platform,
      });
      const { getDataPath } = await import('./process/utils/utils');
      const { getSystemDir } = await import('./process/utils/initStorage');
      const sysDir = getSystemDir();
      return backendManager.start(
        getDataPath(),
        sysDir.logDir,
        {
          cacheDir: sysDir.cacheDir,
          workDir: sysDir.workDir,
          logDir: sysDir.logDir,
        },
        {
          allowPendingOnHealthTimeout: !(isWebUIMode || isResetPasswordMode),
          onHealthTimeout: async (error) => {
            markBackendStartupFailed(error);
            await captureBackendStartupFailure(error);
          },
          onPendingExit: async (error) => {
            markBackendStartupFailed(error);
            await captureBackendStartupFailure(error);
          },
          onReady: (backendPort) => {
            markBackendReady(backendPort, 'backendManager.lateReady', 'aioncore');
          },
        }
      );
    },
    onStarted: (backendPort) => {
      exposeBackendPort(backendPort);
      if (hermesStartup.ok) return;
      if (backendManager.status === 'running') {
        markBackendReady(backendPort, 'backendManager.start', 'aioncore');
        return;
      }
      mark(`backendManager.start pending health (port=${backendPort})`);
    },
    captureFailure: async (error) => {
      markBackendStartupFailed(error);
      await captureBackendStartupFailure(error);
    },
    exitApp: (code) => app.exit(code),
    exitOnFailure: isWebUIMode || isResetPasswordMode,
    logError: console.error,
  });
  if (!backendStartup.ok) {
    if (isWebUIMode || isResetPasswordMode) {
      return;
    }
  }


  // One-shot WebUI admin credential migration. Must run after the backend is
  // up (__backendPort set) and before any mode branch below that might log the
  // user in. Swallows its own errors; the next boot retries.
  const bootBackendPort = (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort;
  if (backendStartedOk && bootBackendPort) {
    await ensureAdminUserOnce(bootBackendPort);
  }

  // One-shot backend migrations are deferred until after the renderer finishes
  // loading. Some migration steps (ConfigStorage.get, ipcBridge.listProviders)
  // route through the renderer via BroadcastChannel; running them here would
  // deadlock because the renderer does not exist yet. See scheduleBackendMigrations().

  try {
    initializeZoomFactor(await ProcessConfig.get('ui.zoomFactor'));
    mark('initializeZoomFactor');
  } catch (error) {
    console.error('[Headmaster] Failed to restore zoom factor:', error);
    initializeZoomFactor(undefined);
  }

  try {
    loadSavedWindowBounds(await ProcessConfig.get('window.bounds'));
    mark('restoreWindowBounds');
  } catch (error) {
    console.error('[Headmaster] Failed to restore window bounds:', error);
    loadSavedWindowBounds(undefined);
  }

  if (isResetPasswordMode) {
    // Handle password reset without creating window
    try {
      const { resetPasswordCLI, resolveResetPasswordUsername } = await import('./process/utils/resetPasswordCLI');
      const username = resolveResetPasswordUsername(process.argv);

      await resetPasswordCLI(username);

      app.quit();
    } catch {
      app.exit(1);
    }
  } else if (isWebUIMode) {
    const userConfigInfo = loadUserWebUIConfig();
    if (userConfigInfo.exists && userConfigInfo.path) {
      // Config file loaded from user directory
    }
    const resolvedPort = resolveWebUIPort(userConfigInfo.config, getSwitchValue);
    const allowRemote = resolveRemoteAccess(userConfigInfo.config, isRemoteMode);
    try {
      // Inside Electron (`Headmaster --webui` or packaged `aionui-web` mode that
      // launches via the Electron shell), reuse the desktop app's data-dir so
      // that conversations / cron jobs created in any path show up everywhere.
      // Matches the desktop IPC path at line 493 above.
      const { getDataPath } = await import('./process/utils/utils');
      const { getSystemDir } = await import('./process/utils/initStorage');
      const sysDirWebUI = getSystemDir();
      // M6: Switch to @aionui/web-host
      const handle = await startWebHost({
        app: {
          version: app.getVersion(),
          isPackaged: app.isPackaged,
          resourcesPath: app.getAppPath(),
          // Same reason as dataDir below: webui.config.json must live next to
          // the DB under the CLI-safe symlink path, so every password-change
          // entry point (CLI --resetpass, settings-toggle IPC, browser login)
          // reads the same file.
          userDataPath: getDataPath(),
        },
        staticDir: path.join(__dirname, '../renderer'),
        port: resolvedPort,
        allowRemote,
        dataDir: getDataPath(),
        logDir: sysDirWebUI.logDir,
        // Expose the same HEADMASTER_{CACHE,WORK,LOG}_DIR env the desktop IPC path
        // passes at line 493, so /api/system/info reports the symlink workDir
        // instead of the path-with-spaces userData root.
        dirs: {
          cacheDir: sysDirWebUI.cacheDir,
          workDir: sysDirWebUI.workDir,
          logDir: sysDirWebUI.logDir,
        },
        backend: {
          kind: 'useExistingBackend',
          port: (() => {
            // Reuse the backend already spawned by backendManager.start() above.
            // Spawning a second backend here would race the first on SQLite.
            const port = (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort;
            if (!port) {
              throw new Error('[WebUI] Cannot start: aioncore is not running (globalThis.__backendPort unset)');
            }
            return port;
          })(),
        },
      });
      console.log(`[WebUI] Headless server started (port=${handle.port}, backendPort=${handle.backendPort})`);
    } catch (err) {
      console.error(`[WebUI] Failed to start server on port ${resolvedPort}:`, err);
      app.exit(1);
      return;
    }

    // Keep the process alive in WebUI mode by preventing default quit behavior.
    // On Linux headless (systemd), Electron may attempt to quit when no windows exist.
    app.on('will-quit', (event) => {
      // Only prevent quit if this is an unexpected exit (server still running).
      // Explicit app.exit() calls bypass will-quit, so they are unaffected.
      if (!isExplicitQuit) {
        event.preventDefault();
        console.warn('[WebUI] Prevented unexpected quit — server is still running');
      }
    });
  } else {
    // 初始化关闭到托盘设置 / Initialize close-to-tray setting
    if (isE2ETestMode) {
      setCloseToTrayEnabled(false);
      destroyTray();
    } else {
      try {
        const savedCloseToTray = await readCloseToTraySetting();
        setCloseToTrayEnabled(savedCloseToTray);
        if (getCloseToTrayEnabled()) {
          createOrUpdateTray();
        }
      } catch {
        // Ignore storage read errors, default to false
      }
    }

    const showMainWindowOnReady = !(wasLaunchedAtLogin() && getCloseToTrayEnabled());

    createWindow({ showOnReady: showMainWindowOnReady });
    appReadyDone = true;
    mark('createWindow');

    // Initialize desktop pet (delayed to not block main window)
    setTimeout(() => {
      void (async () => {
        try {
          const petEnabled = await ProcessConfig.get('pet.enabled');
          if (petEnabled === true) {
            // Read pet sub-settings before creating the pet so flags are honored
            // on the first createPetWindow() call (which is sync).
            const confirmEnabled = (await ProcessConfig.get('pet.confirmEnabled')) ?? true;
            const { createPetWindow, setPetConfirmEnabled } = await import('./process/pet/petManager');
            setPetConfirmEnabled(confirmEnabled);
            createPetWindow();
          }
        } catch (error) {
          console.error('[Pet] Failed to initialize:', error);
        }
      })();
    }, 3000);

    // 读取语言设置并初始化主进程 i18n，然后刷新托盘菜单
    // Read language setting and initialize main process i18n, then refresh tray menu
    try {
      const savedLanguage = await ProcessConfig.get('language');
      await setInitialLanguage(savedLanguage);
      // After language is set, refresh tray menu if it exists
      await refreshTrayMenu();
    } catch (error) {
      console.error('[index] Failed to initialize i18n language:', error);
    }

    // 监听语言变更，刷新托盘菜单文案 / Listen for language changes to refresh tray menu labels
    onLanguageChanged(() => {
      void refreshTrayMenu();
    });

    if (!isE2ETestMode) {
      // 窗口创建后异步恢复 WebUI，不阻塞 UI / Restore WebUI async after window creation, non-blocking
      restoreDesktopWebUIFromPreferences().catch((error) => {
        console.error('[WebUI] Failed to auto-restore:', error);
      });
    }

    // Flush pending deep-link URL (received before window was ready)
    const pendingUrl = getPendingDeepLinkUrl();
    if (pendingUrl) {
      clearPendingDeepLinkUrl();
      mainWindow.webContents.once('did-finish-load', () => {
        handleDeepLinkUrl(pendingUrl);
      });
    }
  }

  // Verify CDP is ready and log status
  const { cdpPort, verifyCdpReady } = await import('./process/utils/configureChromium');
  if (cdpPort) {
    const cdpReady = await verifyCdpReady(cdpPort);
    if (cdpReady) {
      console.log(`[CDP] Remote debugging server ready at http://127.0.0.1:${cdpPort}`);
      console.log(
        `[CDP] MCP chrome-devtools: npx chrome-devtools-mcp@0.16.0 --browser-url=http://127.0.0.1:${cdpPort}`
      );
    } else {
      console.warn(`[CDP] Warning: Remote debugging port ${cdpPort} not responding`);
    }
  }
};

// ============ Protocol Registration ============
// Register headmaster:// as the default protocol client
if (process.defaultApp) {
  // Dev mode: need to pass execPath explicitly
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

// macOS: handle headmaster:// URLs via the open-url event
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLinkUrl(url);
  if (isWebUIMode || isResetPasswordMode || !app.isReady()) {
    return;
  }
  // Focus existing window so user sees the result
  showOrCreateMainWindow({ mainWindow, createWindow });
});

// 监听 GPU 子进程崩溃，连续多次后下次启动自动关闭硬件加速（参见 ELECTRON-9A / ELECTRON-9D）。
installGpuCrashHandler();

// Ensure we don't miss the ready event when running in CLI/WebUI mode
void app
  .whenReady()
  .then(handleAppReady)
  .catch((error) => {
    // App initialization failed
    console.error('[Headmaster] App initialization failed:', error);
    app.quit();
  });

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // 当关闭到托盘启用时，不退出应用 / Don't quit when close-to-tray is enabled
  if (getCloseToTrayEnabled()) {
    return;
  }
  // In WebUI mode, don't quit when windows are closed since we're running a web server
  if (!isWebUIMode && process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  // Skip if handleAppReady hasn't finished — it will create the window itself.
  if (!appReadyDone) return;
  if (!isWebUIMode && app.isReady()) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 从托盘恢复隐藏的窗口 / Restore hidden window from tray
      showAndFocusMainWindow(mainWindow);
      if (process.platform === 'darwin' && app.dock) {
        void app.dock.show();
      }
    } else {
      createWindow();
    }
  }
});

installQuitCleanup({
  onBeforeQuit: (handler) => app.on('before-quit', (event) => handler(event)),
  quitApp: () => app.quit(),
  setIsQuitting,
  markExplicitQuit: () => {
    isExplicitQuit = true;
  },
  destroyTray,
  disposeCronResumeListener: () => {
    disposeCronResumeListener?.();
    disposeCronResumeListener = null;
  },
  // Stop aioncore subprocess — backend shutdown kills all agent children
  // transitively (no separate frontend workerTaskManager remains).
  stopBackend: () => backendManager.stop(),
  destroyPetWindow: async () => {
    const { destroyPetWindow } = await import('./process/pet/petManager');
    destroyPetWindow();
  },
  logInfo: console.log,
  logWarn: console.warn,
  logError: console.error,
});

app.on('will-quit', () => {
  console.log('[Headmaster] will-quit — all cleanup should be complete');
});

app.on('quit', (_event, exitCode) => {
  console.log(`[Headmaster] quit (exitCode=${exitCode})`);
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
