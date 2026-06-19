import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  broadcast: vi.fn(),
  gatewayListener: undefined as
    | ((event: { type: string; session_id?: string; payload?: unknown }) => void)
    | undefined,
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
