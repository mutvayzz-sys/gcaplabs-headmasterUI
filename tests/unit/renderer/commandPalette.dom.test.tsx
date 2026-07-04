/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

import CommandPalette from '@/renderer/components/layout/CommandPalette';

describe('CommandPalette', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  it('opens with Ctrl+K and runs the first matching action on Enter', () => {
    render(<CommandPalette />);

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByTestId('command-palette-overlay')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search commands…'), { target: { value: 'diagnostics' } });
    fireEvent.keyDown(screen.getByPlaceholderText('Search commands…'), { key: 'Enter' });

    expect(mocks.navigate).toHaveBeenCalledWith('/settings/runtime');
    expect(screen.queryByTestId('command-palette-overlay')).not.toBeInTheDocument();
  });
});
