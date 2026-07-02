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
  // Agent37 Console2 BFF config — stored URL + token for multi-user auth.
  // Canonical names are `agent37:*`; the `hermeshq:*` aliases are kept for
  // one release as a transition shim. The IPC channels are stable and
  // served by `agent37ProvisionBridge.ts` (registered as the
  // `hermeshq:*` channel family).
  getAgent37Config: () => ipcRenderer.invoke('hermeshq:get-config'),
  getAgent37Provision: () => ipcRenderer.invoke('hermeshq:get-provision'),
  setAgent37Url: (url: string) => ipcRenderer.invoke('hermeshq:set-url', url),
  setAgent37Token: (token: string) => ipcRenderer.invoke('hermeshq:set-token', token),
  clearAgent37Token: () => ipcRenderer.invoke('hermeshq:clear-token'),
  clearAgent37Provision: () => ipcRenderer.invoke('hermeshq:clear-provision'),
  provisionAgent37: (request: { client: 'headmaster_desktop'; version: string; platform: NodeJS.Platform }) =>
    ipcRenderer.invoke('hermeshq:provision', request),
  validateAgent37Runtime: (request: { runtime_id: string; requested_capability: string }) =>
    ipcRenderer.invoke('hermeshq:validate-runtime', request),
  // Legacy `hermeshq:*` aliases — kept for one release.
  getHermeshqConfig: () => ipcRenderer.invoke('hermeshq:get-config'),
  getHermeshqProvision: () => ipcRenderer.invoke('hermeshq:get-provision'),
  setHermeshqUrl: (url: string) => ipcRenderer.invoke('hermeshq:set-url', url),
  setHermeshqToken: (token: string) => ipcRenderer.invoke('hermeshq:set-token', token),
  clearHermeshqToken: () => ipcRenderer.invoke('hermeshq:clear-token'),
  clearHermeshqProvision: () => ipcRenderer.invoke('hermeshq:clear-provision'),
  provisionHermeshq: (request: { client: 'headmaster_desktop'; version: string; platform: NodeJS.Platform }) =>
    ipcRenderer.invoke('hermeshq:provision', request),
  validateHermeshqRuntime: (request: { runtime_id: string; requested_capability: string }) =>
    ipcRenderer.invoke('hermeshq:validate-runtime', request),
  // Remembered credentials — stored encrypted via OS safeStorage, never in localStorage
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
