/**
 * @vitest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  httpRequest: vi.fn(),
  gatewayRpcRequest: vi.fn(),
  dashboard: {
    status: 'ready' as string,
    lastError: undefined as string | undefined,
  },
}));

vi.mock('@/common/adapter/httpBridge', () => ({
  httpRequest: mocks.httpRequest,
  gatewayRpcRequest: mocks.gatewayRpcRequest,
}));

vi.mock('@renderer/hooks/system/useDashboardStatus', () => ({
  useDashboardStatus: () => mocks.dashboard,
}));

import { useRuntimeConnectionState } from '../../../packages/desktop/src/renderer/hooks/system/useRuntimeConnectionState';

describe('useRuntimeConnectionState', () => {
  beforeEach(() => {
    mocks.httpRequest.mockReset();
    mocks.gatewayRpcRequest.mockReset();
    mocks.dashboard.status = 'ready';
    mocks.dashboard.lastError = undefined;
    window.__backendPort = 9120;
  });

  it('marks connected when RPC probe succeeds', async () => {
    mocks.gatewayRpcRequest.mockResolvedValue({ sessions: [] });
    mocks.httpRequest.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useRuntimeConnectionState());

    await waitFor(() => {
      expect(result.current.state).toBe('connected');
    });
    expect(mocks.gatewayRpcRequest).toHaveBeenCalledWith('session.list', { limit: 1 }, 10_000);
  });

  it('redacts sensitive details from failure reasons', async () => {
    mocks.gatewayRpcRequest.mockRejectedValue(
      new Error('request failed token=abc123 at C:\\Users\\me\\AppData\\Headmaster\\logs\\app.log')
    );

    const { result } = renderHook(() => useRuntimeConnectionState());

    await waitFor(() => {
      expect(result.current.state).toBe('failed');
    });
    expect(result.current.reason).toContain('[local path]');
    expect(result.current.reason).not.toContain('abc123');
  });
});
