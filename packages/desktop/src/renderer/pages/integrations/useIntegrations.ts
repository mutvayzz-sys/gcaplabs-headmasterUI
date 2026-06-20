/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { httpGet, httpPut } from '@/common/adapter/httpBridge';

export interface MessagingEnvVar {
  key: string;
  prompt?: string;
  description?: string;
  is_password?: boolean;
  is_set?: boolean;
  redacted_value?: string;
  url?: string;
}

export interface PlatformConfig {
  id: string;
  name: string;
  icon?: string;
  connected: boolean;
  enabled: boolean;
  configured?: boolean;
  description?: string;
  state?: string;
  envVars?: MessagingEnvVar[];
  settings?: Record<string, unknown>;
  lastError?: string;
}

export interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secret?: string;
}

interface HermesPlatformsResponse {
  platforms?: Array<Record<string, unknown>>;
}

interface HermesWebhooksResponse {
  subscriptions?: Array<Record<string, unknown>>;
  webhooks?: Array<Record<string, unknown>>;
  enabled?: boolean;
  base_url?: string;
}

interface UseIntegrationsReturn {
  platforms: PlatformConfig[];
  webhooks: WebhookEntry[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  updatePlatform: (id: string, updates: Partial<PlatformConfig>) => Promise<void>;
  savePlatformEnv: (id: string, env: Record<string, string>) => Promise<void>;
}

function normalizePlatform(raw: Record<string, unknown>): PlatformConfig {
  const id = String(raw.id ?? raw.platform ?? raw.name ?? '');
  const state = String(raw.state ?? '').toLowerCase();
  const configured = raw.configured === true;
  const enabled = raw.enabled !== false;
  return {
    id,
    name: String(raw.name ?? id),
    icon: typeof raw.icon === 'string' ? raw.icon : undefined,
    connected: state === 'connected' || raw.connected === true,
    enabled,
    settings: raw as Record<string, unknown>,
    lastError:
      typeof raw.error_message === 'string'
        ? raw.error_message
        : typeof raw.lastError === 'string'
          ? raw.lastError
          : configured
            ? undefined
            : 'Not configured',
  };
}

function normalizeWebhook(raw: Record<string, unknown>, index: number): WebhookEntry {
  return {
    id: String(raw.name ?? raw.id ?? index),
    url: String(raw.url ?? raw.endpoint ?? ''),
    events: Array.isArray(raw.events) ? raw.events.map(String) : [],
    active: raw.enabled === true || raw.active === true,
    secret: typeof raw.secret === 'string' ? raw.secret : undefined,
  };
}

interface HermesMessagingPlatform {
  id?: string;
  name?: string;
  enabled?: boolean;
  connected?: boolean;
  configured?: boolean;
  state?: string;
  icon?: string;
  error_message?: string;
  description?: string;
  env_vars?: MessagingEnvVar[];
}

interface HermesMessagingPlatformsResponse {
  platforms?: HermesMessagingPlatform[];
}

function normalizePlatformFromChannel(raw: HermesMessagingPlatform): PlatformConfig {
  const id = String(raw.id ?? '');
  const state = raw.state ?? '';
  return {
    id,
    name: String(raw.name ?? id),
    icon: typeof raw.icon === 'string' ? raw.icon : undefined,
    connected: raw.connected === true || state === 'connected',
    enabled: raw.enabled !== false,
    configured: raw.configured === true,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    state: typeof state === 'string' ? state : undefined,
    envVars: Array.isArray(raw.env_vars) ? raw.env_vars : [],
    settings: raw as unknown as Record<string, unknown>,
    lastError:
      typeof raw.error_message === 'string'
        ? raw.error_message
        : raw.configured === false
          ? 'Not configured'
          : undefined,
  };
}

export function useIntegrations(): UseIntegrationsReturn {
  const [platforms, setPlatforms] = useState<PlatformConfig[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [platformsResponse, webhooksResponse] = await Promise.all([
        httpGet<HermesMessagingPlatformsResponse>('/api/messaging/platforms').invoke(),
        httpGet<HermesWebhooksResponse>('/api/webhooks')
          .invoke()
          .catch((): HermesWebhooksResponse => ({ webhooks: [] })),
      ]);
      setPlatforms((platformsResponse?.platforms ?? []).map(normalizePlatformFromChannel).filter((p) => p.id));
      const rawWebhooks = webhooksResponse.webhooks ?? webhooksResponse.subscriptions ?? [];
      setWebhooks(rawWebhooks.map(normalizeWebhook));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePlatform = useCallback(async (id: string, updates: Partial<PlatformConfig>) => {
    await httpPut<{ ok: boolean }, { enabled?: boolean }>(`/api/messaging/platforms/${encodeURIComponent(id)}`).invoke({
      enabled: updates.enabled,
    });
    setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: updates.enabled ?? p.enabled } : p)));
  }, []);

  const savePlatformEnv = useCallback(
    async (id: string, env: Record<string, string>) => {
      await httpPut<{ ok: boolean }, { env?: Record<string, string> }>(
        `/api/messaging/platforms/${encodeURIComponent(id)}`
      ).invoke({ env });
      await fetchData();
    },
    [fetchData]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    platforms,
    webhooks,
    loading,
    error,
    refresh: fetchData,
    updatePlatform,
    savePlatformEnv,
  };
}
