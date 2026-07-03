import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  httpRequest: vi.fn(),
}));

vi.mock('../../../../packages/desktop/src/common/adapter/httpBridge', () => ({
  httpRequest: mocks.httpRequest,
}));

import {
  fromHermesMessage,
  fromHermesSession,
  getHermesConversation,
  getHermesConversationMessages,
  listHermesConversations,
  rememberOpenHermesConversation,
  resetHermesSessionAdapterStateForTests,
  updateHermesConversation,
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
  beforeEach(() => {
    mocks.httpRequest.mockReset();
    resetHermesSessionAdapterStateForTests();
  });

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

  it('falls back to preview and then New Chat for unnamed sessions', () => {
    expect(fromHermesSession(session({ title: null })).name).toBe('Previous work');
    expect(fromHermesSession(session({ title: null, preview: null })).name).toBe('New Chat');
  });

  it('keeps a newly created session routable before Hermes exposes it through REST', async () => {
    const local = fromHermesSession(session({ id: 'just-created', title: 'New Chat' }));
    rememberOpenHermesConversation(local.id, undefined, local);
    mocks.httpRequest.mockRejectedValue(new Error('Backend GET failed (404): Session not found'));

    await expect(getHermesConversation(local.id)).resolves.toMatchObject({
      id: 'just-created',
      name: 'New Chat',
    });
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

  it('maps stored tool calls and tool results into tool groups', () => {
    const assistant: HermesSessionMessage = {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'call-1',
          function: { name: 'terminal', arguments: '{"command":"pwd"}' },
        },
      ],
    };
    const result: HermesSessionMessage = {
      role: 'tool',
      content: '/workspace',
      tool_call_id: 'call-1',
      tool_name: 'terminal',
    };

    expect(fromHermesMessage(assistant, 'session-1', 0)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool_group',
          content: [expect.objectContaining({ call_id: 'call-1', name: 'terminal' })],
        }),
      ])
    );
    expect(fromHermesMessage(result, 'session-1', 1)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'tool_group',
          content: [expect.objectContaining({ call_id: 'call-1', result_display: '/workspace' })],
        }),
      ])
    );
  });

  it('lists Agent37 sessions from /v1/sessions without filtering empty summaries', async () => {
    const empty = session({ id: 'empty', message_count: 0 });
    const single = session({ id: 'single', message_count: 4 });
    const multiple = session({ id: 'multiple', message_count: 3 });

    mocks.httpRequest.mockImplementation(async (_method: string, url: string) => {
      if (url === '/v1/sessions') {
        return [empty, single, multiple];
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const result = await listHermesConversations({ limit: 20 });

    expect(empty.id).toBe('empty');
    expect(result.items.map((item) => item.id)).toEqual(['empty', 'single', 'multiple']);
    expect(result.total).toBe(3);
    expect(result.has_more).toBe(false);
    expect(mocks.httpRequest.mock.calls[0]?.[1]).toBe('/v1/sessions');
  });

  it('accepts wrapped Agent37 session list response shapes', async () => {
    mocks.httpRequest.mockImplementation(async (_method: string, url: string) => {
      if (url === '/v1/sessions') {
        return { sessions: [session({ id: 'wrapped' })] };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const result = await listHermesConversations({ limit: 20 });

    expect(result.items.map((item) => item.id)).toEqual(['wrapped']);
  });

  it('includes locally open zero-message sessions in the sidebar list', async () => {
    const local = fromHermesSession(session({ id: 'draft', title: 'New Chat', message_count: 0 }));
    rememberOpenHermesConversation(local.id, undefined, local);

    mocks.httpRequest.mockImplementation(async (_method: string, url: string) => {
      if (url === '/v1/sessions') {
        return [];
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const result = await listHermesConversations({ limit: 20 });
    expect(result.items.map((item) => item.id)).toEqual(['draft']);
    expect(result.total).toBe(1);
  });

  it('keeps tool-heavy and interrupted first-turn chats in history', async () => {
    const sessions = [
      session({ id: 'incomplete', message_count: 2, is_active: true }),
      session({ id: 'interrupted', message_count: 3, is_active: false }),
      session({ id: 'failed', message_count: 2, is_active: false }),
      session({ id: 'tool-heavy', message_count: 5, tool_call_count: 2 }),
      session({ id: 'two-query', message_count: 4 }),
    ];

    mocks.httpRequest.mockImplementation(async (_method: string, url: string) => {
      if (url === '/v1/sessions') {
        return sessions;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const result = await listHermesConversations({ limit: 20 });

    expect(result.items.map((item) => item.id)).toEqual([
      'incomplete',
      'interrupted',
      'failed',
      'tool-heavy',
      'two-query',
    ]);
    expect(result.total).toBe(5);
  });

  it('paginates over visible chats rather than raw Hermes sessions', async () => {
    const sessions = [session({ id: 'tracked-1', message_count: 3 }), session({ id: 'tracked-2', message_count: 3 })];

    mocks.httpRequest.mockImplementation(async (_method: string, url: string) => {
      if (url === '/v1/sessions') {
        return sessions;
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const first = await listHermesConversations({ cursor: '0', limit: 1 });
    const second = await listHermesConversations({ cursor: '1', limit: 1 });

    expect(first.items.map((item) => item.id)).toEqual(['tracked-1']);
    expect(first.total).toBe(2);
    expect(first.has_more).toBe(true);
    expect(second.items.map((item) => item.id)).toEqual(['tracked-2']);
    expect(second.has_more).toBe(false);
  });

  it('loads transcript history from Agent37 session detail', async () => {
    mocks.httpRequest.mockImplementation(async (_method: string, url: string) => {
      if (url === '/v1/sessions/session-1') {
        return {
          id: 'session-1',
          messages: [{ role: 'assistant', content: 'Saved reply', created_at: 1_750_000_200 }],
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    const result = await getHermesConversationMessages({ conversation_id: 'session-1' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      conversation_id: 'session-1',
      content: { content: 'Saved reply' },
    });
    expect(mocks.httpRequest.mock.calls[0]?.[1]).toBe('/v1/sessions/session-1');
  });

  it('renames sessions through Agent37 while keeping local draft rename resilient to 404', async () => {
    const local = fromHermesSession(session({ id: 'draft', title: 'Draft' }));
    rememberOpenHermesConversation(local.id, undefined, local);
    mocks.httpRequest.mockRejectedValue(new Error('Backend PATCH failed (404): Session not found'));

    await expect(updateHermesConversation('draft', { name: 'Renamed draft' })).resolves.toBe(true);

    expect(mocks.httpRequest).toHaveBeenCalledWith('PATCH', '/v1/sessions/draft', { title: 'Renamed draft' }, {
      silentStatuses: [404],
    });
    await expect(getHermesConversation('draft')).resolves.toMatchObject({ name: 'Renamed draft' });
  });
});
