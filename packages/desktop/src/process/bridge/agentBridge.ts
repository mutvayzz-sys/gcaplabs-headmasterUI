/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { scanForAgents } from '@process/agent/agentScanner';

/**
 * Register IPC handlers for agent scanning.
 * The renderer calls `acpConversation.getAvailableAgents.invoke()` which
 * is served by the provider registered here.
 */
export function initAgentBridge(): void {
  ipcBridge.acpConversation.scanAgents.provider(async () => {
    return scanForAgents();
  });
}
