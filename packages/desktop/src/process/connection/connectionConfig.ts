/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, safeStorage } from 'electron';

const SAFE_PREFIX = 'safe:';

export type ConnectionMode = 'local' | 'remote';

export interface RemoteConnectionConfig {
  host: string;
  port: number;
  token: string;
}

export interface Agent37Config {
  /** Base URL of the Agent37 server, e.g. "https://yourserver.com" or "http://192.168.1.x:3420" */
  url: string;
  /** Stored JWT from the last successful login — used for auto-login on next launch */
  token: string;
  provision?: Agent37ProvisionSnapshot | null;
}

export interface Agent37ProvisionProvider {
  slug: string;
  name: string;
  runtime_provider: string;
  auth_type: string;
  base_url: string | null;
  default_model: string | null;
  available_models: string[];
  enabled: boolean;
}

export interface Agent37ProvisionAppSettings {
  app_name: string;
  app_short_name: string;
  theme_mode: string;
  default_locale: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  has_logo?: boolean;
  has_favicon?: boolean;
}

export interface Agent37ProvisionSnapshot {
  mode: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
  capabilities: string[];
  runtime: {
    base_url?: string | null;
    api_base_path?: string | null;
    health_url?: string | null;
    validate_url: string;
    version_url?: string | null;
    ttl_seconds: number;
  };
  local_container_config?: {
    endpoint_url: string;
    container_id: string;
  } | null;
  cloud_container_config?: {
    endpoint_url: string | null;
    container_id: string;
    api_server_key?: string | null;
    forward_auth_token?: string | null;
    forward_auth_expires_at?: string | null;
  } | null;
  system_prompt_override?: string | null;
  session_namespace?: string | null;
  honcho_base_url?: string | null;
  honcho_api_key?: string | null;
  nous_api_key?: string | null;
  runtime_env?: Record<string, string> | null;
  providers?: Agent37ProvisionProvider[];
  default_model?: string | null;
  default_provider?: string | null;
  default_base_url?: string | null;
  app_settings?: Agent37ProvisionAppSettings | null;
  client?: string;
  version?: string;
  platform?: string;
  refreshed_at?: string;
}

interface ConnectionConfigFile {
  mode: ConnectionMode;
  remote: RemoteConnectionConfig;
  agent37: Agent37Config;
}

const DEFAULT_REMOTE_CONFIG: RemoteConnectionConfig = { host: '', port: 9119, token: '' };
const DEFAULT_AGENT37_CONFIG: Agent37Config = { url: '', token: '' };
const DEFAULT_CONFIG: ConnectionConfigFile = {
  mode: 'local',
  remote: DEFAULT_REMOTE_CONFIG,
  agent37: DEFAULT_AGENT37_CONFIG,
};

function getConfigPath(): string {
  return join(app.getPath('userData'), 'connection-config.json');
}

function normalizeHost(host: string): string {
  return host
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .split('/')[0];
}

function normalizeRemoteConfig(config: Partial<RemoteConnectionConfig> | undefined): RemoteConnectionConfig {
  const port = Number(config?.port);
  return {
    host: normalizeHost(typeof config?.host === 'string' ? config.host : ''),
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_REMOTE_CONFIG.port,
    token: typeof config?.token === 'string' ? config.token : '',
  };
}

function encryptToken(token: string): string {
  try {
    if (token && safeStorage.isEncryptionAvailable()) {
      return SAFE_PREFIX + safeStorage.encryptString(token).toString('base64');
    }
  } catch {
    // fall through to plain text
  }
  return token;
}

function decryptToken(stored: string): string {
  try {
    if (stored.startsWith(SAFE_PREFIX) && safeStorage.isEncryptionAvailable()) {
      const buf = Buffer.from(stored.slice(SAFE_PREFIX.length), 'base64');
      return safeStorage.decryptString(buf);
    }
  } catch {
    // corrupted — treat as empty so the user gets prompted to log in again
    return '';
  }
  return stored;
}

