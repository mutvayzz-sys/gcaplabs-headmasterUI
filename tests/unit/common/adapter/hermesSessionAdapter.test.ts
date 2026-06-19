import { describe, expect, it } from 'vitest';
import {
  fromHermesMessage,
  fromHermesSession,
  type HermesSessionInfo,
  type HermesSessionMessage,
} from '../../../../packages/desktop/src/common/adapter/hermesSessionAdapter';

const session = (overrides: Partial<HermesSessionInfo> = {}): HermesSessionInfo => ({
  id: 'session-1',
  title: 'Existing Hermes session',
  preview: 'Previous work',
  cwd: 'C:\\work',
  model: 'openai/gpt-5',
  source: 'cli',
  started_at: 1_750_000_000,
  last_active: 1_750_000_100,
  ended_at: null,
  is_active: true,
  archived: false,
  message_count: 2,
  input_tokens: 10,
  output_tokens: 20,
  tool_call_count: 0,
  ...overrides,
});

describe('Hermes session adapter', () => {
  it('maps SessionInfo into the existing conversation model', () => {
    const result = fromHermesSession(session());

    expect(result).toMatchObject({
      id: 'session-1',
      name: 'Existing Hermes session',
      desc: 'Previous work',
      type: 'aionrs',
      source: 'cli',
      status: 'running',
      model: {
        id: 'openai',
        use_model: 'openai/gpt-5',
      },
      extra: {
        workspace: 'C:\\work',
        custom_workspace: true,
        last_token_usage: { total_tokens: 30 },
      },
    });
    expect(result.created_at).toBe(1_750_000_000_000);
    expect(result.modified_at).toBe(1_750_000_100_000);
  });

  it('falls back to preview and then New Mission for unnamed sessions', () => {
    expect(fromHermesSession(session({ title: null })).name).toBe('Previous work');
    expect(fromHermesSession(session({ title: null, preview: null })).name).toBe('New Mission');
  });

  it('maps user and assistant transcript messages into text messages', () => {
    const user: HermesSessionMessage = { role: 'user', content: 'Hello', timestamp: 1_750_000_000 };
    const assistant: HermesSessionMessage = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Hi there' }],
      timestamp: 1_750_000_001,
    };

    expect(fromHermesMessage(user, 'session-1', 0)[0]).toMatchObject({
      conversation_id: 'session-1',
      position: 'right',
      type: 'text',
      content: { content: 'Hello' },
    });
    expect(fromHermesMessage(assistant, 'session-1', 1)[0]).toMatchObject({
      conversation_id: 'session-1',
      position: 'left',
      type: 'text',
      content: { content: 'Hi there' },
    });
  });

  it('preserves assistant reasoning as a completed thinking message', () => {
    const message: HermesSessionMessage = {
      role: 'assistant',
      content: 'Answer',
      reasoning_content: 'Working it out',
    };

    expect(fromHermesMessage(message, 'session-1', 0)).toMatchObject([
      {
        type: 'thinking',
        content: { content: 'Working it out', status: 'done' },
      },
      {
        type: 'text',
        content: { content: 'Answer' },
      },
    ]);
  });
});
