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
  probeCapabilities: vi.fn(async () => null),
  supportsRunsApi: vi.fn(() => false),
  submitRunAndStream: vi.fn(async () => null),
  submitResponseAndStream: vi.fn(async () => null),
  submitRunApproval: vi.fn(async () => {}),
  stopRun: vi.fn(async () => {}),
  cancelResponse: vi.fn(async () => {}),
  supportsResponsesApi: vi.fn(() => false),
}));

import {
  createHermesChatConversation,
  confirmHermesPendingRequest,
  resetHermesChatRuntimeState,
  sendHermesMessage,
  stopHermesConversation,
} from '../../../../packages/desktop/src/common/adapter/hermesChatAdapter';
import { rememberOpenHermesConversation } from '../../../../packages/desktop/src/common/adapter/hermesSessionAdapter';
import {
  submitResponseAndStream,
  supportsResponsesApi,
  cancelResponse,
} from '../../../../packages/desktop/src/common/adapter/httpBridge';

describe('Hermes chat adapter', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.broadcast.mockReset();
    vi.mocked(supportsResponsesApi).mockReturnValue(false);
    vi.mocked(submitResponseAndStream).mockResolvedValue(null);
    vi.mocked(cancelResponse).mockClear();
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

  it('uses an empty model fallback when params.model is missing', async () => {
    mocks.request.mockResolvedValue({
      session_id: 'live-empty',
      stored_session_id: 'stored-empty',
      info: {},
    });

    const result = await createHermesChatConversation({
      type: 'aionrs',
      extra: {},
    } as Parameters<typeof createHermesChatConversation>[0]);

    expect(result.model).toEqual({
      id: '',
      name: '',
      platform: '',
      use_model: '',
      base_url: '',
      api_key: '',
    });
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
        msg_id: expect.not.stringMatching(sent.msg_id),
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

  it('resumes a profile chat, submits a follow-up, and persists streamed events to the stored id', async () => {
    rememberOpenHermesConversation('stored-recruiter', 'recruiter');
    mocks.request
      .mockResolvedValueOnce({
        session_id: 'live-recruiter',
        resumed: 'stored-recruiter',
        message_count: 2,
        messages: [],
      })
      .mockResolvedValueOnce({ status: 'streaming' });

    const sent = await sendHermesMessage({
      conversation_id: 'stored-recruiter',
      input: 'Continue the search',
    });

    expect(mocks.request.mock.calls).toEqual([
      [
        'session.resume',
        {
          session_id: 'stored-recruiter',
          cols: 96,
          profile: 'recruiter',
        },
      ],
      [
        'prompt.submit',
        {
          session_id: 'live-recruiter',
          text: 'Continue the search',
        },
      ],
    ]);

    mocks.gatewayListener?.({
      type: 'message.delta',
      session_id: 'live-recruiter',
      payload: { text: 'Candidate found' },
    });
    mocks.gatewayListener?.({
      type: 'message.complete',
      session_id: 'live-recruiter',
      payload: { text: 'Candidate found' },
    });

    expect(mocks.broadcast).toHaveBeenCalledWith(
      'message.userCreated',
      expect.objectContaining({
        conversation_id: 'stored-recruiter',
        content: 'Continue the search',
      })
    );
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'message.stream',
      expect.objectContaining({
        conversation_id: 'stored-recruiter',
        data: { content: 'Candidate found' },
      })
    );
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'turn.completed',
      expect.objectContaining({
        session_id: 'stored-recruiter',
        turn_id: sent.turn_id,
      })
    );
  });

  it('uses Agent37 responses SSE directly in remote runtime mode', async () => {
    vi.mocked(supportsResponsesApi).mockReturnValue(true);
    vi.mocked(submitResponseAndStream).mockImplementation(async (_input, _sessionId, callbacks) => {
      callbacks.onResponseCreated?.('resp-1', _sessionId);
      callbacks.onChunk('Remote hello');
      callbacks.onDone({ input_tokens: 1, output_tokens: 2 }, 'Remote hello');
      return { responseId: 'resp-1', sessionId: _sessionId };
    });

    const conversation = await createHermesChatConversation({
      type: 'aionrs',
      name: 'Remote',
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

    const sent = await sendHermesMessage({ conversation_id: conversation.id, input: 'Hello remote' });

    expect(mocks.request).not.toHaveBeenCalled();
    expect(submitResponseAndStream).toHaveBeenCalledWith('Hello remote', conversation.id, expect.any(Object), undefined, []);
    expect(sent.runtime.state).toBe('running');
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'message.stream',
      expect.objectContaining({
        conversation_id: conversation.id,
        data: { content: 'Remote hello' },
      })
    );
  });

  it('resumes Agent37 interactive prompts by cancelling and submitting the decision as a new turn', async () => {
    vi.mocked(supportsResponsesApi).mockReturnValue(true);
    let callCount = 0;
    vi.mocked(submitResponseAndStream).mockImplementation(async (_input, _sessionId, callbacks) => {
      callCount += 1;
      if (callCount === 1) {
        callbacks.onResponseCreated?.('resp-original', _sessionId);
        callbacks.onInteractiveRequest?.({
          kind: 'approval',
          request_id: 'approval-1',
          description: 'Allow command?',
          choices: ['once', 'deny'],
        });
        return { responseId: 'resp-original', sessionId: _sessionId };
      }
      callbacks.onResponseCreated?.('resp-resume', _sessionId);
      callbacks.onChunk('Approved result');
      callbacks.onDone({ input_tokens: 2, output_tokens: 3 }, 'Approved result');
      return { responseId: 'resp-resume', sessionId: _sessionId };
    });

    const conversation = await createHermesChatConversation({
      type: 'aionrs',
      name: 'Remote approval',
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

    const sent = await sendHermesMessage({ conversation_id: conversation.id, input: 'Do the thing' });
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'confirmation.add',
      expect.objectContaining({ conversation_id: conversation.id, id: 'approval-1' })
    );

    await confirmHermesPendingRequest({
      conversation_id: conversation.id,
      call_id: 'approval-1',
      msg_id: sent.msg_id,
      data: 'once',
    });

    expect(cancelResponse).toHaveBeenCalledWith('resp-original');
    expect(submitResponseAndStream).toHaveBeenLastCalledWith(
      'User decision: once',
      conversation.id,
      expect.any(Object)
    );
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'message.stream',
      expect.objectContaining({
        conversation_id: conversation.id,
        data: { content: 'Approved result' },
      })
    );
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'confirmation.remove',
      expect.objectContaining({ conversation_id: conversation.id, id: 'approval-1' })
    );
  });
});

