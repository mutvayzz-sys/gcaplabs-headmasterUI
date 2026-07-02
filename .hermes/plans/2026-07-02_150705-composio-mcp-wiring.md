# Composio → Hermes MCP Wiring Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make a connected Composio app (Gmail, Slack, etc.) actually give the running Hermes agent a callable tool — end-to-end: connect → MCP server registered in `$HERMES_HOME/config.yaml` → agent calls Gmail MCP tool → real email listed.

**Architecture:** The console's Composio integration already creates OAuth connections (Composio-side). The missing piece is the bridge from "Composio connection exists" → "Hermes agent has a callable MCP tool". Composio exposes its own hosted MCP server product (`POST /api/v3/mcp/servers` + `/instances`) that wraps connected toolkits into a connectable MCP URL. Hermes natively loads MCP servers from `$HERMES_HOME/config.yaml`'s `mcp_servers` key (HTTP transport: `{ url, headers, enabled }`). The gateway's existing `/api/mcp/servers` compat route currently writes to a dead `api-compat.json` file that nothing reads — it needs to read/write the real `config.yaml` instead. After the gateway route is real, the console calls it to register the Composio MCP URL on OAuth callback, and the Hermes worker picks it up on the next session.

**Tech Stack:** TypeScript (Express gateway, Next.js console), YAML (Hermes config.yaml), Composio REST API v3, Hermes MCP tool loading (`tools/mcp_tool.py`).

**Critical Note for Implementer:**
- The gateway lives at `gcaplabs-hermeshq/third_party/agent37/gateway/` — its `package.json` has NO yaml dependency. You must add `yaml` (npm) as a dependency. The console at `gcaplabs-console2/` already has no yaml dep either, but the console only POSTs to the gateway — it doesn't parse YAML itself.
- The gateway's `resolveHermesHome()` (from `server/paths.ts`) already resolves `$HERMES_HOME` → `~/.hermes` and is already imported in `api.ts`. Use it; don't reinvent.
- `config.yaml` is a REAL config file with model credentials, provider settings, and other keys. You MUST read-modify-write only the `mcp_servers` key — never overwrite the whole file. Use atomic write to avoid corruption if the worker reads mid-write.
- The `mcp_servers` key in Hermes config is a **dict** keyed by server name, NOT an array. Each value is `{ url, headers?, enabled?, transport?, timeout? }` for HTTP transport. The gateway's current stub used an array (`mcpServers: JsonObject[]`) to match the desktop's `IMcpServer` contract — the response shape stays the same (array), but the storage backing it changes from JSON-array to YAML-dict. Convert between the two at the boundary.
- The desktop `IMcpServer` contract (from `packages/desktop/src/common/config/storage.ts:609`) expects: `{ id, name, description?, enabled, transport: { type, url, headers? }, ... }`. The gateway must return this shape from GET `/api/mcp/servers` and accept it on POST. Do not change the desktop client.
- The console repo on disk is `gcaplabs-console2/` (the only local checkout — per mastertodo, the others were deleted and this one renamed). Use it, don't recreate others.

**Execution mode: in-context with per-task escalation gates.** Agent reports after each task and waits for `continue`. (User hasn't specified, but this plan touches three repos with real config files — checkpoint cadence prevents catastrophic clobbering.)

---

## Phase 0: Branch state pre-check

### Task 0: Verify clean working trees across all three repos

**Objective:** Confirm all three repos are on `main` with clean working trees before editing.

**Files:** (read-only)
- `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-hermeshq`
- `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-console2`
- `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-headmasterUI`

**Step 1: Check each repo**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq && git status --short && git branch --show-current && git log -1 --oneline
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-console2 && git status --short && git branch --show-current && git log -1 --oneline
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-headmasterUI && git status --short && git branch --show-current && git log -1 --oneline
```

Expected: all three on `main`, clean working tree (no untracked/modified files). Record the starting commit SHA of `gcaplabs-hermeshq` as the baseline.

**Step 2: If any repo is dirty or not on main, stop and ask the user** whether to commit/stash/switch before proceeding.

---

## Phase 1: Gateway — real config.yaml MCP server storage

### Task 1: Add `yaml` dependency to the gateway

**Objective:** The gateway needs a YAML parser to read/write `config.yaml`. Add it to `package.json`.

**Files:**
- Modify: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-hermeshq\third_party\agent37\gateway\package.json`

**Step 1: Add the dependency**

Add `"yaml": "^2.8.0"` to the `dependencies` block (alphabetically after `express`):

```json
    "express": "^4.21.2",
    "yaml": "^2.8.0"
```

**Step 2: Install**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq/third_party/agent37/gateway && npm install
```

Expected: `yaml` appears in `node_modules/` and `package-lock.json` updates.

**Step 3: Verify import works**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq/third_party/agent37/gateway && node -e "import('yaml').then(m => console.log(typeof m.parse, typeof m.stringify))"
```

Expected: `function function`

**Step 4: Commit**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq && git add third_party/agent37/gateway/package.json third_party/agent37/gateway/package-lock.json && git commit -m "chore(gateway): add yaml dependency for config.yaml MCP server storage"
```

---

### Task 2: Create the config.yaml MCP server store module

**Objective:** A new module that reads/writes only the `mcp_servers` key of `$HERMES_HOME/config.yaml` using read-modify-write, with atomic writes. This replaces the dead `api-compat.json` store for MCP servers.

**Files:**
- Create: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-hermeshq\third_party\agent37\gateway\server\mcpConfigStore.ts`
- Test: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-hermeshq\third_party\agent37\gateway\test\mcp-config-store.test.ts`

**Step 1: Write the failing test**

```typescript
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tempHome: string;

before(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'mcp-config-test-'));
  process.env.HERMES_HOME = tempHome;
});

