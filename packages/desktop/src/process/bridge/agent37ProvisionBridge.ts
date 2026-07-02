/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * IPC bridge for Agent37-backed desktop provisioning.
 *
 * Exposes the Agent37 control plane (now proxied through the Headmaster
 * Console BFF) to the renderer. The IPC channel names keep the historical
 * `hermeshq:*` prefix to avoid churning renderer-side bindings; the underlying
 * implementation talks to Console2's `/api/desktop/provision/current` and
 * `/api/desktop/runtime/validate` endpoints.
 */

import { ipcMain } from 'electron';
import {
  provisionAgent37Desktop,
  validateAgent37RuntimeAccess,
  type Agent37ProvisionRequest,
  type Agent37RuntimeValidationRequest,
} from '../services/agent37ProvisionService';
import {
  clearAgent37Provision,
  getAgent37Provision,
  type Agent37ProvisionSnapshot,
} from '../connection/connectionConfig';

export function initAgent37ProvisionBridge(): void {
  ipcMain.handle('hermeshq:get-provision', () => {
    return getAgent37Provision();
  });

  ipcMain.handle(
    'hermeshq:provision',
    async (_event, request: Agent37ProvisionRequest) => {
      return provisionAgent37Desktop(request);
    }
  );

  ipcMain.handle(
    'hermeshq:validate-runtime',
    async (_event, request: Agent37RuntimeValidationRequest) => {
      return validateAgent37RuntimeAccess(request);
    }
  );

  ipcMain.handle('hermeshq:clear-provision', () => {
    clearAgent37Provision();
    return { success: true };
  });
}

// Re-export for downstream type consumers
export type { Agent37ProvisionSnapshot };
