/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { httpGet } from '@/common/adapter/httpBridge';

export interface PlatformConfig {
  id: string;
  name: string;
  icon?: string;
  connected: boolean;
  enabled: boolean;
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

interface AdonisChannelPlugin {
  plugin_id?: string;
  type?: string;
  name?: string;
  enabled?: boolean;
  connected?: boolean;
  status?: string;
  has_token?: boolean;
  active_users?: number;
  is_extension?: boolean;
}

interface AdonisChannelPluginsResponse {
  data?: AdonisChannelPlugin[];
}

function normalizePlatformFromChannel(raw: AdonisChannelPlugin): PlatformConfig {
  const id = String(raw.plugin_id ?? raw.type ?? '');
  return {
    id,
    name: String(raw.name ?? id),
    icon: `/api/assets/logos/channels/${id}.svg`,
    connected: raw.connected === true,
    enabled: raw.enabled !== false,
    settings: raw as unknown as Record<string, unknown>,
    lastError: raw.status === 'error' ? 'Channel plugin reported an error' : undefined,
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
      const plugins = await httpGet<AdonisChannelPluginsResponse>('/api/channel/plugins').invoke();
      setPlatforms((plugins?.data ?? []).map(normalizePlatformFromChannel).filter((p) => p.id));
      setWebhooks([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePlatform = useCallback(async (id: string, updates: Partial<PlatformConfig>) => {
    console.warn(
      `[integrations] updatePlatform(${id}) is a no-op: Adonis Core channel plugin toggle route is not exposed`
    );
    setPlatforms((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: updates.enabled ?? p.enabled } : p)));
  }, []);

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
  };
}
