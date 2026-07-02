/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * HTTP + WebSocket client for the GCAPCore sidecar (Council / ACP runtime).
 * Hermes remains on __backendPort; GCAPCore listens on __gcapcorePort.
 * __aioncorePort remains as a compatibility alias for upstream route code.
 */

import { BackendHttpError, type HttpRequestOptions } from './httpBridge';

type WsCallback = (data: unknown) => void;
let wsListenersRef: Map<string, Set<WsCallback>> | null = null;

declare global {
  interface Window {
    __gcapcorePort?: number;
    __aioncorePort?: number;
  }
}

const ACP_CONVERSATION_TYPES = new Set(['acp']);

const AIONCORE_WS_EVENTS = new Set([
  'team.agentStatusChanged',
  'team.agentSpawned',
  'team.agentRemoved',
  'team.agentRenamed',
  'team.listChanged',
  'team.created',
  'team.removed',
  'team.renamed',
  'team.teammateMessage',
  'team.mcpStatus',
  'team.taskChanged',
  'team.sessionChanged',
  'team.runAccepted',
  'team.runStarted',
  'team.runUpdated',
  'team.runCompleted',
  'team.runCancelled',
  'team.runFailed',
  'team.childTurnStarted',
  'team.childTurnCompleted',
  'team.childTurnCancelled',
  'message.stream',
  'message.userCreated',
  'turn.completed',
  'confirmation.add',
  'confirmation.update',
  'conversation.artifact',
  'conversation.listChanged',
]);

export function getAioncorePort(): number {
  if (typeof window !== 'undefined') {
    const gcapcore = (window as Window).__gcapcorePort;
    if (typeof gcapcore === 'number' && gcapcore > 0) return gcapcore;
    const aioncore = (window as Window).__aioncorePort;
    if (typeof aioncore === 'number' && aioncore > 0) return aioncore;
  }
  const g = globalThis as typeof globalThis & { __gcapcorePort?: number; __aioncorePort?: number };
  return g.__gcapcorePort ?? g.__aioncorePort ?? 0;
}

export function isAioncoreAvailable(): boolean {
  return getAioncorePort() > 0;
}

export function getAioncoreBaseUrl(): string {
  return `http://127.0.0.1:${getAioncorePort()}`;
}

function getAioncoreWsUrl(): string {
  return `ws://127.0.0.1:${getAioncorePort()}/ws`;
}

export function isAioncoreWsEvent(eventName: string): boolean {
  return AIONCORE_WS_EVENTS.has(eventName);
}

export async function aioncoreHttpRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: HttpRequestOptions
): Promise<T> {
  const port = getAioncorePort();
  if (port <= 0) {
    throw new Error('GCAPCore sidecar is not running');
  }
  const url = `${getAioncoreBaseUrl()}${path}`;
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let parsed: unknown = text;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const silent = options?.silentStatuses?.includes(response.status);
    if (!silent) {
      console.error(`[aioncore] ${method} ${path} failed (${response.status})`);
    }
    throw new BackendHttpError({ method, path, status: response.status, body: parsed });
  }

  if (parsed && typeof parsed === 'object' && 'data' in (parsed as Record<string, unknown>)) {
    return (parsed as { data: T }).data;
  }
  return parsed as T;
}

const conversationRouteCache = new Map<string, 'hermes' | 'aioncore'>();

export function rememberConversationRoute(conversationId: string, route: 'hermes' | 'aioncore'): void {
  conversationRouteCache.set(conversationId, route);
}

export function clearConversationRouteCache(): void {
  conversationRouteCache.clear();
}

function isAcpConversationRecord(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const type = String((raw as { type?: unknown }).type ?? '');
  return ACP_CONVERSATION_TYPES.has(type);
}

/**
 * Decide whether a conversation should use AionCore (ACP) or Hermes.
 */
