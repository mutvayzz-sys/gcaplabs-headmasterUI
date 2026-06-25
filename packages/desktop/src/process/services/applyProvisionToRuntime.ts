/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { app } from 'electron';
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

export function applyProvisionToRuntime(provision: HermeshqProvisionSnapshot): void {
  try {
    const home = resolveHermesHome();
    applyHonchoConfig(home, provision);
  } catch (err) {
    console.warn('[applyProvisionToRuntime] failed to apply provision to runtime config:', err);
  }
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
    const hosts = (typeof current.hosts === 'object' && current.hosts !== null
      ? current.hosts
      : {}) as Record<string, unknown>;
    const existing = (typeof hosts[honchoUrl] === 'object' && hosts[honchoUrl] !== null
      ? hosts[honchoUrl]
      : {}) as Record<string, unknown>;
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
