/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IProvider } from '@/common/config/storage';
import { readProvisionedDefaultModel, readProvisionedProviders } from '@/renderer/hooks/agent/useModelProviderList';
import { resolveDefaultModel } from '@/renderer/pages/conversation/platforms/aionrs/useAionrsModelSelection';
import { MESSAGE_STREAM_FLUSH_INTERVAL_MS } from '@/renderer/pages/conversation/Messages/hooks';

const { configGetMock } = vi.hoisted(() => ({
  configGetMock: vi.fn(),
}));

vi.mock('@/common/config/configService', () => ({
  configService: {
    get: configGetMock,
  },
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    mode: {
      listProviders: {
        invoke: vi.fn(),
      },
    },
    database: {
      getConversationMessages: {
        invoke: vi.fn(),
      },
    },
    conversation: {
      userCreated: {
        on: vi.fn(),
      },
    },
  },
}));

const setProvision = (value: unknown): void => {
  (window as Window & { __agent37Provision?: unknown }).__agent37Provision = value;
};

const provider = (id: string, models: string[]): IProvider =>
  ({
    id,
    name: id,
    platform: id,
    base_url: '',
    api_key: '',
    models,
    enabled: true,
  }) as IProvider;

describe('AionRS model fallback', () => {
  beforeEach(() => {
    configGetMock.mockReset();
    configGetMock.mockReturnValue(undefined);
    setProvision(undefined);
  });

  afterEach(() => {
    setProvision(undefined);
  });

  it('returns empty provision data when the Agent37 provision global is missing', () => {
    expect(readProvisionedProviders()).toEqual([]);
    expect(readProvisionedDefaultModel()).toBeNull();
  });

  it('uses the provisioned default model when it is available', () => {
    setProvision({
      default_provider: 'managed',
      default_model: 'gpt-5-mini',
      default_base_url: 'https://example.test',
    });

    expect(resolveDefaultModel([provider('managed', ['gpt-5-mini', 'gpt-5'])])).toMatchObject({
      id: 'managed',
      use_model: 'gpt-5-mini',
    });
  });

  it('falls back to the saved default when provision is absent', () => {
    configGetMock.mockReturnValue({ id: 'saved', use_model: 'claude-sonnet-4' });

    expect(resolveDefaultModel([provider('managed', ['gpt-5']), provider('saved', ['claude-sonnet-4'])])).toMatchObject({
      id: 'saved',
      use_model: 'claude-sonnet-4',
    });
  });

  it('falls back to the first compatible provider model', () => {
    expect(resolveDefaultModel([provider('first', ['model-a'])])).toMatchObject({
      id: 'first',
      use_model: 'model-a',
    });
  });

  it('keeps restored history sendable by resolving a real model id for first-message send', () => {
    setProvision({
      default_provider: 'managed',
      default_model: 'gpt-5-mini',
    });

    const restoredHistoryFallback = resolveDefaultModel([provider('managed', ['gpt-5-mini'])]);

    expect(restoredHistoryFallback?.use_model).toBe('gpt-5-mini');
    expect(restoredHistoryFallback?.use_model).not.toBe('');
  });

  it('uses a 33ms stream flush cadence', () => {
    expect(MESSAGE_STREAM_FLUSH_INTERVAL_MS).toBe(33);
  });
});
