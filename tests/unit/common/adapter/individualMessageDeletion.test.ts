import { describe, expect, it, vi } from 'vitest';
import { database } from '@/common/adapter/ipcBridge';

describe('individual stored-message deletion', () => {
  it('does not send an inherited API request', async () => {
    const fetchMock = vi.fn();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', fetchMock);

    try {
      await database.deleteMessage('message-1');

      expect(fetchMock).not.toHaveBeenCalled();
      expect(warning).toHaveBeenCalledWith('[headmaster] deleteMessage: not supported by Hermes runtime');
    } finally {
      warning.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
