import { describe, expect, it } from 'vitest';
import { BackendHttpError } from '@/common/adapter/httpBridge';
import { invokeWithMissingRouteFallback, isMissingHermesRoute } from '@/common/adapter/hermesRouteFallback';

describe('hermesRouteFallback', () => {
  it('detects Hermes 404 missing-route errors', () => {
    const error = new BackendHttpError({
      method: 'GET',
      path: '/api/teams',
      status: 404,
      body: { detail: 'No such API endpoint: /api/teams' },
    });
    expect(isMissingHermesRoute(error)).toBe(true);
  });

  it('returns fallback value for missing routes', async () => {
    const error = new BackendHttpError({
      method: 'GET',
      path: '/api/mcp/agent-configs',
      status: 404,
      body: { detail: 'No such API endpoint: /api/mcp/agent-configs' },
    });
    const result = await invokeWithMissingRouteFallback(
      async () => {
        throw error;
      },
      () => [] as string[]
    );
    expect(result).toEqual([]);
  });

  it('rethrows non-404 backend errors', async () => {
    const error = new BackendHttpError({
      method: 'GET',
      path: '/api/teams',
      status: 500,
      body: { error: 'boom' },
    });
    await expect(
      invokeWithMissingRouteFallback(
        async () => {
          throw error;
        },
        () => []
      )
    ).rejects.toBe(error);
  });
});
