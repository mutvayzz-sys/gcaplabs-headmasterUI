/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app, ipcMain, safeStorage } from 'electron';

interface StoredCredentials {
  username: string;
  password: string;
}

function credentialsPath(): string {
  return join(app.getPath('userData'), 'remembered-credentials.bin');
}

export function initCredentialsBridge(): void {
  ipcMain.handle('credentials:save', (_event, creds: StoredCredentials) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'Encryption unavailable on this system' };
      }
      const json = JSON.stringify({ username: creds.username, password: creds.password });
      const encrypted = safeStorage.encryptString(json);
      const path = credentialsPath();
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, encrypted);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('credentials:load', () => {
    try {
      const path = credentialsPath();
      if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) {
        return { success: false, credentials: null };
      }
      const encrypted = readFileSync(path);
      const json = safeStorage.decryptString(encrypted);
      const credentials = JSON.parse(json) as StoredCredentials;
      return { success: true, credentials };
    } catch {
      return { success: false, credentials: null };
    }
  });

  ipcMain.handle('credentials:clear', () => {
    try {
      const path = credentialsPath();
      if (existsSync(path)) unlinkSync(path);
      return { success: true };
    } catch {
      return { success: false };
    }
  });
}
