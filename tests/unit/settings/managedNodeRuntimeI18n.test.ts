/**
 * @license
 * Copyright 2025 Headmaster (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function loadSettingsLocale(language: string): Record<string, string> {
  const url = new URL(
    `../../../packages/desktop/src/renderer/services/i18n/locales/${language}/settings.json`,
    import.meta.url
  );
  return JSON.parse(readFileSync(url, 'utf8')) as Record<string, string>;
}

function loadConversationLocale(language: string): Record<string, unknown> {
  const url = new URL(
    `../../../packages/desktop/src/renderer/services/i18n/locales/${language}/conversation.json`,
    import.meta.url
  );
  return JSON.parse(readFileSync(url, 'utf8')) as Record<string, unknown>;
}

describe('managed node runtime settings copy', () => {
  it('does not tell MCP users to install Node.js when npx/node preparation fails', () => {
    const en = loadSettingsLocale('en-US');

    expect(en.mcpErrorNodeCommandNotFound).not.toContain('Install Node.js');
    expect(en.mcpErrorNodeCommandNotFound).toContain('managed Node environment');
  });

  it('keeps the warmup hint generic until the backend can prove node-specific preparation', () => {
    const en = loadConversationLocale('en-US');

    expect((en.runtimePreparing as Record<string, string>).sendboxHint).toContain('runtime environment');
    expect((en.runtimePreparing as Record<string, string>).sendboxHint).not.toContain('managed Node');
  });
});
