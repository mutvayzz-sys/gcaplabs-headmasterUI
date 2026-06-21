/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getBridgeEmitter } from '@/common/adapter/registry';
import type {
  ITeamAgentRemovedEvent,
  ITeamAgentRenamedEvent,
  ITeamAgentSpawnedEvent,
  ITeamAgentStatusEvent,
  ITeamCreatedEvent,
  ITeamListChangedEvent,
  ITeamTeammateMessageEvent,
} from '@/common/types/team/teamTypes';

function emitTeamEvent(eventName: string, payload: unknown): void {
  try {
    getBridgeEmitter()?.emit(eventName, payload);
  } catch (error) {
    console.warn('[TeamEvents] Failed to emit', eventName, error);
  }
}

export function emitTeamListChanged(event: ITeamListChangedEvent): void {
  emitTeamEvent('team.listChanged', event);
}

export function emitTeamCreated(event: ITeamCreatedEvent): void {
  emitTeamEvent('team.created', event);
}

export function emitTeamAgentSpawned(event: ITeamAgentSpawnedEvent): void {
  emitTeamEvent('team.agentSpawned', event);
}

export function emitTeamAgentRemoved(event: ITeamAgentRemovedEvent): void {
  emitTeamEvent('team.agentRemoved', event);
}

export function emitTeamAgentRenamed(event: ITeamAgentRenamedEvent): void {
  emitTeamEvent('team.agentRenamed', event);
}

export function emitTeamAgentStatus(event: ITeamAgentStatusEvent): void {
  emitTeamEvent('team.agentStatusChanged', event);
}

export function emitTeamTeammateMessage(event: ITeamTeammateMessageEvent): void {
  emitTeamEvent('team.teammateMessage', event);
}
