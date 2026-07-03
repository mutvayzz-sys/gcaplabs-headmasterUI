/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation, TConversationRuntimeSummary, TProviderWithModel } from '../config/storage';
import { uuid } from '../utils';
import type {
  IConfirmMessageParams,
  IConversationTurnCompletedEvent,
  ICreateConversationParams,
  IResponseMessage,
  ISendMessageResult,
} from './ipcBridge';
import {
  broadcastWsEvent,
  cancelResponse,
  gatewayRpcRequest,
  onGatewayEvent,
  submitResponseAndStream,
  supportsResponsesApi,
} from './httpBridge';
import { getHermesConversationProfile, rememberOpenHermesConversation } from './hermesSessionAdapter';

export interface HermesSessionCreateResponse {
  info?: {
    cwd?: string;
    model?: string;
  };
  session_id: string;
  stored_session_id?: string;
}

export interface HermesSessionResumeResponse {
  info?: {
    cwd?: string;
    model?: string;
    running?: boolean;
  };
  message_count: number;
  messages: unknown[];
  resumed: string;
  session_id: string;
}

export interface HermesGatewayEvent {
  type: string;
  session_id?: string;
  payload?: unknown;
}

type ActiveTurn = {
  conversationId: string;
  liveSessionId: string;
  userMsgId: string;
  msgId: string;
  turnId: string;
  sawContent: boolean;
  pendingContent: string;
  flushHandle: ReturnType<typeof setTimeout> | null;
  timeout: ReturnType<typeof setTimeout>;
  responseId?: string;
};

const STREAM_DELTA_FLUSH_MS = 32;

/**
 * Format the human's decision to an Agent37 interactive prompt as the next
 * `input` on the session. The model already has its own question + tool call
 * in the session's full history; this is just a one-line continuation that
 * carries the human's choice back to it.
 */
function formatInteractiveResume(
  request: PendingInteractiveRequest,
  responseValue: string
): string {
  switch (request.kind) {
    case 'approval':
      return `User decision: ${responseValue}`;
    case 'clarify':
      return responseValue;
    case 'sudo':
    case 'secret':
      // Caller must have short-circuited before this; we never reach here.
      return responseValue;
  }
}

type PendingInteractiveRequestKind = 'approval' | 'clarify' | 'sudo' | 'secret';

type PendingInteractiveRequest = {
  confirmation: {
    action: PendingInteractiveRequestKind;
    call_id: string;
    command_type?: string;
    description: string;
    id: string;
    options: Array<{ label: string; value: string }>;
    title?: string;
  };
  conversationId: string;
  kind: PendingInteractiveRequestKind;
  liveSessionId: string;
  requestId: string;
};

const liveByStored = new Map<string, string>();
const storedByLive = new Map<string, string>();
const turnsByLive = new Map<string, ActiveTurn>();
const toolsByLive = new Map<string, Map<string, Record<string, unknown>>>();
const pendingRequestsByConversation = new Map<string, Map<string, PendingInteractiveRequest>>();
const profilesByStored = new Map<string, string>();
const PROFILES_STORAGE_KEY = 'headmaster.sessionProfiles';
let subscribed = false;
const TURN_TIMEOUT_MS = 90_000;
const GATEWAY_DISCONNECT_GRACE_MS = 5_000;
let disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;

const EMPTY_MODEL: TProviderWithModel = {
  id: '',
  name: '',
  platform: '',
  use_model: '',
  base_url: '',
  api_key: '',
};

const loadPersistedProfiles = (): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    for (const [storedId, profile] of Object.entries(parsed)) {
      if (typeof profile === 'string' && profile.trim()) {
        profilesByStored.set(storedId, profile.trim());
      }
    }
  } catch {
    // ignore corrupt storage
  }
};

const persistProfiles = (): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(Object.fromEntries(profilesByStored)));
  } catch {
    // ignore quota errors
  }
};

loadPersistedProfiles();

const runningRuntime = (turnId: string): TConversationRuntimeSummary => ({
  state: 'running',
  can_send_message: false,
  has_task: true,
  task_status: 'running',
  is_processing: true,
  pending_confirmations: 0,
  turn_id: turnId,
});

