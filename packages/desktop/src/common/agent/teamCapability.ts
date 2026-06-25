/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Mirrors AionCore `TEAM_CAPABLE_BACKENDS` whitelist. */
const TEAM_CAPABLE_BACKENDS = new Set(['claude', 'codex', 'gemini', 'aionrs', 'codebuddy']);

export function isTeamCapableBackend(backend: string): boolean {
  return TEAM_CAPABLE_BACKENDS.has(backend.toLowerCase());
}

function hasMcpTransportCapability(handshake: unknown): boolean {
  if (!handshake || typeof handshake !== 'object') return false;
  const caps = (handshake as { agent_capabilities?: unknown }).agent_capabilities;
  if (!caps || typeof caps !== 'object') return false;
  const mcp =
    (caps as { mcp_capabilities?: unknown; mcpCapabilities?: unknown; mcp?: unknown }).mcp_capabilities ??
    (caps as { mcpCapabilities?: unknown }).mcpCapabilities ??
    (caps as { mcp?: unknown }).mcp;
  return mcp !== undefined && mcp !== null;
}

export function resolveTeamCapable(
  agent: {
    team_capable?: boolean;
    backend?: string;
    agent_type?: string;
    id?: string;
    handshake?: unknown;
    available?: boolean;
  },
  options?: { aioncoreSidecar?: boolean }
): boolean {
  if (agent.team_capable === true) return true;
  const backend = (agent.backend || agent.agent_type || agent.id || '').toLowerCase();
  if (isTeamCapableBackend(backend)) return true;
  if (hasMcpTransportCapability(agent.handshake)) return true;
  // When the AionCore sidecar is up, any available ACP/Aionrs CLI on PATH is
  // eligible in the picker — spawn validation happens server-side.
  if (options?.aioncoreSidecar && agent.available !== false) {
    const type = (agent.agent_type || '').toLowerCase();
    if (type === 'acp' || type === 'aionrs') return true;
  }
  return false;
}
