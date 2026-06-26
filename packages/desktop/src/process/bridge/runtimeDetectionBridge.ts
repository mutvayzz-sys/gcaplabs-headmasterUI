/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcMain } from 'electron';
import type { HermesBootstrap } from '@process/backend/hermesBootstrap';

export function initRuntimeDetectionBridge(hermesBootstrap: HermesBootstrap): void {
  ipcMain.handle('runtime:check-and-prompt', () => {
    // Installation is driven by hermesBootstrap.start({ installIfMissing: true }) in
    // index.ts after the window is created. The renderer watches install:progress IPC
    // events and shows its own InstallScreen — no native dialog needed here.
    return { detected: hermesBootstrap.isInstalled() };
  });
}
