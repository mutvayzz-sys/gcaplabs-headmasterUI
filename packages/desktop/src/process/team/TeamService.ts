/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IAddTeamAgentParams, ICreateTeamParams } from '@/common/adapter/teamMapper';
import type { TeamAgent, TTeam } from '@/common/types/team/teamTypes';
import { teamRepository } from './TeamRepository';
import { ensureTeamSession, stopTeamSession } from './TeamSessionManager';
import {
  emitTeamAgentRenamed,
  emitTeamCreated,
  emitTeamListChanged,
} from './teamEvents';

export class TeamService {
  list(userId: string): TTeam[] {
    return teamRepository.listByUser(userId);
  }

  get(id: string): TTeam | null {
    return teamRepository.getById(id);
  }

  async create(params: ICreateTeamParams): Promise<TTeam> {
    const team = teamRepository.create(params);
    emitTeamCreated({ team_id: team.id, team_name: team.name });
    emitTeamListChanged({ team_id: team.id, action: 'created' });
    return team;
  }

  async remove(id: string): Promise<void> {
    await stopTeamSession(id);
    teamRepository.remove(id);
    emitTeamListChanged({ team_id: id, action: 'removed' });
  }

  async addAgent(params: IAddTeamAgentParams): Promise<TeamAgent> {
    const agent = teamRepository.addAgent(params);
    emitTeamListChanged({ team_id: params.team_id, action: 'agent_added' });
    return agent;
  }

  async removeAgent(teamId: string, slotId: string): Promise<void> {
    teamRepository.removeAgent(teamId, slotId);
    emitTeamListChanged({ team_id: teamId, action: 'agent_removed' });
  }

  renameAgent(teamId: string, slotId: string, newName: string): void {
    const before = teamRepository.getById(teamId);
    const existing = before?.agents.find((a) => a.slot_id === slotId);
    teamRepository.renameAgent(teamId, slotId, newName);
    if (existing) {
      emitTeamAgentRenamed({
        team_id: teamId,
        slot_id: slotId,
        old_name: existing.agent_name,
        new_name: newName,
      });
    }
  }

  renameTeam(id: string, name: string): void {
    teamRepository.updateName(id, name);
    emitTeamListChanged({ team_id: id, action: 'created' });
  }

  setSessionMode(teamId: string, sessionMode: string): void {
    teamRepository.updateSessionMode(teamId, sessionMode);
  }

  async ensureSession(teamId: string): Promise<void> {
    await ensureTeamSession(teamId);
  }

  async stopSession(teamId: string): Promise<void> {
    await stopTeamSession(teamId);
  }
}

export const teamService = new TeamService();
