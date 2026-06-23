/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TMessage } from '../chat/chatLib';
import type { TChatConversation, TProviderWithModel } from '../config/storage';
import { fromApiConversation } from './apiModelMapper';
import { aioncoreHttpRequest, isAioncoreAvailable, rememberConversationRoute } from './aioncoreBridge';
import { httpRequest } from './httpBridge';

export interface HermesSessionInfo {
  archived?: boolean;
  cwd?: string | null;
  ended_at: number | null;
  id: string;
  _lineage_root_id?: string | null;
  input_tokens: number;
  is_active: boolean;
  last_active: number;
  message_count: number;
  model: string | null;
  output_tokens: number;
  preview: string | null;
  source: string | null;
  started_at: number;
  title: string | null;
  tool_call_count: number;
  profile?: string;
  is_default_profile?: boolean;
}

export interface HermesPaginatedSessions {
  limit: number;
  offset: number;
  sessions: HermesSessionInfo[];
  total: number;
}

export interface HermesSessionMessage {
  id?: string;
  content: unknown;
  name?: string;
  reasoning?: string | null;
  reasoning_content?: string | null;
  role: 'assistant' | 'system' | 'tool' | 'user';
  text?: unknown;
  timestamp?: number;
  tool_call_id?: string | null;
  tool_calls?: unknown;
  tool_name?: string;
  context?: unknown;
}

export interface HermesSessionMessagesResponse {
  messages: HermesSessionMessage[];
  session_id: string;
}

type PaginatedResult<T> = {
  items: T[];
  total: number;
  has_more: boolean;
};

const sessionProfiles = new Map<string, string>();
const locallyOpenSessions = new Set<string>();
const localConversations = new Map<string, TChatConversation>();

const toMilliseconds = (value: number | null | undefined): number => {
  if (!value) return Date.now();
  return value < 10_000_000_000 ? Math.round(value * 1000) : Math.round(value);
};

const modelFromHermes = (model: string | null): TProviderWithModel => {
  const value = model || '';
  const separator = value.indexOf('/');
  const provider = separator > 0 ? value.slice(0, separator) : '';
  return {
    id: provider,
    platform: provider,
    name: provider,
    base_url: '',
    api_key: '',
    use_model: value,
  };
};

const sessionName = (session: HermesSessionInfo): string =>
  session.title?.trim() || session.preview?.trim() || 'New Chat';

const profileQuery = (profile: string | undefined): string =>
  profile && profile !== 'default' ? `?profile=${encodeURIComponent(profile)}` : '';

