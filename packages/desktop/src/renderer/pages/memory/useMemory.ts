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

export function useMemory(): UseMemoryReturn {
  const [providers, setProviders] = useState<MemoryProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await httpRequest<HermesMemoryStatus>('GET', '/api/memory');
      setProviders(normalizeMemory(status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProvider = useCallback(async (id: string, updates: Partial<MemoryProvider>) => {
    await httpRequest('PUT', '/api/memory/provider', { provider: id === 'builtin' ? null : id });
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: updates.enabled ?? p.enabled } : p)));
  }, []);

  const resetMemory = useCallback(async () => {
    await httpRequest('POST', '/api/memory/reset');
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
