/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

const FORBIDDEN_NAME_PATTERN = /\baion\s*cli\b|\baionui\b|\baionrs\b|\bhermes\b|\bcowork\b/i;

const BACKEND_DISPLAY_NAMES: Record<string, string> = {
  aionrs: 'Headmaster',
  hermes: 'Headmaster',
  headmaster: 'Headmaster',
};

const NAME_OVERRIDES: Record<string, string> = {
  'aion cli': 'Headmaster',
  'aion cli (aionrs)': 'Headmaster',
  'hermes agent': 'Headmaster',
  hermes: 'Headmaster',
  'cli agent': 'Headmaster',
  'headmaster runtime': 'Headmaster',
};

export function sanitizeAgentDisplayName(agent: {
  name?: string;
  backend?: string;
  agent_type?: string;
  id?: string;
}): string {
  const backend = (agent.backend || agent.agent_type || agent.id || '').toLowerCase();
  if (BACKEND_DISPLAY_NAMES[backend]) {
    return BACKEND_DISPLAY_NAMES[backend];
  }

  const rawName = (agent.name || '').trim();
  const normalized = rawName.toLowerCase();
  if (NAME_OVERRIDES[normalized]) {
    return NAME_OVERRIDES[normalized];
  }
  if (FORBIDDEN_NAME_PATTERN.test(rawName)) {
    return BACKEND_DISPLAY_NAMES[backend] ?? 'Headmaster';
  }
  return rawName || backend || 'Agent';
}

export function sanitizeAgentMetadata<T extends { name?: string; backend?: string; agent_type?: string; id?: string }>(
  agent: T
): T {
  return {
    ...agent,
    name: sanitizeAgentDisplayName(agent),
  };
}

const COUNCIL_MCP_SERVER_ALIASES: Record<string, string> = {
  'aionui-team': 'Council',
  aionui_team: 'Council',
};

const COUNCIL_TOOL_LABELS: Record<string, string> = {
  team_members: 'list members',
  team_spawn_agent: 'spawn specialist',
  team_list_models: 'list models',
  team_send_message: 'send message',
  team_task_create: 'create task',
  team_task_update: 'update task',
  team_task_list: 'list tasks',
  team_rename_agent: 'rename specialist',
  team_shutdown_agent: 'shutdown specialist',
  team_describe_assistant: 'describe assistant',
};

function humanizeToolSegment(segment: string): string {
  const key = segment.trim().toLowerCase();
  if (COUNCIL_TOOL_LABELS[key]) return COUNCIL_TOOL_LABELS[key];
  if (key.startsWith('team_')) return key.slice(5).replace(/_/g, ' ');
  return key.replace(/_/g, ' ');
}

/** Rewrite upstream MCP tool identifiers for user-visible UI (chat tool chips, confirmations). */
export function sanitizeToolDisplayName(raw: string | undefined | null): string {
  if (!raw) return '';
  let name = raw.trim();
  if (!name) return '';

  if (name.startsWith('mcp__')) {
    const body = name.slice(5);
    const splitAt = body.indexOf('__');
    if (splitAt > 0) {
      const server = body.slice(0, splitAt);
      const tool = body.slice(splitAt + 2);
      const serverLabel = COUNCIL_MCP_SERVER_ALIASES[server.toLowerCase()] ?? server.replace(/aionui/gi, 'Council');
      return `${serverLabel}: ${humanizeToolSegment(tool)}`;
    }
  }

  if (name.toLowerCase().startsWith('team_')) {
    return `Council: ${humanizeToolSegment(name)}`;
  }

  return name.replace(/\baionui\b/gi, 'Council').replace(/\bhermes\b/gi, 'Headmaster');
}

export function sanitizeMcpServerDisplayName(raw: string | undefined | null): string {
  if (!raw) return '';
  const key = raw.trim().toLowerCase();
  return COUNCIL_MCP_SERVER_ALIASES[key] ?? raw.replace(/aionui/gi, 'Council');
}