async function listAioncoreConversations(params: {
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResult<TChatConversation>> {
  const limit = params.limit ?? 100;
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  query.set('limit', String(limit));
  const qs = query.toString();
  const raw = await aioncoreHttpRequest<PaginatedResult<TChatConversation>>(
    'GET',
    `/api/conversations${qs ? `?${qs}` : ''}`
  );
  const items = (raw.items ?? []).map((item) => {
    rememberConversationRoute(item.id, 'aioncore');
    return fromApiConversation(item);
  });
  return {
    items,
    total: raw.total ?? items.length,
    has_more: raw.has_more ?? false,
  };
}

function mergeConversationPages(
  hermes: PaginatedResult<TChatConversation>,
  aioncore: PaginatedResult<TChatConversation>,
  limit: number,
  visibleOffset: number
): PaginatedResult<TChatConversation> {
  const byId = new Map<string, TChatConversation>();
  for (const item of [...hermes.items, ...aioncore.items]) {
    const existing = byId.get(item.id);
    if (!existing || (item.modified_at ?? 0) >= (existing.modified_at ?? 0)) {
      byId.set(item.id, item);
    }
  }
  const merged = [...byId.values()].sort((a, b) => (b.modified_at ?? 0) - (a.modified_at ?? 0));
  const visible = merged.slice(visibleOffset, visibleOffset + limit);
  return {
    items: visible,
    total: merged.length,
    has_more: visibleOffset + visible.length < merged.length,
  };
}

export async function listUserConversations(params: {
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResult<TChatConversation>> {
  const limit = params.limit ?? 100;
  const visibleOffset = Number.parseInt(params.cursor || '0', 10) || 0;
  const hermes = await listHermesConversations({ cursor: '0', limit: 500 });
  if (!isAioncoreAvailable()) {
    const visible = hermes.items.slice(visibleOffset, visibleOffset + limit);
    return {
      items: visible,
      total: hermes.total,
      has_more: visibleOffset + visible.length < hermes.total,
    };
  }
  try {
    const aioncore = await listAioncoreConversations({ limit: 500 });
    const merged = mergeConversationPages(hermes, aioncore, limit, visibleOffset);
    return merged;
  } catch {
    const visible = hermes.items.slice(visibleOffset, visibleOffset + limit);
    return {
      items: visible,
      total: hermes.total,
      has_more: visibleOffset + visible.length < hermes.total,
    };
  }
}

function isTrackedHermesSession(session: HermesSessionInfo): boolean {
  if (locallyOpenSessions.has(session.id)) return true;
  return session.message_count >= 1;
}

export function forgetOpenHermesConversation(id: string): void {
  locallyOpenSessions.delete(id);
  localConversations.delete(id);
  sessionProfiles.delete(id);
}

/** @internal Vitest-only reset for module-level session caches. */
export function resetHermesSessionAdapterStateForTests(): void {
  sessionProfiles.clear();
  locallyOpenSessions.clear();
  localConversations.clear();
}

export function rememberOpenHermesConversation(
  id: string,
  profile?: string,
  conversation?: TChatConversation
): void {
  locallyOpenSessions.add(id);
  if (profile) sessionProfiles.set(id, profile);
  if (conversation) localConversations.set(id, conversation);
}

export function getHermesConversationProfile(id: string): string | undefined {
  return sessionProfiles.get(id);
}

export function fromHermesSession(session: HermesSessionInfo): TChatConversation {
  if (session.profile) sessionProfiles.set(session.id, session.profile);
  const conversation = {
    id: session.id,
    name: sessionName(session),
    desc: session.preview || undefined,
    type: 'aionrs',
    created_at: toMilliseconds(session.started_at),
    modified_at: toMilliseconds(session.last_active || session.started_at),
    status: session.is_active ? 'running' : 'finished',
    source: session.source || 'headmaster',
    model: modelFromHermes(session.model),
    extra: {
      workspace: session.cwd || '',
      custom_workspace: Boolean(session.cwd),
      last_token_usage: {
        total_tokens: Math.max(0, session.input_tokens || 0) + Math.max(0, session.output_tokens || 0),
      },
      hermes_profile: session.profile,
      hermes_archived: Boolean(session.archived),
      hermes_lineage_root_id: session._lineage_root_id || undefined,
    },
  } as TChatConversation;
  if (locallyOpenSessions.has(session.id)) localConversations.set(session.id, conversation);
  return conversation;
}

const contentToText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (content == null) return '';
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const item = part as Record<string, unknown>;
          if (typeof item.text === 'string') return item.text;
          if (typeof item.content === 'string') return item.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (typeof content === 'object') {
    const item = content as Record<string, unknown>;
    if (typeof item.text === 'string') return item.text;
    if (typeof item.content === 'string') return item.content;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
};

export function fromHermesMessage(message: HermesSessionMessage, conversationId: string, index: number): TMessage[] {
  const createdAt = toMilliseconds(message.timestamp);
  const idBase =
    typeof message.id === 'string' && message.id.trim().length > 0
      ? message.id.trim()
      : `${conversationId}:${index}`;
  const mapped: TMessage[] = [];
  const reasoning = message.reasoning_content || message.reasoning;

  if (reasoning) {
    mapped.push({
      id: `${idBase}:reasoning`,
      msg_id: `${idBase}:reasoning`,
      conversation_id: conversationId,
      type: 'thinking',
      content: { content: reasoning, status: 'done' },
      created_at: createdAt,
      position: 'left',
      status: 'finish',
    });
  }

  const text = contentToText(message.text ?? message.content);
  if (message.role !== 'tool' && (text || message.role !== 'assistant')) {
    mapped.push({
      id: idBase,
      msg_id: idBase,
      conversation_id: conversationId,
      type: 'text',
      content: { content: text },
      created_at: createdAt,
      position: message.role === 'user' ? 'right' : message.role === 'system' ? 'center' : 'left',
      status: 'finish',
      hidden: message.role === 'system',
    });
  }

  if (message.role === 'assistant' && Array.isArray(message.tool_calls)) {
    const tools = message.tool_calls.map((raw, toolIndex) => {
      const call = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
      const fn = call.function && typeof call.function === 'object' ? (call.function as Record<string, unknown>) : call;
      const callId = String(call.id ?? call.call_id ?? `${idBase}:tool:${toolIndex}`);
      let args: Record<string, unknown> = {};
      const rawArgs = fn.arguments ?? call.arguments ?? call.input;
      if (typeof rawArgs === 'string') {
        try {
          args = JSON.parse(rawArgs) as Record<string, unknown>;
        } catch {
          args = { input: rawArgs };
        }
      } else if (rawArgs && typeof rawArgs === 'object') {
        args = rawArgs as Record<string, unknown>;
      }
      return {
        call_id: callId,
        description: String(fn.name ?? call.name ?? 'Tool'),
        name: String(fn.name ?? call.name ?? 'tool'),
        render_output_as_markdown: true,
        status: 'Executing' as const,
        result_display: JSON.stringify(args, null, 2),
      };
    });
    mapped.push({
      id: `${idBase}:tools`,
      msg_id: `${idBase}:tools`,
      conversation_id: conversationId,
      type: 'tool_group',
      content: tools,
      created_at: createdAt,
      position: 'left',
      status: 'finish',
    });
  }

  if (message.role === 'tool') {
    mapped.push({
      id: `${idBase}:tool-result`,
      msg_id: `${idBase}:tool-result`,
      conversation_id: conversationId,
      type: 'tool_group',
      content: [
        {
          call_id: message.tool_call_id || `${idBase}:tool`,
          description: message.tool_name || message.name || 'Tool result',
          name: message.tool_name || message.name || 'tool',
          render_output_as_markdown: true,
          status: 'Success',
          result_display: text,
        },
      ],
      created_at: createdAt,
      position: 'left',
      status: 'finish',
    });
  }

  if (!text && message.context) {
    mapped.push({
      id: `${idBase}:metadata`,
      msg_id: `${idBase}:metadata`,
      conversation_id: conversationId,
      type: 'tips',
      content: {
        content: contentToText(message.context),
        type: 'info',
      },
      created_at: createdAt,
      position: 'center',
      status: 'finish',
      hidden: message.role === 'system',
    });
  }

  return mapped;
}

export async function listHermesConversations(params: {
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResult<TChatConversation>> {
  const limit = params.limit ?? 100;
  const visibleOffset = Number.parseInt(params.cursor || '0', 10) || 0;
  const candidates: HermesSessionInfo[] = [];
  let rawOffset = 0;
  const rawLimit = 200;

  while (true) {
    const query = new URLSearchParams({
      limit: String(rawLimit),
      offset: String(rawOffset),
      order: 'recent',
    });
    const page = await httpRequest<HermesPaginatedSessions>('GET', `/api/sessions?${query}`);
    candidates.push(...page.sessions);
    rawOffset += page.sessions.length;
    if (page.sessions.length === 0 || rawOffset >= page.total) break;
  }

  const trackedSessions = candidates.filter(isTrackedHermesSession);
  const conversations = trackedSessions.map(fromHermesSession);
  const seenIds = new Set(conversations.map((conversation) => conversation.id));
  for (const id of locallyOpenSessions) {
    if (seenIds.has(id)) continue;
    const local = localConversations.get(id);
    if (!local) continue;
    conversations.push(local);
    seenIds.add(id);
  }
  conversations.sort((a, b) => (b.modified_at ?? 0) - (a.modified_at ?? 0));
  const visible = conversations.slice(visibleOffset, visibleOffset + limit);
  return {
    items: visible,
    total: conversations.length,
    has_more: visibleOffset + visible.length < conversations.length,
  };
}

export async function getHermesConversation(id: string): Promise<TChatConversation | null> {
  const profile = sessionProfiles.get(id);
  let session: HermesSessionInfo | null | undefined;
  try {
    session = await httpRequest<HermesSessionInfo>(
      'GET',
      `/api/sessions/${encodeURIComponent(id)}${profileQuery(profile)}`,
      undefined,
      {
        silentStatuses: [404],
      }
    );
  } catch (error) {
    const local = localConversations.get(id);
    if (local) return local;
    throw error;
  }
  if (!session) return localConversations.get(id) ?? null;
  if (!isTrackedHermesSession(session)) return localConversations.get(id) ?? null;
  return fromHermesSession(session);
}

export async function getHermesConversationMessages(params: {
  conversation_id: string;
  page?: number;
  page_size?: number;
  order?: string;
  content_mode?: 'compact' | 'full';
}): Promise<PaginatedResult<TMessage>> {
  const profile = sessionProfiles.get(params.conversation_id);
  const result = await httpRequest<HermesSessionMessagesResponse>(
    'GET',
    `/api/sessions/${encodeURIComponent(params.conversation_id)}/messages${profileQuery(profile)}`
  );
  const all = result.messages.flatMap((message, index) => fromHermesMessage(message, params.conversation_id, index));
  const pageSize = params.page_size ?? all.length;
  const page = Math.max(0, params.page ?? 0);
  const start = page * pageSize;
  const items = all.slice(start, start + pageSize);
  return {
    items,
    total: all.length,
    has_more: start + items.length < all.length,
  };
}

export async function updateHermesConversation(id: string, updates: Partial<TChatConversation>): Promise<boolean> {
  const body: Record<string, unknown> = {};
  if (typeof updates.name === 'string') body.title = updates.name;
  const extra = updates.extra as Record<string, unknown> | undefined;
  if (typeof extra?.hermes_archived === 'boolean') body.archived = extra.hermes_archived;
  const profile = sessionProfiles.get(id);
  if (profile && profile !== 'default') body.profile = profile;
  const local = localConversations.get(id);
  if (local) {
    localConversations.set(id, {
      ...local,
      ...updates,
      extra: {
        ...(local.extra ?? {}),
        ...((updates.extra as Record<string, unknown> | undefined) ?? {}),
      },
    } as TChatConversation);
  }
  if (!Object.keys(body).length) return true;
  const result = await httpRequest<{ ok: boolean }>('PATCH', `/api/sessions/${encodeURIComponent(id)}`, body);
  return result.ok;
}

export async function deleteHermesConversation(id: string): Promise<boolean> {
  const profile = sessionProfiles.get(id);
  const result = await httpRequest<{ ok: boolean }>(
    'DELETE',
    `/api/sessions/${encodeURIComponent(id)}${profileQuery(profile)}`
  );
  sessionProfiles.delete(id);
  locallyOpenSessions.delete(id);
  localConversations.delete(id);
  return result.ok;
}
