import { describe, expect, it } from 'vitest';

import {
  sanitizeAgentDisplayName,
  sanitizeMcpServerDisplayName,
  sanitizeToolDisplayName,
} from '@/common/agent/agentDisplayNames';

describe('agentDisplayNames', () => {
  it('replaces forbidden upstream agent labels with Headmaster', () => {
    expect(sanitizeAgentDisplayName({ name: 'Aion CLI', backend: 'aionrs', agent_type: 'aionrs' })).toBe('Headmaster');
    expect(sanitizeAgentDisplayName({ name: 'Hermes', backend: 'hermes', agent_type: 'acp' })).toBe('Headmaster');
  });

  it('keeps real third-party CLI product names', () => {
    expect(sanitizeAgentDisplayName({ name: 'Claude Code', backend: 'claude', agent_type: 'acp' })).toBe('Claude Code');
    expect(sanitizeAgentDisplayName({ name: 'OpenCode', backend: 'opencode', agent_type: 'acp' })).toBe('OpenCode');
  });

  it('rewrites upstream Council MCP tool names for display', () => {
    expect(sanitizeToolDisplayName('mcp__aionui-team__team_members')).toBe('Council: list members');
    expect(sanitizeToolDisplayName('mcp__aionui-team__team_spawn_agent')).toBe('Council: spawn specialist');
    expect(sanitizeMcpServerDisplayName('aionui-team')).toBe('Council');
  });
});
