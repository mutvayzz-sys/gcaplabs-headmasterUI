/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resolve the GCAPCore binary path for the Council / ACP sidecar.
 *
 * Search order:
 *  1. HEADMASTER_GCAPCORE_BINARY env override (dev)
 *  2. Bundled GCAPCore path (production)
 *  3. Dev-staged resources/bundled-gcapcore
 *  4. Legacy dev-staged resources/bundled-aioncore, for upstream artifact prep
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const BINARY_NAME = 'gcapcore';
const LEGACY_BINARY_NAME = 'aioncore';
const MAX_DIR_ENTRIES = 20;

type BackendBinaryResolveDiagnostics = {
  resourcesPath?: string;
  runtimeKey: string;
  binaryName: string;
  checkedBundledPath?: string;
  bundledDirExists?: boolean;
  runtimeDirExists?: boolean;
  resourcesDirEntries?: string[];
  runtimeDirEntries?: string[];
  overridePath?: string;
};

class BackendBinaryResolveError extends Error {
  readonly diagnostics: BackendBinaryResolveDiagnostics;

  constructor(message: string, diagnostics: BackendBinaryResolveDiagnostics) {
    super(message);
    this.name = 'BackendBinaryResolveError';
    this.diagnostics = diagnostics;
  }
}

function getBinaryName(baseName = BINARY_NAME): string {
  return process.platform === 'win32' ? `${baseName}.exe` : baseName;
}

function getRuntimeKey(): string {
  return `${process.platform}-${process.arch}`;
}

function listDirEntries(dirPath: string): string[] | undefined {
  try {
    return readdirSync(dirPath, { withFileTypes: true })
      .slice(0, MAX_DIR_ENTRIES)
      .map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`);
  } catch {
    return undefined;
  }
}

export function resolveGcapcoreBinaryPath(): string {
  const runtimeKey = getRuntimeKey();
  const binaryName = getBinaryName();
  const diagnostics: BackendBinaryResolveDiagnostics = {
    runtimeKey,
    binaryName,
  };

  const override = process.env.HEADMASTER_GCAPCORE_BINARY?.trim() || process.env.HEADMASTER_AIONCORE_BINARY?.trim();
  if (override) {
    diagnostics.overridePath = override;
    if (existsSync(override)) return override;
  }

  const bundled = bundledPath(runtimeKey, diagnostics);
  if (bundled) return bundled;

  const devBundled = devBundledPath(runtimeKey, diagnostics);
  if (devBundled) return devBundled;

  throw new BackendBinaryResolveError(
    `Cannot find "${BINARY_NAME}" binary. Checked HEADMASTER_GCAPCORE_BINARY, bundled GCAPCore resources, and dev staging paths.`,
    diagnostics
  );
}

function bundledPath(runtimeKey: string, diagnostics: BackendBinaryResolveDiagnostics): string | null {
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (!resourcesPath) return null;
  diagnostics.resourcesPath = resourcesPath;

  const bundledDir = join(resourcesPath, 'bundled-gcapcore');
  for (const binaryName of [getBinaryName(), getBinaryName(LEGACY_BINARY_NAME)]) {
    const runtimeDir = join(bundledDir, runtimeKey);
    const candidate = join(runtimeDir, binaryName);
    diagnostics.checkedBundledPath = candidate;
    diagnostics.bundledDirExists = existsSync(bundledDir);
    diagnostics.runtimeDirExists = existsSync(runtimeDir);
    diagnostics.resourcesDirEntries = listDirEntries(resourcesPath);
    diagnostics.runtimeDirEntries = listDirEntries(runtimeDir);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function devBundledPath(runtimeKey: string, diagnostics: BackendBinaryResolveDiagnostics): string | null {
  const roots = new Set<string>();
  if (process.env.HEADMASTER_PROJECT_ROOT?.trim()) {
    roots.add(resolve(process.env.HEADMASTER_PROJECT_ROOT.trim()));
  }
  roots.add(resolve(process.cwd()));
  let dir = __dirname;
  for (let depth = 0; depth < 8; depth += 1) {
    roots.add(resolve(dir));
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }

  for (const root of roots) {
    for (const baseDirName of ['bundled-gcapcore', 'bundled-aioncore']) {
      for (const binaryName of [getBinaryName(), getBinaryName(LEGACY_BINARY_NAME)]) {
        const candidate = join(root, 'resources', baseDirName, runtimeKey, binaryName);
        if (existsSync(candidate)) {
          diagnostics.checkedBundledPath = candidate;
          return candidate;
        }
      }
    }
  }
  return null;
}

export type { BackendBinaryResolveDiagnostics };
