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

import ChannelsSettingsPage from '@/renderer/pages/settings/ChannelsSettingsPage';

describe('ChannelsSettingsPage backend gate', () => {
  it('keeps the legacy Channels settings page as a WebUI-only compatibility surface', () => {
    render(<ChannelsSettingsPage withWrapper={false} />);

    expect(screen.getByTestId('webui-settings-stub')).toBeInTheDocument();
    expect(screen.queryByTestId('channels-backend-gated-notice')).not.toBeInTheDocument();
  });
});
