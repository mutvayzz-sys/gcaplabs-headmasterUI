/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import type { TChatConversation, TProviderWithModel } from '@/common/config/storage';
import { rememberOpenHermesConversation } from '@/common/adapter/hermesSessionAdapter';
import { getConversationTypeForBackend } from '@/common/utils/buildAgentConversationParams';
import { getTeamDatabase } from './teamDb';
import type { StoredTeamAgent } from './types';

const emptyModel = {} as TProviderWithModel;

export function persistLocalConversation(conversation: TChatConversation, userId = 'system_default_user'): void {
  rememberOpenHermesConversation(conversation.id, undefined, conversation);
  const db = getTeamDatabase();
  const now = Date.now();
  const modelValue = 'model' in conversation && conversation.model != null ? JSON.stringify(conversation.model) : null;
  db.prepare(
    `INSERT OR REPLACE INTO conversations (id, user_id, name, type, extra, model, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    conversation.id,
    userId,
    conversation.name,
    conversation.type,
    JSON.stringify(conversation.extra ?? {}),
    modelValue,
    conversation.status ?? 'pending',
    conversation.created_at ?? now,
    conversation.modified_at ?? now
  );
}

export function loadLocalConversation(id: string): TChatConversation | null {
  const db = getTeamDatabase();
  const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  let extra: Record<string, unknown> = {};
  let model: TProviderWithModel | undefined;
  try {
    extra = JSON.parse(String(row.extra ?? '{}')) as Record<string, unknown>;
  } catch {
    extra = {};
  }
  try {
    model = row.model ? (JSON.parse(String(row.model)) as TProviderWithModel) : undefined;
  } catch {
    model = undefined;
  }
  const conversation = {
    id: String(row.id),
    name: String(row.name ?? ''),
    type: String(row.type ?? 'acp'),
    created_at: Number(row.created_at ?? Date.now()),
    modified_at: Number(row.updated_at ?? Date.now()),
    status: (row.status as TChatConversation['status']) ?? 'pending',
    source: 'headmaster',
    extra,
    model: model ?? emptyModel,
  } as TChatConversation;
  rememberOpenHermesConversation(conversation.id, undefined, conversation);
  return conversation;
}

export function buildTeamAgentConversation(input: {
  agent: StoredTeamAgent;
  teamId: string;
  workspace: string;
  workspaceMode: string;
  sessionMode?: string | null;
  teamMcpStdioConfig?: Record<string, unknown>;
}): TChatConversation {
  const id = randomUUID();
  const backend = input.agent.backend;
  const type = getConversationTypeForBackend(backend);
  const now = Date.now();
  const extra: Record<string, unknown> = {
    workspace: input.workspace,
    custom_workspace: true,
    workspace_mode: input.workspaceMode,
    team_id: input.teamId,
    session_mode: input.sessionMode ?? undefined,
  };

  if (type === 'acp') {
    extra.backend = backend;
    extra.agent_name = input.agent.name;
    extra.current_model_id = input.agent.model !== 'default' ? input.agent.model : backend;
    if (input.agent.custom_agent_id) extra.custom_agent_id = input.agent.custom_agent_id;
    if (input.agent.cli_path) extra.cli_path = input.agent.cli_path;
  }

  if (input.agent.role === 'lead' && input.teamMcpStdioConfig) {
    extra.teamMcpStdioConfig = input.teamMcpStdioConfig;
  }

  return {
    id,
    name: input.agent.name,
    type,
    created_at: now,
    modified_at: now,
    status: 'pending',
    source: 'headmaster',
    extra,
  } as TChatConversation;
}

export function patchLocalConversationExtra(conversationId: string, patch: Record<string, unknown>): void {
  const existing = loadLocalConversation(conversationId);
  if (!existing) return;
  const merged = { ...(existing.extra as Record<string, unknown>), ...patch };
  const updated = { ...existing, extra: merged, modified_at: Date.now() } as TChatConversation;
  persistLocalConversation(updated);
}
