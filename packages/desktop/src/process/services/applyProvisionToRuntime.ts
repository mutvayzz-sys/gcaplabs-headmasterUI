/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { HermeshqProvisionSnapshot } from '../connection/connectionConfig';

function resolveHermesHome(): string {
  if (process.env.HERMES_HOME) return process.env.HERMES_HOME;
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
    const headmasterPath = join(localAppData, 'Headmaster', 'runtime');
    if (existsSync(headmasterPath)) return headmasterPath;
    const legacyPath = join(localAppData, 'hermes');
    if (existsSync(legacyPath)) return legacyPath;
    return headmasterPath;
  }
  const headmasterPath = join(homedir(), '.headmaster', 'runtime');
  if (existsSync(headmasterPath)) return headmasterPath;
  const legacyPath = join(homedir(), '.hermes');
  if (existsSync(legacyPath)) return legacyPath;
  return headmasterPath;
}

function readJson(filePath: string): Record<string, unknown> {
  try {
    if (!existsSync(filePath)) return {};
    return JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeJson(filePath: string, data: Record<string, unknown>): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  renameSync(tmp, filePath);
}

export interface ApplyProvisionResult {
  apiServerKey: string | null;
  /** True when runtime_env entries were written — the Hermes process must restart to pick them up. */
  needsRestart: boolean;
}

/** Applies provision snapshot to the local Hermes runtime config/env files. */
export function applyProvisionToRuntime(provision: HermeshqProvisionSnapshot): ApplyProvisionResult {
  try {
    const home = resolveHermesHome();
    applyHonchoConfig(home, provision);
    applyModelConfig(home, provision);
    return applyNousConfig(home, provision);
  } catch (err) {
    console.warn('[applyProvisionToRuntime] failed to apply provision to runtime config:', err);
    return { apiServerKey: null, needsRestart: false };
  }
}

function applyModelConfig(hermesHome: string, provision: HermeshqProvisionSnapshot): void {
  const updates: Record<string, string> = {};
  if (provision.default_model) updates['default'] = provision.default_model;
  if (provision.default_provider) updates['provider'] = provision.default_provider;
  if (provision.default_base_url) updates['base_url'] = provision.default_base_url;
  if (Object.keys(updates).length === 0) return;

  const configPath = join(hermesHome, 'config.yaml');
  if (!existsSync(configPath)) return;

  let content: string;
  try {
    content = readFileSync(configPath, 'utf-8');
  } catch {
    return;
  }

  const patched = patchModelSection(content, updates);
  if (patched === content) return;

  const tmp = `${configPath}.tmp`;
  writeFileSync(tmp, patched, 'utf-8');
  renameSync(tmp, configPath);
  console.log('[applyProvisionToRuntime] config.yaml model section updated:', updates);
}

/**
 * Patch specific keys inside the `model:` YAML section using plain string
 * replacement so we don't need to parse/serialize the entire file.
 * Only replaces lines that already exist in the section.
 */
function patchModelSection(content: string, updates: Record<string, string>): string {
  // Locate the model: section header
  const modelHeaderIdx = content.indexOf('\nmodel:\n');
  let sectionStart: number;
  let afterHeader: number;
  if (modelHeaderIdx === -1) {
    if (!content.startsWith('model:\n')) return content;
    sectionStart = 0;
    afterHeader = 'model:\n'.length;
  } else {
    sectionStart = modelHeaderIdx + 1;
    afterHeader = sectionStart + 'model:\n'.length;
  }

  // End of section = first line that is not blank and not indented
  const remaining = content.slice(afterHeader);
  const nextTopLevel = remaining.match(/\n[a-zA-Z]/);
  const sectionEnd = nextTopLevel?.index !== undefined ? afterHeader + nextTopLevel.index + 1 : content.length;

  const before = content.slice(0, sectionStart);
  let block = content.slice(sectionStart, sectionEnd);
  const after = content.slice(sectionEnd);

  for (const [key, value] of Object.entries(updates)) {
    block = block.replace(new RegExp(`^([ \\t]+${key}:)[ \\t]*.*$`, 'm'), `$1 "${value}"`);
  }

  return before + block + after;
}

/**
 * Writes NOUS_API_KEY + API_SERVER_ENABLED/KEY to the runtime .env and enables
 * tool gateway flags in config.yaml. Returns the API server key so the main
 * process can expose it to the renderer via IPC (like __backendPort).
 *
 * For headmaster_remote the key comes from the provision snapshot (container
 * generated it); for headmaster_local we generate one ourselves.
 */
function applyNousConfig(hermesHome: string, provision: HermeshqProvisionSnapshot): ApplyProvisionResult {
  const envPath = join(hermesHome, '.env');
  if (!existsSync(envPath)) return { apiServerKey: null, needsRestart: false };

  let env = readFileSync(envPath, 'utf-8');

  // NOUS_API_KEY — enables models + tools via Nous Portal
  if (provision.nous_api_key) {
    env = patchEnvLine(env, 'NOUS_API_KEY', provision.nous_api_key);
  }

  // Inject any provider API keys shipped by HermesHQ (e.g. KIMI_API_KEY)
  const runtimeEnvKeys = Object.keys(provision.runtime_env ?? {});
  if (runtimeEnvKeys.length > 0) {
    for (const [key, value] of Object.entries(provision.runtime_env!)) {
      env = patchEnvLine(env, key, value);
    }
    console.log('[applyProvisionToRuntime] runtime_env injected:', runtimeEnvKeys.join(', '));
  }

  // API server key — used to authenticate Runs API calls from the desktop
  let apiServerKey: string | null = null;
  if (provision.mode === 'headmaster_remote') {
    apiServerKey = provision.cloud_container_config?.api_server_key ?? null;
    // For remote containers the API server runs inside Docker; no local .env to write.
  } else {
    // Local mode: ensure the runtime API server is enabled with a stable key.
    // Read the existing key if already set so we don't rotate it on every login.
    const existingMatch = env.match(/^API_SERVER_KEY=(.+)$/m);
    apiServerKey = existingMatch ? existingMatch[1].trim() : randomBytes(32).toString('hex');
    env = patchEnvLine(env, 'API_SERVER_ENABLED', 'true');
    env = patchEnvLine(env, 'API_SERVER_KEY', apiServerKey);
  }

  const tmp = `${envPath}.tmp`;
  writeFileSync(tmp, env, 'utf-8');
  renameSync(tmp, envPath);
  console.log(
    '[applyProvisionToRuntime] .env updated (nous_api_key=%s, api_server_key=%s, runtime_env_keys=%d)',
    !!provision.nous_api_key,
    !!apiServerKey,
    runtimeEnvKeys.length
  );

  // Enable tool gateway in config.yaml if NOUS_API_KEY was provided
  if (provision.nous_api_key) {
    const configPath = join(hermesHome, 'config.yaml');
    if (existsSync(configPath)) {
      let cfg = readFileSync(configPath, 'utf-8');
      cfg = ensureYamlSection(cfg, 'web', 'use_gateway', 'true');
      cfg = ensureYamlSection(cfg, 'image_gen', 'use_gateway', 'true');
      const tmpCfg = `${configPath}.tmp`;
      writeFileSync(tmpCfg, cfg, 'utf-8');
      renameSync(tmpCfg, configPath);
      console.log('[applyProvisionToRuntime] config.yaml tool gateway enabled');
    }
  }

  return { apiServerKey, needsRestart: runtimeEnvKeys.length > 0 };
}

function patchEnvLine(content: string, key: string, value: string): string {
  const re = new RegExp(`^(#\\s*)?${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  return re.test(content) ? content.replace(re, line) : `${content}\n${line}\n`;
}

function ensureYamlSection(content: string, section: string, key: string, value: string): string {
  const keyRe = new RegExp(`(^${section}:\\n(?:[ \\t][^\\n]*\\n)*)  ${key}:[^\\n]*`, 'm');
  if (keyRe.test(content)) {
    return content.replace(keyRe, (m) => m.replace(new RegExp(`  ${key}:[^\\n]*`), `  ${key}: ${value}`));
  }
  // Section header exists but key is missing — append key inside section
  const sectionRe = new RegExp(`^${section}:`, 'm');
  if (sectionRe.test(content)) {
    return content.replace(sectionRe, `${section}:\n  ${key}: ${value}`);
  }
  // Section doesn't exist — append it
  return `${content}\n${section}:\n  ${key}: ${value}\n`;
}

function applyHonchoConfig(hermesHome: string, provision: HermeshqProvisionSnapshot): void {
  const honchoPath = join(hermesHome, 'honcho.json');
  const current = readJson(honchoPath);

  const peerName = provision.session_namespace ?? null;
  const honchoUrl = provision.honcho_base_url ?? null;
  const honchoApiKey = provision.honcho_api_key ?? null;

  let changed = false;

  if (peerName && current.peerName !== peerName) {
    current.peerName = peerName;
    changed = true;
  }

  if (honchoUrl && honchoApiKey) {
    const hosts = (typeof current.hosts === 'object' && current.hosts !== null ? current.hosts : {}) as Record<
      string,
      unknown
    >;
    const existing = (
      typeof hosts[honchoUrl] === 'object' && hosts[honchoUrl] !== null ? hosts[honchoUrl] : {}
    ) as Record<string, unknown>;
    if (existing.apiKey !== honchoApiKey) {
      hosts[honchoUrl] = { ...existing, apiKey: honchoApiKey };
      current.hosts = hosts;
      changed = true;
    }
  }

  if (changed) {
    writeJson(honchoPath, current);
    console.log('[applyProvisionToRuntime] honcho.json updated for peer:', peerName);
  }
}
