/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hermes Bridge — IPC handlers exposing the HermesBootstrap to the renderer.
 *
 * Replaces the legacy `ipcMain.on('get-backend-port', ...)` Hermes plumbing
 * with three bridge providers under the `hermes.*` namespace:
 *
 *   - `hermes.getDashboardPort()` — returns the OS-assigned port the dashboard
 *     is listening on, or `0` if not yet ready.
 *   - `hermes.getDashboardStatus()` — returns the full status object
 *     (status string, port, lastError, hermesHome, sessionToken).
 *   - `hermes.getSessionToken()` — returns just the token, for the renderer
 *     to inject as `X-Hermes-Session-Token` on REST and `?token=` on WS.
 *
 * The bootstrap instance is provided as a constructor dep (matching the
 * `BackendLifecycleManager` threading pattern in `src/index.ts`).
 *
 * Recon reference: `headmaster-hermes/RECON.md` §5 (session token auth).
 */

import { ipcBridge } from '@/common';
import type { HermesBootstrap, HermesBootstrapStatus } from '@process/backend/hermesBootstrap';

export interface HermesDashboardStatusResponse {
  status: HermesBootstrapStatus;
  port: number;
  lastError: string | null;
  hermesHome: string;
  sessionToken: string;
}

export function initHermesBridge(bootstrap: HermesBootstrap): void {
  ipcBridge.hermes.getDashboardPort.provider(() => Promise.resolve(bootstrap.port));

  ipcBridge.hermes.getDashboardStatus.provider(() =>
    Promise.resolve({
      status: bootstrap.status,
      port: bootstrap.port,
      lastError: bootstrap.lastError,
      hermesHome: bootstrap.hermesHome,
      sessionToken: bootstrap.sessionToken,
    } satisfies HermesDashboardStatusResponse)
  );

  ipcBridge.hermes.getSessionToken.provider(() => Promise.resolve(bootstrap.sessionToken));
}

export type { HermesBootstrap, HermesBootstrapStatus };
