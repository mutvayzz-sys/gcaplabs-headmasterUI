/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

vi.mock('@/renderer/components/settings/SettingsModal/contents/WebuiModalContent', () => ({
  default: () => <div data-testid='webui-settings-stub' />,
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: React.PropsWithChildren<{ contentClassName?: string }>) => <div>{children}</div>,
}));

vi.mock('@/renderer/pages/integrations/useIntegrations', () => ({
  useIntegrations: () => ({
    platforms: [
      {
        id: 'telegram',
        name: 'Telegram',
        connected: false,
        enabled: true,
        description: 'Telegram channel',
        envVars: [{ key: 'TELEGRAM_BOT_TOKEN', prompt: 'Bot token' }],
      },
    ],
    loading: false,
    error: null,
    refresh: vi.fn(),
    updatePlatform: vi.fn(),
    savePlatformEnv: vi.fn(),
  }),
}));

import ChannelsSettingsPage from '@/renderer/pages/settings/ChannelsSettingsPage';

describe('ChannelsSettingsPage backend gate', () => {
  it('shows channels as disabled while the backend contract is pending', () => {
    render(<ChannelsSettingsPage withWrapper={false} />);

    expect(screen.getByTestId('channels-backend-gated-notice')).toHaveTextContent(
      'Channel credential and session APIs are not contracted yet.'
    );
    expect(screen.getByTestId('channel-toggle-telegram')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('channel-toggle-telegram')).toHaveClass('pointer-events-none');
  });
});
