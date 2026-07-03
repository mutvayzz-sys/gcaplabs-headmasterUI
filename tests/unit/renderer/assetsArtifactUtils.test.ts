import { describe, expect, it } from 'vitest';
import { collectArtifactsForSession } from '@/renderer/pages/assets/artifactUtils';

import type { HermesSessionMessage } from '@/common/adapter/hermesSessionAdapter';

describe('asset artifact utilities', () => {
  it('extracts artifacts from raw Agent37 history content parts', () => {
    const messages: HermesSessionMessage[] = [
      {
        role: 'assistant',
        created_at: 1_750_000_300,
        content: [
          { type: 'text', text: 'Generated image: ![chart](/tmp/headmaster-chart.png)' },
          { type: 'text', text: 'Report: https://example.com/report.pdf' },
        ],
      },
    ];

    const result = collectArtifactsForSession('session-1', 'Session 1', messages);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: '/tmp/headmaster-chart.png', kind: 'image', timestamp: 1_750_000_300 }),
        expect.objectContaining({ value: 'https://example.com/report.pdf', kind: 'link', timestamp: 1_750_000_300 }),
      ])
    );
  });
});
