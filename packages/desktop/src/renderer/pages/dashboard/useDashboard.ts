/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { httpGet, httpPost } from '@/common/adapter/httpBridge';
import type { SessionItem } from '@/renderer/pages/activity/useActivity';
import type { KanbanTask } from '@/renderer/pages/kanban/useKanban';
import type { PlatformConfig } from '@/renderer/pages/integrations/useIntegrations';

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

interface AdonisConversationsResponse {
  items?: Array<Record<string, unknown>>;
  total?: number;
}

interface AdonisFsEntry {
  name?: string;
  full_path?: string;
  relative_path?: string;
}

interface AcpAdapterLike {
  id?: string;
  name?: string;
  backend?: string;
  enabled?: boolean;
  available?: boolean;
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

function inferAionuiRoot(conversations: Array<Record<string, unknown>>): string {
  for (const conversation of conversations) {
    const extra = conversation.extra && typeof conversation.extra === 'object' ? conversation.extra as Record<string, unknown> : undefined;
    const workspace = typeof extra?.workspace === 'string' ? extra.workspace : '';
    if (!workspace) continue;
    const separator = workspace.includes('\\') ? '\\' : '/';
    const marker = `${separator}conversations${separator}`;
    const markerIndex = workspace.toLowerCase().indexOf(marker.toLowerCase());
    if (markerIndex > 0) return workspace.slice(0, markerIndex);
  }
  return '';
}

function fromCronJob(raw: Record<string, unknown>): KanbanTask {
  return {
    id: String(raw.id ?? raw.job_id ?? ''),
    title: String(raw.name ?? raw.id ?? raw.job_id ?? 'Scheduled job'),
    description: typeof raw.prompt === 'string' ? raw.prompt : undefined,
    status: raw.enabled === false ? 'review' : 'todo',
    created_at: isoFromUnknown(raw.created_at),
    updated_at: isoFromUnknown(raw.updated_at ?? raw.last_run_at),
  };
}

function normalizePlatform(raw: Record<string, unknown>): PlatformConfig {
  const id = String(raw.id ?? raw.platform ?? raw.name ?? '');
  const state = String(raw.state ?? '').toLowerCase();
  return {
    id,
    name: String(raw.name ?? id),
    connected: state === 'connected' || raw.connected === true,
    enabled: raw.enabled !== false,
    settings: raw,
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
      const conversationsRaw = await httpGet<AdonisConversationsResponse>('/api/conversations').invoke();
      const sessions = (conversationsRaw?.items ?? []).map(normalizeSession);
      const [cronRaw, adaptersRaw] = await Promise.all([
        httpGet<Array<Record<string, unknown>>>('/api/cron/jobs').invoke().catch((_error: unknown): Array<Record<string, unknown>> => []),
        httpGet<AcpAdapterLike[]>('/api/extensions/acp-adapters').invoke().catch((_error: unknown): AcpAdapterLike[] => []),
      ]);
      const root = inferAionuiRoot(conversationsRaw?.items ?? []);
      const filesRaw = root
        ? await httpPost<AdonisFsEntry[], { root: string }>('/api/fs/list').invoke({ root }).catch((_error: unknown): AdonisFsEntry[] => [])
        : [];

      const tasks = (cronRaw ?? []).map(fromCronJob);
      const platforms = (adaptersRaw ?? []).map((adapter) => normalizePlatform({
        id: adapter.id ?? adapter.backend ?? adapter.name,
        name: adapter.name ?? adapter.backend ?? adapter.id,
        connected: adapter.available !== false,
        enabled: adapter.enabled !== false,
      }));
      const activeSessions = sessions.filter((s) => s.status === 'running' || s.status === 'thinking').length;
      const connectedPlatforms = platforms.filter((p) => p.connected && p.enabled).length;
      const pendingTasks = tasks.filter((t) => t.status !== 'done').length;

      setStats({
        activeSessions,
        totalTokens: sessions.reduce((sum, session) => sum + (session.token_count ?? 0), 0),
        messagesToday: 0,
        connectedPlatforms,
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
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 8);

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
