/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

// Hook Sentry IPC so the renderer SDK uses ipcRenderer.send instead of falling
// back to fetch('sentry-ipc://...'), which floods the DevTools Network panel.
// Bundled into this preload via `externalizeDepsPlugin({ exclude: [...] })` so
// Electron's sandbox-mode preload doesn't try to resolve it from node_modules.
import '@sentry/electron/preload';
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { ADAPTER_BRIDGE_EVENT_KEY } from '../common/adapter/constant';

/**
 * @description 注入到renderer进程中, 用于与main进程通信
 * */
contextBridge.exposeInMainWorld('electronAPI', {
  emit: (name: string, data: any) => {
    return ipcRenderer
      .invoke(
        ADAPTER_BRIDGE_EVENT_KEY,
        JSON.stringify({
          name: name,
          data: data,
        })
      )
      .catch((error) => {
        console.error('IPC invoke error:', error);
        throw error;
      });
  },
  on: (callback: any) => {
    const handler = (event: any, value: any) => {
      callback({ event, value });
    };
    ipcRenderer.on(ADAPTER_BRIDGE_EVENT_KEY, handler);
    return () => {
      ipcRenderer.off(ADAPTER_BRIDGE_EVENT_KEY, handler);
    };
  },
  // 获取拖拽文件/目录的绝对路径 / Get absolute path for dragged file/directory
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  // Feedback: collect and compress recent log files
  collectFeedbackLogs: () => ipcRenderer.invoke('feedback:collect-logs'),
  // Feedback: capture a screenshot of the current window
  captureFeedbackScreenshot: () => ipcRenderer.invoke('feedback:capture-screenshot'),
  // Runtime connection mode (local Hermes vs remote Hermes gateway)
  getConnectionMode: () => ipcRenderer.invoke('connection:get-mode'),
  setConnectionMode: (mode: 'local' | 'remote') => ipcRenderer.invoke('connection:set-mode', mode),
  getRemoteConnectionConfig: () => ipcRenderer.invoke('connection:get-remote-config'),
  setRemoteConnectionConfig: (config: { host: string; port: number; token: string }) =>
    ipcRenderer.invoke('connection:set-remote-config', config),
  restartRuntime: () => ipcRenderer.invoke('runtime:restart'),
  // Runtime detection for startup
  checkHermesRuntime: () => ipcRenderer.invoke('runtime:check-and-prompt'),
  // Agent37 Console BFF config — stored URL + token for multi-user auth.
  getAgent37Config: () => ipcRenderer.invoke('agent37:get-config'),
  getAgent37Provision: () => ipcRenderer.invoke('agent37:get-provision'),
  setAgent37Url: (url: string) => ipcRenderer.invoke('agent37:set-url', url),
  setAgent37Token: (token: string) => ipcRenderer.invoke('agent37:set-token', token),
  clearAgent37Token: () => ipcRenderer.invoke('agent37:clear-token'),
  clearAgent37Provision: () => ipcRenderer.invoke('agent37:clear-provision'),
  provisionAgent37: (request: { client: 'headmaster_desktop'; version: string; platform: NodeJS.Platform }) =>
    ipcRenderer.invoke('agent37:provision', request),
  validateAgent37Runtime: (request: { runtime_id: string; requested_capability: string }) =>
    ipcRenderer.invoke('agent37:validate-runtime', request),
  // Auth: run in the main process to avoid renderer-context CORS (the
  // renderer loads from file:// or http://localhost:5173, both cross-origin
  // from console.gcaplabs.com). No MFA: the console's auth is plain Supabase
  // email+password with no MFA concept.
  login: (request: { email: string; password: string }) => ipcRenderer.invoke('agent37:login', request),
  register: (request: { email: string; password: string }) => ipcRenderer.invoke('agent37:register', request),
  refreshAgent37Token: () => ipcRenderer.invoke('agent37:refresh-token'),
  logoutAgent37: () => ipcRenderer.invoke('agent37:logout'),
  // Managed-runtime lifecycle (proxied to console /api/chat/runtime/*). The
  // renderer never talks to the console directly; everything routes through
  // these IPC channels. The console is the source of truth for the singleton
  // (resolved from the logged-in user's profile).
  getAgent37Runtime: () => ipcRenderer.invoke('agent37:runtime:get'),
  startAgent37Runtime: () => ipcRenderer.invoke('agent37:runtime:start'),
  stopAgent37Runtime: () => ipcRenderer.invoke('agent37:runtime:stop'),
  restartAgent37Runtime: () => ipcRenderer.invoke('agent37:runtime:restart'),
  updateAgent37Runtime: () => ipcRenderer.invoke('agent37:runtime:update'),
  resizeAgent37Runtime: (input: { cpu?: number; memory?: number; disk?: number }) =>
    ipcRenderer.invoke('agent37:runtime:resize', input),

  // Composio integrations, proxied to console /api/chat/integrations/* (same reasoning as the
  // auth channels above — Node fetch in the main process, not a CORS-restricted renderer fetch).
  listComposioToolkits: (params: { search?: string; cursor?: string }) =>
    ipcRenderer.invoke('agent37:integrations:toolkits', params),
  listComposioConnections: () => ipcRenderer.invoke('agent37:integrations:connections'),
  connectComposioToolkit: (toolkit: string) => ipcRenderer.invoke('agent37:integrations:connect', toolkit),
  registerComposioMcp: (toolkit: string) => ipcRenderer.invoke('agent37:integrations:register-mcp', toolkit),
  disconnectComposioConnection: (connectionId: string) =>
    ipcRenderer.invoke('agent37:integrations:disconnect', connectionId),
  // Opens a real BrowserWindow for the Composio OAuth flow and resolves once its navigation
  // carries a connected_account_id — see composioIntegrationsBridge.ts for why this can't reuse
  // the browser-side window.opener.postMessage pattern the web console uses.
  runComposioOAuthPopup: (redirectUrl: string) => ipcRenderer.invoke('agent37:integrations:oauth-popup', redirectUrl),

  saveCredentials: (creds: { username: string; password: string }) => ipcRenderer.invoke('credentials:save', creds),
  loadCredentials: () => ipcRenderer.invoke('credentials:load'),
  clearCredentials: () => ipcRenderer.invoke('credentials:clear'),
  // OAuth login via popup BrowserWindow — returns JWT token on success
  triggerOAuthLogin: (provider: string) =>
    ipcRenderer.invoke('oauth:trigger-login', provider) as Promise<{
      success: boolean;
      token?: string;
      error?: string;
    }>,
  // Install progress — subscribe/unsubscribe to stage-by-stage progress events
  onInstallProgress: (callback: (progress: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => callback(progress);
    ipcRenderer.on('install:progress', handler);
    return () => ipcRenderer.off('install:progress', handler);
  },
});

// Synchronously fetch the backend port/session token and expose it to the renderer
// via contextBridge (direct window assignment is invisible under contextIsolation).
const backendPort = ipcRenderer.sendSync('get-backend-port') as number;
const gcapcorePort = ipcRenderer.sendSync('get-aioncore-port') as number;
const backendHost = ipcRenderer.sendSync('get-backend-host') as string;
const hermesSessionToken = ipcRenderer.sendSync('get-hermes-session-token') as string;
const initialLanguage = ipcRenderer.sendSync('get-initial-language') as string | null;
const backendStartupFailed = ipcRenderer.sendSync('get-backend-startup-failed') as boolean;
const backendStartupFailure = ipcRenderer.sendSync('get-backend-startup-failure') as unknown;
// IMPORTANT: __backendPort and __hermesSessionToken are NOT exposed via
// contextBridge.exposeInMainWorld. That API creates read-only, non-configurable
// properties — the renderer hook (useDashboardStatus.ts) needs to WRITE to these
// as the dashboard lifecycle changes, so exposing them here would throw
// "Cannot assign to read only property" on every status update.
// The renderer creates these as writable properties on first poll.
contextBridge.exposeInMainWorld('__gcapcorePort', gcapcorePort > 0 ? gcapcorePort : 0);
contextBridge.exposeInMainWorld('__aioncorePort', gcapcorePort > 0 ? gcapcorePort : 0);
contextBridge.exposeInMainWorld('__backendHost', backendHost || '127.0.0.1');
contextBridge.exposeInMainWorld('__initialLanguage', initialLanguage ?? null);
contextBridge.exposeInMainWorld('__backendStartupFailed', backendStartupFailed === true);
contextBridge.exposeInMainWorld('__backendStartupFailure', backendStartupFailure ?? null);

// 托盘事件监听 - 将 IPC 事件转换为 DOM 事件
// Tray event listeners - convert IPC events to DOM events
const trayEvents = [
  'tray:navigate-to-guid',
  'tray:navigate-to-conversation',
  'tray:open-about',
  'tray:pause-all-tasks',
  'tray:check-update',
];

for (const channel of trayEvents) {
  ipcRenderer.on(channel, (_event, ...args) => {
    window.dispatchEvent(new CustomEvent(channel, { detail: args[0] }));
  });
}

ipcRenderer.on('hermes:runtime-changed', () => {
  window.dispatchEvent(new CustomEvent('hermes:runtime-changed'));
});

// API server key — set once after provision, then broadcast on re-login.
// Written directly on window (not via contextBridge) so it stays mutable.
const _initialApiKey = ipcRenderer.sendSync('get-api-server-key') as string | null;
if (_initialApiKey) {
  (window as Window & { __apiServerKey?: string }).__apiServerKey = _initialApiKey;
}
ipcRenderer.on('backend:api-server-key', (_event, key: string) => {
  (window as Window & { __apiServerKey?: string }).__apiServerKey = key;
});
