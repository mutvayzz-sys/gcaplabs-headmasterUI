/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHermesChatConversation } from '@/common/adapter/hermesChatAdapter';
import { buildAgentConversationParams, getConversationTypeForBackend } from '@/common/utils/buildAgentConversationParams';
import type { TProviderWithModel } from '@/common/config/storage';
import { teamRepository } from './TeamRepository';
import {
  buildTeamAgentConversation,
  loadLocalConversation,
  patchLocalConversationExtra,
  persistLocalConversation,
} from './ConversationStore';
import { TeamMcpServer, findAgentByName, normalizeSpawnBackend, type TeamMcpHandlers } from './TeamMcpServer';
import type { StoredTeamAgent, StoredTeamRow } from './types';
import {
  emitTeamAgentRemoved,
  emitTeamAgentSpawned,
  emitTeamAgentStatus,
} from './teamEvents';
import { httpRequest } from '@/common/adapter/httpBridge';

const emptyModel = {} as TProviderWithModel;
const activeSessions = new Map<string, TeamSession>();

class TeamSession {
  readonly teamId: string;
  readonly mcp: TeamMcpServer;
  private ensurePromise: Promise<void> | null = null;

  constructor(teamId: string, handlers: TeamMcpHandlers) {
    this.teamId = teamId;
    this.mcp = new TeamMcpServer(teamId, handlers);
  }

  ensure(): Promise<void> {
    if (!this.ensurePromise) {
      this.ensurePromise = this.runEnsure().finally(() => {
        this.ensurePromise = null;
      });
    }
    return this.ensurePromise;
  }

  private async runEnsure(): Promise<void> {
    const stored = teamRepository.getStoredById(this.teamId);
    if (!stored) throw new Error('Team not found');

    await this.mcp.start();
    const stdioConfig = this.mcp.getStdioConfig();

    let agents = [...stored.agents];
    let changed = false;

    for (const agent of agents) {
      if (agent.conversation_id) continue;
      const conversation = await this.createConversationForAgent(stored, agent, agent.role === 'lead' ? stdioConfig : undefined);
      agent.conversation_id = conversation.id;
      agent.status = 'idle';
      changed = true;
      emitTeamAgentStatus({
        team_id: this.teamId,
        slot_id: agent.slot_id,
        status: 'idle',
      });
    }

    const leader = agents.find((a) => a.role === 'lead' && a.conversation_id);
    if (leader?.conversation_id) {
      patchLocalConversationExtra(leader.conversation_id, { teamMcpStdioConfig: stdioConfig });
    }

    if (changed) {
      teamRepository.updateAgents(this.teamId, agents);
    }
  }

  private async createConversationForAgent(
    team: StoredTeamRow,
    agent: StoredTeamAgent,
    stdioConfig?: ReturnType<TeamMcpServer['getStdioConfig']>
  ) {
    const type = getConversationTypeForBackend(agent.backend);
    if (type === 'aionrs') {
      const params = buildAgentConversationParams({
        backend: agent.backend,
        name: agent.name,
        agent_name: agent.name,
        workspace: team.workspace,
        model: emptyModel,
        session_mode: team.session_mode ?? undefined,
        custom_agent_id: agent.custom_agent_id,
      });
      return createHermesChatConversation(params);
    }

    const conversation = buildTeamAgentConversation({
      agent,
      teamId: team.id,
      workspace: team.workspace,
      workspaceMode: team.workspace_mode,
      sessionMode: team.session_mode,
      teamMcpStdioConfig: stdioConfig,
    });
    persistLocalConversation(conversation);
    return conversation;
  }

  async stop(): Promise<void> {
    await this.mcp.stop();
  }
}

