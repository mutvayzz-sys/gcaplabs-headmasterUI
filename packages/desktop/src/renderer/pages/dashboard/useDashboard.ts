/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { httpGet } from '@/common/adapter/httpBridge';
import { listHermesConversations } from '@/common/adapter/hermesSessionAdapter';
import type { SessionItem } from '@/renderer/pages/activity/useActivity';
import type { KanbanTask } from '@/renderer/pages/kanban/useKanban';

export interface DashboardStats {
  activeSessions: number;
  totalTokens: number;
  messagesToday: number;
  connectedPlatforms: number;
  pendingTasks: number;
  memoryProviders: number;
  documentsCount: number;
}

export interface RecentItem {
  id: string;
  type: 'session' | 'task' | 'document' | 'message';
  title: string;
  timestamp: string;
  meta?: string;
}

function isoFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  return undefined;
}

function normalizeSession(raw: Record<string, unknown>): SessionItem {
  const id = String(raw.id ?? raw.session_id ?? '');
  const active = raw.is_active === true;
  return {
    id,
    name: String(raw.title ?? raw.name ?? raw.preview ?? id),
    status: active ? 'running' : raw.ended_at ? 'complete' : 'idle',
    agent_name: typeof raw.profile === 'string' ? raw.profile : typeof raw.source === 'string' ? raw.source : undefined,
    created_at: isoFromUnknown(raw.started_at ?? raw.created_at),
    updated_at: isoFromUnknown(raw.last_active ?? raw.updated_at ?? raw.ended_at ?? raw.started_at),
    token_count: typeof raw.message_count === 'number' ? raw.message_count : undefined,
  };
}

function inferWorkspaceRoot(conversations: Array<Record<string, unknown>>): string {
  for (const conversation of conversations) {
    const extra =
      conversation.extra && typeof conversation.extra === 'object'
        ? (conversation.extra as Record<string, unknown>)
        : undefined;
    const workspace = typeof extra?.workspace === 'string' ? extra.workspace : '';
    if (workspace) return workspace;
  }
  return '';
}

function fromCronJob(raw: Record<string, unknown>): KanbanTask {
  return {
    id: String(raw.id ?? raw.job_id ?? ''),
    title: String(raw.name ?? raw.id ?? raw.job_id ?? 'Scheduled job'),
    description: typeof raw.prompt === 'string' ? raw.prompt : undefined,
    status: raw.enabled === false ? 'blocked' : 'ready',
    created_at: isoFromUnknown(raw.created_at),
    updated_at: isoFromUnknown(raw.updated_at ?? raw.last_run_at),
  };
}

export function useDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    activeSessions: 0,
    totalTokens: 0,
    messagesToday: 0,
    connectedPlatforms: 0,
    pendingTasks: 0,
    memoryProviders: 0,
    documentsCount: 0,
  });
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conversationsRaw = await listHermesConversations({ limit: 500 });
      const conversationItems = conversationsRaw.items as unknown as Array<Record<string, unknown>>;
      const sessions = conversationItems.map(normalizeSession);
      const cronRaw = await httpGet<Array<Record<string, unknown>>>('/api/cron/jobs')
        .invoke()
        .catch((_error: unknown): Array<Record<string, unknown>> => []);
      const root = inferWorkspaceRoot(conversationItems);
      const filesRaw = root
        ? await httpGet<{ entries?: Array<Record<string, unknown>> }>(`/api/files?path=${encodeURIComponent(root)}`)
            .invoke()
            .then((result) => result.entries ?? [])
            .catch((_error: unknown): Array<Record<string, unknown>> => [])
        : [];

      const tasks = (cronRaw ?? []).map(fromCronJob);
      const activeSessions = sessions.filter((s) => s.status === 'running' || s.status === 'thinking').length;
      const pendingTasks = tasks.filter((t) => t.status !== 'done').length;

      setStats({
        activeSessions,
        totalTokens: sessions.reduce((sum, session) => sum + (session.token_count ?? 0), 0),
        messagesToday: 0,
        connectedPlatforms: 0,
        pendingTasks,
        memoryProviders: 0,
        documentsCount: filesRaw.length,
      });

      const recentItems: RecentItem[] = [
        ...sessions.slice(0, 5).map((s) => ({
          id: s.id,
          type: 'session' as const,
          title: s.name ?? `Session ${s.id.slice(0, 8)}`,
          timestamp: s.updated_at ?? s.created_at ?? new Date().toISOString(),
          meta: s.status,
        })),
        ...tasks.slice(0, 3).map((t) => ({
          id: t.id,
          type: 'task' as const,
          title: t.title,
          timestamp: t.updated_at ?? t.created_at ?? new Date().toISOString(),
          meta: t.status,
        })),
      ]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8);

      setRecent(recentItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, recent, loading, error, refresh };
}
