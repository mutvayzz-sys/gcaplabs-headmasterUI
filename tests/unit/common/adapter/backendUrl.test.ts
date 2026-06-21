import { afterEach, describe, expect, it } from 'vitest';

import { resolveBackendHost, resolveBackendPort } from '@/common/adapter/backendUrl';

describe('backendUrl', () => {
  afterEach(() => {
    delete (globalThis as typeof globalThis & { __backendHost?: string; __backendPort?: number }).__backendHost;
    delete (globalThis as typeof globalThis & { __backendHost?: string; __backendPort?: number }).__backendPort;
  });

  it('defaults to localhost when no host is published', () => {
    expect(resolveBackendHost()).toBe('127.0.0.1');
  });

  it('reads remote host from globalThis in main-process context', () => {
    (globalThis as typeof globalThis & { __backendHost?: string }).__backendHost = '192.168.1.50';
    expect(resolveBackendHost()).toBe('192.168.1.50');
  });

  it('reads published backend port from globalThis', () => {
    (globalThis as typeof globalThis & { __backendPort?: number }).__backendPort = 9123;
    expect(resolveBackendPort()).toBe(9123);
  });
});