async function describeAssistantText(customAgentId: string, locale: string, leaderBackend: string): Promise<string> {
  let name = customAgentId;
  let description = '';
  let skills: string[] = [];

  if (customAgentId.startsWith('builtin-')) {
    name = customAgentId.replace(/^builtin-/, '').replace(/-/g, ' ');
    description = `Built-in preset assistant for ${name}`;
    skills = ['document creation', 'structured output', 'workspace tasks'];
  } else {
    try {
      const profile = await httpRequest<Record<string, unknown>>(
        'GET',
        `/api/profiles/${encodeURIComponent(customAgentId)}`,
        undefined,
        { silentStatuses: [404] }
      );
      if (profile) {
        name = String(profile.display_name ?? profile.name ?? customAgentId);
        description = String(profile.description ?? profile.summary ?? '');
      }
    } catch {
      // fall through
    }
  }

  if (!description) {
    throw new Error(`Assistant "${customAgentId}" not found`);
  }

  return [
    `# ${name}`,
    `Backend: ${leaderBackend}`,
    '',
    '## Description',
    description,
    '',
    '## Skills',
    ...(skills.length ? skills.map((s) => `- ${s}`) : ['- general assistance']),
    '',
    '## Example tasks',
    '- Draft documents',
    '- Research and summarize',
    '',
    `To add this assistant to the team, call team_spawn_agent with custom_agent_id="${customAgentId}" and a unique name.`,
    `(locale=${locale})`,
  ].join('\n');
}

function getSession(teamId: string): TeamSession {
  let session = activeSessions.get(teamId);
  if (!session) {
    const handlers: TeamMcpHandlers = {
      describeAssistant: async (args, _fromSlotId) => {
        const stored = teamRepository.getStoredById(teamId);
        const leader = stored?.agents.find((a) => a.role === 'lead');
        const backend = leader?.backend ?? 'gemini';
        return describeAssistantText(args.custom_agent_id, args.locale ?? 'en-US', backend);
      },
      spawnAgent: async (args, _fromSlotId) => {
        const stored = teamRepository.getStoredById(teamId);
        if (!stored) throw new Error('Team not found');
        const backend = normalizeSpawnBackend(args.backend ?? (args.custom_agent_id ? 'gemini' : 'claude'));
        const model = args.model ?? backend;
        const agent = teamRepository.addAgent({
          team_id: teamId,
          agent: {
            role: 'teammate',
            agent_type: backend,
            agent_name: args.name,
            conversation_type: 'acp',
            status: 'pending',
            model,
            custom_agent_id: args.custom_agent_id,
          },
        });

        const session = getSession(teamId);
        await session.ensure();

        const refreshed = teamRepository.getById(teamId);
        const spawned = refreshed?.agents.find((a) => a.slot_id === agent.slot_id);
        if (spawned) {
          emitTeamAgentSpawned({ team_id: teamId, agent: spawned });
        }
        return `Spawned teammate ${args.name}`;
      },
      fireAgent: async (args, _fromSlotId) => {
        const stored = teamRepository.getStoredById(teamId);
        if (!stored) throw new Error('Team not found');
        const target =
          (args.slot_id ? stored.agents.find((a) => a.slot_id === args.slot_id) : undefined) ??
          (args.name ? findAgentByName(stored.agents, args.name) : undefined);
        if (!target) throw new Error(`Member "${args.name ?? args.slot_id ?? ''}" not found`);
        if (target.role === 'lead') throw new Error('Cannot remove the team leader');
        teamRepository.removeAgent(teamId, target.slot_id);
        emitTeamAgentRemoved({ team_id: teamId, slot_id: target.slot_id });
        return `Removed teammate ${target.name}`;
      },
    };
    session = new TeamSession(teamId, handlers);
    activeSessions.set(teamId, session);
  }
  return session;
}

export async function ensureTeamSession(teamId: string): Promise<void> {
  await getSession(teamId).ensure();
}

export async function stopTeamSession(teamId: string): Promise<void> {
  const session = activeSessions.get(teamId);
  if (!session) return;
  await session.stop();
  activeSessions.delete(teamId);
}

export async function disposeAllTeamSessions(): Promise<void> {
  const ids = [...activeSessions.keys()];
  await Promise.all(ids.map((id) => stopTeamSession(id)));
}

export function getTeamMcpPort(teamId: string): number {
  return activeSessions.get(teamId)?.mcp.getPort() ?? 0;
}

export function getLocalTeamConversation(conversationId: string) {
  return loadLocalConversation(conversationId);
}
