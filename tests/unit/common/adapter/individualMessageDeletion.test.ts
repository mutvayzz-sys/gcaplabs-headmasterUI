import { describe, expect, it, vi } from 'vitest';
import { database } from '@/common/adapter/ipcBridge';

describe('individual stored-message deletion', () => {
  it('attempts upstream DELETE /api/messages/:id', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
      text: async () => '',
    }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      await database.deleteMessage('message-1');
      expect(fetchMock).toHaveBeenCalled();
      const url = String(fetchMock.mock.calls[0]?.[0] ?? '');
      expect(url).toContain('/api/messages/message-1');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
