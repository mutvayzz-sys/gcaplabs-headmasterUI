/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { httpGet, httpPut, httpRequest } from '@/common/adapter/httpBridge';

export interface ToolsetInfo {
  name: string;
  label?: string;
  description?: string;
  enabled?: boolean;
  configured?: boolean;
}

export interface ToolEnvVar {
  key: string;
  prompt?: string;
  description?: string;
  advanced?: boolean;
}

export interface ToolProvider {
  name: string;
  label?: string;
  env_vars: ToolEnvVar[];
}

export interface ToolsetConfig {
  name: string;
  providers: ToolProvider[];
  selected_provider?: string;
  env_state?: Record<string, boolean>;
}

export function useToolsets() {
  const [toolsets, setToolsets] = useState<ToolsetInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await httpGet<ToolsetInfo[]>('/api/tools/toolsets').invoke();
      setToolsets(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load toolsets');
      setToolsets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleToolset = useCallback(async (name: string, enabled: boolean) => {
    await httpPut<{ ok: boolean }, { enabled: boolean }>(
      `/api/tools/toolsets/${encodeURIComponent(name)}`
    ).invoke({ enabled });
    setToolsets((prev) => prev.map((t) => (t.name === name ? { ...t, enabled } : t)));
  }, []);

  const loadConfig = useCallback(async (name: string): Promise<ToolsetConfig> => {
    return httpGet<ToolsetConfig>(`/api/tools/toolsets/${encodeURIComponent(name)}/config`).invoke();
  }, []);

  const selectProvider = useCallback(async (name: string, provider: string) => {
    await httpPut<{ ok: boolean }, { provider: string }>(
      `/api/tools/toolsets/${encodeURIComponent(name)}/provider`
    ).invoke({ provider });
  }, []);

  const setEnvVar = useCallback(async (key: string, value: string) => {
    await httpRequest('PUT', '/api/config/env', { key, value });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    toolsets,
    loading,
    error,
    refresh,
    toggleToolset,
    loadConfig,
    selectProvider,
    setEnvVar,
  };
}
