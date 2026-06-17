/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ConversationContextValue } from '@/renderer/hooks/context/ConversationContext';

/**
 * Auto-opens a preview tab when a new .pptx/.docx/.xlsx file appears in the
 * workspace during the current conversation.
 *
 * Deprecated - Preview functionality has been removed with PreviewPanel
 */
export const useAutoPreviewOfficeFiles = (
  _conversation: Pick<ConversationContextValue, 'conversation_id' | 'workspace'> | null
) => {
  // No-op - functionality removed with PreviewPanel
};