function normalizeAgent37Config(config: Partial<Agent37Config> | undefined): Agent37Config {
  const rawToken = typeof config?.token === 'string' ? config.token : '';
  return {
    url: typeof config?.url === 'string' ? config.url.trim().replace(/\/$/, '') : '',
    token: decryptToken(rawToken),
    provision: normalizeProvisionSnapshot(config?.provision),
  };
}

function normalizeProvisionSnapshot(
  snapshot: Partial<Agent37ProvisionSnapshot> | null | undefined
): Agent37ProvisionSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const user = snapshot.user;
  const runtime = snapshot.runtime;
  const capabilities = Array.isArray(snapshot.capabilities)
    ? snapshot.capabilities.filter(
        (capability): capability is string => typeof capability === 'string' && capability.length > 0
      )
    : [];
  if (!user || typeof user.id !== 'string' || typeof user.username !== 'string' || typeof user.role !== 'string') {
    return null;
  }
  if (!runtime || typeof runtime.validate_url !== 'string') {
    return null;
  }
  const normalized: Agent37ProvisionSnapshot = {
    mode: typeof snapshot.mode === 'string' ? snapshot.mode : 'headmaster_local',
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    capabilities,
    runtime: {
      base_url: typeof runtime.base_url === 'string' ? runtime.base_url : null,
      api_base_path: typeof runtime.api_base_path === 'string' ? runtime.api_base_path : null,
      health_url: typeof runtime.health_url === 'string' ? runtime.health_url : null,
      validate_url: runtime.validate_url,
      version_url: typeof runtime.version_url === 'string' ? runtime.version_url : null,
      ttl_seconds: Number.isFinite(Number(runtime.ttl_seconds)) ? Number(runtime.ttl_seconds) : 0,
    },
    client: typeof snapshot.client === 'string' ? snapshot.client : undefined,
    version: typeof snapshot.version === 'string' ? snapshot.version : undefined,
    platform: typeof snapshot.platform === 'string' ? snapshot.platform : undefined,
    refreshed_at: typeof snapshot.refreshed_at === 'string' ? snapshot.refreshed_at : undefined,
  };
  // Optional new fields from Phase 1+2 provision contract
  if (snapshot.local_container_config && typeof snapshot.local_container_config === 'object') {
    const lcc = snapshot.local_container_config as Record<string, unknown>;
    if (typeof lcc.endpoint_url === 'string' && typeof lcc.container_id === 'string') {
      normalized.local_container_config = { endpoint_url: lcc.endpoint_url, container_id: lcc.container_id };
    }
  }
  if (snapshot.cloud_container_config && typeof snapshot.cloud_container_config === 'object') {
    const ccc = snapshot.cloud_container_config as Record<string, unknown>;
    if (typeof ccc.container_id === 'string') {
      normalized.cloud_container_config = {
        endpoint_url: typeof ccc.endpoint_url === 'string' ? ccc.endpoint_url : null,
        container_id: ccc.container_id,
        api_server_key: typeof ccc.api_server_key === 'string' ? ccc.api_server_key : null,
        forward_auth_token: typeof ccc.forward_auth_token === 'string' ? ccc.forward_auth_token : null,
        forward_auth_expires_at: typeof ccc.forward_auth_expires_at === 'string' ? ccc.forward_auth_expires_at : null,
      };
    }
  }
  if (typeof snapshot.system_prompt_override === 'string') {
    normalized.system_prompt_override = snapshot.system_prompt_override;
  }
  if (typeof snapshot.session_namespace === 'string') {
    normalized.session_namespace = snapshot.session_namespace;
  }
  if (typeof snapshot.honcho_base_url === 'string') {
    normalized.honcho_base_url = snapshot.honcho_base_url;
  }
  if (typeof snapshot.honcho_api_key === 'string') {
    normalized.honcho_api_key = snapshot.honcho_api_key;
  }
  if (typeof snapshot.nous_api_key === 'string') {
    normalized.nous_api_key = snapshot.nous_api_key;
  }
  if (snapshot.runtime_env && typeof snapshot.runtime_env === 'object' && !Array.isArray(snapshot.runtime_env)) {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(snapshot.runtime_env)) {
      if (typeof k === 'string' && typeof v === 'string') env[k] = v;
    }
    if (Object.keys(env).length > 0) normalized.runtime_env = env;
  }
  // Provider catalog + default model from provision response
  if (Array.isArray(snapshot.providers)) {
    normalized.providers = snapshot.providers
      .filter(
        (p): p is Agent37ProvisionProvider =>
          p !== null && typeof p === 'object' && typeof p.slug === 'string' && typeof p.name === 'string'
      )
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        runtime_provider: p.runtime_provider,
        auth_type: p.auth_type,
        base_url: p.base_url ?? null,
        default_model: p.default_model ?? null,
        available_models: Array.isArray(p.available_models)
          ? p.available_models.filter((m) => typeof m === 'string')
          : [],
        enabled: p.enabled !== false,
      }));
  }
  if (typeof snapshot.default_model === 'string') {
    normalized.default_model = snapshot.default_model;
  }
  if (typeof snapshot.default_provider === 'string') {
    normalized.default_provider = snapshot.default_provider;
  }
  if (typeof snapshot.default_base_url === 'string') {
    normalized.default_base_url = snapshot.default_base_url;
  }
  return normalized;
}

