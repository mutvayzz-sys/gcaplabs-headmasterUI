import { describe, expect, it } from 'vitest';
import { buildAvailableBackends } from '@/renderer/hooks/assistant/useDetectedAgents';
import type { AgentMetadata } from '@/renderer/utils/model/agentTypes';

const agent = (overrides: Partial<AgentMetadata>): AgentMetadata => ({
  id: 'agent',
  name: 'Agent',
  agent_type: 'acp',
  agent_source: 'builtin',
  enabled: true,
  available: true,
  ...overrides,
});

describe('Specialist engine catalog', () => {
  it('includes only enabled, available conversation engines', () => {
    const result = buildAvailableBackends([
      agent({ id: 'claude', backend: 'claude', name: 'Claude Code' }),
      agent({ id: 'profile', agent_type: 'aionrs', name: 'Headmaster' }),
      agent({ id: 'missing', backend: 'codex', available: false }),
      agent({ id: 'disabled', backend: 'gemini', enabled: false }),
      agent({ id: 'remote', agent_type: 'remote', backend: 'remote' }),
      agent({ id: 'persona', agent_type: 'nanobot', backend: 'nanobot' }),
    ]);

    expect(result.map((item) => item.id)).toEqual(['claude', 'aionrs']);
  });

  it('limits a Specialist to models advertised by its selected engine', () => {
    const result = buildAvailableBackends([
      agent({
        id: 'claude',
        backend: 'claude',
        handshake: {
          available_models: {
            current_model_id: 'claude-sonnet',
            current_model_label: 'Claude Sonnet',
            available_models: [
              { id: 'claude-sonnet', label: 'Claude Sonnet' },
              { id: 'claude-opus', label: 'Claude Opus' },
            ],
          },
        },
      }),
    ]);

    expect(result[0].modelOptions).toEqual([
      { value: 'claude-sonnet', label: 'Claude Sonnet' },
      { value: 'claude-opus', label: 'Claude Opus' },
    ]);
  });
});
