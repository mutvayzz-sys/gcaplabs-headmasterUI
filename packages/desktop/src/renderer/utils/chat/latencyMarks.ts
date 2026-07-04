/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ChatLatencyMark =
  | 'history_click'
  | 'conversation_paint'
  | 'composer_enabled'
  | 'send_click'
  | 'user_bubble_render'
  | 'request_accepted'
  | 'first_token'
  | 'final_response';

const PREFIX = 'headmaster.chat';
const MARK_ORDER: ChatLatencyMark[] = [
  'history_click',
  'conversation_paint',
  'composer_enabled',
  'send_click',
  'user_bubble_render',
  'request_accepted',
  'first_token',
  'final_response',
];

export type ChatLatencyEntry = { mark: ChatLatencyMark; conversationId?: string; at: number };

export type ChatLatencyReportRow = {
  conversationId: string;
  marks: Partial<Record<ChatLatencyMark, number>>;
  durations: Partial<Record<`${ChatLatencyMark}->${ChatLatencyMark}`, number>>;
  totalMs?: number;
};

const now = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

export function markChatLatency(mark: ChatLatencyMark, conversationId?: string): void {
  const name = `${PREFIX}.${mark}${conversationId ? `.${conversationId}` : ''}`;
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    try {
      performance.mark(name);
    } catch {
      // Ignore browser performance buffer failures.
    }
  }

  if (typeof window !== 'undefined') {
    const target = window as Window & { __headmasterChatLatency?: ChatLatencyEntry[] };
    target.__headmasterChatLatency = target.__headmasterChatLatency ?? [];
    target.__headmasterChatLatency.push({ mark, conversationId, at: now() });
  }
}

export function getChatLatencyEntries(): ChatLatencyEntry[] {
  if (typeof window === 'undefined') return [];
  return [...((window as Window & { __headmasterChatLatency?: ChatLatencyEntry[] }).__headmasterChatLatency ?? [])];
}

export function getChatLatencyReport(entries: ChatLatencyEntry[] = getChatLatencyEntries()): ChatLatencyReportRow[] {
  const rows = new Map<string, ChatLatencyReportRow>();
  for (const entry of entries) {
    const conversationId = entry.conversationId || 'global';
    const row = rows.get(conversationId) ?? { conversationId, marks: {}, durations: {} };
    row.marks[entry.mark] = entry.at;
    rows.set(conversationId, row);
  }

  for (const row of rows.values()) {
    for (let index = 1; index < MARK_ORDER.length; index++) {
      const prevMark = MARK_ORDER[index - 1];
      const nextMark = MARK_ORDER[index];
      const prev = row.marks[prevMark];
      const next = row.marks[nextMark];
      if (prev !== undefined && next !== undefined) {
        row.durations[`${prevMark}->${nextMark}`] = Math.round(next - prev);
      }
    }
    const first = row.marks.history_click ?? row.marks.send_click;
    const last = row.marks.final_response ?? row.marks.first_token ?? row.marks.conversation_paint;
    if (first !== undefined && last !== undefined) {
      row.totalMs = Math.round(last - first);
    }
  }

  return [...rows.values()];
}
