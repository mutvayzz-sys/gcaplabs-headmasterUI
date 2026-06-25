#!/usr/bin/env node
/**
 * Headmaster runtime smoke test — probes Hermes dashboard APIs after spawn.
 * Writes NDJSON results to debug-fe02c3.log for debug session fe02c3.
 */

import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const LOG_PATH = join(process.cwd(), 'debug-fe02c3.log');
const SESSION_ID = 'fe02c3';
const ENDPOINT = 'http://127.0.0.1:7516/ingest/f0a355cb-b07b-4257-aacc-d94aab72a599';

function debugLog(location, message, data = {}, hypothesisId = 'smoke') {
  const entry = {
    sessionId: SESSION_ID,
    runId: 'smoke-runtime',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  appendFileSync(LOG_PATH, `${JSON.stringify(entry)}\n`);
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION_ID },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

function hermesBin() {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  const hermesHome = process.env.HERMES_HOME || join(localAppData, 'hermes');
  return join(hermesHome, 'bin', 'hermes.exe');
}

const READY_RE = /HERMES_DASHBOARD_READY\s+port=(\d+)/;

async function waitForReady(child, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Hermes dashboard ready timeout')), timeoutMs);
    const onData = (chunk) => {
      buf += chunk.toString();
      const match = buf.match(READY_RE);
      if (match) {
        clearTimeout(timer);
        child.stdout?.off('data', onData);
        child.stderr?.off('data', onData);
        resolve(Number(match[1]));
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('exit', (code) => {
      if (!buf.match(READY_RE)) reject(new Error(`Hermes exited ${code} before ready`));
    });
  });
}

async function probe(name, url, token, expectJson = true) {
  const headers = token ? { 'X-Hermes-Session-Token': token } : {};
  try {
    const res = await fetch(url, { headers });
    const ct = res.headers.get('content-type') || '';
    let bodyPreview = '';
    if (expectJson && ct.includes('json')) {
      const json = await res.json();
      bodyPreview = Array.isArray(json)
        ? `array[${json.length}]`
        : typeof json === 'object'
          ? Object.keys(json).slice(0, 8).join(',')
          : String(json);
    } else {
      bodyPreview = (await res.text()).slice(0, 120);
    }
    return { name, status: res.status, ok: res.ok, preview: bodyPreview };
  } catch (err) {
    return { name, status: 0, ok: false, preview: err instanceof Error ? err.message : String(err) };
  }
}

async function wsRpc(port, token, method, params, id = 1) {
  const url = `ws://127.0.0.1:${port}/api/ws?token=${encodeURIComponent(token)}`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`WS RPC timeout: ${method}`));
    }, 30000);
    ws.onopen = () => {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    };
    ws.onmessage = (event) => {
      let frame;
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (frame.id !== id) return;
      clearTimeout(timer);
      ws.close();
      if (frame.error) reject(new Error(frame.error.message || `RPC error: ${method}`));
      else resolve(frame.result);
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`WS error: ${method}`));
    };
  });
}

async function main() {
  const bin = hermesBin();
  if (!existsSync(bin)) {
    debugLog('smoke-test-runtime.mjs:main', 'hermes binary missing', { bin }, 'H0');
    console.error('Hermes not installed:', bin);
    process.exit(1);
  }

  const token = randomBytes(16).toString('hex');
  debugLog('smoke-test-runtime.mjs:spawn', 'spawning hermes dashboard', { bin }, 'H1');

  const child = spawn(bin, ['dashboard', '--no-open', '--port', '0', '--skip-build'], {
    env: {
      ...process.env,
      HERMES_DASHBOARD_SESSION_TOKEN: token,
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let port;
  try {
    port = await waitForReady(child);
    debugLog('smoke-test-runtime.mjs:ready', 'dashboard ready', { port }, 'H1');
  } catch (err) {
    debugLog('smoke-test-runtime.mjs:ready', 'dashboard failed', { error: String(err) }, 'H1');
    child.kill();
    process.exit(1);
  }

  const base = `http://127.0.0.1:${port}`;
  const endpoints = [
    ['status', `${base}/api/status`],
    ['sessions', `${base}/api/sessions`],
    ['models', `${base}/api/model/options`],
    ['skills', `${base}/api/skills`],
    ['mcp', `${base}/api/mcp/servers`],
    ['cron', `${base}/api/cron/jobs`],
    ['providers', `${base}/api/providers/oauth`],
    ['platforms', `${base}/api/messaging/platforms`],
    ['profiles', `${base}/api/profiles`],
  ];

  const results = [];
  for (const [name, url] of endpoints) {
    const r = await probe(name, url, token);
    results.push(r);
    debugLog('smoke-test-runtime.mjs:probe', `probe ${name}`, r, 'H2');
  }

  let wsOk = false;
  try {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/api/ws?token=${encodeURIComponent(token)}`);
    wsOk = await new Promise((resolve) => {
      const t = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);
      ws.onopen = () => {
        clearTimeout(t);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => {
        clearTimeout(t);
        resolve(false);
      };
    });
  } catch {
    wsOk = false;
  }
  debugLog('smoke-test-runtime.mjs:ws', 'websocket probe', { wsOk }, 'H3');

  let sessionCreate = { ok: false, preview: 'skipped' };
  try {
    const result = await wsRpc(port, token, 'session.create', { profile: 'default' }, 1);
    sessionCreate = {
      ok: Boolean(result?.session_id),
      preview: result?.session_id || JSON.stringify(result).slice(0, 120),
    };
  } catch (err) {
    sessionCreate = { ok: false, preview: String(err) };
  }
  debugLog('smoke-test-runtime.mjs:session', 'session.create default', sessionCreate, 'H4');

  let recruiterCreate = { ok: false, preview: 'skipped' };
  try {
    const result = await wsRpc(port, token, 'session.create', { profile: 'recruiter' }, 2);
    recruiterCreate = {
      ok: Boolean(result?.session_id),
      preview: result?.session_id || JSON.stringify(result).slice(0, 120),
    };
  } catch (err) {
    recruiterCreate = { ok: false, preview: String(err) };
  }
  debugLog('smoke-test-runtime.mjs:session', 'session.create recruiter', recruiterCreate, 'H5');

  child.kill();
  try {
    spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    /* ignore */
  }

  const failed = results.filter((r) => !r.ok);
  const summary = {
    port,
    endpointPass: results.filter((r) => r.ok).length,
    endpointTotal: results.length,
    wsOk,
    sessionCreate,
    recruiterCreate,
    failed: failed.map((f) => f.name),
  };
  debugLog('smoke-test-runtime.mjs:summary', 'smoke complete', summary, 'SUMMARY');
  console.log(JSON.stringify(summary, null, 2));

  const hmLog = join(
    homedir(),
    'AppData',
    'Roaming',
    'Headmaster',
    'logs',
    `${new Date().toISOString().slice(0, 10)}.log`
  );
  if (existsSync(hmLog)) {
    const tail = readFileSync(hmLog, 'utf8').split('\n').slice(-200).join('\n');
    const errors = (tail.match(/\[error\]|ERROR|Cannot read properties/gi) || []).length;
    debugLog('smoke-test-runtime.mjs:hmLog', 'headmaster log tail scan', { hmLog, errorHits: errors }, 'H6');
  }

  const rpcOk = sessionCreate.ok && recruiterCreate.ok;
  process.exit(failed.length === 0 && wsOk && rpcOk ? 0 : 1);
}

main().catch((err) => {
  debugLog('smoke-test-runtime.mjs:fatal', 'fatal', { error: String(err) }, 'FATAL');
  console.error(err);
  process.exit(1);
});