after(() => {
  delete process.env.HERMES_HOME;
});

test('listMcpServers returns empty when no config.yaml exists', async () => {
  const { listMcpServers } = await import('../server/mcpConfigStore.js');
  const servers = await listMcpServers();
  assert.equal(servers.length, 0);
});

test('upsertMcpServer writes to config.yaml mcp_servers key', async () => {
  const { upsertMcpServer, listMcpServers } = await import('../server/mcpConfigStore.js');
  await upsertMcpServer('composio-gmail', {
    url: 'https://backend.composio.dev/v3/mcp/server1?user_id=u1',
    enabled: true,
    headers: { Authorization: 'Bearer test-token' },
  });
  const servers = await listMcpServers();
  assert.equal(servers.length, 1);
  assert.equal(servers[0].name, 'composio-gmail');
  assert.equal(servers[0].transport.type, 'http');
  assert.equal(servers[0].transport.url, 'https://backend.composio.dev/v3/mcp/server1?user_id=u1');
  assert.equal(servers[0].enabled, true);
});

test('upsertMcpServer preserves other config.yaml keys', async () => {
  const configPath = join(tempHome, 'config.yaml');
  writeFileSync(configPath, 'model:\n  default: kimi-k2.7-code\n  provider: kimi-coding\nmcp_servers:\n  existing:\n    url: "https://old.example.com"\n    enabled: false\n');
  const { upsertMcpServer, listMcpServers } = await import('../server/mcpConfigStore.js');
  await upsertMcpServer('new-server', { url: 'https://new.example.com', enabled: true });
  const raw = readFileSync(configPath, 'utf8');
  assert.ok(raw.includes('kimi-k2.7-code'), 'model config preserved');
  assert.ok(raw.includes('old.example.com'), 'existing mcp server preserved');
  assert.ok(raw.includes('new.example.com'), 'new server written');
  const servers = await listMcpServers();
  assert.equal(servers.length, 2);
});

test('removeMcpServer removes only the named server', async () => {
  const { removeMcpServer, listMcpServers } = await import('../server/mcpConfigStore.js');
  await removeMcpServer('new-server');
  const servers = await listMcpServers();
  assert.equal(servers.length, 1);
  assert.equal(servers[0].name, 'existing');
});

test('toggleMcpServer flips enabled', async () => {
  const { toggleMcpServer, listMcpServers } = await import('../server/mcpConfigStore.js');
  await toggleMcpServer('existing');
  const servers = await listMcpServers();
  assert.equal(servers[0].enabled, true);
});
```

**Step 2: Run test to verify failure**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq/third_party/agent37/gateway && node --import tsx --test test/mcp-config-store.test.ts
```

Expected: FAIL — module not found.

**Step 3: Write minimal implementation**

```typescript
// server/mcpConfigStore.ts
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { resolveHermesHome } from './paths.js';

/**
 * Read-modify-write store for the `mcp_servers` key in $HERMES_HOME/config.yaml.
 *
 * Hermes loads MCP servers from this key (tools/mcp_tool.py). The HTTP transport
 * entry shape is: { url: string, headers?: Record<string,string>, enabled?: boolean,
 * transport?: 'sse'|'http'|'streamable_http', timeout?: number }.
 *
 * The desktop IMcpServer contract (ipcBridge.ts → storage.ts:609) expects an array
 * of { id, name, enabled, transport: { type, url, headers? }, ... }. We convert
 * between the YAML dict (keyed by name) and the array shape at the boundary.
 */

export interface HermesMcpServerEntry {
  url: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  transport?: string;
  timeout?: number;
  [key: string]: unknown;
}

export interface DesktopMcpServer {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  transport: {
    type: 'http' | 'sse' | 'streamable_http';
    url: string;
    headers?: Record<string, string>;
  };
  builtin?: boolean;
  original_json?: string;
  created_at?: number;
  updated_at?: number;
  [key: string]: unknown;
}

function configPath(): string {
  return join(resolveHermesHome(), 'config.yaml');
}

function readConfigFile(): Record<string, unknown> {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function writeConfigFile(config: Record<string, unknown>): void {
  const path = configPath();
  mkdirSync(resolveHermesHome(), { recursive: true });
  // Atomic write: write to temp then rename. Hermes' own save_config uses
  // atomic_replace too — we mirror that to avoid a half-written file if the
  // worker reads mid-write.
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, stringify(config), 'utf8');
  // rename is atomic on same filesystem
  const { renameSync } = require('node:fs');
  renameSync(tmp, path);
}

function getServersDict(config: Record<string, unknown>): Record<string, HermesMcpServerEntry> {
  const servers = config['mcp_servers'];
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) return {};
  return servers as Record<string, HermesMcpServerEntry>;
}

function entryToDesktop(name: string, entry: HermesMcpServerEntry): DesktopMcpServer {
  const transportType = entry.transport === 'sse' ? 'sse' : 'http';
  return {
    id: name,
    name,
    enabled: entry.enabled !== false,
    transport: {
      type: transportType,
      url: entry.url,
      ...(entry.headers ? { headers: entry.headers } : {}),
    },
    original_json: JSON.stringify(entry),
    builtin: false,
  };
}

export async function listMcpServers(): Promise<DesktopMcpServer[]> {
  const config = readConfigFile();
  const dict = getServersDict(config);
  return Object.entries(dict).map(([name, entry]) => entryToDesktop(name, entry));
}

export async function upsertMcpServer(name: string, entry: HermesMcpServerEntry): Promise<DesktopMcpServer> {
  const config = readConfigFile();
  const dict = getServersDict(config);
  dict[name] = entry;
  config['mcp_servers'] = dict;
  writeConfigFile(config);
  return entryToDesktop(name, entry);
}

export async function removeMcpServer(name: string): Promise<boolean> {
  const config = readConfigFile();
  const dict = getServersDict(config);
  if (!(name in dict)) return false;
  delete dict[name];
  if (Object.keys(dict).length === 0) {
    delete config['mcp_servers'];
  } else {
    config['mcp_servers'] = dict;
  }
  writeConfigFile(config);
  return true;
}

export async function toggleMcpServer(name: string): Promise<DesktopMcpServer | null> {
  const config = readConfigFile();
  const dict = getServersDict(config);
  if (!(name in dict)) return null;
  dict[name].enabled = dict[name].enabled === false; // flip
  config['mcp_servers'] = dict;
  writeConfigFile(config);
  return entryToDesktop(name, dict[name]);
}

export async function getMcpServer(name: string): Promise<DesktopMcpServer | null> {
  const config = readConfigFile();
  const dict = getServersDict(config);
  if (!(name in dict)) return null;
  return entryToDesktop(name, dict[name]);
}
```

