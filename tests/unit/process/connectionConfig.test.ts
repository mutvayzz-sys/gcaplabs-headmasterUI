import { beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdirSync } from 'node:fs';

const mocks = vi.hoisted(() => {
  const userDataPath = `${process.env.TEMP || process.env.TMP || 'C:\\\\Temp'}\\headmaster-connection-config-${Date.now()}`;
  return {
    userDataPath,
    getPath: vi.fn(() => userDataPath),
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: mocks.getPath,
  },
}));

import {
  clearHermeshqProvision,
  getHermeshqConfig,
  getHermeshqProvision,
  setHermeshqProvision,
  setHermeshqToken,
  setHermeshqUrl,
} from '@/process/connection/connectionConfig';

beforeAll(() => {
  mkdirSync(mocks.userDataPath, { recursive: true });
});

describe('connectionConfig', () => {
  it('persists HermesHQ provisioning metadata alongside the session token', () => {
    setHermeshqUrl('http://192.168.0.102:3421/');
    setHermeshqToken('token-123');
    setHermeshqProvision({
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
      client: 'headmaster_desktop',
      version: '0.2.1',
      platform: 'win32',
      refreshed_at: '2026-06-25T00:00:00.000Z',
    });

    const config = getHermeshqConfig();
    expect(config).toMatchObject({
      url: 'http://192.168.0.102:3421',
      token: 'token-123',
      provision: {
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
        client: 'headmaster_desktop',
        version: '0.2.1',
        platform: 'win32',
        refreshed_at: '2026-06-25T00:00:00.000Z',
      },
    });
  });

  it('clears provision metadata when requested', () => {
    setHermeshqProvision({
      mode: 'headmaster_local',
      user: {
        id: 'user-2',
        username: 'demo2',
        role: 'admin',
      },
      capabilities: ['chat'],
      runtime: {
        validate_url: 'http://192.168.0.102:3421/api/desktop/runtime/validate',
        ttl_seconds: 300,
      },
    });

    expect(getHermeshqProvision()).toMatchObject({
      user: {
        username: 'demo2',
      },
    });

    clearHermeshqProvision();
    expect(getHermeshqProvision()).toBeNull();
  });
});
