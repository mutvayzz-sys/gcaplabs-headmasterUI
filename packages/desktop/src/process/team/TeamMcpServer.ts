/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServer, type Server, type Socket } from 'node:net';
import { randomBytes } from 'node:crypto';
import { teamRepository } from './TeamRepository';
import type { StoredTeamAgent } from './types';
import { resolveTeamMcpStdioScriptPath } from './teamMcpPaths';

const TEAM_SUPPORTED_BACKENDS = new Set(['claude', 'codex', 'gemini']);

type McpRequest = {
  tool?: string;
  args?: Record<string, unknown>;
  auth_token?: string;
  from_slot_id?: string;
};

type McpReply = { result?: string; error?: string };

export type TeamMcpHandlers = {
  describeAssistant: (args: { custom_agent_id: string; locale?: string }, fromSlotId?: string) => Promise<string>;
  spawnAgent: (
    args: { name: string; backend?: string; model?: string; custom_agent_id?: string },
    fromSlotId?: string
  ) => Promise<string>;
  fireAgent: (args: { name?: string; slot_id?: string }, fromSlotId?: string) => Promise<string>;
};

function readFrame(socket: Socket): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off('error', onError);
      socket.off('data', onData);
    };

    let buffer = Buffer.alloc(0);

    const onData = (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4) return;
      const length = buffer.readUInt32BE(0);
      if (buffer.length < 4 + length) return;
      cleanup();
      resolve(buffer.subarray(4, 4 + length));
    };

    socket.on('error', onError);
    socket.on('data', onData);
  });
}

function writeFrame(socket: Socket, payload: McpReply): void {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const frame = Buffer.allocUnsafe(4 + body.length);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, 4);
  socket.write(frame);
}

export class TeamMcpServer {
  readonly teamId: string;
  readonly authToken: string;
  private server: Server | null = null;
  private port = 0;
  private handlers: TeamMcpHandlers;

  constructor(teamId: string, handlers: TeamMcpHandlers, authToken = randomBytes(24).toString('hex')) {
    this.teamId = teamId;
    this.authToken = authToken;
    this.handlers = handlers;
  }

  getPort(): number {
    return this.port;
  }

  getStdioConfig(): { command: string; args: string[]; env: Array<{ name: string; value: string }> } {
    return {
      command: process.execPath,
      args: [resolveTeamMcpStdioScriptPath()],
      env: [
        { name: 'TEAM_MCP_PORT', value: String(this.port) },
        { name: 'TEAM_MCP_TOKEN', value: this.authToken },
        { name: 'TEAM_ID', value: this.teamId },
      ],
    };
  }

  async start(): Promise<number> {
    if (this.server && this.port > 0) return this.port;

    await new Promise<void>((resolve, reject) => {
      const server = createServer((socket) => {
        void this.handleClient(socket);
      });
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (!address || typeof address === 'string') {
          reject(new Error('Failed to resolve Team MCP port'));
          return;
        }
        this.port = address.port;
        this.server = server;
        resolve();
      });
    });

    return this.port;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
    });
    this.server = null;
    this.port = 0;
  }

  private async handleClient(socket: Socket): Promise<void> {
    try {
      const frame = await readFrame(socket);
      if (!frame) return;
      const request = JSON.parse(frame.toString('utf8')) as McpRequest;
      const reply = await this.dispatch(request);
      writeFrame(socket, reply);
    } catch (error) {
      writeFrame(socket, { error: error instanceof Error ? error.message : String(error) });
    } finally {
      socket.end();
    }
  }

  private async dispatch(request: McpRequest): Promise<McpReply> {
    if (request.auth_token !== this.authToken) {
      return { error: 'Unauthorized' };
    }

    const tool = request.tool ?? '';
    const args = request.args ?? {};
    const fromSlotId = request.from_slot_id;

    try {
      switch (tool) {
        case 'team_describe_assistant':
        case 'describe_assistant': {
          const customAgentId = String(args.custom_agent_id ?? '');
          if (!customAgentId) return { error: 'custom_agent_id is required' };
          const result = await this.handlers.describeAssistant(
            { custom_agent_id: customAgentId, locale: String(args.locale ?? 'en-US') },
            fromSlotId
          );
          return { result };
        }
        case 'team_spawn_agent':
        case 'spawn_agent': {
          const name = String(args.name ?? '').trim();
          if (!name) return { error: 'name is required' };
          const result = await this.handlers.spawnAgent(
            {
              name,
              backend: args.backend ? String(args.backend) : undefined,
              model: args.model ? String(args.model) : undefined,
              custom_agent_id: args.custom_agent_id ? String(args.custom_agent_id) : undefined,
            },
            fromSlotId
          );
          return { result };
        }
        case 'fire_agent':
        case 'remove_agent': {
          const result = await this.handlers.fireAgent(
            {
              name: args.name ? String(args.name) : undefined,
              slot_id: args.slot_id ? String(args.slot_id) : undefined,
            },
            fromSlotId
          );
          return { result };
        }
        default:
          return { error: `Unknown tool: ${tool}` };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}

export function normalizeSpawnBackend(raw?: string): string {
  const backend = (raw ?? 'claude').toLowerCase();
  if (backend === 'acp') return 'claude';
  return TEAM_SUPPORTED_BACKENDS.has(backend) ? backend : 'claude';
}

export function findAgentByName(agents: StoredTeamAgent[], name: string): StoredTeamAgent | undefined {
  const target = name.trim().toLowerCase();
  return agents.find((agent) => agent.name.trim().toLowerCase() === target);
}

export const teamMcpWhitelist = TEAM_SUPPORTED_BACKENDS;