describe('gateway edge cases', () => {
  beforeEach(() => {
    mocks.request.mockReset();
    mocks.broadcast.mockReset();
    vi.mocked(supportsResponsesApi).mockReturnValue(false);
    vi.mocked(submitResponseAndStream).mockResolvedValue(null);
    vi.mocked(cancelResponse).mockClear();
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
      })
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
    vi.useFakeTimers();
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

    expect(mocks.broadcast.mock.calls.filter((call) => call[0] === 'turn.completed')).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(5_000);

    const completedCalls = mocks.broadcast.mock.calls.filter((call) => call[0] === 'turn.completed');
    expect(completedCalls).toHaveLength(1);
    expect(mocks.broadcast).toHaveBeenCalledWith(
      'message.stream',
      expect.objectContaining({
        type: 'tips',
        data: expect.objectContaining({ type: 'error' }),
      })
    );
    vi.useRealTimers();
  });

  it('resumes the durable session before the next prompt after reconnecting', async () => {
    vi.useFakeTimers();
    mocks.request
      .mockResolvedValueOnce({ session_id: 'live-old', stored_session_id: 'stored-1' })
      .mockResolvedValueOnce({ status: 'streaming' })
      .mockResolvedValueOnce({ session_id: 'live-new', resumed: 'stored-1', messages: [] })
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
    await sendHermesMessage({ conversation_id: 'stored-1', input: 'first' });
    mocks.gatewayListener?.({ type: 'gateway.disconnected' });
    await vi.advanceTimersByTimeAsync(5_000);

    await sendHermesMessage({ conversation_id: 'stored-1', input: 'second' });

    expect(mocks.request.mock.calls.slice(-2)).toEqual([
      ['session.resume', { session_id: 'stored-1', cols: 96 }],
      ['prompt.submit', { session_id: 'live-new', text: 'second' }],
    ]);
    vi.useRealTimers();
  });

  it('sanitizes RPC failures and leaves the chat reusable', async () => {
    mocks.request
      .mockResolvedValueOnce({ session_id: 'live-1', stored_session_id: 'stored-1' })
      .mockRejectedValueOnce(new Error('Bearer super-secret-token at http://127.0.0.1/private'))
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

    await expect(sendHermesMessage({ conversation_id: 'stored-1', input: 'first' })).rejects.toThrow(
      'The runtime could not start this response.'
    );
    expect(mocks.broadcast.mock.calls.some((call) => call[0] === 'message.userCreated')).toBe(false);
    await expect(sendHermesMessage({ conversation_id: 'stored-1', input: 'retry' })).resolves.toMatchObject({
      runtime: { state: 'running' },
    });
    expect(JSON.stringify(mocks.broadcast.mock.calls)).not.toContain('super-secret-token');
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
