/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcMain } from 'electron';
import {
  getConnectionMode,
  setConnectionMode,
  getRemoteConfig,
  setRemoteConfig,
  getHermeshqConfig,
  setHermeshqUrl,
  setHermeshqToken,
  clearHermeshqToken,
  clearHermeshqProvision,
  type ConnectionMode,
  type RemoteConnectionConfig,
} from '../connection/connectionConfig';

export function initConnectionBridge(): void {
  ipcMain.handle('connection:get-mode', () => {
    return getConnectionMode();
  });

  ipcMain.handle('connection:set-mode', (_event, mode: ConnectionMode) => {
    setConnectionMode(mode);
    return { success: true };
  });

  ipcMain.handle('connection:get-remote-config', () => {
    return getRemoteConfig();
  });

  ipcMain.handle('connection:set-remote-config', (_event, config: RemoteConnectionConfig) => {
    setRemoteConfig(config);
    return { success: true };
  });

  ipcMain.handle('hermeshq:get-config', () => {
    return getHermeshqConfig();
  });

  ipcMain.handle('hermeshq:set-url', (_event, url: string) => {
    setHermeshqUrl(typeof url === 'string' ? url : '');
    return { success: true };
  });

  ipcMain.handle('hermeshq:set-token', (_event, token: string) => {
    setHermeshqToken(typeof token === 'string' ? token : '');
    return { success: true };
  });

  ipcMain.handle('hermeshq:clear-token', () => {
    clearHermeshqToken();
    clearHermeshqProvision();
    return { success: true };
  });
}
