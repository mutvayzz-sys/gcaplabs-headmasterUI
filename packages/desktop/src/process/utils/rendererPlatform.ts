/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Returns the platform the desktop is running on. Reads `process.platform`
 * when available (main process) and falls back to a UA sniff when called from
 * the renderer (where `process` is not defined under Electron's contextBridge).
 */
export function getRendererPlatform(): NodeJS.Platform {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (globalThis as any).process?.platform === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (globalThis as any).process.platform as NodeJS.Platform;
    }
  } catch {
    /* fall through */
  }
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
  if (ua.includes('win')) return 'win32';
  if (ua.includes('mac')) return 'darwin';
  if (ua.includes('linux')) return 'linux';
  return 'win32';
}
