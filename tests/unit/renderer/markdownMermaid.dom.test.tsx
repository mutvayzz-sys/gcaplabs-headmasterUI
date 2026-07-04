/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MermaidBlock from '@/renderer/components/Markdown/MermaidBlock';

const { initializeMock, renderMock } = vi.hoisted(() => ({
  initializeMock: vi.fn(),
  renderMock: vi.fn(),
}));

vi.mock('mermaid', () => ({
  default: {
    initialize: initializeMock,
    render: renderMock,
  },
}));

describe('MermaidBlock', () => {
  beforeEach(() => {
    initializeMock.mockReset();
    renderMock.mockReset();
    renderMock.mockResolvedValue({ svg: '<svg><text>diagram</text></svg>' });
    document.documentElement.setAttribute('data-theme', 'light');
  });

  it('loads and renders Mermaid diagrams on demand', async () => {
    render(<MermaidBlock code='graph TD; A-->B' />);

    await waitFor(() => {
      expect(renderMock).toHaveBeenCalledOnce();
    });

    expect(initializeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default',
      })
    );
    expect(screen.getByTestId('mermaid-diagram').innerHTML).toContain('<svg');
  });
});
