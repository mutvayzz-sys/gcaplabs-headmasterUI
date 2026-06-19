#!/usr/bin/env node
/**
 * Probe the packaged Headmaster/Adonis runtime route surface.
 *
 * Run while out/win-unpacked/Headmaster.exe is running.
 * Writes out/runtime-probe-report.json and exits non-zero if required routes fail.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const repoRoot = path.resolve(__dirname, '..');
const reportPath = path.join(repoRoot, 'out', 'runtime-probe-report.json');
const appData = process.env.APPDATA;
if (!appData) throw new Error('APPDATA is required');

const logPath = path.join(appData, 'Headmaster', 'logs', '2026-06-15.log');
const aionRoot = path.join(appData, 'Headmaster', 'aionui');
const probeFile = path.join(aionRoot, 'runtime-probe.txt');

function latestPort() {
  const text = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  const matches = [...text.matchAll(/Server listening on 127\.0\.0\.1:(\d+)/g)];
  return matches.at(-1)?.[1] ?? '';
}

async function request(port, method, route, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {}
    return { ok: response.ok, status: response.status, body: parsed, raw: raw.slice(0, 1000) };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeBody(body) {
  if (!body || typeof body !== 'object') return { type: typeof body };
  const data = Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
  if (Array.isArray(data))
    return { type: 'array', length: data.length, firstKeys: data[0] ? Object.keys(data[0]).slice(0, 10) : [] };
  if (data && typeof data === 'object') {
    const summary = { type: 'object', keys: Object.keys(data).slice(0, 20) };
    if (Array.isArray(data.items)) summary.items = data.items.length;
    if (Array.isArray(data.platforms)) summary.platforms = data.platforms.length;
    if (Array.isArray(data.entries)) summary.entries = data.entries.length;
    return summary;
  }
  return { type: typeof data };
}

function extractBackends(conversationsResult) {
  const data = conversationsResult.body?.data ?? conversationsResult.body;
  const items = Array.isArray(data?.items) ? data.items : [];
  return [
    ...new Set(items.map((item) => item?.extra?.backend || item?.extra?.provider_id || item?.type).filter(Boolean)),
  ].sort();
}

async function main() {
  const port = latestPort();
  if (!port) throw new Error(`No backend port found in ${logPath}`);

  const health = await request(port, 'GET', '/health');
  if (!health.ok) throw new Error(`Backend health failed on port ${port}: ${JSON.stringify(health)}`);

  const probes = [
    { name: 'health', method: 'GET', route: '/health', required: true },
    { name: 'auth-status', method: 'GET', route: '/api/auth/status', required: true },
    { name: 'settings-client', method: 'GET', route: '/api/settings/client', required: true },
    { name: 'providers', method: 'GET', route: '/api/providers', required: true },
    { name: 'conversations', method: 'GET', route: '/api/conversations', required: true },
    { name: 'cron-jobs', method: 'GET', route: '/api/cron/jobs', required: true },
    { name: 'extensions', method: 'GET', route: '/api/extensions', required: true },
    { name: 'extensions-agents', method: 'GET', route: '/api/extensions/agents', required: true },
    { name: 'extensions-acp-adapters', method: 'GET', route: '/api/extensions/acp-adapters', required: true },
    { name: 'extensions-assistants', method: 'GET', route: '/api/extensions/assistants', required: true },
    { name: 'mcp-servers', method: 'GET', route: '/api/mcp/servers', required: true },
    { name: 'skills', method: 'GET', route: '/api/skills', required: true },
    { name: 'skills-builtin-auto', method: 'GET', route: '/api/skills/builtin-auto', required: true },
    { name: 'asset-claude-logo', method: 'GET', route: '/api/assets/logos/ai-major/claude.svg', required: true },
    { name: 'fs-list', method: 'POST', route: '/api/fs/list', body: { root: aionRoot }, required: true },
    { name: 'fs-dir', method: 'POST', route: '/api/fs/dir', body: { dir: aionRoot, root: aionRoot }, required: true },
    {
      name: 'fs-write',
      method: 'POST',
      route: '/api/fs/write',
      body: { path: probeFile, data: `Headmaster runtime probe ${new Date().toISOString()}\n` },
      required: true,
    },
    { name: 'fs-read', method: 'POST', route: '/api/fs/read', body: { path: probeFile }, required: true },
    { name: 'known-missing-profiles', method: 'GET', route: '/api/profiles', expectStatus: 404, required: false },
    { name: 'known-missing-files', method: 'GET', route: '/api/files', expectStatus: 404, required: false },
    { name: 'known-missing-memory', method: 'GET', route: '/api/memory', expectStatus: 404, required: false },
    { name: 'known-missing-ws-http', method: 'GET', route: '/api/ws', expectStatus: 404, required: false },
    {
      name: 'known-missing-kanban-plugin',
      method: 'GET',
      route: '/api/plugins/kanban/board',
      expectStatus: 404,
      required: false,
    },
    {
      name: 'known-missing-messaging-platforms',
      method: 'GET',
      route: '/api/messaging/platforms',
      expectStatus: 404,
      required: false,
    },
    {
      name: 'known-missing-model-options',
      method: 'GET',
      route: '/api/model/options',
      expectStatus: 404,
      required: false,
    },
  ];

  const results = [];
  for (const probe of probes) {
    const result = await request(port, probe.method, probe.route, probe.body);
    const pass = probe.expectStatus ? result.status === probe.expectStatus : result.ok;
    results.push({
      name: probe.name,
      method: probe.method,
      route: probe.route,
      required: probe.required,
      expectStatus: probe.expectStatus ?? '2xx',
      pass,
      status: result.status,
      error: result.error,
      summary: summarizeBody(result.body),
    });
  }

  const conversations = results.find((r) => r.name === 'conversations');
  const conversationsRaw = await request(port, 'GET', '/api/conversations');
  const report = {
    generatedAt: new Date().toISOString(),
    port,
    aionRoot,
    probeFile,
    knownCliBackendsFromConversations: extractBackends(conversationsRaw),
    results,
    failedRequired: results.filter((r) => r.required && !r.pass),
    failedKnownMissing: results.filter((r) => !r.required && !r.pass),
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Runtime probe report: ${reportPath}`);
  console.log(
    `Required: ${results.filter((r) => r.required && r.pass).length}/${results.filter((r) => r.required).length} passing`
  );
  console.log(
    `Known missing: ${results.filter((r) => !r.required && r.pass).length}/${results.filter((r) => !r.required).length} matched expected status`
  );
  console.log(`CLI backends from conversations: ${report.knownCliBackendsFromConversations.join(', ') || '(none)'}`);

  if (report.failedRequired.length > 0) {
    console.error('FAILED REQUIRED PROBES:', JSON.stringify(report.failedRequired, null, 2));
    process.exit(1);
  }
}

console.log('[runtime-probe] starting');
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