function readConfig(): ConnectionConfigFile {
  try {
    const path = getConfigPath();
    if (!existsSync(path))
      return { ...DEFAULT_CONFIG, remote: { ...DEFAULT_REMOTE_CONFIG }, agent37: { ...DEFAULT_AGENT37_CONFIG } };
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<ConnectionConfigFile>;
    return {
      mode: parsed.mode === 'remote' ? 'remote' : 'local',
      remote: normalizeRemoteConfig(parsed.remote),
      agent37: normalizeAgent37Config(parsed.agent37),
    };
  } catch (err) {
    console.warn('[connection-config] failed to read config, using defaults', err);
    return { ...DEFAULT_CONFIG, remote: { ...DEFAULT_REMOTE_CONFIG }, agent37: { ...DEFAULT_AGENT37_CONFIG } };
  }
}

function writeConfig(config: ConnectionConfigFile): void {
  const path = getConfigPath();
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(config, null, 2), 'utf-8');
  renameSync(tmp, path);
}

export function getConnectionMode(): ConnectionMode {
  return readConfig().mode;
}

export function setConnectionMode(mode: ConnectionMode): void {
  const config = readConfig();
  writeConfig({ ...config, mode: mode === 'remote' ? 'remote' : 'local' });
}

export function getRemoteConfig(): RemoteConnectionConfig {
  return readConfig().remote;
}

export function setRemoteConfig(remote: RemoteConnectionConfig): void {
  const config = readConfig();
  writeConfig({ ...config, remote: normalizeRemoteConfig(remote) });
}

export function getAgent37Config(): Agent37Config {
  return readConfig().agent37;
}

export function setAgent37Url(url: string): void {
  const config = readConfig();
  writeConfig({ ...config, agent37: { ...config.agent37, url: url.trim().replace(/\/$/, '') } });
}

export function setAgent37Token(token: string): void {
  const config = readConfig();
  writeConfig({ ...config, agent37: { ...config.agent37, token: encryptToken(token) } });
}

export function clearAgent37Token(): void {
  const config = readConfig();
  writeConfig({ ...config, agent37: { ...config.agent37, token: '' } });
}

export function getAgent37Provision(): Agent37ProvisionSnapshot | null {
  return readConfig().agent37.provision ?? null;
}

export function setAgent37Provision(provision: Agent37ProvisionSnapshot): void {
  const config = readConfig();
  writeConfig({ ...config, agent37: { ...config.agent37, provision: normalizeProvisionSnapshot(provision) } });
}

export function clearAgent37Provision(): void {
  const config = readConfig();
  writeConfig({ ...config, agent37: { ...config.agent37, provision: null } });
}

