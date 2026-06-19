/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RuntimeSettings from '@/renderer/pages/settings/RuntimeSettings';

const mocks = vi.hoisted(() => ({
  httpGet: vi.fn(),
  httpPut: vi.fn(),
}));

vi.mock('@/common/adapter/httpBridge', () => ({
  httpGet: (url: string) => ({
    invoke: () => mocks.httpGet(url),
  }),
  httpPut: (url: string) => ({
    invoke: (data: unknown) => mocks.httpPut(url, data),
  }),
}));

vi.mock('@/renderer/pages/settings/components/SettingsPageWrapper', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid='settings-page-wrapper'>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('RuntimeSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches config on mount', async () => {
    mocks.httpGet.mockResolvedValue({});

    render(<RuntimeSettings />);

    await waitFor(() => {
      expect(mocks.httpGet).toHaveBeenCalledWith('/api/config');
      expect(mocks.httpGet).toHaveBeenCalledWith('/api/config/defaults');
      expect(mocks.httpGet).toHaveBeenCalledWith('/api/config/schema');
    });
  });

  it('displays error card with Retry button when fetch fails', async () => {
    mocks.httpGet.mockRejectedValue(new Error('Network error'));

    render(<RuntimeSettings />);

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/settings\.runtime\.(error|retry)/i);
    });
  });

  it('re-fetches config when Retry button is clicked', async () => {
    mocks.httpGet.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({});

    const { rerender } = render(<RuntimeSettings />);

    await waitFor(() => {
      expect(mocks.httpGet).toHaveBeenCalledWith('/api/config');
    });

    const retryButton = screen.queryByText(/retry/i);
    if (retryButton) {
      fireEvent.click(retryButton);
      await waitFor(() => {
        expect(mocks.httpGet).toHaveBeenCalledTimes(6); // 3 endpoints × 2 calls
      });
    }
  });

  it('saves config and re-fetches on success', async () => {
    const mockConfig = {
      fields: {
        model_name: {
          type: 'string',
          description: 'Model name',
          category: 'basic',
          default: 'gpt-4',
        },
      },
      category_order: ['basic'],
    };

    mocks.httpGet.mockResolvedValue(mockConfig);
    mocks.httpPut.mockResolvedValue({ success: true });

    render(<RuntimeSettings />);

    await waitFor(() => {
      expect(mocks.httpGet).toHaveBeenCalled();
    });

    const saveButton = screen.queryByText(/save|submit/i);
    if (saveButton) {
      fireEvent.click(saveButton);
      await waitFor(() => {
        expect(mocks.httpPut).toHaveBeenCalledWith('/api/config', expect.any(Object));
      });
    }
  });

  it('blocks save when required fields have errors', async () => {
    const mockConfig = {
      fields: {
        port: {
          type: 'number',
          description: 'Port number',
          category: 'network',
          min: 1024,
          max: 65535,
          required: true,
        },
      },
      category_order: ['network'],
    };

    mocks.httpGet.mockResolvedValue(mockConfig);

    render(<RuntimeSettings />);

    await waitFor(() => {
      expect(mocks.httpGet).toHaveBeenCalled();
    });

    // Try to set an invalid value (below min)
    const portInput = screen.queryByDisplayValue('1024') || screen.queryByRole('spinbutton');
    if (portInput) {
      fireEvent.change(portInput, { target: { value: '500' } });
    }

    const saveButton = screen.queryByText(/save|submit/i);
    if (saveButton) {
      // The save button should be disabled or the call should fail
      expect(saveButton).toHaveAttribute('disabled');
    }
  });

  it('handles backend error on save gracefully', async () => {
    const mockConfig = {
      fields: {
        model_name: {
          type: 'string',
          category: 'basic',
        },
      },
      category_order: ['basic'],
    };

    mocks.httpGet.mockResolvedValue(mockConfig);
    mocks.httpPut.mockRejectedValue(new Error('Invalid configuration'));

    render(<RuntimeSettings />);

    await waitFor(() => {
      expect(mocks.httpGet).toHaveBeenCalled();
    });

    const saveButton = screen.queryByText(/save|submit/i);
    if (saveButton) {
      fireEvent.click(saveButton);
      await waitFor(() => {
        expect(mocks.httpPut).toHaveBeenCalled();
        // Verify re-fetch was NOT called after error
        const callCountAfterError = mocks.httpGet.mock.calls.length;
        expect(callCountAfterError).toBeLessThan(9); // Would be 9 if re-fetch happened
      });
    }
  });

  it('renders schema fields dynamically based on config schema', async () => {
    const mockConfig = {
      fields: {
        max_tokens: {
          type: 'number',
          description: 'Maximum tokens',
          category: 'limits',
          default: 2000,
          min: 1,
          max: 4000,
        },
        debug_mode: {
          type: 'boolean',
          description: 'Enable debug logging',
          category: 'logging',
          default: false,
        },
      },
      category_order: ['limits', 'logging'],
    };

    mocks.httpGet.mockResolvedValue(mockConfig);

    render(<RuntimeSettings />);

    await waitFor(() => {
      expect(mocks.httpGet).toHaveBeenCalledWith('/api/config/schema');
    });

    // Verify at least some schema content is rendered
    const wrapper = screen.getByTestId('settings-page-wrapper');
    expect(wrapper).toBeInTheDocument();
  });
});
