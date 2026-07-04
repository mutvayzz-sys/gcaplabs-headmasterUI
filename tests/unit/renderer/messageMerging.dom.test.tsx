/**
 * @license
 * Copyright 2025 Headmaster (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { type PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcBridge } from '@/common';
import type { IMessageAcpToolCall, IMessageText, IMessageThinking } from '@/common/chat/chatLib';
import type { TChatConversation } from '@/common/config/storage';
import {
  MESSAGE_STREAM_FLUSH_INTERVAL_MS,
  MessageListLoadingProvider,
  MessageListProvider,
  useAddOrUpdateMessage,
  useMessageLstCache,
  useMessageList,
} from '@/renderer/pages/conversation/Messages/hooks';
import {
  loadAllUserConversations,
  MESSAGE_HISTORY_PAGE_SIZE,
  SESSION_HISTORY_PAGE_SIZE,
} from '@/renderer/utils/chat/pagedConversationData';

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      userCreated: {
        on: vi.fn().mockReturnValue(() => {}),
      },
    },
    database: {
      getConversationMessages: {
        invoke: vi.fn(),
      },
      getUserConversations: {
        invoke: vi.fn(),
      },
    },
  },
}));

const CONVERSATION_ID = 'conversation-1';

function createTextMessage(msgId: string, content: string): IMessageText {
  return {
    id: `text-${msgId}-${content}`,
    type: 'text',
    msg_id: msgId,
    conversation_id: CONVERSATION_ID,
    position: 'left',
    content: {
      content,
    },
  };
}

function createThinkingMessage(msgId: string, content: string): IMessageThinking {
  return {
    id: `thinking-${msgId}-${content}`,
    type: 'thinking',
    msg_id: msgId,
    conversation_id: CONVERSATION_ID,
    position: 'left',
    content: {
      content,
      status: 'thinking',
    },
  };
}

function createThinkingDoneMessage(msgId: string, duration: number): IMessageThinking {
  return {
    id: `thinking-done-${msgId}`,
    type: 'thinking',
    msg_id: msgId,
    conversation_id: CONVERSATION_ID,
    position: 'left',
    content: {
      content: '',
      duration,
      status: 'done',
    },
  };
}

function createToolCallMessage(toolCallId: string): IMessageAcpToolCall {
  return {
    id: toolCallId,
    type: 'acp_tool_call',
    msg_id: toolCallId,
    conversation_id: CONVERSATION_ID,
    position: 'left',
    content: {
      session_id: 'session-1',
      update: {
        sessionUpdate: 'tool_call',
        tool_call_id: toolCallId,
        status: 'completed',
        title: 'Read file',
        kind: 'read',
      },
    },
  };
}

function TestWrapper({ children }: PropsWithChildren): JSX.Element {
  return <MessageListProvider value={[]}>{children}</MessageListProvider>;
}

function CacheWrapper({ children }: PropsWithChildren): JSX.Element {
  return (
    <MessageListLoadingProvider value={false}>
      <MessageListProvider value={[]}>{children}</MessageListProvider>
    </MessageListLoadingProvider>
  );
}

function useMessageHarness() {
  return {
    addOrUpdateMessage: useAddOrUpdateMessage(),
    messages: useMessageList(),
  };
}

function useCacheHarness() {
  useMessageLstCache(CONVERSATION_ID);
  return useMessageList();
}

async function flushMessageQueue(): Promise<void> {
  await act(async () => {
    vi.runAllTimers();
  });
}

describe('message merging', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('keeps text segments split when tool calls interrupt the same msg_id stream', async () => {
    const { result } = renderHook(() => useMessageHarness(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.addOrUpdateMessage(createTextMessage('msg-1', 'hello'));
      result.current.addOrUpdateMessage(createTextMessage('msg-1', ' world'));
    });
    await flushMessageQueue();

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('text');
    expect((result.current.messages[0] as IMessageText).content.content).toBe('hello world');

    act(() => {
      result.current.addOrUpdateMessage(createToolCallMessage('tool-1'));
      result.current.addOrUpdateMessage(createTextMessage('msg-1', 'again'));
    });
    await flushMessageQueue();

    expect(result.current.messages.map((message) => message.type)).toEqual(['text', 'acp_tool_call', 'text']);
    expect((result.current.messages[0] as IMessageText).content.content).toBe('hello world');
    expect((result.current.messages[2] as IMessageText).content.content).toBe('again');
  });

  it('keeps thinking segments split when tool calls interrupt the same msg_id stream', async () => {
    const { result } = renderHook(() => useMessageHarness(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.addOrUpdateMessage(createThinkingMessage('msg-1', 'alpha'));
      result.current.addOrUpdateMessage(createThinkingMessage('msg-1', 'beta'));
    });
    await flushMessageQueue();

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe('thinking');
    expect((result.current.messages[0] as IMessageThinking).content.content).toBe('alphabeta');

    act(() => {
      result.current.addOrUpdateMessage(createToolCallMessage('tool-1'));
      result.current.addOrUpdateMessage(createThinkingMessage('msg-1', 'gamma'));
    });
    await flushMessageQueue();

    expect(result.current.messages.map((message) => message.type)).toEqual(['thinking', 'acp_tool_call', 'thinking']);
    expect((result.current.messages[0] as IMessageThinking).content.content).toBe('alphabeta');
    expect((result.current.messages[2] as IMessageThinking).content.content).toBe('gamma');
  });

  it('merges thinking done updates into the existing thinking message instead of appending a completion message', async () => {
    const { result } = renderHook(() => useMessageHarness(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.addOrUpdateMessage(createThinkingMessage('msg-1', 'alpha'));
      result.current.addOrUpdateMessage(createToolCallMessage('tool-1'));
      result.current.addOrUpdateMessage(createThinkingDoneMessage('msg-1', 4200));
    });
    await flushMessageQueue();

    expect(result.current.messages.map((message) => message.type)).toEqual(['thinking', 'acp_tool_call']);
    expect((result.current.messages[0] as IMessageThinking).content.status).toBe('done');
    expect((result.current.messages[0] as IMessageThinking).content.duration).toBe(4200);
  });

  it('ignores non-renderable transformed stream messages', async () => {
    const { result } = renderHook(() => useMessageHarness(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.addOrUpdateMessage(undefined);
    });
    await flushMessageQueue();

    expect(result.current.messages).toEqual([]);
  });

  it('batches bursty stream token updates until the 33ms flush interval', async () => {
    const { result } = renderHook(() => useMessageHarness(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.addOrUpdateMessage(createTextMessage('msg-1', 'a'));
      result.current.addOrUpdateMessage(createTextMessage('msg-1', 'b'));
      result.current.addOrUpdateMessage(createTextMessage('msg-1', 'c'));
    });

    expect(result.current.messages).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(MESSAGE_STREAM_FLUSH_INTERVAL_MS - 1);
    });

    expect(result.current.messages).toEqual([]);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.messages).toHaveLength(1);
    expect((result.current.messages[0] as IMessageText).content.content).toBe('abc');
  });

  it('requests compact tool content when hydrating historical messages', async () => {
    const invoke = vi.mocked(ipcBridge.database.getConversationMessages.invoke);
    invoke.mockClear();
    invoke.mockResolvedValue({ items: [], total: 0, has_more: false });

    renderHook(() => useMessageLstCache(CONVERSATION_ID), {
      wrapper: CacheWrapper,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith({
      conversation_id: CONVERSATION_ID,
      page: 0,
      page_size: MESSAGE_HISTORY_PAGE_SIZE,
      content_mode: 'compact',
    });
  });

  it('hydrates historical messages through bounded pages', async () => {
    vi.useRealTimers();
    const invoke = vi.mocked(ipcBridge.database.getConversationMessages.invoke);
    invoke.mockReset();
    invoke
      .mockResolvedValueOnce({
        items: [createTextMessage('msg-1', 'first')],
        total: 2,
        has_more: true,
      })
      .mockResolvedValueOnce({
        items: [createTextMessage('msg-2', 'second')],
        total: 2,
        has_more: false,
      });

    const { result } = renderHook(() => useCacheHarness(), {
      wrapper: CacheWrapper,
    });

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledTimes(2);
    });

    expect(invoke).toHaveBeenNthCalledWith(1, {
      conversation_id: CONVERSATION_ID,
      page: 0,
      page_size: MESSAGE_HISTORY_PAGE_SIZE,
      content_mode: 'compact',
    });
    expect(invoke).toHaveBeenNthCalledWith(2, {
      conversation_id: CONVERSATION_ID,
      page: 1,
      page_size: MESSAGE_HISTORY_PAGE_SIZE,
      content_mode: 'compact',
    });
    expect(result.current.map((message) => message.msg_id)).toEqual(['msg-1', 'msg-2']);
  });
});

describe('paged conversation data', () => {
  afterEach(() => {
    vi.mocked(ipcBridge.database.getUserConversations.invoke).mockReset();
  });

  const conversation = (id: string): TChatConversation =>
    ({
      id,
      name: id,
      type: 'aionrs',
      created_at: 1,
      modified_at: 1,
      status: 'finished',
    }) as TChatConversation;

  it('loads user conversations through cursor pages', async () => {
    const invoke = vi.mocked(ipcBridge.database.getUserConversations.invoke);
    invoke
      .mockResolvedValueOnce({
        items: [conversation('session-1')],
        total: 2,
        has_more: true,
      })
      .mockResolvedValueOnce({
        items: [conversation('session-2')],
        total: 2,
        has_more: false,
      });

    await expect(loadAllUserConversations()).resolves.toMatchObject([{ id: 'session-1' }, { id: 'session-2' }]);
    expect(invoke).toHaveBeenNthCalledWith(1, { cursor: '0', limit: SESSION_HISTORY_PAGE_SIZE });
    expect(invoke).toHaveBeenNthCalledWith(2, { cursor: '1', limit: SESSION_HISTORY_PAGE_SIZE });
  });
});
