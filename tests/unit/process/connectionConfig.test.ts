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
  clearAgent37Provision,
  getAgent37Config,
  getAgent37Provision,
  setAgent37Provision,
  setAgent37Token,
  setAgent37Url,
} from '@/process/connection/connectionConfig';

beforeAll(() => {
  mkdirSync(mocks.userDataPath, { recursive: true });
});

describe('connectionConfig', () => {
  it('persists Agent37 provisioning metadata alongside the session token', () => {
    setAgent37Url('http://192.168.0.102:3421/');
    setAgent37Token('token-123');
    setAgent37Provision({
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

    const config = getAgent37Config();
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
    setAgent37Provision({
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

    expect(getAgent37Provision()).toMatchObject({
      user: {
        username: 'demo2',
      },
    });

    clearAgent37Provision();
    expect(getAgent37Provision()).toBeNull();
  });
});
