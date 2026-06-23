/**
 * @vitest-environment jsdom
 */
/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mirrorHermesDashboardGlobals } from '@renderer/hooks/system/useDashboardStatus';

describe('mirrorHermesDashboardGlobals', () => {
  afterEach(() => {
    window.__backendPort = 0;
    window.__hermesPort = 0;
    window.__hermesSessionToken = '';
  });

  it('mirrors ready port and token from the bootstrap snapshot', () => {
    const result = mirrorHermesDashboardGlobals({
      status: 'ready',
      port: 61946,
      sessionToken: 'live-token',
      lastError: null,
      hermesHome: '/hermes',
    });

    expect(window.__backendPort).toBe(61946);
    expect(window.__hermesSessionToken).toBe('live-token');
    expect(result.portChanged).toBe(true);
    expect(result.tokenChanged).toBe(true);
  });

  it('clears port but keeps the latest spawn token while restarting', () => {
    window.__backendPort = 61648;
    window.__hermesSessionToken = 'old-token';

    const result = mirrorHermesDashboardGlobals({
      status: 'restarting',
      port: 0,
      sessionToken: 'new-token',
      lastError: 'crashed',
      hermesHome: '/hermes',
    });

    expect(window.__backendPort).toBe(0);
    expect(window.__hermesSessionToken).toBe('new-token');
    expect(result.portChanged).toBe(true);
    expect(result.tokenChanged).toBe(true);
  });
});
