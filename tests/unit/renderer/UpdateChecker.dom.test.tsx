/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  httpRequest: vi.fn(),
  notificationInfo: vi.fn(),
}));

vi.mock('@/common/adapter/httpBridge', () => ({
  httpRequest: mocks.httpRequest,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('@arco-design/web-react', async () => {
  const actual = await vi.importActual<typeof import('@arco-design/web-react')>('@arco-design/web-react');
  return {
    ...actual,
    Notification: {
      ...actual.Notification,
      info: mocks.notificationInfo,
    },
  };
});

import UpdateChecker from '@/renderer/components/layout/Sider/SiderNav/UpdateChecker';

describe('UpdateChecker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.httpRequest.mockReset();
    mocks.notificationInfo.mockReset();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('announces a runtime update at most once per day', async () => {
    mocks.httpRequest.mockResolvedValue({
      update_available: true,
      message: 'Runtime 0.3.0 is ready.',
    });

    render(<UpdateChecker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocks.httpRequest).toHaveBeenCalledWith('GET', '/api/hermes/update/check');
    expect(mocks.notificationInfo).toHaveBeenCalledTimes(1);

    mocks.httpRequest.mockClear();
    mocks.notificationInfo.mockClear();
    render(<UpdateChecker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(mocks.httpRequest).not.toHaveBeenCalled();
  });

  it('stays silent when no runtime update is available', async () => {
    mocks.httpRequest.mockResolvedValue({ update_available: false });

    render(<UpdateChecker />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(mocks.httpRequest).toHaveBeenCalledTimes(1);
    expect(mocks.notificationInfo).not.toHaveBeenCalled();
  });
});
