/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  retry: vi.fn(),
  state: 'connected' as 'connected' | 'failed' | 'connecting',
  restartRuntime: vi.fn(),
  resetHttpBridgeConnections: vi.fn(),
}));

vi.mock('@/renderer/hooks/system/useRuntimeConnectionState', () => ({
  useRuntimeConnectionState: () => ({
    state: mocks.state,
    retry: mocks.retry,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@/common/adapter/httpBridge', () => ({
  resetHttpBridgeConnections: mocks.resetHttpBridgeConnections,
}));

import GatewayStatusIndicator from '@/renderer/components/layout/Sider/SiderNav/GatewayStatusIndicator';

describe('GatewayStatusIndicator', () => {
  beforeEach(() => {
    mocks.state = 'connected';
    mocks.retry.mockReset();
    mocks.restartRuntime.mockReset();
    mocks.resetHttpBridgeConnections.mockReset();
    window.electronAPI = {
      restartRuntime: mocks.restartRuntime,
    } as typeof window.electronAPI;
  });

  it('shows active status when the runtime is connected', () => {
    render(<GatewayStatusIndicator />);
    expect(screen.getByText('Headmaster: Active')).toBeTruthy();
  });

  it('shows inactive status when the runtime is disconnected', () => {
    mocks.state = 'failed';
    render(<GatewayStatusIndicator />);
    expect(screen.getByText('Headmaster: Inactive')).toBeTruthy();
  });

  it('restarts the runtime from the sidebar control', async () => {
    mocks.restartRuntime.mockResolvedValue(undefined);
    render(<GatewayStatusIndicator />);

    fireEvent.click(screen.getByTitle('Restart Headmaster'));

    expect(mocks.resetHttpBridgeConnections).toHaveBeenCalledTimes(1);
    expect(mocks.restartRuntime).toHaveBeenCalledTimes(1);
  });
});
