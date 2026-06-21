import { describe, expect, it, vi, afterEach } from 'vitest';

import { CouncilSidecarUnavailableError, requireCouncilSidecar } from '@/common/errors/councilSidecar';

describe('councilSidecar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as typeof globalThis & { __aioncorePort?: number }).__aioncorePort;
  });

  it('throws when AionCore port is not set', () => {
    expect(() => requireCouncilSidecar()).toThrow(CouncilSidecarUnavailableError);
  });

  it('passes when AionCore port is available', () => {
    (globalThis as typeof globalThis & { __aioncorePort?: number }).__aioncorePort = 47123;
    expect(() => requireCouncilSidecar()).not.toThrow();
  });
});