export async function resolveConversationRoute(conversationId: string): Promise<'hermes' | 'aioncore'> {
  const cached = conversationRouteCache.get(conversationId);
  if (cached) return cached;

  if (isAioncoreAvailable()) {
    try {
      const raw = await aioncoreHttpRequest<unknown>(
        'GET',
        `/api/conversations/${encodeURIComponent(conversationId)}`,
        undefined,
        {
          silentStatuses: [404],
        }
      );
      if (isAcpConversationRecord(raw)) {
        conversationRouteCache.set(conversationId, 'aioncore');
        return 'aioncore';
      }
    } catch (error) {
      if (error instanceof BackendHttpError && error.status === 404) {
        // not in aioncore — fall through
      } else if (!isAioncoreAvailable()) {
        conversationRouteCache.set(conversationId, 'hermes');
        return 'hermes';
      }
    }
  }

  conversationRouteCache.set(conversationId, 'hermes');
  return 'hermes';
}

// ---------------------------------------------------------------------------
// AionCore WebSocket (team events + ACP streaming)
// ---------------------------------------------------------------------------

let aioncoreWs: WebSocket | null = null;
let aioncoreWsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let aioncoreWsReconnectAttempt = 0;

export function registerAioncoreWsListener(eventName: string, handler: WsCallback): () => void {
  if (!wsListenersRef) return () => {};
  if (!wsListenersRef.has(eventName)) {
    wsListenersRef.set(eventName, new Set());
  }
  wsListenersRef.get(eventName)!.add(handler);
  return () => {
    wsListenersRef?.get(eventName)?.delete(handler);
  };
}

/** Wire the shared wsListeners map from httpBridge.ts */
export function bindAioncoreWsListeners(listeners: Map<string, Set<WsCallback>>): void {
  wsListenersRef = listeners;
}

export function ensureAioncoreWs(): void {
  if (typeof window === 'undefined') return;
  if (!isAioncoreAvailable()) return;
  if (aioncoreWs && (aioncoreWs.readyState === WebSocket.OPEN || aioncoreWs.readyState === WebSocket.CONNECTING)) {
    return;
  }
  connectAioncoreWs();
}

export function resetAioncoreWsConnection(): void {
  if (aioncoreWsReconnectTimer) clearTimeout(aioncoreWsReconnectTimer);
  aioncoreWsReconnectTimer = null;
  aioncoreWsReconnectAttempt = 0;
  aioncoreWs?.close();
  aioncoreWs = null;
}

function connectAioncoreWs(): void {
  const url = getAioncoreWsUrl();
  try {
    aioncoreWs = new WebSocket(url);
  } catch {
    scheduleAioncoreWsReconnect();
    return;
  }

  const current = aioncoreWs;

  current.addEventListener('open', () => {
    aioncoreWsReconnectAttempt = 0;
  });

  current.addEventListener('close', () => {
    if (aioncoreWs === current) aioncoreWs = null;
    scheduleAioncoreWsReconnect();
  });

  current.addEventListener('error', () => {
    current.close();
  });

  current.addEventListener('message', (event: MessageEvent) => {
    try {
      const msg = JSON.parse(String(event.data)) as {
        name?: string;
        event?: string;
        data?: unknown;
        payload?: unknown;
      };
      const eventName = msg.name ?? msg.event;
      const payload = msg.data ?? msg.payload;
      if (!eventName || !wsListenersRef) return;
      const handlers = wsListenersRef.get(eventName);
      if (!handlers) return;
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch {
          /* isolate listener failures */
        }
      }
    } catch {
      /* ignore non-json */
    }
  });
}

function scheduleAioncoreWsReconnect(): void {
  if (!isAioncoreAvailable()) return;
  if (aioncoreWsReconnectTimer) return;
  const delay = Math.min(1000 * Math.pow(2, aioncoreWsReconnectAttempt), 30_000);
  aioncoreWsReconnectAttempt++;
  aioncoreWsReconnectTimer = setTimeout(() => {
    aioncoreWsReconnectTimer = null;
    ensureAioncoreWs();
  }, delay);
}
