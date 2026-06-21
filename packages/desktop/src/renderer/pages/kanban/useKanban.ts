/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { httpGet, httpPatch, isBackendHttpError } from '@/common/adapter/httpBridge';
export type KanbanColumnId = 'triage' | 'ready' | 'running' | 'blocked' | 'done';

export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  status: KanbanColumnId;
  assignee?: string;
  priority?: number;
  created_at?: string;
  updated_at?: string;
}

export interface KanbanColumn {
  id: KanbanColumnId;
  label: string;
  tasks: KanbanTask[];
}

interface HermesKanbanTask {
  id: string;
  title: string;
  body?: string | null;
  assignee?: string | null;
  status: string;
  priority?: number | null;
  created_at?: number | null;
  started_at?: number | null;
  completed_at?: number | null;
}

interface HermesKanbanBoardResponse {
  columns: Array<{
    name: string;
    tasks: HermesKanbanTask[];
  }>;
}

const COLUMN_LABELS: Record<KanbanColumnId, string> = {
  triage: 'Triage',
  ready: 'Ready',
  running: 'Running',
  blocked: 'Blocked',
  done: 'Done',
};

const COLUMN_ORDER: KanbanColumnId[] = ['triage', 'ready', 'running', 'blocked', 'done'];

/** Map Hermes kanban plugin status names to Headmaster column ids. */
export function mapHermesStatusToColumn(status: string): KanbanColumnId {
  const normalized = status.toLowerCase().replace(/[\s-]+/g, '_');
  switch (normalized) {
    case 'backlog':
    case 'triage':
      return 'triage';
    case 'todo':
    case 'ready':
      return 'ready';
    case 'in_progress':
    case 'running':
    case 'claimed':
      return 'running';
    case 'review':
    case 'blocked':
      return 'blocked';
    case 'done':
    case 'complete':
    case 'completed':
      return 'done';
    default:
      return 'triage';
  }
}

/** Map Headmaster column id back to Hermes plugin status for PATCH. */
export function mapColumnToHermesStatus(columnId: KanbanColumnId): string {
  switch (columnId) {
    case 'triage':
      return 'backlog';
    case 'ready':
      return 'todo';
    case 'running':
      return 'in_progress';
    case 'blocked':
      return 'review';
    case 'done':
      return 'done';
    default:
      return 'backlog';
  }
}

function isoFromUnix(value: number | null | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const ms = value > 1_000_000_000_000 ? value : value * 1000;
  return new Date(ms).toISOString();
}

function normalizeTask(raw: HermesKanbanTask): KanbanTask {
  return {
    id: raw.id,
    title: raw.title,
    description: typeof raw.body === 'string' ? raw.body : undefined,
    status: mapHermesStatusToColumn(raw.status),
    assignee: typeof raw.assignee === 'string' ? raw.assignee : undefined,
    priority: typeof raw.priority === 'number' ? raw.priority : undefined,
    created_at: isoFromUnix(raw.created_at),
    updated_at: isoFromUnix(raw.completed_at ?? raw.started_at ?? raw.created_at),
  };
}

function buildColumnsFromBoard(data: HermesKanbanBoardResponse): KanbanColumn[] {
  const buckets = new Map<KanbanColumnId, KanbanTask[]>(
    COLUMN_ORDER.map((id) => [id, [] as KanbanTask[]])
  );

  for (const column of data.columns ?? []) {
    for (const task of column.tasks ?? []) {
      const normalized = normalizeTask(task);
      buckets.get(normalized.status)?.push(normalized);
    }
  }

  return COLUMN_ORDER.map((id) => ({
    id,
    label: COLUMN_LABELS[id],
    tasks: buckets.get(id) ?? [],
  }));
}

export function useKanban() {
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnavailable(false);
    try {
      const board = await httpGet<HermesKanbanBoardResponse>('/api/plugins/kanban/board').invoke();
      setColumns(buildColumnsFromBoard(board));
    } catch (err) {
      if (isBackendHttpError(err) && (err.status === 404 || err.status === 502 || err.status === 503)) {
        setUnavailable(true);
        setColumns(COLUMN_ORDER.map((id) => ({ id, label: COLUMN_LABELS[id], tasks: [] as KanbanTask[] })));
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load kanban board');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const moveTask = useCallback(
    async (taskId: string, targetColumn: KanbanColumnId) => {
      const status = mapColumnToHermesStatus(targetColumn);
      await httpPatch<{ task?: HermesKanbanTask }, { status: string }>(
        `/api/plugins/kanban/tasks/${encodeURIComponent(taskId)}`
      ).invoke({ status });
      setColumns((prev) => {
        let moved: KanbanTask | undefined;
        const next = prev.map((col) => {
          const remaining = col.tasks.filter((task) => {
            if (task.id === taskId) {
              moved = { ...task, status: targetColumn };
              return false;
            }
            return true;
          });
          return { ...col, tasks: remaining };
        });
        if (!moved) return prev;
        return next.map((col) =>
          col.id === targetColumn ? { ...col, tasks: [...col.tasks, moved!] } : col
        );
      });
    },
    []
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    columns,
    loading,
    error,
    unavailable,
    refresh,
    moveTask,
  };
}
