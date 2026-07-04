/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserWindow, ipcMain } from 'electron';
import {
  connectComposioToolkit,
  disconnectComposioConnection,
  listComposioConnections,
  listComposioToolkits,
  registerComposioMcp,
  type ComposioResult,
} from '../services/agent37ProvisionService';

// The console's browser-side ComposioApps.tsx detects OAuth completion via a `connected_account_id`
// query param landing back on whatever page window.opener.postMessage'd it from — that relies on
// same-origin popup/opener access, which doesn't hold here (the desktop renderer is file:// or
// localhost:5173, not console.gcaplabs.com). Instead we open a real BrowserWindow (same pattern as
// oauthBridge.ts's login popup) and watch its navigations directly for that query param.
const CONNECTED_ACCOUNT_PARAM = 'connected_account_id';

function extractConnectedAccountId(url: string): string | null {
  try {
    return new URL(url).searchParams.get(CONNECTED_ACCOUNT_PARAM);
  } catch {
    return null;
  }
}

async function runComposioOAuthPopup(redirectUrl: string): Promise<ComposioResult<{ connectedAccountId: string }>> {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 560,
      height: 760,
      show: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      title: 'Connect app',
      autoHideMenuBar: true,
    });

    let settled = false;
    const finish = (result: ComposioResult<{ connectedAccountId: string }>) => {
      if (settled) return;
      settled = true;
      if (!win.isDestroyed()) win.close();
      resolve(result);
    };

    const checkUrl = (url: string) => {
      const connectedAccountId = extractConnectedAccountId(url);
      if (connectedAccountId) finish({ success: true, data: { connectedAccountId } });
    };

    win.webContents.on('will-redirect', (_evt, url) => checkUrl(url));
    win.webContents.on('did-navigate', (_evt, url) => checkUrl(url));
    win.on('closed', () => finish({ success: false, error: 'Window closed before the connection completed.' }));

    win.loadURL(redirectUrl).catch(() => {
      finish({ success: false, error: 'Failed to load the OAuth sign-in page.' });
    });
  });
}

export function initComposioIntegrationsBridge(): void {
  ipcMain.handle('agent37:integrations:toolkits', (_event, params: { search?: string }) =>
    listComposioToolkits(params ?? {})
  );
  ipcMain.handle('agent37:integrations:connections', () => listComposioConnections());
  ipcMain.handle('agent37:integrations:connect', (_event, toolkit: string) => connectComposioToolkit(toolkit));
  ipcMain.handle('agent37:integrations:register-mcp', (_event, toolkit: string) => registerComposioMcp(toolkit));
  ipcMain.handle('agent37:integrations:disconnect', (_event, connectionId: string) =>
    disconnectComposioConnection(connectionId)
  );
  ipcMain.handle('agent37:integrations:oauth-popup', (_event, redirectUrl: string) =>
    runComposioOAuthPopup(redirectUrl)
  );
}
