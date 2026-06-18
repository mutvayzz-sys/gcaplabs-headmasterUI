/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Window {
    __backendPort?: number;
    __backendHost?: string;
    __hermesSessionToken?: string;
  }
}

/**
 * Single source of truth for the backend base URL. The Settings, config
 * service, http bridge, and runtime probes all read this — so updating the
 * resolution here updates them everywhere.
 *
 * - In WebUI browser mode (no preload) we use the same-origin host so its
 *   static server can reverse-proxy /api/* to the backend.
 * - In Electron we use the host + port that the main process publishes via
 *   the `get-backend-port` IPC handler. For remote connections, the host
 *   comes from `window.__backendHost` (set by preload from connection config).
 *   Default: `127.0.0.1:{port}` for local mode.
 */
export function getBackendBase(): string {
  if (typeof window === 'undefined') return '';
  if (typeof document !== 'undefined' && !window.electronAPI) {
    return '';
  }
  const port = window.__backendPort || 13400;
  const host = window.__backendHost || '127.0.0.1';
  return `http://${host}:${port}`;
}

/**
 * Headers the renderer should attach to every backend call when a Hermes
 * session token is available. Backend returns 401 without it in packaged
 * builds.
 */
export function getBackendAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = window.__hermesSessionToken;
  return token ? { 'X-Hermes-Session-Token': token } : {};
}
