/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { isBackendHttpError } from './httpBridge';

/** True when Hermes (or another slim runtime) lacks an inherited AionUI route. */
export function isMissingHermesRoute(error: unknown): boolean {
  if (!isBackendHttpError(error)) return false;
  if (error.status === 404 || error.status === 405) return true;
  const body = error.body;
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = String((body as { detail?: unknown }).detail ?? '');
    if (/no such api endpoint/i.test(detail)) return true;
  }
  return /no such api endpoint/i.test(error.message);
}

export async function invokeWithMissingRouteFallback<T>(
  invoke: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  try {
    return await invoke();
  } catch (error) {
    if (isMissingHermesRoute(error)) {
      return await fallback();
    }
    throw error;
  }
}
