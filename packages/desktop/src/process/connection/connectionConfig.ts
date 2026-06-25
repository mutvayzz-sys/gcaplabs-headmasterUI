/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

export type ConnectionMode = 'local' | 'remote';

export interface RemoteConnectionConfig {
  host: string;
  port: number;
  token: string;
}

export interface HermeshqConfig {
  /** Base URL of the HermesHQ server, e.g. "https://yourserver.com" or "http://192.168.1.x:3420" */
  url: string;
  /** Stored JWT from the last successful login — used for auto-login on next launch */
  token: string;
  provision?: HermeshqProvisionSnapshot | null;
}

export interface HermeshqProvisionSnapshot {
  mode: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
  capabilities: string[];
  runtime: {
    validate_url: string;
    ttl_seconds: number;
  };
  client?: string;
  version?: string;
  platform?: string;
  refreshed_at?: string;
}

interface ConnectionConfigFile {
  mode: ConnectionMode;
  remote: RemoteConnectionConfig;
  hermeshq: HermeshqConfig;
}

const DEFAULT_REMOTE_CONFIG: RemoteConnectionConfig = { host: '', port: 9119, token: '' };
const DEFAULT_HERMESHQ_CONFIG: HermeshqConfig = { url: '', token: '' };
const DEFAULT_CONFIG: ConnectionConfigFile = {
  mode: 'local',
  remote: DEFAULT_REMOTE_CONFIG,
  hermeshq: DEFAULT_HERMESHQ_CONFIG,
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

function normalizeHermeshqConfig(config: Partial<HermeshqConfig> | undefined): HermeshqConfig {
  return {
    url: typeof config?.url === 'string' ? config.url.trim().replace(/\/$/, '') : '',
    token: typeof config?.token === 'string' ? config.token : '',
    provision: normalizeProvisionSnapshot(config?.provision),
  };
}

function normalizeProvisionSnapshot(snapshot: Partial<HermeshqProvisionSnapshot> | null | undefined): HermeshqProvisionSnapshot | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const user = snapshot.user;
  const runtime = snapshot.runtime;
  const capabilities = Array.isArray(snapshot.capabilities)
    ? snapshot.capabilities.filter((capability): capability is string => typeof capability === 'string' && capability.length > 0)
    : [];
  if (!user || typeof user.id !== 'string' || typeof user.username !== 'string' || typeof user.role !== 'string') {
    return null;
  }
  if (!runtime || typeof runtime.validate_url !== 'string') {
    return null;
  }
  return {
    mode: typeof snapshot.mode === 'string' ? snapshot.mode : 'headmaster_local',
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    capabilities,
    runtime: {
      validate_url: runtime.validate_url,
      ttl_seconds: Number.isFinite(Number(runtime.ttl_seconds)) ? Number(runtime.ttl_seconds) : 0,
    },
    client: typeof snapshot.client === 'string' ? snapshot.client : undefined,
    version: typeof snapshot.version === 'string' ? snapshot.version : undefined,
    platform: typeof snapshot.platform === 'string' ? snapshot.platform : undefined,
    refreshed_at: typeof snapshot.refreshed_at === 'string' ? snapshot.refreshed_at : undefined,
  };
}

function readConfig(): ConnectionConfigFile {
  try {
    const path = getConfigPath();
    if (!existsSync(path)) return { ...DEFAULT_CONFIG, remote: { ...DEFAULT_REMOTE_CONFIG }, hermeshq: { ...DEFAULT_HERMESHQ_CONFIG } };
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<ConnectionConfigFile>;
    return {
      mode: parsed.mode === 'remote' ? 'remote' : 'local',
      remote: normalizeRemoteConfig(parsed.remote),
      hermeshq: normalizeHermeshqConfig(parsed.hermeshq),
    };
  } catch (err) {
    console.warn('[connection-config] failed to read config, using defaults', err);
    return { ...DEFAULT_CONFIG, remote: { ...DEFAULT_REMOTE_CONFIG }, hermeshq: { ...DEFAULT_HERMESHQ_CONFIG } };
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

export function getHermeshqConfig(): HermeshqConfig {
  return readConfig().hermeshq;
}

export function setHermeshqUrl(url: string): void {
  const config = readConfig();
  writeConfig({ ...config, hermeshq: { ...config.hermeshq, url: url.trim().replace(/\/$/, '') } });
}

export function setHermeshqToken(token: string): void {
  const config = readConfig();
  writeConfig({ ...config, hermeshq: { ...config.hermeshq, token } });
}

export function clearHermeshqToken(): void {
  const config = readConfig();
  writeConfig({ ...config, hermeshq: { ...config.hermeshq, token: '' } });
}

export function getHermeshqProvision(): HermeshqProvisionSnapshot | null {
  return readConfig().hermeshq.provision ?? null;
}

export function setHermeshqProvision(provision: HermeshqProvisionSnapshot): void {
  const config = readConfig();
  writeConfig({ ...config, hermeshq: { ...config.hermeshq, provision: normalizeProvisionSnapshot(provision) } });
}

export function clearHermeshqProvision(): void {
  const config = readConfig();
  writeConfig({ ...config, hermeshq: { ...config.hermeshq, provision: null } });
}
