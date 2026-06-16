/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { httpRequest } from '@/common/adapter/httpBridge';

export interface MemoryProvider {
  id: string;
  name: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

interface HermesMemoryStatus {
  active?: string;
  providers?: Array<{ name: string; description?: string; configured?: boolean }>;
  builtin_files?: Record<string, number>;
}

interface UseMemoryReturn {
  provider: MemoryProvider | null;
  providers: MemoryProvider[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  updateProvider: (id: string, updates: Partial<MemoryProvider>) => Promise<void>;
  resetMemory: () => Promise<void>;
}

function normalizeMemory(data: HermesMemoryStatus): MemoryProvider[] {
  const active = data.active ?? '';
  const pluginProviders = (data.providers ?? []).map((p) => ({
    id: p.name,
    name: p.name,
    enabled: active === p.name,
    config: { description: p.description, configured: p.configured },
  }));
  return [
    {
      id: 'builtin',
      name: 'Built-in Markdown Memory',
      enabled: !active,
      config: { files: data.builtin_files ?? {} },
    },
    ...pluginProviders,
  ];
}

interface AdonisSettingsClientMemory {
  'acp.config'?: Record<string, {
    preferredModelId?: string;
    cli_path?: string;
    auth_methodId?: string;
  }>;
}

interface AdonisMcpServer {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  last_test_status?: string;
}

async function fetchMemoryProvidersFromAdonis(): Promise<MemoryProvider[]> {
  const [settingsEnvelope, mcpEnvelope] = await Promise.all([
    httpRequest<AdonisSettingsClientMemory>('GET', '/api/settings/client').catch((_error: unknown): null => null),
    httpRequest<AdonisMcpServer[]>('GET', '/api/mcp/servers').catch((_error: unknown): null => null),
  ]);

  const acpConfig = settingsEnvelope && typeof settingsEnvelope === 'object' && 'data' in settingsEnvelope
    ? (settingsEnvelope as { data?: AdonisSettingsClientMemory }).data?.['acp.config'] ?? {}
    : {};

  const mcpServers = mcpEnvelope && typeof mcpEnvelope === 'object' && 'data' in mcpEnvelope
    ? (mcpEnvelope as { data?: AdonisMcpServer[] }).data ?? []
    : [];

  const fromBackends: MemoryProvider[] = Object.entries(acpConfig).map(([backend]) => ({
    id: `backend-${backend}`,
    name: `${backend.charAt(0).toUpperCase() + backend.slice(1)} Session Memory`,
    enabled: true,
    config: { source: 'acp.config', backend },
  }));

  const fromMcp: MemoryProvider[] = mcpServers
    .filter((s) => /mem|memory|honcho|recall|store/i.test(s.name ?? '') || /memory/i.test(s.description ?? ''))
    .map((s) => ({
      id: `mcp-${s.id}`,
      name: s.name,
      enabled: s.enabled,
      config: { source: 'mcp', last_test_status: s.last_test_status },
    }));

  return [
    {
      id: 'builtin',
      name: 'Built-in Markdown Memory',
      enabled: true,
      config: { source: 'builtin' },
    },
    ...fromBackends,
    ...fromMcp,
  ];
}

export function useMemory(): UseMemoryReturn {
  const [providers, setProviders] = useState<MemoryProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const providers = await fetchMemoryProvidersFromAdonis();
      setProviders(providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProvider = useCallback(async (id: string, updates: Partial<MemoryProvider>) => {
    console.warn(`[memory] updateProvider(${id}) is a no-op: Adonis Core does not expose a memory provider toggle route`);
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: updates.enabled ?? p.enabled } : p)));
  }, []);

  const resetMemory = useCallback(async () => {
    console.warn('[memory] resetMemory is a no-op: Adonis Core does not expose /api/memory/reset');
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  return {
    provider: providers.find((p) => p.enabled) ?? providers[0] ?? null,
    providers,
    loading,
    error,
    refresh: fetchProviders,
    updateProvider,
    resetMemory,
  };
}
