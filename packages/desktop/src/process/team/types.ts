/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Agent row persisted in the teams.agents JSON column (aioncore-compatible shape). */
export type StoredTeamAgent = {
  slot_id: string;
  conversation_id: string;
  role: 'lead' | 'teammate';
  backend: string;
  name: string;
  model: string;
  status: string;
  icon?: string;
  cli_path?: string;
  custom_agent_id?: string;
  pending_confirmations?: number;
};

export type StoredTeamRow = {
  id: string;
  user_id: string;
  name: string;
  workspace: string;
  workspace_mode: string;
  lead_agent_id: string;
  agents: StoredTeamAgent[];
  session_mode?: string | null;
  created_at: number;
  updated_at: number;
};
