/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { TMessage } from '@/common/chat/chatLib';
import type { TChatConversation } from '@/common/config/storage';
import type { PaginatedResult } from '@/common/adapter/ipcBridge';

export const SESSION_HISTORY_PAGE_SIZE = 100;
export const MESSAGE_HISTORY_PAGE_SIZE = 200;

const MAX_PAGED_FETCH_ITERATIONS = 500;

export async function collectCursorPaginatedItems<T>(
  fetchPage: (params: { cursor: string; limit: number }) => Promise<PaginatedResult<T>>,
  pageSize = SESSION_HISTORY_PAGE_SIZE
): Promise<T[]> {
  const items: T[] = [];
  let cursor = '0';

  for (let guard = 0; guard < MAX_PAGED_FETCH_ITERATIONS; guard += 1) {
    const result = await fetchPage({ cursor, limit: pageSize });
    const pageItems = Array.isArray(result?.items) ? result.items : [];
    items.push(...pageItems);

    if (!result?.has_more || pageItems.length === 0 || items.length >= result.total) {
      break;
    }

    cursor = String((Number.parseInt(cursor, 10) || 0) + pageItems.length);
  }

  return items;
}

export async function collectPagePaginatedItems<T>(
  fetchPage: (params: { page: number; page_size: number }) => Promise<PaginatedResult<T>>,
  pageSize = MESSAGE_HISTORY_PAGE_SIZE
): Promise<T[]> {
  const items: T[] = [];

  for (let page = 0; page < MAX_PAGED_FETCH_ITERATIONS; page += 1) {
    const result = await fetchPage({ page, page_size: pageSize });
    const pageItems = Array.isArray(result?.items) ? result.items : [];
    items.push(...pageItems);

    if (!result?.has_more || pageItems.length === 0 || items.length >= result.total) {
      break;
    }
  }

  return items;
}

export async function loadAllUserConversations(pageSize = SESSION_HISTORY_PAGE_SIZE): Promise<TChatConversation[]> {
  return collectCursorPaginatedItems(
    (params) =>
      ipcBridge.database.getUserConversations.invoke({
        cursor: params.cursor,
        limit: params.limit,
      }),
    pageSize
  );
}

export async function loadAllConversationMessages(params: {
  conversation_id: string;
  pageSize?: number;
  content_mode?: 'compact' | 'full';
  order?: string;
}): Promise<TMessage[]> {
  const { conversation_id, pageSize = MESSAGE_HISTORY_PAGE_SIZE, content_mode, order } = params;
  return collectPagePaginatedItems(
    (pageParams) =>
      ipcBridge.database.getConversationMessages.invoke({
        conversation_id,
        page: pageParams.page,
        page_size: pageParams.page_size,
        ...(content_mode ? { content_mode } : {}),
        ...(order ? { order } : {}),
      }),
    pageSize
  );
}
