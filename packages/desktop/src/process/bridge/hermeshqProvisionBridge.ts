/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcMain } from 'electron';
import { provisionHermeshqDesktop, validateHermeshqRuntimeAccess } from '../services/hermeshqProvisionService';
import {
  clearHermeshqProvision,
  getHermeshqProvision,
  type HermeshqProvisionSnapshot,
} from '../connection/connectionConfig';

export function initHermeshqProvisionBridge(): void {
  ipcMain.handle('hermeshq:get-provision', () => {
    return getHermeshqProvision();
  });

  ipcMain.handle(
    'hermeshq:provision',
    async (
      _event,
      request: { client: 'headmaster_desktop'; version: string; platform: NodeJS.Platform }
    ): Promise<{ success: boolean; provision?: HermeshqProvisionSnapshot; status?: number; error?: string }> => {
      return provisionHermeshqDesktop(request);
    }
  );

  ipcMain.handle(
    'hermeshq:validate-runtime',
    async (
      _event,
      request: { runtime_id: string; requested_capability: string }
    ): Promise<{ success: boolean; validation?: { allowed: boolean; capabilities: string[]; role: string; ttl_seconds: number }; status?: number; error?: string }> => {
      return validateHermeshqRuntimeAccess(request);
    }
  );

  ipcMain.handle('hermeshq:clear-provision', () => {
    clearHermeshqProvision();
    return { success: true };
  });
}
