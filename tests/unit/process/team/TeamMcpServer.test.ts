/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import * as net from 'node:net';
import { describe, expect, it } from 'vitest';
import { TeamMcpServer, findAgentByName, normalizeSpawnBackend } from '@process/team/TeamMcpServer';

function sendFramedRequest(port: number, payload: Record<string, unknown>): Promise<{ result?: string; error?: string }> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      const body = Buffer.from(JSON.stringify(payload), 'utf8');
      const frame = Buffer.allocUnsafe(4 + body.length);
      frame.writeUInt32BE(body.length, 0);
      body.copy(frame, 4);
      socket.write(frame);
    });

    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4) return;
      const length = buffer.readUInt32BE(0);
      if (buffer.length < 4 + length) return;
      const body = buffer.subarray(4, 4 + length);
      resolve(JSON.parse(body.toString('utf8')) as { result?: string; error?: string });
      socket.end();
    });
    socket.on('error', reject);
  });
}

describe('TeamMcpServer', () => {
  it('normalizes spawn backends to the team whitelist', () => {
    expect(normalizeSpawnBackend('acp')).toBe('claude');
    expect(normalizeSpawnBackend('gemini')).toBe('gemini');
    expect(normalizeSpawnBackend('unknown')).toBe('claude');
  });

  it('finds agents by case-insensitive name', () => {
    const found = findAgentByName(
      [{ slot_id: '1', conversation_id: '', role: 'teammate', backend: 'claude', name: 'Dev1', model: 'claude', status: 'idle' }],
      'dev1'
    );
    expect(found?.name).toBe('Dev1');
  });

  it('rejects unauthorized MCP requests', async () => {
    const server = new TeamMcpServer('team-1', {
      describeAssistant: async () => 'ok',
      spawnAgent: async () => 'spawned',
      fireAgent: async () => 'fired',
    });
    const port = await server.start();
    const reply = await sendFramedRequest(port, {
      tool: 'team_describe_assistant',
      args: { custom_agent_id: 'builtin-cowork' },
      auth_token: 'wrong',
    });
    expect(reply.error).toContain('Unauthorized');
    await server.stop();
  });

  it('dispatches team_describe_assistant over TCP', async () => {
    const server = new TeamMcpServer(
      'team-2',
      {
        describeAssistant: async (args) => `describe:${args.custom_agent_id}`,
        spawnAgent: async () => 'spawned',
        fireAgent: async () => 'fired',
      },
      'test-token'
    );
    const port = await server.start();
    const reply = await sendFramedRequest(port, {
      tool: 'team_describe_assistant',
      args: { custom_agent_id: 'builtin-cowork', locale: 'en-US' },
      auth_token: 'test-token',
    });
    expect(reply.result).toBe('describe:builtin-cowork');
    await server.stop();
  });
});
