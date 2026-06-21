#!/usr/bin/env node
/**
 * Stdio MCP bridge for team tools — proxies tool calls to the TeamMcpServer TCP endpoint.
 * Spawned by ACP leader agents with TEAM_MCP_PORT / TEAM_MCP_TOKEN in env.
 */
/* eslint-disable no-console */
const net = require('node:net');

const port = Number(process.env.TEAM_MCP_PORT || '0');
const token = process.env.TEAM_MCP_TOKEN || '';

if (!port || !token) {
  console.error('TEAM_MCP_PORT and TEAM_MCP_TOKEN are required');
  process.exit(1);
}

function writeFrame(socket, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const frame = Buffer.allocUnsafe(4 + body.length);
  frame.writeUInt32BE(body.length, 0);
  body.copy(frame, 4);
  socket.write(frame);
}

function readFrames(onMessage) {
  let buffer = Buffer.alloc(0);
  process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32BE(0);
      if (buffer.length < 4 + length) break;
      const body = buffer.subarray(4, 4 + length);
      buffer = buffer.subarray(4 + length);
      try {
        onMessage(JSON.parse(body.toString('utf8')));
      } catch (error) {
        console.error('[teamMcpStdio] invalid JSON frame', error);
      }
    }
  });
}

function forwardToolCall(request) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port }, () => {
      writeFrame(socket, {
        tool: request.tool || request.name,
        args: request.arguments || request.args || {},
        auth_token: token,
        from_slot_id: request.from_slot_id,
      });
    });

    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4) return;
      const length = buffer.readUInt32BE(0);
      if (buffer.length < 4 + length) return;
      const body = buffer.subarray(4, 4 + length);
      try {
        resolve(JSON.parse(body.toString('utf8')));
      } catch (error) {
        reject(error);
      } finally {
        socket.end();
      }
    });
    socket.on('error', reject);
  });
}

readFrames(async (message) => {
  if (message?.method === 'tools/list') {
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: [
            { name: 'spawn_agent', description: 'Spawn a teammate agent' },
            { name: 'fire_agent', description: 'Remove a teammate agent' },
            { name: 'team_spawn_agent', description: 'Spawn a preset assistant teammate' },
            { name: 'team_describe_assistant', description: 'Describe a preset assistant' },
          ],
        },
      })}\n`
    );
    return;
  }

  if (message?.method === 'tools/call') {
    try {
      const reply = await forwardToolCall({
        tool: message.params?.name,
        args: message.params?.arguments ?? {},
      });
      const text = reply.error ? `Error: ${reply.error}` : reply.result || '';
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: { content: [{ type: 'text', text }] },
        })}\n`
      );
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          error: { message: error instanceof Error ? error.message : String(error) },
        })}\n`
      );
    }
  }
});

process.stdin.resume();