**Step 4: Run test to verify pass**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq/third_party/agent37/gateway && node --import tsx --test test/mcp-config-store.test.ts
```

Expected: 5 tests PASS.

**Step 5: Commit**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq && git add third_party/agent37/gateway/server/mcpConfigStore.ts third_party/agent37/gateway/test/mcp-config-store.test.ts && git commit -m "feat(gateway): add config.yaml-backed MCP server store"
```

---

### Task 3: Rewire `/api/mcp/servers` routes to use the real config.yaml store

**Objective:** Replace the fake `api-compat.json`-backed MCP server handlers in `api.ts` with calls to the new `mcpConfigStore.ts` module. Keep the HTTP response shape unchanged.

**Files:**
- Modify: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-hermeshq\third_party\agent37\gateway\server\routes\api.ts` (lines ~526-586: the GET/POST/PUT/toggle/DELETE `/mcp/servers` handlers)

**Step 1: Read the current handlers**

Read `api.ts` lines 1-10 (imports), 526-586 (MCP handlers) to get the exact current code.

**Step 2: Add the import**

At the top of `api.ts`, after line 8 (`import { resolveGatewayHome, resolveHermesHome, expandHomePrefix } from '../paths.js';`), add:

```typescript
import { listMcpServers, upsertMcpServer, removeMcpServer, toggleMcpServer, getMcpServer, type HermesMcpServerEntry } from '../mcpConfigStore.js';
```

**Step 3: Replace the GET handler (line 526-528)**

Replace:
```typescript
apiRouter.get('/mcp/servers', (_req, res) => {
  res.json({ servers: readStore().mcpServers });
});
```

With:
```typescript
apiRouter.get('/mcp/servers', async (_req, res, next) => {
  try {
    res.json({ servers: await listMcpServers() });
  } catch (err) { next(err); }
});
```

**Step 4: Replace the POST handler (lines 530-539)**

Replace:
```typescript
apiRouter.post('/mcp/servers', (req, res) => {
  const body = (req.body ?? {}) as JsonObject;
  const name = String(body.name || body.id || '').trim();
  if (!name) throw validationError('name is required.', 'name');
  const store = readStore();
  const server = { id: name, enabled: true, builtin: false, ...body, name };
  store.mcpServers = [...store.mcpServers.filter((item) => item.name !== name && item.id !== name), server];
  writeStore(store);
  res.json(server);
});
```

With:
```typescript
apiRouter.post('/mcp/servers', async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as JsonObject;
    const name = String(body.name || body.id || '').trim();
    if (!name) throw validationError('name is required.', 'name');
    // The desktop sends a transport: { type, url, headers? } shape. Extract the
    // Hermes config.yaml entry fields from it.
    const transport = body.transport as { url?: string; headers?: Record<string, string>; type?: string } | undefined;
    const url = String(body.url || transport?.url || '').trim();
    if (!url) throw validationError('url is required (body.url or body.transport.url).', 'url');
    const entry: HermesMcpServerEntry = {
      url,
      enabled: body.enabled !== false,
      ...(transport?.headers || body.headers ? { headers: (transport?.headers || body.headers) as Record<string, string> } : {}),
      ...(transport?.type && transport.type !== 'http' ? { transport: transport.type } : {}),
    };
    const server = await upsertMcpServer(name, entry);
    res.json(server);
  } catch (err) { next(err); }
});
```

**Step 5: Replace the PUT handler (lines 557-567)**

Replace:
```typescript
apiRouter.put('/mcp/servers/:id', (req, res) => {
  const store = readStore();
  const index = store.mcpServers.findIndex((item) => item.id === req.params.id || item.name === req.params.id);
  if (index < 0) {
    res.status(404).json({ error: { code: 'not_found', message: 'MCP server not found.' } });
    return;
  }
  store.mcpServers[index] = { ...store.mcpServers[index], ...(req.body as JsonObject) };
  writeStore(store);
  res.json(store.mcpServers[index]);
});
```

With:
```typescript
apiRouter.put('/mcp/servers/:id', async (req, res, next) => {
  try {
    const existing = await getMcpServer(req.params.id);
    if (!existing) {
      res.status(404).json({ error: { code: 'not_found', message: 'MCP server not found.' } });
      return;
    }
    // For PUT, re-upsert with the merged body — the store does a full replace of the entry.
    const body = (req.body ?? {}) as JsonObject;
    const transport = body.transport as { url?: string; headers?: Record<string, string>; type?: string } | undefined;
    const url = String(body.url || transport?.url || existing.transport.url).trim();
    const entry: HermesMcpServerEntry = {
      url,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled,
      ...(transport?.headers || body.headers || existing.transport.headers ? { headers: ((transport?.headers || body.headers || existing.transport.headers) as Record<string, string>) } : {}),
      ...(transport?.type && transport.type !== 'http' ? { transport: transport.type } : {}),
    };
    const server = await upsertMcpServer(req.params.id, entry);
    res.json(server);
  } catch (err) { next(err); }
});
```

**Step 6: Replace the toggle handler (lines 569-579)**

Replace:
```typescript
apiRouter.post('/mcp/servers/:id/toggle', (req, res) => {
  const store = readStore();
  const index = store.mcpServers.findIndex((item) => item.id === req.params.id || item.name === req.params.id);
  if (index < 0) {
    res.status(404).json({ error: { code: 'not_found', message: 'MCP server not found.' } });
    return;
  }
  store.mcpServers[index] = { ...store.mcpServers[index], enabled: store.mcpServers[index].enabled === false };
  writeStore(store);
  res.json(store.mcpServers[index]);
});
```

With:
```typescript
apiRouter.post('/mcp/servers/:id/toggle', async (req, res, next) => {
  try {
    const server = await toggleMcpServer(req.params.id);
    if (!server) {
      res.status(404).json({ error: { code: 'not_found', message: 'MCP server not found.' } });
      return;
    }
    res.json(server);
  } catch (err) { next(err); }
});
```

**Step 7: Replace the DELETE handler (lines 581-586)**

Replace:
```typescript
apiRouter.delete('/mcp/servers/:id', (req, res) => {
  const store = readStore();
  store.mcpServers = store.mcpServers.filter((item) => item.id !== req.params.id && item.name !== req.params.id);
  writeStore(store);
  res.status(204).end();
});
```

With:
```typescript
apiRouter.delete('/mcp/servers/:id', async (req, res, next) => {
  try {
    await removeMcpServer(req.params.id);
    res.status(204).end();
  } catch (err) { next(err); }
});
```

**Step 8: Leave the import handler (`/mcp/servers/import`, lines 541-555) alone for now** — it's not called by the console or the desktop in the Composio flow, and changing it risks breaking the desktop's existing import path. It still writes to the old store, which is now dead for MCP servers. Add a TODO comment above it:

```typescript
// TODO: /mcp/servers/import still uses the old api-compat.json store. Migrate
// to mcpConfigStore if the desktop's import flow is ever exercised.
apiRouter.post('/mcp/servers/import', (req, res) => {
```

**Step 9: Typecheck**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq/third_party/agent37/gateway && npm run typecheck
```

Expected: PASS, no errors.

**Step 10: Run existing tests**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq/third_party/agent37/gateway && npm test
```

Expected: all tests pass. The `api-compat.integration.test.ts` line 139 asserts `{ servers: [] }` — that should still pass since an empty config.yaml returns an empty array.

**Step 11: Commit**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq && git add third_party/agent37/gateway/server/routes/api.ts && git commit -m "fix(gateway): wire /api/mcp/servers to real config.yaml instead of dead JSON store"
```

---

### Task 4: Update the integration test to verify config.yaml backing

**Objective:** The existing `api-compat.integration.test.ts` asserts `{ servers: [] }` for a fresh state. Add a test that POSTs a server and confirms it lands in config.yaml.

**Files:**
- Modify: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-hermeshq\third_party\agent37\gateway\test\api-compat.integration.test.ts`

**Step 1: Add a test after the existing MCP assertion (after line 139)**

```typescript
test('/api/mcp/servers POST writes to config.yaml', async () => {
  // POST a server
  const created = await jsonOk<{ id: string; name: string; enabled: boolean }>('/api/mcp/servers', {
    method: 'POST',
    body: JSON.stringify({
      name: 'test-mcp',
      enabled: true,
      transport: { type: 'http', url: 'https://mcp.example.com/endpoint' },
    }),
  });
  assert.equal(created.name, 'test-mcp');
  assert.equal(created.enabled, true);

  // GET confirms it persists
  const { servers } = await jsonOk<{ servers: Array<{ name: string }> }>('/api/mcp/servers');
  assert.ok(servers.some((s) => s.name === 'test-mcp'));

  // DELETE cleans up
  await fetch(`${base}/api/mcp/servers/test-mcp`, { method: 'DELETE' });
  const { servers: after } = await jsonOk<{ servers: Array<{ name: string }> }>('/api/mcp/servers');
  assert.ok(!after.some((s) => s.name === 'test-mcp'));
});
```

**Step 2: Run tests**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq/third_party/agent37/gateway && npm test
```

Expected: all pass including the new test.

**Step 3: Commit**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq && git add third_party/agent37/gateway/test/api-compat.integration.test.ts && git commit -m "test(gateway): verify /api/mcp/servers persists to config.yaml"
```

---

## Phase 2: Console — Composio MCP server creation + gateway registration

### Task 5: Add Composio MCP server management to `composio.ts`

**Objective:** Extend the Composio client to create/find a shared MCP server, add auth_config_ids to it, and create per-user instances.

**Files:**
- Modify: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-console2\src\lib\composio.ts`

**Step 1: Add the MCP server management functions**

Append to the end of `composio.ts` (after `initiateConnection`):

```typescript
// ── Composio MCP server management ──────────────────────────────────────────
//
// Composio has a first-class MCP server product separate from the toolkit
// connection API. A "server" binds one or more auth_config_ids (i.e. connected
// toolkits) and is instantiated per-user to produce a connectable MCP URL.
//
// We use a SINGLE shared MCP server per console project (name: "headmaster-shared"),
// and PATCH new auth_config_ids onto it as users connect more toolkits. Each user
// gets their own instance (user_id = Supabase user id) so tool access is scoped.

const SHARED_MCP_SERVER_NAME = 'headmaster-shared';

interface ComposioMcpServer {
  id: string;
  name: string;
  auth_config_ids: string[];
}

interface ComposioMcpInstance {
  id: string;
  server_id: string;
  user_id: string;
  connect_url: string;
}

async function findSharedMcpServer(): Promise<ComposioMcpServer | null> {
  // List existing servers and find ours by name.
  const result = await composioFetch<{ items: ComposioMcpServer[] }>(`/mcp/servers?limit=100`);
  return result.items?.find((s) => s.name === SHARED_MCP_SERVER_NAME) ?? null;
}

async function createSharedMcpServer(authConfigId: string): Promise<ComposioMcpServer> {
  const created = await composioFetch<{ id: string; name: string; auth_config_ids: string[] }>('/mcp/servers', {
    method: 'POST',
    body: JSON.stringify({
      name: SHARED_MCP_SERVER_NAME,
      auth_config_ids: [authConfigId],
    }),
  });
  return created;
}

async function patchSharedMcpServer(serverId: string, authConfigIds: string[]): Promise<ComposioMcpServer> {
  const patched = await composioFetch<{ id: string; name: string; auth_config_ids: string[] }>(`/mcp/servers/${serverId}`, {
    method: 'PATCH',
    body: JSON.stringify({ auth_config_ids: authConfigIds }),
  });
  return patched;
}

async function createMcpInstance(serverId: string, userId: string): Promise<ComposioMcpInstance> {
  const created = await composioFetch<{ id: string; server_id: string; user_id: string; connect_url?: string }>(`/mcp/servers/${serverId}/instances`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
  // Composio returns the connect URL in a specific format. If connect_url isn't
  // directly in the response, construct it from the known pattern.
  const connectUrl = created.connect_url ?? `https://backend.composio.dev/v3/mcp/${serverId}?user_id=${userId}`;
  return { ...created, connect_url };
}

/**
 * Ensure a Composio MCP server exists with the given auth_config_id, and create
 * a per-user instance. Returns the connectable MCP URL.
 *
 * Called after a successful Composio OAuth connection completes — the console
 * then POSTs this URL to the user's gateway /api/mcp/servers to register it
 * with the running Hermes agent.
 */
export async function ensureComposioMcpForUser(params: {
  authConfigId: string;
  userId: string;
}): Promise<{ mcpUrl: string; serverId: string }> {
  // 1. Find or create the shared MCP server, with this auth_config_id included.
  let server = await findSharedMcpServer();
  if (!server) {
    server = await createSharedMcpServer(params.authConfigId);
  } else {
    // Ensure the auth_config_id is in the server's list (PATCH to append).
    if (!server.auth_config_ids.includes(params.authConfigId)) {
      server = await patchSharedMcpServer(server.id, [...server.auth_config_ids, params.authConfigId]);
    }
  }

  // 2. Create (or re-create) a per-user instance.
  const instance = await createMcpInstance(server.id, params.userId);

  return { mcpUrl: instance.connect_url, serverId: server.id };
}

/**
 * Remove an auth_config_id from the shared MCP server when a user disconnects
 * a toolkit. If no auth_config_ids remain, the server is deleted.
 */
export async function removeToolkitFromSharedMcp(params: {
  authConfigId: string;
}): Promise<void> {
  const server = await findSharedMcpServer();
  if (!server) return;
  const remaining = server.auth_config_ids.filter((id) => id !== params.authConfigId);
  if (remaining.length === 0) {
    await composioFetch(`/mcp/servers/${server.id}`, { method: 'DELETE' });
  } else {
    await patchSharedMcpServer(server.id, remaining);
  }
}
```

**Step 2: Export the `findOrCreateManagedAuthConfigId` so it can be reused**

The function at line 117 is currently module-private. We need to call it from the new flow. Add `export` to the function declaration:

Change line 117 from:
```typescript
async function findOrCreateManagedAuthConfigId(toolkitSlug: string): Promise<string> {
```
to:
```typescript
export async function findOrCreateManagedAuthConfigId(toolkitSlug: string): Promise<string> {
```

**Step 3: Typecheck**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-console2 && npm run typecheck
```

Expected: PASS.

**Step 4: Commit**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-console2 && git add src/lib/composio.ts && git commit -m "feat(composio): add MCP server + instance management for tool wiring"
```

---

### Task 6: Add a gateway MCP registration helper to the console

**Objective:** A server-side helper that POSTs an MCP server URL to the user's runtime gateway (`/api/mcp/servers`), using the existing `instanceCall` from `hermeshq.ts`.

**Files:**
- Modify: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-console2\src\lib\hermeshq.ts`

**Step 1: Add the helper to the `hermeshq` object**

After the existing `listMcpServers` line (line 224), add:

```typescript
  // Register an MCP server on the user's runtime gateway so the Hermes agent
  // can call its tools. The gateway writes it to $HERMES_HOME/config.yaml.
  registerMcpServer: (name: string, url: string, headers?: Record<string, string>) =>
    instanceCall<{ id: string; name: string; enabled: boolean }>('/api/mcp/servers', {
      method: 'POST',
      body: JSON.stringify({
        name,
        enabled: true,
        transport: { type: 'http', url, ...(headers ? { headers } : {}) },
      }),
    }),
  removeMcpServer: (name: string) =>
    instanceCall<void>(`/api/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' }),
```

**Step 2: Typecheck**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-console2 && npm run typecheck
```

Expected: PASS.

**Step 3: Commit**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-console2 && git add src/lib/hermeshq.ts && git commit -m "feat(console): add registerMcpServer/removeMcpServer helpers"
```

---

### Task 7: Wire the MCP registration into the connect + disconnect flows

**Objective:** After a Composio connection completes (OAuth callback returns to the integrations tab), create/update the shared MCP server and register it with the user's gateway. On disconnect, remove it.

**Files:**
- Modify: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-console2\src\app\api\chat\integrations\connect\route.ts`
- Modify: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-console2\src\app\api\chat\integrations\connections\[id]\route.ts`
- Create: `C:\Users\Matve\Desktop\GCAP-Labs\gcaplabs-console2\src\app\api\chat\integrations\register-mcp\route.ts`

**Step 1: Create the register-mcp route (called after OAuth callback)**

The Composio OAuth flow redirects the user to Composio → back to the integrations tab. The `connected_account_id` is known at `initiateConnection` time but the connection may not be `ACTIVE` yet (it's `INITIALIZING`). We need a separate endpoint that the client calls after the redirect lands, to find the auth_config_id and register the MCP server.

Create `src/app/api/chat/integrations/register-mcp/route.ts`:

```typescript
import { findOrCreateManagedAuthConfigId, ensureComposioMcpForUser } from '@/lib/composio';
import { hermeshq } from '@/lib/hermeshq';
import { requireUser } from '@/lib/auth';
import { ApiError, handleError, json, readJson } from '@/lib/http';

export async function POST(request: Request) {
  try {
    const { user } = await requireUser();
    const { toolkit } = await readJson<{ toolkit?: string }>(request);
    if (!toolkit || typeof toolkit !== 'string') {
      throw new ApiError(400, 'invalid_request', 'toolkit is required');
    }

    // 1. Find the (now-connected) auth config for this toolkit.
    const authConfigId = await findOrCreateManagedAuthConfigId(toolkit);

    // 2. Create/update the shared Composio MCP server + per-user instance.
    const { mcpUrl } = await ensureComposioMcpForUser({ authConfigId, userId: user.id });

    // 3. Register the MCP URL on the user's runtime gateway → config.yaml.
    try {
      await hermeshq.registerMcpServer('composio', mcpUrl);
    } catch (e) {
      // If the gateway is unreachable (container not provisioned), don't fail the
      // whole connect flow — the connection is still valid on Composio's side.
      // The MCP registration can be retried. Log but proceed.
      console.warn('[register-mcp] Failed to register on gateway:', e instanceof Error ? e.message : e);
    }

    return json({ ok: true, mcpUrl });
  } catch (e) {
    return handleError(e);
  }
}
```

**Step 2: Update the connect route to return the redirect URL as before**

The existing `connect/route.ts` already initiates the connection and returns `{ redirectUrl, connectedAccountId }`. No change needed — the client redirects to `redirectUrl`, OAuth happens on Composio's side, then returns to the integrations tab. The client then calls `register-mcp` to wire the tool.

**Step 3: Update the disconnect route to also remove the MCP server**

Replace the entire `connections/[id]/route.ts` DELETE handler:

```typescript
import { disconnectAccount, listConnectedAccounts, findOrCreateManagedAuthConfigId, removeToolkitFromSharedMcp } from '@/lib/composio';
import { hermeshq } from '@/lib/hermeshq';
import { requireUser } from '@/lib/auth';
import { ApiError, handleError, json } from '@/lib/http';

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const owned = await listConnectedAccounts(user.id);
    const conn = owned.find((c) => c.id === id);
    if (!conn) {
      throw new ApiError(404, 'not_found', 'Connection not found.');
    }

    // 1. Disconnect on Composio's side.
    await disconnectAccount(id);

    // 2. Remove this toolkit's auth_config from the shared MCP server.
    try {
      const authConfigId = await findOrCreateManagedAuthConfigId(conn.toolkit.slug);
      await removeToolkitFromSharedMcp({ authConfigId });
    } catch {
      // Best-effort — the connection is already disconnected on Composio's side.
    }

    // 3. If the user has no remaining active connections, remove the MCP server
    //    from the gateway. (If other connections remain, the shared MCP server
    //    still has their auth_config_ids and the instance URL is unchanged.)
    const remaining = owned.filter((c) => c.id !== id && c.status.toUpperCase() === 'ACTIVE');
    if (remaining.length === 0) {
      try {
        await hermeshq.removeMcpServer('composio');
      } catch {
        // Best-effort — gateway may be unreachable.
      }
    }

    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
```

**Step 4: Update the ComposioApps component to call register-mcp after redirect**

In `ComposioApps.tsx`, the `handleConnect` function redirects to `redirectUrl`. When the user comes back from OAuth, they land on the integrations tab (the `callbackUrl`). Add a `useEffect` that checks for a `connectedAccountId` in the URL search params and calls `register-mcp`:

Actually — the Composio callback URL is `${origin}${agentTabPath(MANAGED_AGENT_ID, 'integrations')}`. Composio appends `?connected_account_id=...` to the callback. So after redirect, the URL has the `connected_account_id` query param.

Add to `ComposioApps.tsx`, inside the component, after `fetchConnections` effect:

```typescript
  // After OAuth redirect back to this tab, register the MCP server.
  const searchParams = useSearchParams();
  const registeredRef = useRef<string | null>(null);

  useEffect(() => {
    const connectedAccountId = searchParams.get('connected_account_id');
    if (!connectedAccountId || registeredRef.current === connectedAccountId) return;
    registeredRef.current = connectedAccountId;
    // We don't know the toolkit slug from the callback URL alone — Composio
    // only returns connected_account_id. We'll POST with the connectedAccountId
    // and let the server resolve the toolkit from the connection.
    // Actually, we need the toolkit slug. Fetch connections to find it.
    fetchConnections().then((conns) => {
      const conn = conns.find((c) => c.id === connectedAccountId);
      if (!conn) return;
      apiFetch('/api/chat/integrations/register-mcp', {
        method: 'POST',
        body: JSON.stringify({ toolkit: conn.toolkit.slug }),
      }).catch((e) => setError(`MCP registration failed: ${(e as Error).message}`));
    });
  }, [searchParams, fetchConnections]);
```

Wait — `useSearchParams` needs to be imported. It's already imported at line 4 (`import { usePathname, useRouter, useSearchParams } from 'next/navigation';`). Good.

But `ComposioApps` is not currently using `useSearchParams` — let me check. Line 3-4 shows it imports from next/navigation but only uses `useRouter` indirectly via the parent. Actually, `ComposioApps` doesn't currently call `useSearchParams`. Add the import — it's already in the import block but unused. Add the `useSearchParams` call:

At the top of the component, after `const [error, setError] = useState<string | null>(null);` (line 52), add:

```typescript
  const searchParams = useSearchParams();
  const registeredRef = useRef<string | null>(null);
```

Then add the effect described above after the `fetchConnections` effect (after line 68).

**Step 5: Typecheck**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-console2 && npm run typecheck
```

Expected: PASS.

**Step 6: Build**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-console2 && npm run build
```

Expected: compiled successfully.

**Step 7: Commit**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-console2 && git add src/app/api/chat/integrations/register-mcp/route.ts src/app/api/chat/integrations/connections/[id]/route.ts src/components/integrations/ComposioApps.tsx && git commit -m "feat(integrations): wire Composio MCP registration on connect/disconnect"
```

---

## Phase 3: End-to-end verification

### Task 8: Deploy gateway changes to the VPS

**Objective:** The gateway runs inside the per-user Hermes container. The updated `api.ts` + `mcpConfigStore.ts` need to be deployed.

**Files:** (infra — no code changes)

**Step 1: Push the hermeshq changes**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-hermeshq && git push origin main
```

**Step 2: On the VPS, pull + rebuild the runtime image + recreate the container**

This follows the existing VPS workflow documented in mastertodo.md. The runtime image (`headmaster-hermes-runtime:latest`) includes the gateway. After rebuilding, recreate the provisioned container:

```bash
# On the VPS (via hoster/SSH):
cd /home/m4/headmaster-stack
git pull
docker compose build headmaster-hermes-runtime
docker compose up -d headmaster-hermes-runtime
# Recreate the provisioned container onto the new image
# (the exact command depends on the current provision flow)
```

**Step 3: Verify the gateway serves the new MCP route**

```bash
# With a valid forward-auth token:
curl -s https://hm-<id>.gcaplabs.com/api/mcp/servers -H "Authorization: Bearer <token>" | jq .
```

Expected: `{ "servers": [] }` (empty if no MCP servers registered yet).

---

### Task 9: Deploy console changes to Vercel

**Objective:** Push the console changes and let Vercel auto-deploy (or trigger a manual deploy).

**Step 1: Push**

```bash
cd C:/Users/Matve/Desktop/GCAP-Labs/gcaplabs-console2 && git push origin main
```

**Step 2: Verify the register-mcp endpoint responds**

After Vercel deploys (check the Vercel dashboard or `git log` on the Vercel project):

```bash
curl -s https://console.gcaplabs.com/api/chat/integrations/register-mcp -X POST -H "Content-Type: application/json" -d '{"toolkit":"gmail"}' 2>&1 | head
```

Expected: 401 (unauthorized — no session cookie) or 500 (COMPOSIO_API_KEY not set in Vercel env — check it is). Not a 404.

---

### Task 10: End-to-end smoke test — connect Gmail → agent lists emails

**Objective:** The definitive test. Connect Gmail via Composio in the console, then ask the agent to list 3 emails. The agent must call a Gmail MCP tool and return real results.

**Step 1: Log into the console** at `https://console.gcaplabs.com` with `admin@gcaplabs.com`.

**Step 2: Navigate to the Integrations tab** → Browse → search "Gmail" → Connect.

**Step 3: Complete the OAuth flow** — Gmail OAuth consent → redirected back to the integrations tab.

**Step 4: Verify the MCP registration fired** — check the browser network tab for the `POST /api/chat/integrations/register-mcp` call. It should return `{ ok: true, mcpUrl: "https://backend.composio.dev/v3/mcp/..." }`.

**Step 5: Start a new chat session** and send the prompt: "List my 3 most recent emails."

**Step 6: Verify the agent calls a Gmail MCP tool** — the chat should show a tool call (e.g. `gmail_list_emails` or similar), and return real email subjects/senders.

**Step 7: If the agent has no email tool** — check the gateway logs for MCP server loading errors. The MCP URL may need the `transport: streamable_http` hint (Composio's MCP uses Streamable HTTP, not plain HTTP). If so, update `mcpConfigStore.ts` entry construction to set `transport: 'streamable_http'` when the URL contains `composio.dev`, or add a `transport` field to the POST body from the console.

**Step 8: Disconnect Gmail** → verify the MCP server is removed from the gateway (check `GET /api/mcp/servers` returns empty) and the agent can no longer call email tools.

**Step 9: Record the result** in `mastertodo.md` — mark the Composio/MCP gap as resolved or document what remains.

---

## Files likely to change

| File | Change |
|------|--------|
| `gcaplabs-hermeshq/third_party/agent37/gateway/package.json` | Add `yaml` dep |
| `gcaplabs-hermeshq/third_party/agent37/gateway/server/mcpConfigStore.ts` | NEW — config.yaml read-modify-write |
| `gcaplabs-hermeshq/third_party/agent37/gateway/test/mcp-config-store.test.ts` | NEW — unit tests |
| `gcaplabs-hermeshq/third_party/agent37/gateway/server/routes/api.ts` | Rewire MCP handlers to mcpConfigStore |
| `gcaplabs-hermeshq/third_party/agent37/gateway/test/api-compat.integration.test.ts` | Add config.yaml persistence test |
| `gcaplabs-console2/src/lib/composio.ts` | Add MCP server/instance management |
| `gcaplabs-console2/src/lib/hermeshq.ts` | Add registerMcpServer/removeMcpServer |
| `gcaplabs-console2/src/app/api/chat/integrations/register-mcp/route.ts` | NEW — post-OAuth MCP registration |
| `gcaplabs-console2/src/app/api/chat/integrations/connections/[id]/route.ts` | Add MCP teardown on disconnect |
| `gcaplabs-console2/src/components/integrations/ComposioApps.tsx` | Call register-mcp after OAuth redirect |

## Tests / validation

- `mcp-config-store.test.ts` — 5 unit tests (list, upsert, preserve keys, remove, toggle)
- `api-compat.integration.test.ts` — existing + new config.yaml persistence test
- Gateway typecheck: `npm run typecheck`
- Gateway tests: `npm test`
- Console typecheck: `npm run typecheck`
- Console build: `npm run build`
- **End-to-end**: connect Gmail → ask agent to list emails → verify tool call (Task 10)

## Risks, tradeoffs, and open questions

1. **Composio MCP transport type** — Composio's MCP server uses Streamable HTTP, not plain HTTP. Hermes' `mcp_tool.py` defaults to Streamable HTTP for `url` entries (no `transport` field needed). If the default doesn't work, we may need to explicitly set `transport: 'streamable_http'` in the config entry. The current plan doesn't set it (relies on Hermes' default), but Task 10 Step 7 has the fallback.

2. **Auth config deduplication** — `findOrCreateManagedAuthConfigId` is per-toolkit, shared across all users (Composio-managed). This means the same auth_config_id is used for all users connecting the same toolkit. The per-user scoping happens at the MCP *instance* level (`user_id` = Supabase user id), not the auth_config level. This is correct — the auth_config defines *how* to authenticate (Composio's managed OAuth app), the instance defines *whose* connection to use.

3. **Gateway container restart** — when `config.yaml` is written, the Hermes worker reads it on the next session start (it caches config per-session). An existing running session won't pick up the new MCP server until a new session is created. The console's chat flow already creates new sessions per conversation, so this should work naturally. If not, a worker restart may be needed (document in Task 10).

4. **Composio MCP API contract** — the exact response shape of `POST /mcp/servers`, `PATCH /mcp/servers/{id}`, and `POST /mcp/servers/{id}/instances` is based on the mastertodo notes (lines 90-94) and the OpenAPI spec. The `connect_url` field name and format may differ — if the `createMcpInstance` response doesn't include a `connect_url`, the fallback constructs it from `https://backend.composio.dev/v3/mcp/{serverId}?user_id={userId}`. Verify against the live API during Task 10.

5. **Shared MCP server name collision** — `SHARED_MCP_SERVER_NAME = 'headmaster-shared'` is used across all console users. If multiple users connect different toolkits, the shared server accumulates all auth_config_ids. This is intentional — each user's instance only exposes the toolkits they connected (scoped by `user_id`). But if Composio's instance doesn't filter by auth_config_id per user, a user might see tools for toolkits they didn't connect. Verify during Task 10.

6. **DEFAULT: execution mode** — the plan assumes in-context checkpoint execution (report after each task, wait for `continue`). If the user prefers autonomous subagent dispatch instead, switch to `subagent-driven-development` mode. The plan is structured for either.

7. **DEFAULT: Composio MCP server deletion on last disconnect** — when the last active connection is removed, the plan deletes the shared MCP server from the gateway AND calls `removeToolkitFromSharedMcp` which may DELETE the Composio MCP server entirely. This is aggressive — if another user is using a different toolkit through the same shared server, deleting it breaks them. The fix: only delete the Composio server if `remaining.length === 0` globally (not just for this user). But we can't easily check global connections from the console (each user only sees their own). Safer: always PATCH to remove the auth_config_id, never DELETE the Composio server. Let Composio's own lifecycle handle it. **Open question for the user**: aggressive cleanup or leave the shared server alive?