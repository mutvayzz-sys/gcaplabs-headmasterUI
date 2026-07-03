import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync } from 'node:fs';

const mocks = vi.hoisted(() => {
  const userDataPath = `${process.env.TEMP || process.env.TMP || 'C:\\\\Temp'}\\headmaster-agent37-service-${Date.now()}`;
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
  clearAgent37Provision,
  clearAgent37Token,
  getAgent37Provision,
  setAgent37Token,
  setAgent37Url,
} from '@/process/connection/connectionConfig';
import {
  provisionAgent37Desktop,
  validateAgent37RuntimeAccess,
} from '@/process/services/agent37ProvisionService';

beforeAll(() => {
  mkdirSync(mocks.userDataPath, { recursive: true });
});

beforeEach(() => {
  clearAgent37Token();
  clearAgent37Provision();
  vi.unstubAllGlobals();
});

describe('agent37ProvisionService', () => {
  it('stores provision metadata returned by Agent37', async () => {
    setAgent37Url('http://192.168.0.102:3421');
    setAgent37Token('session-token');
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

    const result = await provisionAgent37Desktop({
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
    expect(getAgent37Provision()).toMatchObject({
      user: { username: 'demo1' },
    });
  });

  it('fails closed when runtime validation is denied', async () => {
    setAgent37Url('http://192.168.0.102:3421');
    setAgent37Token('session-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: 'revoked' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    const result = await validateAgent37RuntimeAccess({
      runtime_id: 'local-hermes',
      requested_capability: 'terminal',
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(getAgent37Provision()).toBeNull();
  });
});
