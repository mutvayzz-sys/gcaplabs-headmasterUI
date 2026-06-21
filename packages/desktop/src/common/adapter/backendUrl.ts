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

const DEFAULT_BACKEND_HOST = '127.0.0.1';
const DEFAULT_BACKEND_PORT = 13400;

/** Host published by main/preload for local or remote Hermes connections. */
export function resolveBackendHost(): string {
  if (typeof window !== 'undefined' && window.__backendHost) {
    return window.__backendHost;
  }
  const g = globalThis as typeof globalThis & { __backendHost?: string };
  return g.__backendHost ?? DEFAULT_BACKEND_HOST;
}

/** Port published by main/preload once the runtime is ready. */
export function resolveBackendPort(fallback = DEFAULT_BACKEND_PORT): number {
  if (typeof window !== 'undefined') {
    const w = window.__backendPort;
    if (typeof w === 'number' && w > 0) return w;
  }
  const g = globalThis as typeof globalThis & { __backendPort?: number };
  const port = g.__backendPort;
  return typeof port === 'number' && port > 0 ? port : fallback;
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
  return `http://${resolveBackendHost()}:${resolveBackendPort()}`;
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
