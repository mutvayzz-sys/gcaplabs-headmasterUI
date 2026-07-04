/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { getChatLatencyReport, type ChatLatencyReportRow } from '@/renderer/utils/chat/latencyMarks';

const isEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('chatPerf') === '1' || window.localStorage.getItem('headmaster.chatPerfDebug') === '1';
};

const formatDuration = (value: number | undefined): string => (value === undefined ? '—' : `${value}ms`);

const ChatPerfDebugPanel: React.FC = () => {
  const [enabled] = useState(isEnabled);
  const [rows, setRows] = useState<ChatLatencyReportRow[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setRows(getChatLatencyReport());
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);

  if (!enabled) return null;

  const latest = rows.at(-1);
  const durations = latest?.durations ?? {};

  return (
    <div
      data-testid='chat-perf-debug-panel'
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        zIndex: 50,
        width: 320,
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid var(--color-border-2)',
        background: 'rgba(20, 20, 20, 0.82)',
        color: '#fff',
        fontSize: 12,
        lineHeight: '18px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.24)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Chat perf</div>
      <div>conversation: {latest?.conversationId ?? '—'}</div>
      <div>history → paint: {formatDuration(durations['history_click->conversation_paint'])}</div>
      <div>send → user bubble: {formatDuration(durations['send_click->user_bubble_render'])}</div>
      <div>accepted → first token: {formatDuration(durations['request_accepted->first_token'])}</div>
      <div>first token → final: {formatDuration(durations['first_token->final_response'])}</div>
      <div>total: {formatDuration(latest?.totalMs)}</div>
    </div>
  );
};

export default ChatPerfDebugPanel;
