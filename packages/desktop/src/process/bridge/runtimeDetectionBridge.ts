/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcMain, dialog, app } from 'electron';
import type { HermesBootstrap } from '@process/backend/hermesBootstrap';

export interface RuntimeChoice {
  action: 'use-detected' | 'specify-path' | 'skip' | 'quit' | 'retry';
  customPath?: string;
}

let userRuntimeChoice: RuntimeChoice | null = null;

export function getUserRuntimeChoice(): RuntimeChoice | null {
  return userRuntimeChoice;
}

export function initRuntimeDetectionBridge(hermesBootstrap: HermesBootstrap): void {
  ipcMain.handle('runtime:check-and-prompt', async () => {
    const isInstalled = hermesBootstrap.isInstalled();

    if (isInstalled) {
      userRuntimeChoice = { action: 'use-detected' };
      return {
        detected: true,
        path: hermesBootstrap.hermesHome,
      };
    }

    // Show dialog only when auto-install has already failed
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Runtime Installation Failed',
      message: 'Headmaster could not install its runtime automatically.',
      detail:
        'The Headmaster runtime failed to install. This may be due to network issues or missing system prerequisites.\n\n' +
        'Would you like to:\n' +
        '• Retry the installation\n' +
        '• Specify a custom runtime installation path\n' +
        '• Quit',
      buttons: ['Retry', 'Specify Path', 'Quit'],
      defaultId: 0,
      cancelId: 2,
    });

    switch (result.response) {
      case 0: // Retry
        userRuntimeChoice = { action: 'retry' };
        return { detected: false, choice: 'retry' };

      case 1: // Specify Path
        const pathResult = await dialog.showOpenDialog({
          title: 'Select Runtime Installation Directory',
          properties: ['openDirectory'],
          message: 'Select the directory containing your runtime installation',
        });
        if (!pathResult.canceled && pathResult.filePaths[0]) {
          userRuntimeChoice = { action: 'specify-path', customPath: pathResult.filePaths[0] };
          return { detected: false, choice: 'specify-path', customPath: pathResult.filePaths[0] };
        }
        userRuntimeChoice = { action: 'retry' };
        return { detected: false, choice: 'retry' };

      case 2: // Quit
      default:
        app.quit();
        return { detected: false, choice: 'quit' };
    }
  });
}
