#!/usr/bin/env node
/**
 * Probe Headmaster / AionUI HTTP surfaces against a running backend.
 *
 * Usage:
 *   node scripts/probe-aion-endpoints.mjs [--port 8787] [--token TOKEN] [--json]
 *
 * Reads HEADMASTER_BACKEND_PORT / HERMES_SESSION_TOKEN from env when flags omitted.
 */

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const port = Number(getArg('--port') ?? process.env.HEADMASTER_BACKEND_PORT ?? process.env.HERMES_PORT ?? 0);
const token = getArg('--token') ?? process.env.HERMES_SESSION_TOKEN ?? '';
const jsonOut = args.includes('--json');

if (!port) {
  console.error('Missing backend port. Pass --port or set HEADMASTER_BACKEND_PORT.');
  process.exit(1);
}

const base = `http://127.0.0.1:${port}`;

/** GET probes — safe read-only inventory from ipcBridge.ts */
const GET_ENDPOINTS = [
  '/api/status',
  '/api/system/info',
  '/api/sessions',
  '/api/profiles',
  '/api/assistants',
  '/api/providers',
  '/api/model/options',
  '/api/agents',
  '/api/skills',
  '/api/skills/builtin-auto',
  '/api/skills/paths',
  '/api/skills/detect-paths',
  '/api/skills/external-paths',
  '/api/mcp/servers',
  '/api/mcp/oauth/authenticated',
  '/api/cron/jobs',
  '/api/teams?user_id=system_default_user',
  '/api/conversations/active-count',
  '/api/remote-agents',
  '/api/channel/plugins',
  '/api/channel/pairings',
  '/api/channel/users',
  '/api/channel/sessions',
  '/api/hub/extensions',
  '/api/extensions/acp-adapters',
  '/api/providers/oauth',
  '/api/messaging/platforms',
  '/api/google/subscription-status',
  '/api/google/auth-status',
  '/api/tasks/running-count',
];

async function probe(method, path) {
  const headers = {};
  if (token) headers['X-Hermes-Session-Token'] = token;
  const started = Date.now();
  try {
    const res = await fetch(`${base}${path}`, { method, headers });
    const ct = res.headers.get('content-type') || '';
    let detail = `HTTP ${res.status}`;
    if (res.ok && ct.includes('application/json')) {
      const data = await res.json();
      const keys = data && typeof data === 'object' ? Object.keys(data).slice(0, 6) : [];
      detail = `${detail} keys=[${keys.join(',')}]`;
    }
    return {
      method,
      path,
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      detail,
    };
  } catch (error) {
    return {
      method,
      path,
      ok: false,
      status: 0,
      ms: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

const results = [];
for (const path of GET_ENDPOINTS) {
  results.push(await probe('GET', path));
}

const summary = {
  port,
  probed: results.length,
  ready: results.filter((r) => r.ok).length,
  unavailable: results.filter((r) => !r.ok).length,
  results,
};

if (jsonOut) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(`Backend ${base} — ${summary.ready}/${summary.probed} endpoints OK\n`);
  for (const row of results) {
    const mark = row.ok ? 'OK ' : 'ERR';
    console.log(`${mark} ${row.method.padEnd(4)} ${row.path.padEnd(48)} ${row.detail} (${row.ms}ms)`);
  }
}

process.exit(summary.unavailable > 0 ? 2 : 0);
