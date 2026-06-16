/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { WebContentsView, session } from 'electron';
import { ipcBridge } from '@/common';
import type { CdpStatus } from '@/process/utils/configureChromium';
import { getCdpStatus } from '@/process/utils/configureChromium';

interface CdpTarget {
  targetId: string;
  url: string;
  view?: WebContentsView;
  wsUrl?: string;
}

const targets = new Map<string, CdpTarget>();
let targetCounter = 0;

/**
 * Start a passive CDP session: create a hidden BrowserView, navigate to URL,
 * and return the CDP WebSocket URL so the renderer can connect via `chrome-remote-interface`.
 */
export async function startCdp(url: string): Promise<{ targetId: string; wsUrl: string } | null> {
  const status = getCdpStatus();
  if (!status.enabled || !status.port) {
    console.warn('[BrowserBridge] CDP not enabled — cannot start passive session');
    return null;
  }

  const targetId = `headmaster-browser-${++targetCounter}`;
  const partition = `persist:browser-${targetId}`;

  // Create isolated session to avoid cookie/login leakage
  const ses = session.fromPartition(partition);

  const view = new WebContentsView({
    webPreferences: {
      session: ses,
      offscreen: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Set a reasonable viewport size for capture/scraping
  view.setBounds({ x: 0, y: 0, width: 1280, height: 900 });

  // Wait for navigation
  await view.webContents.loadURL(url);

  // Get the CDP debugging WebSocket URL for this webContents
  // The target ID is the webContents.id in Electron's CDP implementation
  const wsUrl = `ws://127.0.0.1:${status.port}/devtools/page/${view.webContents.id}`;

  // Enable required CDP domains for passive viewing
  await view.webContents.debugger.attach('1.3');
  await view.webContents.debugger.sendCommand('Page.enable');
  await view.webContents.debugger.sendCommand('Runtime.enable');
  await view.webContents.debugger.sendCommand('DOM.enable');

  targets.set(targetId, { targetId, url, view, wsUrl });
  console.log(`[BrowserBridge] CDP target ${targetId} → ${url} (ws: ${wsUrl})`);

  return { targetId, wsUrl };
}

/**
 * Stop a passive CDP session and destroy the BrowserView.
 */
export async function stopCdp(targetId: string): Promise<void> {
  const target = targets.get(targetId);
  if (!target) return;

  if (target.view) {
    try {
      target.view.webContents.debugger.detach();
    } catch {
      // Already detached
    }
    target.view.webContents.close();
  }

  targets.delete(targetId);
  console.log(`[BrowserBridge] CDP target ${targetId} stopped`);
}

/**
 * Send a passive CDP command (read-only safe list).
 */
export async function sendCdpCommand(
  targetId: string,
  method: string,
  params?: Record<string, unknown>
): Promise<unknown> {
  const target = targets.get(targetId);
  if (!target || !target.view) {
    throw new Error(`Target ${targetId} not found`);
  }

  // Whitelist: only passive / safe commands
  const PASSIVE_METHODS = new Set([
    'Page.captureScreenshot',
    'Page.getResourceTree',
    'DOM.getDocument',
    'DOM.querySelector',
    'DOM.querySelectorAll',
    'Runtime.evaluate',
    'Runtime.getProperties',
  ]);

  if (!PASSIVE_METHODS.has(method)) {
    throw new Error(`Method ${method} is not allowed in passive CDP mode`);
  }

  return target.view.webContents.debugger.sendCommand(method, params);
}

/** Get current CDP status (delegates to configureChromium). */
export function getBrowserCdpStatus(): CdpStatus {
  return getCdpStatus();
}

/** Clean up all targets on app quit. */
export function cleanupAllBrowserTargets(): void {
  for (const [id] of targets) {
    void stopCdp(id);
  }
}

/** Wire IPC providers for browser bridge. */
export function initBrowserBridge(): void {
  ipcBridge.browser.startCdp.provider(async ({ url }: { url: string }) => {
    const result = await startCdp(url);
    return result;
  });

  ipcBridge.browser.stopCdp.provider(async ({ targetId }: { targetId: string }) => {
    await stopCdp(targetId);
  });

  ipcBridge.browser.getCdpStatus.provider(async () => {
    return getBrowserCdpStatus();
  });

  ipcBridge.browser.sendCdpCommand.provider(async ({ targetId, method, params }: { targetId: string; method: string; params?: Record<string, unknown> }) => {
    return sendCdpCommand(targetId, method, params);
  });
}
