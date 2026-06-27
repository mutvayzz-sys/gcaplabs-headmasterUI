import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync } from 'node:fs';

const mocks = vi.hoisted(() => {
  const userDataPath = `${process.env.TEMP || process.env.TMP || 'C:\\\\Temp'}\\headmaster-hermeshq-service-${Date.now()}`;
  return {
    userDataPath,
    getPath: vi.fn(() => userDataPath),
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: mocks.getPath,
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
  BrowserWindow: {
    getAllWindows: () => [],
  },
}));

import {
  clearHermeshqProvision,
  clearHermeshqToken,
  getHermeshqProvision,
  setHermeshqToken,
  setHermeshqUrl,
} from '@/process/connection/connectionConfig';
import {
  provisionHermeshqDesktop,
  validateHermeshqRuntimeAccess,
} from '@/process/services/hermeshqProvisionService';

beforeAll(() => {
  mkdirSync(mocks.userDataPath, { recursive: true });
});

beforeEach(() => {
  clearHermeshqToken();
  clearHermeshqProvision();
  vi.unstubAllGlobals();
});

describe('hermeshqProvisionService', () => {
  it('stores provision metadata returned by HermesHQ', async () => {
    setHermeshqUrl('http://192.168.0.102:3421');
    setHermeshqToken('session-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            mode: 'headmaster_local',
            user: {
              id: 'user-1',
              username: 'demo1',
              role: 'user',
            },
            capabilities: ['chat', 'terminal'],
            runtime: {
              validate_url: 'http://192.168.0.102:3421/api/desktop/runtime/validate',
              ttl_seconds: 300,
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    const result = await provisionHermeshqDesktop({
      client: 'headmaster_desktop',
      version: '0.2.1',
      platform: 'win32',
    });

    expect(result.success).toBe(true);
    expect(result.provision).toMatchObject({
      mode: 'headmaster_local',
      user: { username: 'demo1' },
      capabilities: ['chat', 'terminal'],
    });
    expect(getHermeshqProvision()).toMatchObject({
      user: { username: 'demo1' },
    });
  });

  it('fails closed when runtime validation is denied', async () => {
    setHermeshqUrl('http://192.168.0.102:3421');
    setHermeshqToken('session-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: 'revoked' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    const result = await validateHermeshqRuntimeAccess({
      runtime_id: 'local-hermes',
      requested_capability: 'terminal',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(getHermeshqProvision()).toBeNull();
  });
});
