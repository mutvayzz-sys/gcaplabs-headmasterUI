import { ipcBridge } from '@/common';
import { GOOGLE_AUTH_PROVIDER_ID } from '@/common/config/constants';
import type { IProvider } from '@/common/config/storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR, { type SWRConfiguration } from 'swr';
import { useGoogleAuthModels } from './useGoogleAuthModels';
import { hasSpecificModelCapability } from '@/renderer/utils/model/modelCapabilities';

export interface ModelProviderListResult {
  providers: IProvider[];
  getAvailableModels: (provider: IProvider) => string[];
  formatModelLabel: (provider: { platform?: string } | undefined, modelName?: string) => string;
}

export const PROVIDERS_SWR_KEY = 'providers';

// Provider config is local application state. Keep it stable after the initial
// load and refresh only through explicit mutate() calls after CRUD operations.
export const PROVIDERS_SWR_OPTIONS: SWRConfiguration<IProvider[], Error> = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  shouldRetryOnError: false,
};

export const fetchProviders = async (): Promise<IProvider[]> => {
  return (await ipcBridge.mode.listProviders.invoke()) ?? [];
};

/**
 * Read the provisioned provider catalog from the HermesHQ provision snapshot
 * stored on window.__hermeshqProvision. These are the admin-controlled
 * providers shipped in the provision response — they take priority over the
 * local runtime's /api/model/options (which only sees local .env keys).
 */
function readProvisionedProviders(): IProvider[] {
  if (typeof window === 'undefined') return [];
  const provision = (window as any).__hermeshqProvision as
    | { providers?: Array<Record<string, unknown>> }
    | undefined;
  if (!provision?.providers || !Array.isArray(provision.providers)) return [];
  return provision.providers
    .filter((p) => p && typeof p.slug === 'string' && typeof p.name === 'string')
    .map((p) => ({
      id: p.slug as string,
      platform: (p.runtime_provider as string) ?? (p.slug as string),
      name: p.name as string,
      base_url: (p.base_url as string) ?? '',
      api_key: '',
      models: Array.isArray(p.available_models) ? (p.available_models as string[]) : [],
      enabled: p.enabled !== false,
      managed_by_runtime: true,
    } as unknown as IProvider));
}

/**
 * Read the provisioned default model/provider/base_url from the provision snapshot.
 * Returns null if not available.
 */
export function readProvisionedDefaultModel(): {
  model: string;
  provider: string;
  base_url: string;
} | null {
  if (typeof window === 'undefined') return null;
  const provision = (window as any).__hermeshqProvision as
    | { default_model?: string | null; default_provider?: string | null; default_base_url?: string | null }
    | undefined;
  if (!provision?.default_model) return null;
  return {
    model: provision.default_model,
    provider: provision.default_provider ?? '',
    base_url: provision.default_base_url ?? '',
  };
}

export const useProvidersQuery = () => {
  const swr = useSWR<IProvider[]>(PROVIDERS_SWR_KEY, fetchProviders, PROVIDERS_SWR_OPTIONS);

  // Re-fetch providers when the Hermes dashboard becomes ready. The initial
  // fetch often fails because the dashboard hasn't spawned yet (port=0),
  // and SWR is configured with shouldRetryOnError: false — so it never
  // retries on its own. Listen for the runtime-changed event and revalidate.
  useEffect(() => {
    const handler = () => {
      swr.mutate();
    };
    window.addEventListener('hermes:runtime-changed', handler);
    return () => window.removeEventListener('hermes:runtime-changed', handler);
  }, [swr]);

  return swr;
};

/**
 * Shared hook that builds the provider list (including Google Auth)
 * and exposes helpers consumed by both conversation and channel settings.
 *
 * Provider sources (in priority order):
 * 1. HermesHQ provisioned providers (window.__hermeshqProvision.providers) —
 *    admin-controlled catalog shipped in the provision response
 * 2. Local runtime /api/model/options — fallback, sees local .env API keys
 * 3. Google Auth provider — injected if Google Auth is available
 */
export const useModelProviderList = (): ModelProviderListResult => {
  const { isGoogleAuth } = useGoogleAuthModels();
  const { data: modelConfig } = useProvidersQuery();

  // Track provisioned providers so we re-render when the provision snapshot
  // arrives (dispatched via the 'hermeshq:provision-updated' DOM event).
  const [provisionedProviders, setProvisionedProviders] = useState<IProvider[]>(() =>
    readProvisionedProviders()
  );
  useEffect(() => {
    const handler = () => setProvisionedProviders(readProvisionedProviders());
    window.addEventListener('hermeshq:provision-updated', handler);
    return () => window.removeEventListener('hermeshq:provision-updated', handler);
  }, []);

  // Mutable cache for available-model filtering
  const available_modelsCacheRef = useRef(new Map<string, string[]>());

  // 当 modelConfig 变化时清除缓存
  useEffect(() => {
    available_modelsCacheRef.current.clear();
  }, [modelConfig, provisionedProviders]);

  const getAvailableModels = useCallback((provider: IProvider): string[] => {
    // 包含 model_enabled 状态到缓存 key 中
    const model_enabledKey = provider.model_enabled ? JSON.stringify(provider.model_enabled) : 'all-enabled';
    const cacheKey = `${provider.id}-${(provider.models || []).join(',')}-${model_enabledKey}`;
    const cache = available_modelsCacheRef.current;
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }
    const result: string[] = [];
    for (const modelName of provider.models || []) {
      // 检查模型是否被禁用（默认为启用）
      const isModelEnabled = provider.model_enabled?.[modelName] !== false;
      if (!isModelEnabled) continue;

      const functionCalling = hasSpecificModelCapability(provider, modelName, 'function_calling');
      const excluded = hasSpecificModelCapability(provider, modelName, 'excludeFromPrimary');
      if ((functionCalling === true || functionCalling === undefined) && excluded !== true) {
        result.push(modelName);
      }
    }
    cache.set(cacheKey, result);
    return result;
  }, []);

  const providers = useMemo(() => {
    // Provisioned providers from HermesHQ take priority. Fall back to local
    // runtime providers only if the provision didn't ship any.
    let list: IProvider[];
    if (provisionedProviders.length > 0) {
      list = provisionedProviders;
    } else {
      list = Array.isArray(modelConfig) ? modelConfig : [];
    }
    // 过滤掉被禁用的 provider（默认为启用）
    list = list.filter((p) => p.enabled !== false);

    if (isGoogleAuth) {
      const googleProvider: IProvider = {
        id: GOOGLE_AUTH_PROVIDER_ID,
        name: 'Gemini Google Auth',
        platform: 'gemini-with-google-auth',
        base_url: '',
        api_key: '',
        model: [],
        capabilities: [{ type: 'text' }, { type: 'vision' }, { type: 'function_calling' }],
        enabled: true, // Google Auth provider 始终启用
      } as unknown as IProvider;
      list = [googleProvider, ...list];
    }
    // 过滤掉没有可用模型的 provider
    return list.filter((p) => getAvailableModels(p).length > 0);
  }, [getAvailableModels, isGoogleAuth, modelConfig, provisionedProviders]);

  const formatModelLabel = useCallback((_provider: { platform?: string } | undefined, modelName?: string) => {
    if (!modelName) return '';
    return modelName;
  }, []);

  return { providers, getAvailableModels, formatModelLabel };
};
