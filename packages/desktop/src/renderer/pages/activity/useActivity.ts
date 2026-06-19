/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { getHermesConversationMessages, listHermesConversations } from '@/common/adapter/hermesSessionAdapter';

export interface SessionItem {
  id: string;
  name?: string;
  status: 'running' | 'thinking' | 'complete' | 'failed' | 'idle';
  agent_name?: string;
  task?: string;
  created_at?: string;
  updated_at?: string;
  token_count?: number;
  cost?: number;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface UseActivityReturn {
  sessions: SessionItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  filterStatus: string | null;
  setFilterStatus: (s: string | null) => void;
  filterAgent: string | null;
  setFilterAgent: (a: string | null) => void;
  expandedSessionId: string | null;
  setExpandedSessionId: (id: string | null) => void;
  messages: SessionMessage[];
  messagesLoading: boolean;
}

const STATUS_OPTIONS = ['running', 'thinking', 'complete', 'failed', 'idle'];

function isoFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  return undefined;
}

function normalizeMessage(raw: Record<string, unknown>, index: number): SessionMessage {
  const role = raw.role === 'assistant' || raw.role === 'system' ? raw.role : 'user';
  const content = raw.content ?? raw.text ?? raw.message ?? '';
  const c =
    typeof content === 'string' ? content : content && typeof content === 'object' ? JSON.stringify(content) : '';
  return {
    id: String(raw.id ?? raw.message_id ?? raw.msg_id ?? index),
    role,
    content: c,
    created_at: isoFromUnknown(raw.created_at ?? raw.timestamp ?? raw.time) ?? new Date().toISOString(),
  };
}

function normalizeStatus(raw: Record<string, unknown>): SessionItem['status'] {
  const explicit = String(raw.status ?? '').toLowerCase();
  if (['running', 'thinking', 'complete', 'failed', 'idle'].includes(explicit))
    return explicit as SessionItem['status'];
  if (raw.is_active === true || raw.is_processing === true || raw.can_send_message === false) return 'running';
  if (raw.ended_at === null || raw.ended_at === undefined) return 'idle';
  return 'complete';
}

function normalizeSession(raw: Record<string, unknown>): SessionItem {
  const id = String(raw.id ?? raw.session_id ?? raw.sid ?? '');
  const title = raw.title ?? raw.name ?? raw.preview ?? raw.summary;
  const messageCount = typeof raw.message_count === 'number' ? raw.message_count : undefined;
  const extra = raw.extra && typeof raw.extra === 'object' ? (raw.extra as Record<string, unknown>) : undefined;
  return {
    id,
    name: typeof title === 'string' && title ? title : id,
    status: normalizeStatus(raw),
    agent_name:
      typeof extra?.agent_name === 'string'
        ? extra.agent_name
        : typeof extra?.backend === 'string'
          ? extra.backend
          : typeof raw.source === 'string'
            ? raw.source
            : undefined,
    task:
      typeof raw.latest_message === 'string'
        ? raw.latest_message
        : typeof raw.preview === 'string'
          ? raw.preview
          : undefined,
    created_at: isoFromUnknown(raw.started_at ?? raw.created_at),
    updated_at: isoFromUnknown(raw.last_active ?? raw.updated_at ?? raw.modified_at ?? raw.ended_at ?? raw.started_at),
    token_count: messageCount,
    cost: typeof raw.cost === 'number' ? raw.cost : undefined,
  };
}

export function useActivity(): UseActivityReturn {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listHermesConversations({ limit: 500 });
      let next = data.items
        .map((item) => normalizeSession(item as unknown as Record<string, unknown>))
        .filter((s) => s.id);
      if (filterStatus) next = next.filter((s) => s.status === filterStatus);
      if (filterAgent) {
        const needle = filterAgent.toLowerCase();
        next = next.filter((s) => (s.agent_name ?? '').toLowerCase().includes(needle));
      }
      setSessions(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterAgent]);

  const fetchMessages = useCallback(async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const data = await getHermesConversationMessages({ conversation_id: sessionId, content_mode: 'full' });
      setMessages(
        data.items.map((message, index) =>
          normalizeMessage(
            {
              id: message.id,
              role: message.position === 'right' ? 'user' : message.position === 'center' ? 'system' : 'assistant',
              content: 'content' in message.content ? message.content.content : '',
              created_at: message.created_at,
            },
            index
          )
        )
      );
    } catch (err) {
      console.error('Failed to load session messages:', err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (expandedSessionId) {
      fetchMessages(expandedSessionId);
    } else {
      setMessages([]);
    }
  }, [expandedSessionId, fetchMessages]);

  return {
    sessions,
    loading,
    error,
    refresh: fetchSessions,
    filterStatus,
    setFilterStatus,
    filterAgent,
    setFilterAgent,
    expandedSessionId,
    setExpandedSessionId,
    messages,
    messagesLoading,
  };
}

export { STATUS_OPTIONS };
