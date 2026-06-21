import { describe, expect, it } from 'vitest';

import { isTeamCapableBackend, resolveTeamCapable } from '@/common/agent/teamCapability';

describe('teamCapability', () => {
  it('recognizes AionCore whitelist backends', () => {
    expect(isTeamCapableBackend('claude')).toBe(true);
    expect(isTeamCapableBackend('codex')).toBe(true);
    expect(isTeamCapableBackend('aionrs')).toBe(true);
    expect(isTeamCapableBackend('cursor')).toBe(false);
  });

  it('infers team capability when Hermes omits team_capable', () => {
    expect(
      resolveTeamCapable({
        id: 'claude',
        backend: 'claude',
        agent_type: 'acp',
      })
    ).toBe(true);
  });

  it('respects explicit backend team_capable flag', () => {
    expect(
      resolveTeamCapable({
        id: 'custom',
        backend: 'custom',
        team_capable: true,
      })
    ).toBe(true);
  });

  it('treats available PATH agents as team-capable when the AionCore sidecar is running', () => {
    expect(
      resolveTeamCapable(
        {
          id: 'qwen',
          backend: 'qwen',
          agent_type: 'acp',
          available: true,
        },
        { aioncoreSidecar: true }
      )
    ).toBe(true);
  });
});
