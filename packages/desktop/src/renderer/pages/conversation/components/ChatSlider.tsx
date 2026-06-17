/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { Message } from '@arco-design/web-react';
import React from 'react';
import ChatWorkspace from '../Workspace';

const ChatSlider: React.FC<{
  conversation?: TChatConversation;
}> = ({ conversation }) => {
  const [messageApi, messageContext] = Message.useMessage({ maxCount: 1 });

  const workspace = conversation?.extra?.workspace;
  const conversationType = conversation?.type ?? 'acp';
  const isTempWorkspace = (conversation?.extra as { is_temporary_workspace?: boolean } | undefined)
    ?.is_temporary_workspace;

  let workspaceNode: React.ReactNode = null;
  if (workspace && conversationType) {
    workspaceNode = (
      <ChatWorkspace
        conversation_id={conversation!.id}
        workspace={workspace}
        isTemporaryWorkspace={isTempWorkspace}
        eventPrefix={conversationType}
        messageApi={messageApi}
      />
    );
  }

  if (!workspaceNode) {
    return <div></div>;
  }

  return (
    <>
      {messageContext}
      {workspaceNode}
    </>
  );
};

export default ChatSlider;
