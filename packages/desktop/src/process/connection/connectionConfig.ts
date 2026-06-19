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

interface ConnectionConfigFile {
  mode: ConnectionMode;
  remote: RemoteConnectionConfig;
}

const DEFAULT_REMOTE_CONFIG: RemoteConnectionConfig = { host: '', port: 9119, token: '' };
const DEFAULT_CONFIG: ConnectionConfigFile = {
  mode: 'local',
  remote: DEFAULT_REMOTE_CONFIG,
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

function readConfig(): ConnectionConfigFile {
  try {
    const path = getConfigPath();
    if (!existsSync(path)) return { ...DEFAULT_CONFIG, remote: { ...DEFAULT_REMOTE_CONFIG } };
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<ConnectionConfigFile>;
    return {
      mode: parsed.mode === 'remote' ? 'remote' : 'local',
      remote: normalizeRemoteConfig(parsed.remote),
    };
  } catch (err) {
    console.warn('[connection-config] failed to read config, using defaults', err);
    return { ...DEFAULT_CONFIG, remote: { ...DEFAULT_REMOTE_CONFIG } };
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
