/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserWindow, ipcMain, session } from 'electron';
import { getHermeshqConfig } from '../connection/connectionConfig';

const SUCCESS_PATH = '/desktop-oauth-success';

export function initOAuthBridge(): void {
  ipcMain.handle(
    'oauth:trigger-login',
    async (event, provider: string): Promise<{ success: boolean; token?: string; error?: string }> => {
      const config = getHermeshqConfig();
      const baseUrl = (config?.url ?? 'https://console.gcaplabs.com')
        .replace(/\/$/, '')
        .replace('://hermeshq.gcaplabs.com', '://console.gcaplabs.com')
        .replace('://hq.gcaplabs.com', '://console.gcaplabs.com');
      const loginUrl = `${baseUrl}/api/auth/oidc/login?provider=${encodeURIComponent(provider)}&desktop=true`;

      return new Promise((resolve) => {
        const win = new BrowserWindow({
          width: 520,
          height: 660,
          show: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
          },
          title: 'Sign in',
          autoHideMenuBar: true,
        });

        let settled = false;

        const finish = (result: { success: boolean; token?: string; error?: string }) => {
          if (settled) return;
          settled = true;
          if (!win.isDestroyed()) win.close();
          resolve(result);
        };

        // Intercept navigation to /desktop-oauth-success before the page loads
        win.webContents.on('will-redirect', (_evt, url) => {
          if (url.includes(SUCCESS_PATH)) {
            try {
              const parsed = new URL(url);
              const token = parsed.searchParams.get('token');
              if (token) {
                finish({ success: true, token });
              } else {
                finish({ success: false, error: 'No token in OAuth callback' });
              }
            } catch {
              finish({ success: false, error: 'Invalid OAuth callback URL' });
            }
          }
        });

        win.webContents.on('did-navigate', (_evt, url) => {
          if (url.includes(SUCCESS_PATH)) {
            try {
              const parsed = new URL(url);
              const token = parsed.searchParams.get('token');
              if (token) {
                finish({ success: true, token });
              } else {
                finish({ success: false, error: 'No token in OAuth callback' });
              }
            } catch {
              finish({ success: false, error: 'Invalid OAuth callback URL' });
            }
          }
        });

        win.on('closed', () => {
          finish({ success: false, error: 'Window closed by user' });
        });

        win.loadURL(loginUrl).catch(() => {
          finish({ success: false, error: 'Failed to load OAuth provider page' });
        });
      });
    }
  );
}
