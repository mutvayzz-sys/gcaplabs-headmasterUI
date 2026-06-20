import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  broadcast: vi.fn(),
  gatewayListener: undefined as ((event: { type: string; session_id?: string; payload?: unknown }) => void) | undefined,
}));

vi.mock('../../../../packages/desktop/src/common/adapter/httpBridge', () => ({
  gatewayRpcRequest: mocks.request,
  broadcastWsEvent: mocks.broadcast,
  onGatewayEvent: vi.fn((listener) => {
    mocks.gatewayListener = listener;
    return () => {};
  }),
}));

import {
  createHermesChatConversation,
  resetHermesChatRuntimeState,
  sendHermesMessage,
  stopHermesConversation,
} from '../../../../packages/desktop/src/common/adapter/hermesChatAdapter';

describe('Hermes chat adapter', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.broadcast.mockReset();
    resetHermesChatRuntimeState();
  });

  it('creates a live Hermes session and preserves its durable stored id', async () => {
    mocks.request.mockResolvedValue({
      session_id: 'live-1',
      stored_session_id: 'stored-1',
      info: { cwd: 'C:\\work' },
    });

    const result = await createHermesChatConversation({
      type: 'aionrs',
      name: 'Mission',
      model: {
        id: 'openai',
        name: 'OpenAI',
        platform: 'openai',
        api_key: '',
        base_url: '',
        use_model: 'openai/gpt-5',
      },
      extra: { workspace: 'C:\\work' },
    });

    expect(mocks.request).toHaveBeenCalledWith('session.create', {
      cols: 96,
      cwd: 'C:\\work',
      title: 'Mission',
    });
    expect(result.id).toBe('stored-1');
  });

  it('creates profile chats in the selected Hermes profile', async () => {
    mocks.request.mockResolvedValue({
      session_id: 'live-recruiter',
      stored_session_id: 'stored-recruiter',
      info: {},
    });

    await createHermesChatConversation({
      type: 'aionrs',
      assistant: {
        id: 'recruiter',
        conversation_overrides: {},
      },
      model: {
        id: 'openai',
        name: 'OpenAI',
        platform: 'openai',
        api_key: '',
        base_url: '',
        use_model: 'openai/gpt-5',
      },
      extra: {},
    });

    expect(mocks.request).toHaveBeenCalledWith('session.create', {
      cols: 96,
      profile: 'recruiter',
    });
  });

  it('submits over JSON-RPC and translates streaming events', async () => {
    mocks.request
      .mockResolvedValueOnce({
        session_id: 'live-1',
        stored_session_id: 'stored-1',
      })
      .mockResolvedValueOnce({ status: 'streaming' });

    await createHermesChatConversation({
      type: 'aionrs',
      model: {
        id: 'openai',
        name: 'OpenAI',
        platform: 'openai',
        api_key: '',
        base_url: '',
        use_model: 'openai/gpt-5',
      },
      extra: {},
    });
    mocks.broadcast.mockClear();

    const sent = await sendHermesMessage({ conversation_id: 'stored-1', input: 'Hello' });

    expect(mocks.request).toHaveBeenLastCalledWith('prompt.submit', {
      session_id: 'live-1',
      text: 'Hello',
    });
    expect(sent.runtime.state).toBe('running');

    mocks.gatewayListener?.({ type: 'message.start', session_id: 'live-1', payload: {} });
    mocks.gatewayListener?.({ type: 'message.delta', session_id: 'live-1', payload: { text: 'Hi' } });
    mocks.gatewayListener?.({ type: 'message.complete', session_id: 'live-1', payload: { text: 'Hi' } });

    expect(mocks.broadcast).toHaveBeenCalledWith(
      'message.stream',
      expect.objectContaining({
        conversation_id: 'stored-1',
        type: 'content',
        data: { content: 'Hi' },
      })
    );
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'turn.completed',
      expect.objectContaining({
        session_id: 'stored-1',
        turn_id: sent.turn_id,
        status: 'finished',
      })
    );
  });

  it('resumes a stored session before interrupting when no live id is cached', async () => {
    mocks.request.mockResolvedValueOnce({
      session_id: 'live-resumed',
      resumed: 'stored-existing',
      message_count: 1,
      messages: [],
    });
    mocks.request.mockResolvedValueOnce({ status: 'interrupted' });

    const result = await stopHermesConversation('stored-existing');

    expect(mocks.request.mock.calls).toEqual([
      ['session.resume', { session_id: 'stored-existing', cols: 96 }],
      ['session.interrupt', { session_id: 'live-resumed' }],
    ]);
    expect(result.runtime.state).toBe('idle');
  });
});

