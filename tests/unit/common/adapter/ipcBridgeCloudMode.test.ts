/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@office-ai/platform', () => ({
  bridge: {
    buildProvider: vi.fn(() => ({
      provider: vi.fn(),
      invoke: vi.fn(async () => []),
    })),
    buildEmitter: vi.fn(() => ({
      on: vi.fn(() => vi.fn()),
      emit: vi.fn(),
    })),
  },
}));

vi.mock('electron', () => ({}));

const loadBridgeInCloudMode = async () => {
  vi.resetModules();
  vi.stubGlobal('window', {
    __cloudContainerEndpoint: 'https://cloud.example.test',
    __runtimeBearerToken: 'token',
    __agent37Provision: {
      providers: [
        {
          slug: 'openai',
          runtime_provider: 'openai',
          name: 'OpenAI',
          available_models: ['gpt-4.1'],
          enabled: true,
        },
      ],
    },
  });
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('fetch should not be called for local-only cloud-mode routes');
  }));
  return import('@/common/adapter/ipcBridge');
};

describe('ipcBridge cloud-mode local-only gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('fails closed for local-only inventories without hitting the cloud endpoint', async () => {
    const { mcpService, cron, acpConversation, fs, extensions } = await loadBridgeInCloudMode();

    await expect(mcpService.listServers.invoke()).resolves.toEqual([]);
    await expect(cron.listJobs.invoke()).resolves.toEqual([]);
    await expect(acpConversation.getAvailableAgents.invoke()).resolves.toEqual([]);
    await expect(fs.listAvailableSkills.invoke()).resolves.toEqual([]);
    await expect(extensions.getAcpAdapters.invoke()).resolves.toEqual([]);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses provisioned provider data and skips redundant /api/providers fetches in cloud mode', async () => {
    const { mode } = await loadBridgeInCloudMode();

    await expect(mode.listProviders.invoke()).resolves.toMatchObject([
      {
        id: 'openai',
        platform: 'openai',
        name: 'OpenAI',
        models: ['gpt-4.1'],
        enabled: true,
        managed_by_runtime: true,
      },
    ]);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports Google Auth unavailable without probing local-only Google routes in cloud mode', async () => {
    const { googleAuth } = await loadBridgeInCloudMode();

    await expect(googleAuth.status.invoke()).resolves.toMatchObject({ success: false });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed for conversation side panels without unsupported cloud calls', async () => {
    const { conversation } = await loadBridgeInCloudMode();

    await expect(conversation.getSlashCommands.invoke({ conversation_id: 'conv-1' })).resolves.toEqual([]);
    await expect(conversation.listArtifacts.invoke({ conversation_id: 'conv-1' })).resolves.toEqual([]);
    await expect(conversation.confirmation.list.invoke({ conversation_id: 'conv-1' })).resolves.toEqual([]);
    await expect(
      conversation.askSideQuestion.invoke({ conversation_id: 'conv-1', question: 'anything?' })
    ).resolves.toEqual({ status: 'unsupported' });

    expect(fetch).not.toHaveBeenCalled();
  });
});
