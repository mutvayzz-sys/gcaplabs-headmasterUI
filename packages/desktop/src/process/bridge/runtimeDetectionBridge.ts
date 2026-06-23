/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcMain, dialog, app } from 'electron';
import type { HermesBootstrap } from '@process/backend/hermesBootstrap';

export interface RuntimeChoice {
  action: 'use-detected' | 'specify-path' | 'skip' | 'quit';
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

    // Show dialog to user
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Runtime Not Found',
      message: 'Headmaster requires the Python runtime to function.',
      detail:
        'The Python runtime was not detected at the expected location.\n\n' +
        'Would you like to:\n' +
        '• Specify a custom runtime installation path\n' +
        '• Launch without runtime (limited functionality)\n' +
        '• Quit and install the runtime',
      buttons: ['Specify Path', 'Launch Without Runtime', 'Quit'],
      defaultId: 2,
      cancelId: 2,
    });

    switch (result.response) {
      case 0: // Specify Path
        const pathResult = await dialog.showOpenDialog({
          title: 'Select Runtime Installation Directory',
          properties: ['openDirectory'],
          message: 'Select the directory containing your runtime installation',
        });
        if (!pathResult.canceled && pathResult.filePaths[0]) {
          userRuntimeChoice = { action: 'specify-path', customPath: pathResult.filePaths[0] };
          return { detected: false, choice: 'specify-path', customPath: pathResult.filePaths[0] };
        }
        // Fall through to skip if user cancels
        userRuntimeChoice = { action: 'skip' };
        return { detected: false, choice: 'skip' };

      case 1: // Launch Without Runtime
        userRuntimeChoice = { action: 'skip' };
        return { detected: false, choice: 'skip' };

      case 2: // Quit
      default:
        app.quit();
        return { detected: false, choice: 'quit' };
    }
  });
}
