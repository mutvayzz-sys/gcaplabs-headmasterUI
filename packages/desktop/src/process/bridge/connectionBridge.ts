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
  getAgent37Config,
  setAgent37Url,
  setAgent37Token,
  clearAgent37Token,
  clearAgent37Provision,
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

  ipcMain.handle('agent37:get-config', () => {
    return getAgent37Config();
  });

  ipcMain.handle('agent37:set-url', (_event, url: string) => {
    setAgent37Url(typeof url === 'string' ? url : '');
    return { success: true };
  });

  ipcMain.handle('agent37:set-token', (_event, token: string) => {
    setAgent37Token(typeof token === 'string' ? token : '');
    return { success: true };
  });

  ipcMain.handle('agent37:clear-token', () => {
    clearAgent37Token();
    clearAgent37Provision();
    return { success: true };
  });
}
