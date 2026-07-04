import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveGcapcoreBinaryPath } from '@/process/backend/gcapcoreBinaryResolver';

const runtimeKey = `${process.platform}-${process.arch}`;
const binaryName = process.platform === 'win32' ? 'gcapcore.exe' : 'gcapcore';
const legacyBinaryName = process.platform === 'win32' ? 'aioncore.exe' : 'aioncore';
const originalResourcesPathDescriptor = Object.getOwnPropertyDescriptor(process, 'resourcesPath');
const originalProjectRoot = process.env.HEADMASTER_PROJECT_ROOT;

function touch(filePath: string) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, 'stub');
}

function setResourcesPath(resourcesPath: string) {
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    value: resourcesPath,
  });
}

describe('resolveGcapcoreBinaryPath', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'headmaster-gcapcore-resolver-'));
    process.env.HEADMASTER_PROJECT_ROOT = join(tempRoot, 'project');
    delete process.env.HEADMASTER_GCAPCORE_BINARY;
    delete process.env.HEADMASTER_AIONCORE_BINARY;
  });

  afterEach(() => {
    rmSync(tempRoot, { recursive: true, force: true });
    if (originalResourcesPathDescriptor) {
      Object.defineProperty(process, 'resourcesPath', originalResourcesPathDescriptor);
    } else {
      delete (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
    }
    if (originalProjectRoot === undefined) {
      delete process.env.HEADMASTER_PROJECT_ROOT;
    } else {
      process.env.HEADMASTER_PROJECT_ROOT = originalProjectRoot;
    }
  });

  it('resolves packaged GCAPCore resources from resourcesPath', () => {
    const resourcesPath = join(tempRoot, 'resources');
    const packagedBinary = join(resourcesPath, 'bundled-gcapcore', runtimeKey, binaryName);
    touch(packagedBinary);
    setResourcesPath(resourcesPath);

    expect(resolveGcapcoreBinaryPath()).toBe(packagedBinary);
  });

  it('does not resolve packaged legacy bundled-aioncore resources', () => {
    const resourcesPath = join(tempRoot, 'resources');
    const legacyPackagedBinary = join(resourcesPath, 'bundled-aioncore', runtimeKey, legacyBinaryName);
    const devGcapcoreBinary = join(process.env.HEADMASTER_PROJECT_ROOT!, 'resources', 'bundled-gcapcore', runtimeKey, binaryName);
    touch(legacyPackagedBinary);
    touch(devGcapcoreBinary);
    setResourcesPath(resourcesPath);

    expect(resolveGcapcoreBinaryPath()).toBe(devGcapcoreBinary);
  });

  it('still accepts legacy bundled-aioncore in dev staging for upstream artifact prep', () => {
    const resourcesPath = join(tempRoot, 'empty-resources');
    const devLegacyBinary = join(process.env.HEADMASTER_PROJECT_ROOT!, 'resources', 'bundled-aioncore', runtimeKey, legacyBinaryName);
    touch(devLegacyBinary);
    setResourcesPath(resourcesPath);

    expect(resolveGcapcoreBinaryPath()).toBe(devLegacyBinary);
  });
});