describe('gateway edge cases', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.broadcast.mockReset();
    resetHermesChatRuntimeState();
  });

  it('handles unknown event types silently without broadcasting', () => {
    mocks.request.mockResolvedValue({
      session_id: 'live-1',
      stored_session_id: 'stored-1',
    });

    mocks.gatewayListener?.({
      type: 'unknown.xyz',
      session_id: 'live-1',
      payload: {},
    });

    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it('drops events for sessions with no active turn', async () => {
    mocks.request.mockResolvedValueOnce({
      session_id: 'live-1',
      stored_session_id: 'stored-1',
    });
    await createHermesChatConversation({
      type: 'aionrs',
      model: {
        id: 'openai',
        name: 'OpenAI',
        platform: 'openai',
        api_key: '',
        base_url: '',
        use_model: 'openai/gpt-5',
      },
      extra: {},
    });

    mocks.broadcast.mockClear();

    // Event for an unregistered session_id
    mocks.gatewayListener?.({
      type: 'message.delta',
      session_id: 'live-unknown',
      payload: { text: 'orphaned' },
    });

    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it('ignores rpc_error events when no active turn is tracked', async () => {
    mocks.request.mockResolvedValueOnce({
      session_id: 'live-1',
      stored_session_id: 'stored-1',
    });
    mocks.request.mockImplementation(() => new Promise(() => {})); // hang forever

    await createHermesChatConversation({
      type: 'aionrs',
      model: {
        id: 'openai',
        name: 'OpenAI',
        platform: 'openai',
        api_key: '',
        base_url: '',
        use_model: 'openai/gpt-5',
      },
      extra: {},
    });
    mocks.broadcast.mockClear();

    // rpc_error has no session_id; adapter returns immediately with no active turn to notify
    mocks.gatewayListener?.({
      type: 'rpc_error',
      payload: { error: 'connection closed' },
    });

    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it('handles RPC error frames', async () => {
    mocks.request.mockResolvedValueOnce({
      session_id: 'live-1',
      stored_session_id: 'stored-1',
    });
    mocks.request.mockResolvedValueOnce({ status: 'streaming' });

    await createHermesChatConversation({
      type: 'aionrs',
      model: {
        id: 'openai',
        name: 'OpenAI',
        platform: 'openai',
        api_key: '',
        base_url: '',
        use_model: 'openai/gpt-5',
      },
      extra: {},
    });

    await sendHermesMessage({ conversation_id: 'stored-1', input: 'test' });
    mocks.broadcast.mockClear();

    mocks.gatewayListener?.({
      type: 'error',
      session_id: 'live-1',
      payload: { message: 'model rate limited' },
    });

    expect(mocks.broadcast).toHaveBeenCalledWith(
      'message.stream',
      expect.objectContaining({
        type: 'tips',
        data: expect.objectContaining({ content: 'model rate limited' }),
      }),
    );
  });

  it('completes turn without double-firing on interrupt', async () => {
    mocks.request.mockResolvedValueOnce({
      session_id: 'live-1',
      stored_session_id: 'stored-1',
    });
    mocks.request.mockResolvedValueOnce({ status: 'streaming' });

    await createHermesChatConversation({
      type: 'aionrs',
      model: {
        id: 'openai',
        name: 'OpenAI',
        platform: 'openai',
        api_key: '',
        base_url: '',
        use_model: 'openai/gpt-5',
      },
      extra: {},
    });

    const sent = await sendHermesMessage({
      conversation_id: 'stored-1',
      input: 'test',
    });
    mocks.broadcast.mockClear();

    mocks.gatewayListener?.({
      type: 'message.start',
      session_id: 'live-1',
      payload: {},
    });
    mocks.gatewayListener?.({
      type: 'message.delta',
      session_id: 'live-1',
      payload: { text: 'Part of response' },
    });
    mocks.gatewayListener?.({
      type: 'message.complete',
      session_id: 'live-1',
      payload: { text: 'Part of response', finish_reason: 'stop' },
    });

    const completedCalls = mocks.broadcast.mock.calls.filter((call) => call[0] === 'turn.completed');
    expect(completedCalls).toHaveLength(1);
  });

  it('handles malformed events without crashing', () => {
    mocks.gatewayListener?.({
      type: 'message.delta',
      session_id: 'live-1',
      payload: null, // malformed payload
    });

    expect(mocks.broadcast).not.toHaveBeenCalled();
  });

  it('finalizes an active turn once when the gateway disconnects', async () => {
    mocks.request
      .mockResolvedValueOnce({ session_id: 'live-1', stored_session_id: 'stored-1' })
      .mockResolvedValueOnce({ status: 'streaming' });

    await createHermesChatConversation({
      type: 'aionrs',
      model: {
        id: 'openai',
        name: 'OpenAI',
        platform: 'openai',
        api_key: '',
        base_url: '',
        use_model: 'openai/gpt-5',
      },
      extra: {},
    });
    await sendHermesMessage({ conversation_id: 'stored-1', input: 'hello' });
    mocks.broadcast.mockClear();

    mocks.gatewayListener?.({ type: 'gateway.disconnected' });
    mocks.gatewayListener?.({ type: 'gateway.disconnected' });

    const completedCalls = mocks.broadcast.mock.calls.filter((call) => call[0] === 'turn.completed');
    expect(completedCalls).toHaveLength(1);
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'message.stream',
      expect.objectContaining({
        type: 'tips',
        data: expect.objectContaining({ type: 'error' }),
      })
    );
  });

  it('ignores duplicate and out-of-order terminal events', async () => {
    mocks.request
      .mockResolvedValueOnce({ session_id: 'live-1', stored_session_id: 'stored-1' })
      .mockResolvedValueOnce({ status: 'streaming' });

    await createHermesChatConversation({
      type: 'aionrs',
      model: {
        id: 'openai',
        name: 'OpenAI',
        platform: 'openai',
        api_key: '',
        base_url: '',
        use_model: 'openai/gpt-5',
      },
      extra: {},
    });
    await sendHermesMessage({ conversation_id: 'stored-1', input: 'hello' });
    mocks.broadcast.mockClear();

    mocks.gatewayListener?.({ type: 'message.complete', session_id: 'live-1', payload: { text: 'done' } });
    mocks.gatewayListener?.({ type: 'message.delta', session_id: 'live-1', payload: { text: 'late' } });
    mocks.gatewayListener?.({ type: 'message.complete', session_id: 'live-1', payload: { text: 'done again' } });

    const completedCalls = mocks.broadcast.mock.calls.filter((call) => call[0] === 'turn.completed');
    expect(completedCalls).toHaveLength(1);
    expect(mocks.broadcast).not.toHaveBeenCalledWith(
      'message.stream',
      expect.objectContaining({ data: { content: 'late' } })
    );
  });
});
