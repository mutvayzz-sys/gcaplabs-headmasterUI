/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * @vitest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIntegrations } from '@/renderer/pages/integrations/useIntegrations';

describe('useIntegrations cloud mode gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    (window as Window & { __cloudContainerEndpoint?: string }).__cloudContainerEndpoint = 'https://cloud.example.test';
  });

  it('does not call local messaging/webhook routes when Agent37 remote mode is active', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('fetch should not be called for local-only integration routes');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useIntegrations());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.platforms).toEqual([]);
    expect(result.current.webhooks).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