const idleRuntime = (): TConversationRuntimeSummary => ({
  state: 'idle',
  can_send_message: true,
  has_task: false,
  task_status: 'finished',
  is_processing: false,
  pending_confirmations: 0,
  turn_id: null,
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const textFromPayload = (payload: unknown): string => {
  const record = asRecord(payload);
  const value = record.text ?? record.rendered ?? '';
  return typeof value === 'string' ? value : '';
};

const emitResponse = (turn: ActiveTurn, type: string, data: unknown, replace = false): void => {
  const message: IResponseMessage = {
    type,
    data,
    msg_id: turn.msgId,
    turn_id: turn.turnId,
    conversation_id: turn.conversationId,
    created_at: Date.now(),
    replace,
  };
  broadcastWsEvent('message.stream', message);
};

const emitCompleted = (turn: ActiveTurn, detail = ''): void => {
  const completed: IConversationTurnCompletedEvent = {
    session_id: turn.conversationId,
    turn_id: turn.turnId,
    status: 'finished',
    state: 'ai_waiting_input',
    detail,
    can_send_message: true,
    runtime: idleRuntime(),
    workspace: '',
    model: { platform: '', name: '', use_model: '' },
    last_message: {
      id: turn.msgId,
      type: 'text',
      content: null,
      status: 'finish',
      created_at: Date.now(),
    },
  };
  broadcastWsEvent('turn.completed', completed);
};

const finishTurn = (liveSessionId: string, detail = '', errorMessage?: string): void => {
  const turn = turnsByLive.get(liveSessionId);
  if (!turn) return;
  if (turn.flushHandle) {
    clearTimeout(turn.flushHandle);
    turn.flushHandle = null;
  }
  if (turn.pendingContent) {
    turn.sawContent = true;
    emitResponse(turn, 'content', { content: turn.pendingContent });
    turn.pendingContent = '';
  }
  clearTimeout(turn.timeout);
  if (errorMessage) {
    emitResponse(turn, 'tips', { content: errorMessage, type: 'error' });
  }
  emitResponse(turn, 'finish', {});
  emitCompleted(turn, detail || errorMessage || '');
  turnsByLive.delete(liveSessionId);
  toolsByLive.delete(liveSessionId);
  clearPendingRequests(turn.conversationId);
};

const pendingConfirmationBucket = (conversationId: string): Map<string, PendingInteractiveRequest> => {
  let bucket = pendingRequestsByConversation.get(conversationId);
  if (!bucket) {
    bucket = new Map<string, PendingInteractiveRequest>();
    pendingRequestsByConversation.set(conversationId, bucket);
  }
  return bucket;
};

const emitConfirmationAdd = (request: PendingInteractiveRequest): void => {
  broadcastWsEvent('confirmation.add', {
    conversation_id: request.conversationId,
    ...request.confirmation,
  });
};

const emitConfirmationRemove = (conversationId: string, requestId: string): void => {
  broadcastWsEvent('confirmation.remove', { conversation_id: conversationId, id: requestId });
};

const clearPendingRequestsForKind = (conversationId: string, kind: PendingInteractiveRequestKind): void => {
  const bucket = pendingRequestsByConversation.get(conversationId);
  if (!bucket) return;

  for (const [requestId, request] of bucket.entries()) {
    if (request.kind !== kind) continue;
    bucket.delete(requestId);
    emitConfirmationRemove(conversationId, requestId);
  }

  if (bucket.size === 0) {
    pendingRequestsByConversation.delete(conversationId);
  }
};

const clearPendingRequests = (conversationId: string): void => {
  const bucket = pendingRequestsByConversation.get(conversationId);
  if (!bucket) return;

  for (const requestId of bucket.keys()) {
    emitConfirmationRemove(conversationId, requestId);
  }
  pendingRequestsByConversation.delete(conversationId);
};

const registerPendingRequest = (request: PendingInteractiveRequest, replaceKind = false): void => {
  const bucket = pendingConfirmationBucket(request.conversationId);
  if (replaceKind) {
    clearPendingRequestsForKind(request.conversationId, request.kind);
  }
  bucket.set(request.requestId, request);
  emitConfirmationAdd(request);
};

const pendingRequestFromConfirmation = (
  bucket: Map<string, PendingInteractiveRequest>,
  requestId: string
): PendingInteractiveRequest | null => bucket.get(requestId) ?? null;

const normalizeConfirmationChoice = (value: string): 'once' | 'session' | 'always' | 'deny' => {
  switch (value) {
    case 'once':
    case 'proceed_once':
      return 'once';
    case 'session':
    case 'proceed_always_server':
      return 'session';
    case 'always':
    case 'proceed_always':
    case 'proceed_always_tool':
      return 'always';
    case 'deny':
    case 'cancel':
    default:
      return 'deny';
  }
};

const confirmationValueFromParams = (params: IConfirmMessageParams): string => {
  const data = params.data as
    | string
    | { answer?: unknown; password?: unknown; response?: unknown; value?: unknown }
    | undefined;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const value = data.value ?? data.answer ?? data.password ?? data.response;
    return typeof value === 'string' ? value : String(value ?? '');
  }
  return '';
};

const listPendingRequests = (conversationId: string): PendingInteractiveRequest[] =>
  [...(pendingRequestsByConversation.get(conversationId)?.values() ?? [])].sort((a, b) =>
    a.requestId.localeCompare(b.requestId)
  );

const buildApprovalRequest = (turn: ActiveTurn, payload: Record<string, unknown>): PendingInteractiveRequest => {
  const requestId = uuid();
  const allowPermanent = payload.allow_permanent !== false;
  const command = String(payload.command ?? '');
  const description = String((payload.description ?? command) || 'Approval required');
  const options = allowPermanent
    ? [
        { label: 'Yes, allow once', value: 'once' },
        { label: 'Yes, allow for this session', value: 'session' },
        { label: 'Yes, allow always', value: 'always' },
        { label: 'No (esc)', value: 'deny' },
      ]
    : [
        { label: 'Yes, allow once', value: 'once' },
        { label: 'Yes, allow for this session', value: 'session' },
        { label: 'No (esc)', value: 'deny' },
      ];

  return {
    kind: 'approval',
    conversationId: turn.conversationId,
    liveSessionId: turn.liveSessionId,
    requestId,
    confirmation: {
      action: 'approval',
      id: requestId,
      call_id: requestId,
      command_type: command || undefined,
      description,
      title: description,
      options,
    },
  };
};

const buildClarifyRequest = (turn: ActiveTurn, payload: Record<string, unknown>): PendingInteractiveRequest | null => {
  const requestId = String(payload.request_id ?? '');
  const question = String(payload.question ?? '');
  if (!requestId || !question) return null;

  const choices = Array.isArray(payload.choices)
    ? payload.choices.filter((choice): choice is string => typeof choice === 'string' && choice.trim().length > 0)
    : [];

  return {
    kind: 'clarify',
    conversationId: turn.conversationId,
    liveSessionId: turn.liveSessionId,
    requestId,
    confirmation: {
      action: 'clarify',
      id: requestId,
      call_id: requestId,
      description: question,
      title: question,
      options: choices.map((choice) => ({ label: choice, value: choice })),
    },
  };
};

const buildMaskedRequest = (
  turn: ActiveTurn,
  kind: 'sudo' | 'secret',
  payload: Record<string, unknown>
): PendingInteractiveRequest | null => {
  const requestId = String(payload.request_id ?? '');
  if (!requestId) return null;

  const envVar = kind === 'secret' ? String(payload.env_var ?? '') : '';
  const prompt = kind === 'secret' ? String(payload.prompt ?? '') : '';

  return {
    kind,
    conversationId: turn.conversationId,
    liveSessionId: turn.liveSessionId,
    requestId,
    confirmation: {
      action: kind,
      id: requestId,
      call_id: requestId,
      description: kind === 'secret' ? prompt || envVar || 'Secret input required' : 'Sudo password required',
      title: kind === 'secret' ? prompt || envVar || 'Secret input required' : 'Sudo password required',
      options: [],
      ...(kind === 'secret' && envVar ? { command_type: envVar } : {}),
    },
  };
};

async function respondToPendingRequest(request: PendingInteractiveRequest, responseValue: string): Promise<void> {
  // Remote (Agent37) mode: the gateway has no mid-turn interactive endpoint
  // and the stream contract has no `response.interactive.requested` event.
  // Resume the session by cancelling the in-flight turn and posting a fresh
  // `input` on the same `session_id` so the model sees the human's decision
  // as the next user turn. The full conversation history is held by the
  // gateway, so the agent has the original question + its own tool call in
  // context when it consumes the resume turn.
  if (supportsResponsesApi()) {
    const turn = turnsByLive.get(request.liveSessionId);
    if (!turn) {
      throw new Error('No active turn to respond to');
    }
    // `sudo` and `secret` carry credentials. Agent37 sessions persist their
    // full history to disk, so we MUST NOT pass the value as plain `input` —
    // it would land in the session transcript. Cancel the turn and surface a
    // user-visible error instead. A real sudo/secret flow on Agent37 needs
    // the gateway to add a non-persisted credential channel, which is not
    // in the current contract (https://www.agent37.com/docs/agents-api/chat).
    if (request.kind === 'sudo' || request.kind === 'secret') {
      if (turn.responseId) await cancelResponse(turn.responseId);
      throw new Error(
        `${request.kind} prompts are not supported over Agent37 — re-run the command with credentials provided another way.`
      );
    }
    if (turn.responseId) {
      await cancelResponse(turn.responseId);
    }
    // Re-issue the user's decision as a fresh turn on the same session.
    const resumeText = formatInteractiveResume(request, responseValue);
    await submitResponseAndStream(resumeText, turn.liveSessionId, {
      onChunk() {
        /* no-op: the resume turn's content is rendered by the existing turn pipeline below */
      },
      onToolEvent() {
        /* no-op */
      },
      onReasoning() {
        /* no-op */
      },
      onDone() {
        /* no-op */
      },
      onError(message) {
        finishTurn(turn.liveSessionId, message, message);
      },
    });
    return;
  }
  // Local dashboard mode: use legacy WS-RPC.
  switch (request.kind) {
    case 'approval':
      await gatewayRpcRequest('approval.respond', {
        choice: normalizeConfirmationChoice(responseValue),
        session_id: request.liveSessionId,
      });
      return;
    case 'clarify':
      await gatewayRpcRequest('clarify.respond', {
        answer: responseValue,
        request_id: request.requestId,
      });
      return;
    case 'sudo':
      await gatewayRpcRequest('sudo.respond', {
        password: responseValue,
        request_id: request.requestId,
      });
      return;
    case 'secret':
      await gatewayRpcRequest('secret.respond', {
        request_id: request.requestId,
        value: responseValue,
      });
      return;
  }
}

function removePendingRequest(conversationId: string, requestId: string): void {
  const bucket = pendingRequestsByConversation.get(conversationId);
  if (!bucket) return;
  if (!bucket.delete(requestId)) return;
  emitConfirmationRemove(conversationId, requestId);
  if (bucket.size === 0) {
    pendingRequestsByConversation.delete(conversationId);
  }
}

async function confirmPendingRequest(params: IConfirmMessageParams): Promise<void> {
  const bucket = pendingRequestsByConversation.get(params.conversation_id);
  if (!bucket) {
    throw new Error(`Pending confirmation not found for conversation ${params.conversation_id}`);
  }

  const request = pendingRequestFromConfirmation(bucket, params.call_id);
  if (!request) {
    throw new Error(`Pending confirmation ${params.call_id} not found for conversation ${params.conversation_id}`);
  }

  const responseValue = confirmationValueFromParams(params);

  // All turn types (local + remote) flow through `submitResponseAndStream`,
  // so resume goes through the same `respondToPendingRequest` path below.
  await respondToPendingRequest(request, responseValue);
  removePendingRequest(params.conversation_id, request.requestId);
}

const flushContentDelta = (turn: ActiveTurn): void => {
  if (!turn.pendingContent) return;
  const chunk = turn.pendingContent;
  turn.pendingContent = '';
  turn.sawContent = true;
  emitResponse(turn, 'content', { content: chunk });
};

const scheduleContentFlush = (turn: ActiveTurn): void => {
  if (turn.flushHandle !== null) return;
  turn.flushHandle = setTimeout(() => {
    turn.flushHandle = null;
    flushContentDelta(turn);
  }, STREAM_DELTA_FLUSH_MS);
};

const clearTurnTimeout = (turn: ActiveTurn): void => {
  clearTimeout(turn.timeout);
};

const scheduleTurnTimeout = (turn: ActiveTurn): void => {
  clearTurnTimeout(turn);
  turn.timeout = setTimeout(() => {
    finishTurn(
      turn.liveSessionId,
      'The runtime did not finish this response in time.',
      'The runtime did not finish this response in time. You can retry without restarting Headmaster.'
    );
  }, TURN_TIMEOUT_MS);
};

const abortTurn = (turn: ActiveTurn): void => {
  clearTurnTimeout(turn);
  if (turn.flushHandle) {
    clearTimeout(turn.flushHandle);
    turn.flushHandle = null;
  }
  turnsByLive.delete(turn.liveSessionId);
};

const finalizeGatewayDisconnect = (): void => {
  for (const liveSessionId of [...turnsByLive.keys()]) {
    finishTurn(
      liveSessionId,
      'The runtime connection was interrupted.',
      'The runtime connection was interrupted. Reconnect and send your message again.'
    );
  }
  liveByStored.clear();
  storedByLive.clear();
};

export function handleHermesGatewayEvent(event: HermesGatewayEvent): void {
  if (event.type === 'gateway.connected') {
    if (disconnectGraceTimer) {
      clearTimeout(disconnectGraceTimer);
      disconnectGraceTimer = null;
    }
    return;
  }
  if (event.type === 'gateway.disconnected') {
    if (disconnectGraceTimer) clearTimeout(disconnectGraceTimer);
    disconnectGraceTimer = setTimeout(() => {
      disconnectGraceTimer = null;
      finalizeGatewayDisconnect();
    }, GATEWAY_DISCONNECT_GRACE_MS);
    return;
  }
  const liveSessionId = event.session_id;
  if (!liveSessionId) return;
  const turn = turnsByLive.get(liveSessionId);
  if (!turn) return;
  const payload = asRecord(event.payload);

  switch (event.type) {
    case 'message.start':
      emitResponse(turn, 'start', {});
      break;
    case 'message.delta': {
      const text = textFromPayload(payload);
      if (text) {
        turn.pendingContent += text;
        scheduleContentFlush(turn);
      }
      break;
    }
    case 'reasoning.delta':
    case 'reasoning.available':
      // Hermes desktop ignores thinking.delta; reasoning is optional and
      // expensive to render on every token in the legacy message list UI.
      break;
    case 'tool.start':
    case 'tool.progress':
    case 'tool.generating':
    case 'tool.complete': {
      const callId = String(payload.tool_id ?? payload.call_id ?? payload.name ?? uuid());
      let tools = toolsByLive.get(liveSessionId);
      if (!tools) {
        tools = new Map();
        toolsByLive.set(liveSessionId, tools);
      }
      tools.set(callId, {
        call_id: callId,
        description: String(payload.preview ?? payload.summary ?? payload.description ?? payload.name ?? 'Tool'),
        name: String(payload.name ?? 'tool'),
        render_output_as_markdown: true,
        result_display:
          payload.inline_diff ??
          payload.result_text ??
          payload.result ??
          payload.output ??
          payload.summary ??
          payload.preview,
        status: payload.error ? 'Error' : event.type === 'tool.complete' ? 'Success' : 'Executing',
      });
      emitResponse(turn, 'tool_group', [...tools.values()]);
      break;
    }
    case 'approval.request': {
      const request = buildApprovalRequest(turn, payload);
      clearPendingRequestsForKind(turn.conversationId, 'approval');
      registerPendingRequest(request);
      break;
    }
    case 'clarify.request': {
      const request = buildClarifyRequest(turn, payload);
      if (request) registerPendingRequest(request);
      break;
    }
    case 'sudo.request': {
      const request = buildMaskedRequest(turn, 'sudo', payload);
      if (request) {
        clearPendingRequestsForKind(turn.conversationId, 'sudo');
        registerPendingRequest(request);
      }
      break;
    }
    case 'secret.request': {
      const request = buildMaskedRequest(turn, 'secret', payload);
      if (request) {
        clearPendingRequestsForKind(turn.conversationId, 'secret');
        registerPendingRequest(request);
      }
      break;
    }
    case 'message.complete': {
      if (turn.flushHandle) {
        clearTimeout(turn.flushHandle);
        turn.flushHandle = null;
      }
      if (turn.pendingContent) {
        turn.sawContent = true;
        emitResponse(turn, 'content', { content: turn.pendingContent });
        turn.pendingContent = '';
      }
      const finalText = textFromPayload(payload);
      if (!turn.sawContent && finalText) {
        emitResponse(turn, 'content', { content: finalText });
      }
      clearTimeout(turn.timeout);
      emitResponse(turn, 'finish', payload.usage ?? {});
      emitCompleted(turn);
      turnsByLive.delete(liveSessionId);
      toolsByLive.delete(liveSessionId);
      clearPendingRequests(turn.conversationId);
      break;
    }
    case 'tool.error':
    case 'message.error':
    case 'session.expired':
    case 'error': {
      const message = String(payload.message ?? 'The runtime could not complete this response.');
      finishTurn(liveSessionId, message, message);
      break;
    }
  }
}

const ensureSubscribed = (): void => {
  if (subscribed) return;
  subscribed = true;
  onGatewayEvent(handleHermesGatewayEvent);
};

const rememberSession = (storedId: string, liveId: string): void => {
  liveByStored.set(storedId, liveId);
  storedByLive.set(liveId, storedId);
};

const isSessionNotFound = (error: unknown): boolean =>
  error instanceof Error && /session not found/i.test(error.message);

const runtimeSubmissionError = (): Error =>
  new Error('The runtime could not start this response. Reconnect if needed, then try again.');

async function resumeSession(storedId: string): Promise<string> {
  const profile = profilesByStored.get(storedId) ?? getHermesConversationProfile(storedId);
  if (profile) {
    profilesByStored.set(storedId, profile);
    persistProfiles();
  }
  const resumed = await gatewayRpcRequest<HermesSessionResumeResponse>('session.resume', {
    session_id: storedId,
    cols: 96,
    ...(profile ? { profile } : {}),
  });
  rememberSession(storedId, resumed.session_id);
  return resumed.session_id;
}

async function ensureLiveSession(storedId: string): Promise<string> {
  return liveByStored.get(storedId) ?? resumeSession(storedId);
}

export async function createHermesChatConversation(params: ICreateConversationParams): Promise<TChatConversation> {
  const workspace = params.extra.workspace?.trim();
  const profile = params.assistant?.id?.trim();
  const sessionMode = params.extra?.session_mode;
  if (supportsResponsesApi()) {
    const storedId = uuid();
    if (profile) {
      profilesByStored.set(storedId, profile);
      persistProfiles();
    }
    rememberSession(storedId, storedId);
    const now = Date.now();
    const conversation: TChatConversation = {
      id: storedId,
      name: params.name?.trim() || 'New Chat',
      type: 'aionrs',
      created_at: now,
      modified_at: now,
      status: 'pending',
      source: 'headmaster',
      model: params.model ?? EMPTY_MODEL,
      runtime: idleRuntime(),
      extra: {
        ...params.extra,
        workspace: workspace || '',
        custom_workspace: Boolean(workspace),
      },
    };
    rememberOpenHermesConversation(storedId, profile, conversation);
    return conversation;
  }

  ensureSubscribed();
  const created = await gatewayRpcRequest<HermesSessionCreateResponse>('session.create', {
    cols: 96,
    ...(workspace ? { cwd: workspace } : {}),
    ...(params.name ? { title: params.name } : {}),
    ...(profile ? { profile } : {}),
  });
  const storedId = created.stored_session_id || created.session_id;
  rememberSession(storedId, created.session_id);
  if (profile) {
    profilesByStored.set(storedId, profile);
    persistProfiles();
  }
  const now = Date.now();
  const conversation: TChatConversation = {
    id: storedId,
    name: params.name?.trim() || 'New Chat',
    type: 'aionrs',
    created_at: now,
    modified_at: now,
    status: 'pending',
    source: 'headmaster',
    model: params.model ?? EMPTY_MODEL,
    runtime: idleRuntime(),
    extra: {
      ...params.extra,
      workspace: created.info?.cwd || workspace || '',
      custom_workspace: Boolean(created.info?.cwd || workspace),
    },
  };
  rememberOpenHermesConversation(storedId, profile, conversation);
  return conversation;
}

export async function sendHermesMessage(params: {
  conversation_id: string;
  input: string;
  files?: string[];
}): Promise<ISendMessageResult> {
  const useResponsesApi = supportsResponsesApi();
  if (!useResponsesApi) ensureSubscribed();
  let liveSessionId = params.conversation_id;
  if (!useResponsesApi) {
    try {
      liveSessionId = await ensureLiveSession(params.conversation_id);
    } catch {
      throw runtimeSubmissionError();
    }
  } else {
    rememberSession(params.conversation_id, params.conversation_id);
  }
  const userMsgId = uuid();
  const assistantMsgId = uuid();
  const turnId = uuid();
  const turn: ActiveTurn = {
    conversationId: params.conversation_id,
    liveSessionId,
    userMsgId,
    msgId: assistantMsgId,
    turnId,
    sawContent: false,
    pendingContent: '',
    flushHandle: null,
    timeout: setTimeout(() => {}, 0),
  };
  scheduleTurnTimeout(turn);
  turnsByLive.set(liveSessionId, turn);
  const text = [params.input, ...(params.files ?? []).map((file) => `@file:${file}`)].filter(Boolean).join('\n');

  const emitUserCreated = (): void => {
    broadcastWsEvent('message.userCreated', {
      conversation_id: params.conversation_id,
      msg_id: userMsgId,
      content: params.input,
      position: 'right',
      status: 'finish',
      hidden: false,
      created_at: Date.now(),
    });
  };

  if (useResponsesApi) {
    let toolCallIndex = 0;
    void submitResponseAndStream(text, liveSessionId, {
      onResponseCreated(responseId, sessionId) {
        turn.responseId = responseId;
        if (sessionId && sessionId !== liveSessionId) {
          liveByStored.set(params.conversation_id, sessionId);
          storedByLive.set(sessionId, params.conversation_id);
        }
      },
      onChunk(chunk) {
        if (!chunk) return;
        turn.sawContent = true;
        turn.pendingContent += chunk;
        scheduleContentFlush(turn);
      },
      onToolEvent(name, status, preview) {
        emitResponse(turn, 'tool_group', [
          {
            call_id: `${liveSessionId}:${name}:${toolCallIndex++}`,
            name,
            status: status === 'running' ? 'Executing' : status === 'completed' ? 'Success' : 'Error',
            description: preview ?? name,
            result_display: status === 'completed' ? preview : undefined,
          },
        ]);
      },
      onReasoning(text: string) {
        if (text) emitResponse(turn, 'thought', { subject: 'reasoning', description: text });
      },
      onInteractiveRequest(data) {
        // Surface the interactive prompt to the existing confirmation UI.
        // The PendingInteractiveRequest system handles rendering and user input.
        registerPendingRequest({
          kind: data.kind,
          conversationId: turn.conversationId,
          liveSessionId: turn.liveSessionId,
          requestId: data.request_id,
          confirmation: {
            action: data.kind,
            id: data.request_id,
            call_id: data.request_id,
            description: data.description ?? data.prompt ?? data.question ?? data.command ?? '',
            title: data.description ?? data.prompt ?? data.question ?? 'Interactive request',
            options: (data.choices ?? []).map((c) => ({ label: c, value: c })),
            ...(data.env_var ? { command_type: data.env_var } : {}),
          },
        });
      },
      onDone(usage, outputText) {
        if (turn.flushHandle) {
          clearTimeout(turn.flushHandle);
          turn.flushHandle = null;
        }
        if (turn.pendingContent) {
          emitResponse(turn, 'content', { content: turn.pendingContent });
          turn.pendingContent = '';
        } else if (!turn.sawContent && outputText) {
          emitResponse(turn, 'content', { content: outputText });
        }
        clearTimeout(turn.timeout);
        emitResponse(turn, 'finish', usage ?? {});
        emitCompleted(turn, usage ? `tokens: ${usage.input_tokens}+${usage.output_tokens}` : '');
        turnsByLive.delete(liveSessionId);
      },
      onError(message) {
        finishTurn(liveSessionId, message, message);
      },
    }).then((responseResult) => {
      if (responseResult) {
        turn.responseId = responseResult.responseId;
        return;
      }
      finishTurn(
        liveSessionId,
        'The runtime could not start this response.',
        'The runtime could not start this response.'
      );
    });

    emitUserCreated();
    return { msg_id: userMsgId, turn_id: turnId, runtime: runningRuntime(turnId) };
  }

  // Local-dashboard mode: WS-RPC `prompt.submit`. Hermes emits streamed
  // chunks via the `message.stream` WS event handled by
  // `handleHermesGatewayEvent`. This branch is only reachable when
  // `!useResponsesApi` (i.e. the bundled Hermes Python runtime, which
  // exposes `/api/ws` WS-RPC but not the Agent37 `/v1/responses` REST
  // surface). Remote (Agent37 Cloud) mode took the early-return at the
  // top of this function.
  try {
    await gatewayRpcRequest('prompt.submit', { session_id: liveSessionId, text });
  } catch (error) {
    if (!isSessionNotFound(error)) {
      abortTurn(turn);
      throw runtimeSubmissionError();
    }
    turnsByLive.delete(liveSessionId);
    try {
      liveSessionId = await resumeSession(params.conversation_id);
      turn.liveSessionId = liveSessionId;
      scheduleTurnTimeout(turn);
      turnsByLive.set(liveSessionId, turn);
      await gatewayRpcRequest('prompt.submit', { session_id: liveSessionId, text });
    } catch {
      abortTurn(turn);
      throw runtimeSubmissionError();
    }
  }

  emitUserCreated();
  return { msg_id: userMsgId, turn_id: turnId, runtime: runningRuntime(turnId) };
}

export async function stopHermesConversation(
  conversationId: string
): Promise<{ runtime: TConversationRuntimeSummary }> {
  let liveSessionId = supportsResponsesApi()
    ? (liveByStored.get(conversationId) ?? conversationId)
    : await ensureLiveSession(conversationId);
  const turn = turnsByLive.get(liveSessionId);
  if (turn?.responseId) {
    await cancelResponse(turn.responseId);
  } else {
    try {
      await gatewayRpcRequest('session.interrupt', { session_id: liveSessionId });
    } catch (error) {
      if (!isSessionNotFound(error)) throw error;
      liveSessionId = await resumeSession(conversationId);
      await gatewayRpcRequest('session.interrupt', { session_id: liveSessionId });
    }
  }
  if (turn) {
    finishTurn(liveSessionId, 'Interrupted');
  }
  clearPendingRequests(conversationId);
  return { runtime: idleRuntime() };
}

export function resetHermesChatRuntimeState(): void {
  for (const turn of turnsByLive.values()) {
    clearTimeout(turn.timeout);
    if (turn.flushHandle) {
      clearTimeout(turn.flushHandle);
    }
  }
  liveByStored.clear();
  storedByLive.clear();
  turnsByLive.clear();
  toolsByLive.clear();
  pendingRequestsByConversation.clear();
  profilesByStored.clear();
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(PROFILES_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export async function listHermesPendingRequests(
  conversationId: string
): Promise<Array<PendingInteractiveRequest['confirmation']>> {
  ensureSubscribed();
  return listPendingRequests(conversationId).map((request) => request.confirmation);
}

export async function confirmHermesPendingRequest(params: IConfirmMessageParams): Promise<void> {
  ensureSubscribed();
  await confirmPendingRequest(params);
}
