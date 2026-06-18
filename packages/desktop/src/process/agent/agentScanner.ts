/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';

/**
 * Catalog of known CLI agents to probe for on $PATH.
 * Each entry maps a binary name to display metadata.
 */
const KNOWN_AGENTS = [
  { id: 'claude', name: 'Claude Code', command: 'claude', backend: 'claude' },
  { id: 'codex', name: 'OpenAI Codex', command: 'codex', backend: 'codex' },
  { id: 'grok', name: 'Grok CLI', command: 'grok', backend: 'grok' },
  { id: 'hermes', name: 'Hermes Agent', command: 'hermes', backend: 'hermes' },
] as const;

export type ScannedAgent = {
  id: string;
  name: string;
  backend: string;
  agent_type: 'acp';
  agent_source: 'builtin';
  enabled: boolean;
  available: boolean;
  command: string;
};

/**
 * Scan $PATH for known CLI agent binaries.
 * Returns an array of agent metadata for each found binary.
 * Gracefully skips binaries that aren't installed.
 */
export function scanForAgents(): ScannedAgent[] {
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'where' : 'which';

  const found: ScannedAgent[] = [];
  for (const agent of KNOWN_AGENTS) {
    try {
      const result = execSync(`${cmd} ${agent.command}`, {
        encoding: 'utf-8',
        timeout: 3000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();

      if (result) {
        found.push({
          id: agent.id,
          name: agent.name,
          backend: agent.backend,
          agent_type: 'acp',
          agent_source: 'builtin',
          enabled: true,
          available: true,
          command: agent.command,
        });
      }
    } catch {
      // Binary not found — skip silently
    }
  }
  return found;
}