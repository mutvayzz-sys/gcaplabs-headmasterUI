/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * IPC bridge for Agent37-backed desktop provisioning.
 *
 * Exposes the Agent37 control plane (now proxied through the Headmaster
 * Console BFF) to the renderer. The IPC channel names keep the historical
 * `agent37:*` prefix to avoid churning renderer-side bindings; the underlying
 * implementation talks to Console2's `/api/desktop/provision/current` and
 * `/api/desktop/runtime/validate` endpoints.
 */

import { ipcMain } from 'electron';
import {
  getManagedRuntime,
  loginAgent37Desktop,
  logoutAgent37Desktop,
  provisionAgent37Desktop,
  refreshAgent37TokenDesktop,
  registerAgent37Desktop,
  resizeManagedRuntime,
  restartManagedRuntime,
  startManagedRuntime,
  stopManagedRuntime,
  updateManagedRuntime,
  validateAgent37RuntimeAccess,
  type Agent37LoginRequest,
  type Agent37ProvisionRequest,
  type Agent37RegisterRequest,
  type Agent37RuntimeValidationRequest,
  type ResizeInput,
} from '../services/agent37ProvisionService';
import {
  clearAgent37Provision,
  getAgent37Provision,
  type Agent37ProvisionSnapshot,
} from '../connection/connectionConfig';

export function initAgent37ProvisionBridge(): void {
  ipcMain.handle('agent37:get-provision', () => {
    return getAgent37Provision();
  });

  ipcMain.handle('agent37:provision', async (_event, request: Agent37ProvisionRequest) => {
    return provisionAgent37Desktop(request);
  });

  ipcMain.handle('agent37:validate-runtime', async (_event, request: Agent37RuntimeValidationRequest) => {
    return validateAgent37RuntimeAccess(request);
  });

  ipcMain.handle('agent37:clear-provision', () => {
    clearAgent37Provision();
    return { success: true };
  });

  // Auth: login/register/logout run here (not the renderer) so the request
  // is a Node fetch, not a browser-context one — the renderer loads from
  // file:// (packaged) or http://localhost:5173 (dev), and a direct fetch to
  // console.gcaplabs.com from there is cross-origin and subject to CORS,
  // which console does not currently allow. No MFA channel: the console's
  // auth is plain Supabase email+password with no MFA concept.
  ipcMain.handle('agent37:login', (_event, request: Agent37LoginRequest) => loginAgent37Desktop(request));
  ipcMain.handle('agent37:register', (_event, request: Agent37RegisterRequest) => registerAgent37Desktop(request));
  ipcMain.handle('agent37:refresh-token', () => refreshAgent37TokenDesktop());
  ipcMain.handle('agent37:logout', () => logoutAgent37Desktop());

  // Managed-runtime lifecycle (proxied to console /api/chat/runtime/*).
  // Channels are read-only in the renderer; the IPC layer is the only
  // surface that talks to the console.
  ipcMain.handle('agent37:runtime:get', () => getManagedRuntime());
  ipcMain.handle('agent37:runtime:start', () => startManagedRuntime());
  ipcMain.handle('agent37:runtime:stop', () => stopManagedRuntime());
  ipcMain.handle('agent37:runtime:restart', () => restartManagedRuntime());
  ipcMain.handle('agent37:runtime:update', () => updateManagedRuntime());
  ipcMain.handle('agent37:runtime:resize', (_event, input: ResizeInput) => resizeManagedRuntime(input));
}

// Re-export for downstream type consumers
export type { Agent37ProvisionSnapshot };
