/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { IAddTeamAgentParams, ICreateTeamParams } from '@/common/adapter/teamMapper';
import { fromBackendTeam, toBackendAgent } from '@/common/adapter/teamMapper';
import type { TeamAgent, TTeam } from '@/common/types/team/teamTypes';
import { getTeamDatabase } from './teamDb';
import type { StoredTeamAgent, StoredTeamRow } from './types';

function parseAgents(raw: string): StoredTeamAgent[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredTeamAgent[]) : [];
  } catch {
    return [];
  }
}

function rowToStored(row: Record<string, unknown>): StoredTeamRow {
  return {
    id: String(row.id ?? ''),
    user_id: String(row.user_id ?? ''),
    name: String(row.name ?? ''),
    workspace: String(row.workspace ?? ''),
    workspace_mode: String(row.workspace_mode ?? 'shared'),
    lead_agent_id: String(row.lead_agent_id ?? ''),
    agents: parseAgents(String(row.agents ?? '[]')),
    session_mode: row.session_mode == null ? null : String(row.session_mode),
    created_at: Number(row.created_at ?? 0),
    updated_at: Number(row.updated_at ?? 0),
  };
}

function toBackendRecord(team: StoredTeamRow): Record<string, unknown> {
  return {
    id: team.id,
    user_id: team.user_id,
    name: team.name,
    workspace: team.workspace,
    workspace_mode: team.workspace_mode,
    leader_agent_id: team.lead_agent_id,
    session_mode: team.session_mode ?? undefined,
    agents: team.agents,
    created_at: team.created_at,
    updated_at: team.updated_at,
  };
}

function assignSlotIds(agents: Omit<TeamAgent, 'slot_id' | 'conversation_id'>[]): StoredTeamAgent[] {
  return agents.map((agent) => {
    const backend = toBackendAgent(agent);
    return {
      slot_id: randomUUID(),
      conversation_id: '',
      role: backend.role as 'lead' | 'teammate',
      backend: String(backend.backend ?? agent.agent_type ?? 'acp'),
      name: String(backend.name ?? agent.agent_name ?? 'Agent'),
      model: String(backend.model ?? 'default'),
      status: 'pending',
      icon: agent.icon,
      cli_path: agent.cli_path,
      custom_agent_id: agent.custom_agent_id,
      pending_confirmations: 0,
    };
  });
}

export class TeamRepository {
  listByUser(userId: string): TTeam[] {
    const db = getTeamDatabase();
    const rows = db.prepare('SELECT * FROM teams WHERE user_id = ? ORDER BY updated_at DESC').all(userId) as Record<
      string,
      unknown
    >[];
    return rows.map((row) => fromBackendTeam(toBackendRecord(rowToStored(row))));
  }

  getById(id: string): TTeam | null {
    const db = getTeamDatabase();
    const row = db.prepare('SELECT * FROM teams WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return fromBackendTeam(toBackendRecord(rowToStored(row)));
  }

  getStoredById(id: string): StoredTeamRow | null {
    const db = getTeamDatabase();
    const row = db.prepare('SELECT * FROM teams WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToStored(row) : null;
  }

  create(params: ICreateTeamParams): TTeam {
    if (!params.name?.trim()) {
      throw new Error('Team name is required');
    }
    if (!params.workspace?.trim()) {
      throw new Error('Workspace path is required');
    }
    if (!existsSync(params.workspace)) {
      throw new Error(
        `Workspace path is unavailable: ${params.workspace}. Make sure the selected workspace path exists and is accessible.`
      );
    }
    const leader = params.agents.find((a) => a.role === 'leader');
    if (!leader) {
      throw new Error('A team leader is required');
    }

    const id = randomUUID();
    const now = Date.now();
    const agents = assignSlotIds(params.agents);
    const leaderSlot = agents.find((a) => a.role === 'lead');
    const leadAgentId = leaderSlot?.slot_id ?? '';

    const db = getTeamDatabase();
    db.prepare(
      `INSERT INTO teams (id, user_id, name, workspace, workspace_mode, lead_agent_id, agents, session_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    ).run(
      id,
      params.user_id,
      params.name.trim(),
      params.workspace,
      params.workspace_mode,
      leadAgentId,
      JSON.stringify(agents),
      now,
      now
    );

    const created = this.getById(id);
    if (!created) throw new Error('Failed to create team');
    return created;
  }

  remove(id: string): void {
    getTeamDatabase().prepare('DELETE FROM teams WHERE id = ?').run(id);
  }

  updateAgents(id: string, agents: StoredTeamAgent[], updatedAt = Date.now()): TTeam | null {
    getTeamDatabase()
      .prepare('UPDATE teams SET agents = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(agents), updatedAt, id);
    return this.getById(id);
  }

  updateName(id: string, name: string): void {
    getTeamDatabase().prepare('UPDATE teams SET name = ?, updated_at = ? WHERE id = ?').run(name, Date.now(), id);
  }

  updateSessionMode(id: string, sessionMode: string): void {
    getTeamDatabase()
      .prepare('UPDATE teams SET session_mode = ?, updated_at = ? WHERE id = ?')
      .run(sessionMode, Date.now(), id);
  }

  addAgent(params: IAddTeamAgentParams): TeamAgent {
    const stored = this.getStoredById(params.team_id);
    if (!stored) throw new Error('Team not found');

    const [agent] = assignSlotIds([params.agent]);
    if (!agent) throw new Error('Failed to add agent');

    const agents = [...stored.agents, agent];
    const updated = this.updateAgents(params.team_id, agents);
    if (!updated) throw new Error('Failed to update team');
    const created = updated.agents.find((a) => a.slot_id === agent.slot_id);
    if (!created) throw new Error('Failed to resolve added agent');
    return created;
  }

  removeAgent(teamId: string, slotId: string): void {
    const stored = this.getStoredById(teamId);
    if (!stored) throw new Error('Team not found');
    const agents = stored.agents.filter((a) => a.slot_id !== slotId);
    this.updateAgents(teamId, agents);
  }

  renameAgent(teamId: string, slotId: string, newName: string): void {
    const stored = this.getStoredById(teamId);
    if (!stored) throw new Error('Team not found');
    const agents = stored.agents.map((a) => (a.slot_id === slotId ? { ...a, name: newName } : a));
    this.updateAgents(teamId, agents);
  }
}

export const teamRepository = new TeamRepository();
