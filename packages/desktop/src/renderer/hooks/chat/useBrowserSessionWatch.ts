/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { useCallback, useEffect } from 'react';
import { useBrowserPanelContext } from '@/renderer/pages/conversation/BrowserPanel';
import { useConversationRuntimeView } from '@/renderer/pages/conversation/runtime/useConversationRuntimeView';

/** noVNC URL served by Camofox when ENABLE_VNC=1 */
const CAMOFOX_VNC_URL = 'http://localhost:6080';

/** Delay before hiding the panel after the agent finishes, so the user can see the final state */
const CLOSE_DELAY_MS = 2500;

function isBrowserToolName(name: string): boolean {
  return name.startsWith('browser_');
}

type RawToolItem = { name?: unknown };
type RawMessage = { type: string; content: unknown };

function hasBrowserToolInMessages(messages: RawMessage[]): boolean {
  return messages.some((msg) => {
    if (msg.type === 'tool_group') {
      const items = msg.content;
      if (!Array.isArray(items)) return false;
      return (items as RawToolItem[]).some((tool) => typeof tool.name === 'string' && isBrowserToolName(tool.name));
    }
    if (msg.type === 'tool_call') {
      const content = msg.content as { name?: unknown } | null | undefined;
      return typeof content?.name === 'string' && isBrowserToolName(content.name);
    }
    if (msg.type === 'acp_tool_call') {
      const content = msg.content as { update?: { title?: unknown } } | null | undefined;
      const title = content?.update?.title;
      return typeof title === 'string' && isBrowserToolName(title);
    }
    return false;
  });
}

/**
 * Watches the active conversation for browser tool usage and auto-opens/closes
 * the BrowserPanel showing the Camofox noVNC live view.
 */
export function useBrowserSessionWatch(conversationId: string | undefined): void {
  const { isOpen, openBrowserPanel, closeBrowserPanel } = useBrowserPanelContext();
  const { isProcessing } = useConversationRuntimeView(conversationId ?? '');

  const checkForBrowserActivity = useCallback(async (): Promise<boolean> => {
    if (!conversationId) return false;
    try {
      const result = await ipcBridge.database.getConversationMessages.invoke({
        conversation_id: conversationId,
        page: 0,
        page_size: 30,
        content_mode: 'compact',
      });
      const items = (result?.items ?? []) as RawMessage[];
      return hasBrowserToolInMessages(items);
    } catch {
      return false;
    }
  }, [conversationId]);

  // While processing: check for browser tools on every message update
  useEffect(() => {
    if (!isProcessing || !conversationId) return;

    void checkForBrowserActivity().then((found) => {
      if (found) openBrowserPanel(CAMOFOX_VNC_URL);
    });

    const unsub = ipcBridge.conversation.listChanged.on((event) => {
      if (event.conversation_id !== conversationId) return;
      void checkForBrowserActivity().then((found) => {
        if (found) openBrowserPanel(CAMOFOX_VNC_URL);
      });
    });

    return unsub;
  }, [isProcessing, conversationId, checkForBrowserActivity, openBrowserPanel]);

  // When processing stops, close the panel after a short delay
  useEffect(() => {
    if (isProcessing || !isOpen) return;
    const timer = setTimeout(closeBrowserPanel, CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isProcessing, isOpen, closeBrowserPanel]);
}
