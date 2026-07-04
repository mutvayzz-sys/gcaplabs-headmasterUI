/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IProvider, TProviderWithModel } from '@/common/config/storage';
import { configService } from '@/common/config/configService';
import { readProvisionedDefaultModel, useModelProviderList } from '@/renderer/hooks/agent/useModelProviderList';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Sessions created before model tracking existed (or where the backend simply didn't record one)
// come back with an empty use_model — see hermesSessionAdapter.ts's modelFromAgent37. Rather than
// leave the composer stuck on "no model selected" for those, fall back the same way a brand-new
// conversation does: the provisioned admin default, then the user's saved preference, then
// whatever model happens to be first in the list.
export function resolveDefaultModel(providers: IProvider[]): TProviderWithModel | undefined {
  if (!providers.length) return undefined;

  const provisionedDefault = readProvisionedDefaultModel();
  if (provisionedDefault?.model) {
    const provider = providers.find((p) => p.id === provisionedDefault.provider);
    const models = provider?.models || [];
    const use_model = models.includes(provisionedDefault.model) ? provisionedDefault.model : models[0];
    if (provider && use_model) return { ...provider, use_model } as TProviderWithModel;
  }

  const saved = configService.get('aionrs.defaultModel');
  if (saved && typeof saved === 'object' && 'id' in saved) {
    const provider = providers.find((p) => p.id === saved.id);
    if (provider?.models?.includes(saved.use_model)) {
      return { ...provider, use_model: saved.use_model } as TProviderWithModel;
    }
  }

  const first = providers[0];
  const use_model = first?.models?.[0];
  return first && use_model ? ({ ...first, use_model } as TProviderWithModel) : undefined;
}

export type AionrsModelSelection = {
  current_model?: TProviderWithModel;
  providers: IProvider[];
  getAvailableModels: (provider: IProvider) => string[];
  handleSelectModel: (provider: IProvider, modelName: string) => Promise<void>;
  getDisplayModelName: (modelName?: string) => string;
};

export type UseAionrsModelSelectionOptions = {
  initialModel: TProviderWithModel | undefined;
  onSelectModel: (provider: IProvider, modelName: string) => Promise<boolean>;
  onResolveMissingModel?: (provider: TProviderWithModel, modelName: string) => Promise<boolean>;
};

export const useAionrsModelSelection = ({
  initialModel,
  onSelectModel,
  onResolveMissingModel,
}: UseAionrsModelSelectionOptions): AionrsModelSelection => {
  const [current_model, setCurrentModel] = useState<TProviderWithModel | undefined>(initialModel);
  const resolvedModelKeyRef = useRef('');

  const { providers: allProviders, getAvailableModels, formatModelLabel } = useModelProviderList();

  // Adonis Core does not support Google Auth — filter it out
  const providers = useMemo(
    () => allProviders.filter((p) => !p.platform?.toLowerCase().includes('gemini-with-google-auth')),
    [allProviders]
  );

  useEffect(() => {
    if (initialModel?.use_model) {
      setCurrentModel(initialModel);
      return;
    }
    // No model recorded for this conversation (older session, or the backend never reported
    // one) — wait for the provider list so resolveDefaultModel has something to pick from.
    if (!providers.length) return;
    const resolved = resolveDefaultModel(providers);
    setCurrentModel(resolved);
    if (resolved?.use_model) {
      const key = `${resolved.id}:${resolved.use_model}`;
      if (resolvedModelKeyRef.current !== key) {
        resolvedModelKeyRef.current = key;
        void onResolveMissingModel?.(resolved, resolved.use_model);
      }
    }
  }, [initialModel?.id, initialModel?.use_model, onResolveMissingModel, providers]);

  const handleSelectModel = useCallback(
    async (provider: IProvider, modelName: string) => {
      const selected = {
        ...(provider as unknown as TProviderWithModel),
        use_model: modelName,
      } as TProviderWithModel;
      const ok = await onSelectModel(provider, modelName);
      if (ok) {
        setCurrentModel(selected);
      }
    },
    [onSelectModel]
  );

  const getDisplayModelName = useCallback(
    (modelName?: string) => {
      if (!modelName) return '';
      const label = formatModelLabel(current_model, modelName);
      const maxLength = 20;
      return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
    },
    [current_model, formatModelLabel]
  );

  return {
    current_model,
    providers,
    getAvailableModels,
    handleSelectModel,
    getDisplayModelName,
  };
};
