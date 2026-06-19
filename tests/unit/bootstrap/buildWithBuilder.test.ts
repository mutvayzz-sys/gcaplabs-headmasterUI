/**
 * @license
 * Copyright 2025 Headmaster (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(__dirname, '../../..');

describe('build-with-builder', () => {
  it.each([
    {
      args: ['arm64', '--win', '--arm64'],
      expectedArch: 'arm64',
    },
    {
      args: ['auto', '--mac', '--x64'],
      expectedArch: 'x64',
    },
  ])('exits cleanly for $expectedArch with args $args', ({ args }) => {
    const tempDir = mkdtempSync(join(tmpdir(), 'headmaster-build-test-'));
    const hookPath = join(tempDir, 'hook.cjs');

    writeFileSync(
      hookPath,
      `
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// Satisfy build-with-builder's output checks without clobbering real build
// artifacts: out/ lives in the actual repo (the script resolves it from its
// own __dirname), so only create empty placeholders when nothing is there.
function ensurePlaceholder(relativePath) {
  const target = path.join(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, '');
  }
}

childProcess.execSync = function mockedExecSync(command) {
  const commandText = String(command);
  if (commandText.includes('electron-vite build')) {
    ensurePlaceholder('out/main/index.js');
    ensurePlaceholder('out/renderer/index.html');
  }
  return Buffer.from('');
};
`,
      'utf8'
    );

    try {
      const result = spawnSync(process.execPath, ['scripts/build-with-builder.js', ...args], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${hookPath}`].filter(Boolean).join(' '),
        },
      });

      expect(result.status, result.stderr || result.stdout).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
