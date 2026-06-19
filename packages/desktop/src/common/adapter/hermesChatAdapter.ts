/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation, TConversationRuntimeSummary } from '../config/storage';
import { uuid } from '../utils';
import type {
  IConfirmMessageParams,
  IConversationTurnCompletedEvent,
  ICreateConversationParams,
  IResponseMessage,
  ISendMessageResult,
} from './ipcBridge';
import { broadcastWsEvent, gatewayRpcRequest, onGatewayEvent } from './httpBridge';

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
  msgId: string;
  turnId: string;
  sawContent: boolean;
};

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
let subscribed = false;

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
  await respondToPendingRequest(request, responseValue);
  removePendingRequest(params.conversation_id, request.requestId);
}

export function handleHermesGatewayEvent(event: HermesGatewayEvent): void {
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
        turn.sawContent = true;
        emitResponse(turn, 'content', { content: text });
      }
      break;
    }
    case 'reasoning.delta':
    case 'reasoning.available': {
      const text = textFromPayload(payload);
      if (text) emitResponse(turn, 'thought', { subject: 'Reasoning', description: text });
      break;
    }
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
      const finalText = textFromPayload(payload);
      if (!turn.sawContent && finalText) {
        emitResponse(turn, 'content', { content: finalText });
      }
      emitResponse(turn, 'finish', payload.usage ?? {});
      emitCompleted(turn);
      turnsByLive.delete(liveSessionId);
      toolsByLive.delete(liveSessionId);
      clearPendingRequests(turn.conversationId);
      break;
    }
    case 'error': {
      const message = String(payload.message ?? 'The runtime could not complete this response.');
      emitResponse(turn, 'tips', { content: message, type: 'error' });
      emitResponse(turn, 'finish', {});
      emitCompleted(turn, message);
      turnsByLive.delete(liveSessionId);
      toolsByLive.delete(liveSessionId);
      clearPendingRequests(turn.conversationId);
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

async function resumeSession(storedId: string): Promise<string> {
  const resumed = await gatewayRpcRequest<HermesSessionResumeResponse>('session.resume', {
    session_id: storedId,
    cols: 96,
  });
  rememberSession(storedId, resumed.session_id);
  return resumed.session_id;
}

async function ensureLiveSession(storedId: string): Promise<string> {
  return liveByStored.get(storedId) ?? resumeSession(storedId);
}

export async function createHermesChatConversation(params: ICreateConversationParams): Promise<TChatConversation> {
  ensureSubscribed();
  const workspace = params.extra.workspace?.trim();
  const created = await gatewayRpcRequest<HermesSessionCreateResponse>('session.create', {
    cols: 96,
    ...(workspace ? { cwd: workspace } : {}),
    ...(params.name ? { title: params.name } : {}),
  });
  const storedId = created.stored_session_id || created.session_id;
  rememberSession(storedId, created.session_id);
  const now = Date.now();
  return {
    id: storedId,
    name: params.name?.trim() || 'New Mission',
    type: 'aionrs',
    created_at: now,
    modified_at: now,
    status: 'pending',
    source: 'headmaster',
    model: params.model,
    runtime: idleRuntime(),
    extra: {
      ...params.extra,
      workspace: created.info?.cwd || workspace || '',
      custom_workspace: Boolean(created.info?.cwd || workspace),
    },
  } as TChatConversation;
}

export async function sendHermesMessage(params: {
  conversation_id: string;
  input: string;
  files?: string[];
}): Promise<ISendMessageResult> {
  ensureSubscribed();
  let liveSessionId = await ensureLiveSession(params.conversation_id);
  const msgId = uuid();
  const turnId = uuid();
  const turn: ActiveTurn = {
    conversationId: params.conversation_id,
    liveSessionId,
    msgId,
    turnId,
    sawContent: false,
  };
  turnsByLive.set(liveSessionId, turn);
  broadcastWsEvent('message.userCreated', {
    conversation_id: params.conversation_id,
    msg_id: msgId,
    content: params.input,
    position: 'right',
    status: 'finish',
    hidden: false,
    created_at: Date.now(),
  });
  const text = [params.input, ...(params.files ?? []).map((file) => `@file:${file}`)].filter(Boolean).join('\n');

  try {
    await gatewayRpcRequest('prompt.submit', { session_id: liveSessionId, text });
  } catch (error) {
    if (!isSessionNotFound(error)) {
      turnsByLive.delete(liveSessionId);
      throw error;
    }
    turnsByLive.delete(liveSessionId);
    liveSessionId = await resumeSession(params.conversation_id);
    turn.liveSessionId = liveSessionId;
    turnsByLive.set(liveSessionId, turn);
    await gatewayRpcRequest('prompt.submit', { session_id: liveSessionId, text });
  }

  return { msg_id: msgId, turn_id: turnId, runtime: runningRuntime(turnId) };
}

export async function stopHermesConversation(
  conversationId: string
): Promise<{ runtime: TConversationRuntimeSummary }> {
  let liveSessionId = await ensureLiveSession(conversationId);
  try {
    await gatewayRpcRequest('session.interrupt', { session_id: liveSessionId });
  } catch (error) {
    if (!isSessionNotFound(error)) throw error;
    liveSessionId = await resumeSession(conversationId);
    await gatewayRpcRequest('session.interrupt', { session_id: liveSessionId });
  }
  const turn = turnsByLive.get(liveSessionId);
  if (turn) {
    emitResponse(turn, 'finish', {});
    emitCompleted(turn, 'Interrupted');
    turnsByLive.delete(liveSessionId);
    toolsByLive.delete(liveSessionId);
  }
  clearPendingRequests(conversationId);
  return { runtime: idleRuntime() };
}

export function resetHermesChatRuntimeState(): void {
  liveByStored.clear();
  storedByLive.clear();
  turnsByLive.clear();
  toolsByLive.clear();
  pendingRequestsByConversation.clear();
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
