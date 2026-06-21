/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { bridge } from '@office-ai/platform';
import type { TeamAgent, TTeam } from '@/common/types/team/teamTypes';
import { getHermesConversation } from '@/common/adapter/hermesSessionAdapter';
import { aioncoreHttpRequest, isAioncoreAvailable } from '@/common/adapter/aioncoreBridge';
import { isMissingHermesRoute } from '@/common/adapter/hermesRouteFallback';
import { httpPost } from '@/common/adapter/httpBridge';
import type { TChatConversation } from '@/common/config/storage';
import type { IAddTeamAgentParams, ICreateTeamParams } from '@/common/adapter/teamMapper';
import { getConversationTypeForBackend } from '@/common/utils/buildAgentConversationParams';
import { loadLocalConversation } from '@process/team/ConversationStore';
import { teamService } from '@process/team/TeamService';

/**
 * Minimal ACP warmup — marks local team conversations ready for UI routing.
 */
export async function warmupTeamConversation(conversationId: string): Promise<void> {
  const conversation = loadLocalConversation(conversationId);
  if (!conversation) return;
  const backend = String((conversation.extra as { backend?: string }).backend ?? '');
  if (getConversationTypeForBackend(backend) !== 'acp') return;
}

export function initTeamBridge(): void {
  bridge.buildProvider<TTeam[], { user_id: string }>('team.list').provider(async (params) =>
    teamService.list(params.user_id)
  );

  bridge.buildProvider<TTeam, { id: string }>('team.get').provider(async (params) => teamService.get(params.id));

  bridge.buildProvider<TTeam, ICreateTeamParams>('team.create').provider(async (params) => teamService.create(params));

  bridge.buildProvider<void, { id: string }>('team.remove').provider(async (params) => {
    await teamService.remove(params.id);
  });

  bridge.buildProvider<TeamAgent, IAddTeamAgentParams>('team.addAgent').provider(async (params) =>
    teamService.addAgent(params)
  );

  bridge.buildProvider<void, { team_id: string; slot_id: string }>('team.removeAgent').provider(async (params) => {
    await teamService.removeAgent(params.team_id, params.slot_id);
  });

  bridge.buildProvider<void, { team_id: string }>('team.ensureSession').provider(async (params) => {
    await teamService.ensureSession(params.team_id);
  });

  bridge.buildProvider<void, { team_id: string }>('team.stop').provider(async (params) => {
    await teamService.stopSession(params.team_id);
  });

  bridge.buildProvider<void, { team_id: string; slot_id: string; new_name: string }>('team.renameAgent').provider(
    async (params) => {
      teamService.renameAgent(params.team_id, params.slot_id, params.new_name);
    }
  );

  bridge.buildProvider<void, { id: string; name: string }>('team.renameTeam').provider(async (params) => {
    teamService.renameTeam(params.id, params.name);
  });

  bridge.buildProvider<void, { team_id: string; session_mode: string }>('team.setSessionMode').provider(async (params) => {
    teamService.setSessionMode(params.team_id, params.session_mode);
  });

  bridge.buildProvider<TChatConversation | null, { id: string }>('conversation.get').provider(async (params) => {
    if (isAioncoreAvailable()) {
      try {
        const raw = await aioncoreHttpRequest<Record<string, unknown>>(
          'GET',
          `/api/conversations/${encodeURIComponent(params.id)}`,
          undefined,
          { silentStatuses: [404] }
        );
        if (raw && typeof raw === 'object') {
          return raw as unknown as TChatConversation;
        }
      } catch {
        // fall through to native / Hermes lookup
      }
    }
    const local = loadLocalConversation(params.id);
    if (local) return local;
    return getHermesConversation(params.id);
  });

  bridge.buildProvider<void, { conversation_id: string }>('conversation.warmup').provider(async (params) => {
    if (isAioncoreAvailable()) {
      try {
        await aioncoreHttpRequest('POST', `/api/conversations/${encodeURIComponent(params.conversation_id)}/warmup`);
        return;
      } catch {
        // fall through
      }
    }
    const local = loadLocalConversation(params.conversation_id);
    if (local) {
      await warmupTeamConversation(params.conversation_id);
      return;
    }
    try {
      await httpPost<void, { conversation_id: string }>(
        (p) => `/api/conversations/${p.conversation_id}/warmup`
      ).invoke(params);
    } catch (error) {
      if (!isMissingHermesRoute(error)) throw error;
    }
  });
}
