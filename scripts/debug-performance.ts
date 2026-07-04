#!/usr/bin/env tsx
/**
 * Print chat latency baselines from exported Headmaster chat latency marks.
 *
 * Usage:
 *   In DevTools: copy(JSON.stringify(window.__headmasterChatLatency ?? []))
 *   Save to .tmp/chat-latency.json
 *   bunx tsx scripts/debug-performance.ts --input .tmp/chat-latency.json --report
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type ChatLatencyMark =
  | 'history_click'
  | 'conversation_paint'
  | 'composer_enabled'
  | 'send_click'
  | 'user_bubble_render'
  | 'request_accepted'
  | 'first_token'
  | 'final_response';

type ChatLatencyEntry = { mark: ChatLatencyMark; conversationId?: string; at: number };

const markOrder: ChatLatencyMark[] = [
  'history_click',
  'conversation_paint',
  'composer_enabled',
  'send_click',
  'user_bubble_render',
  'request_accepted',
  'first_token',
  'final_response',
];

const args = process.argv.slice(2);
const inputIndex = args.findIndex((arg) => arg === '--input' || arg === '-i');
const inputPath = inputIndex >= 0 ? args[inputIndex + 1] : undefined;

if (!inputPath) {
  console.log(`Headmaster chat performance baseline helper\n\n1. Run dev mode with the panel enabled:\n   localStorage.setItem('headmaster.chatPerfDebug', '1')\n\n2. Exercise: history click, first send, long stream, session switch.\n\n3. Export marks from DevTools:\n   copy(JSON.stringify(window.__headmasterChatLatency ?? [], null, 2))\n\n4. Save to .tmp/chat-latency.json and run:\n   bunx tsx scripts/debug-performance.ts --input .tmp/chat-latency.json --report\n`);
  process.exit(0);
}

const raw = readFileSync(resolve(inputPath), 'utf8');
const entries = JSON.parse(raw) as ChatLatencyEntry[];
const byConversation = new Map<string, Partial<Record<ChatLatencyMark, number>>>();

for (const entry of entries) {
  const key = entry.conversationId || 'global';
  const marks = byConversation.get(key) ?? {};
  marks[entry.mark] = entry.at;
  byConversation.set(key, marks);
}

const rows = [...byConversation.entries()].map(([conversationId, marks]) => {
  const row: Record<string, string | number> = { conversationId };
  for (let index = 1; index < markOrder.length; index++) {
    const from = markOrder[index - 1];
    const to = markOrder[index];
    const start = marks[from];
    const end = marks[to];
    row[`${from}->${to}`] = start !== undefined && end !== undefined ? Math.round(end - start) : '—';
  }
  const first = marks.history_click ?? marks.send_click;
  const last = marks.final_response ?? marks.first_token ?? marks.conversation_paint;
  row.total = first !== undefined && last !== undefined ? Math.round(last - first) : '—';
  return row;
});

console.table(rows);
