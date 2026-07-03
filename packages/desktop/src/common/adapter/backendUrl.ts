/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Single source of truth for the desktop's base URL resolution.
 *
 * Three transport seams live in this codebase and they each have their own
 * globals injection point:
 *
 *   1. Agent37 /v1 (cloud container)  -> `__cloudContainerEndpoint` + Bearer token
 *      Provision response from console.gcaplabs.com sets
 *      `window.__cloudContainerEndpoint` (see AuthContext.applyProvisionGlobals).
 *      All `/v1/responses`, `/v1/sessions`, `/v1/files/*` traffic lands here.
 *
 *   2. Local Hermes dashboard          -> `__backendHost` + `__backendPort`
 *      `hermesBootstrap.start()` writes the loopback port to
 *      `globalThis.__backendPort` and `useDashboardStatus` mirrors it onto
 *      `window.__backendPort`. Legacy manual-remote mode (Settings → Runtime
 *      "Remote Hermes") populates the same globals with a user-typed host.
 *      The local dashboard exposes both `/api/*` and `/api/ws`.
 *
 *   3. GCAPCore sidecar (Council / ACP) -> `__gcapcorePort`
 *      Separate port, used for ACP / multi-agent team events. Routed through
 *      `aioncoreBridge.ts`, NOT through this module — different concern.
 *
 * WebUI browser mode has no Electron preload, so none of the above globals
 * are injected. Requests go same-origin to the web-host's static server,
 * which reverse-proxies `/api/*` and upgrades `/ws` to the local backend.
 *
 * The pre-port-9119-era fallback constant (13400) is intentionally gone.
 * That was the AionUi Electron port and nothing on the current runtime
 * listens there. Callers must read the published port from
 * `__backendPort`; if it's 0 (dashboard not ready), they should refuse to
 * send instead of silently connecting to a dead port.
 */

declare global {
  interface Window {
    __backendPort?: number;
    __backendHost?: string;
    __hermesSessionToken?: string;
    /** Cloud container endpoint URL set by AuthContext.applyProvisionGlobals. */
    __cloudContainerEndpoint?: string;
  }
}

const DEFAULT_BACKEND_HOST = '127.0.0.1';
/**
 * Local-dashboard default port. The Hermes dashboard defaults to 9119 (see
 * `hermes_cli/subcommands/dashboard.py:26`) and the legacy manual-remote
 * mode (`Settings → Runtime`) also starts there. Only used as a last-resort
 * fallback in environments where neither the renderer nor the main process
 * has published a port (notably the vitest node environment). Production
 * Electron paths always have a real port published before the first HTTP
 * call goes out.
 */
export const DEFAULT_LOCAL_DASHBOARD_PORT = 9119;

/** Host published by main/preload for local or remote Hermes connections. */
export function resolveBackendHost(): string {
  if (typeof window !== 'undefined' && window.__backendHost) {
    return window.__backendHost;
  }
  const g = globalThis as typeof globalThis & { __backendHost?: string };
  return g.__backendHost ?? DEFAULT_BACKEND_HOST;
}

/**
 * Port published by main/preload once the runtime is ready.
 *
 * Returns 0 (not a real port) when nothing has been published. Callers that
 * actually want to talk to the backend should treat 0 as "not ready" — see
 * `httpBridge.httpRequest`'s `port <= 0` guard. The previous AionUi-era
 * default of 13400 has been removed because nothing listens on it anymore;
 * failing fast on 0 surfaces the misconfiguration rather than silently
 * hitting a dead port.
 *
 * @param fallback Optional last-resort port. Only honored when no port is
 *   published. Defaults to 0 so the caller can decide whether to refuse the
 *   request. The local-dashboard default (9119) is opt-in via
 *   `DEFAULT_LOCAL_DASHBOARD_PORT`.
 */
export function resolveBackendPort(fallback = 0): number {
  if (typeof window !== 'undefined') {
    const w = window.__backendPort;
    if (typeof w === 'number' && w > 0) return w;
  }
  const g = globalThis as typeof globalThis & { __backendPort?: number };
  const port = g.__backendPort;
  return typeof port === 'number' && port > 0 ? port : fallback;
}

/**
 * True when AuthContext has set `__cloudContainerEndpoint` from the
 * provision response. In this mode all backend traffic must go to that
 * cloud endpoint (with the provisioned Bearer token) — never to the local
 * Hermes dashboard on `__backendPort`.
 */
export function isRemoteContainerMode(): boolean {
  if (typeof window !== 'undefined' && window.__cloudContainerEndpoint) {
    return true;
  }
  const g = globalThis as typeof globalThis & { __cloudContainerEndpoint?: string };
  return Boolean(g.__cloudContainerEndpoint);
}

/**
 * WebUI (browser) mode: no Electron preload, so `window.__backendPort` and
 * `window.electronAPI` are both missing. Requests must go same-origin so
 * the web-host's static server can reverse-proxy `/api/*` and upgrade `/ws`.
 */
export function isWebUiBrowserMode(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  return !(window as Window & { electronAPI?: unknown }).electronAPI;
}

/**
 * Single source of truth for the backend base URL. The Settings, config
 * service, http bridge, runtime probes, and speech stream all read this —
 * so updating the resolution here updates them everywhere.
 *
 * - Agent37 cloud (remote container): returns the provisioned cloud
 *   endpoint verbatim.
 * - WebUI browser mode: returns `''` so callers concatenate to a same-origin
 *   path like `fetch('/api/foo')`.
 * - Electron renderer + legacy manual remote: `http://<host>:<port>`.
 */
export function getBackendBase(): string {
  if (typeof window === 'undefined') return '';
  if (isRemoteContainerMode()) {
    const endpoint = resolveCloudContainerEndpoint();
    if (endpoint) return endpoint;
  }
  if (isWebUiBrowserMode()) return '';
  return `http://${resolveBackendHost()}:${resolveBackendPort()}`;
}

/**
 * Resolved Agent37 / Hermes Cloud endpoint URL. Returns `''` if the
 * provision response did not advertise one.
 */
export function resolveCloudContainerEndpoint(): string {
  if (typeof window !== 'undefined' && window.__cloudContainerEndpoint) {
    return window.__cloudContainerEndpoint;
  }
  const g = globalThis as typeof globalThis & { __cloudContainerEndpoint?: string };
  return g.__cloudContainerEndpoint ?? '';
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
