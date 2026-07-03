/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { httpRequest } from '@/common/adapter/httpBridge';
import {
  getAgent37SessionHistory,
  listHermesConversations,
  type Agent37SessionDetail,
} from '@/common/adapter/hermesSessionAdapter';
import { type ArtifactKind, type ArtifactRecord, collectArtifactsForSession } from './artifactUtils';

export type DeliverableFilter = 'all' | ArtifactKind;

export function useDeliverables() {
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const conversations = await listHermesConversations({ limit: 40 });
      const collected: ArtifactRecord[] = [];

      const sessionArtifacts = await Promise.all(conversations.items.slice(0, 20).map(async (conversation) => {
        const sessionId = conversation.id;
        const sessionTitle = conversation.name || sessionId;
        const result = await httpRequest<Agent37SessionDetail>('GET', `/v1/sessions/${encodeURIComponent(sessionId)}`);
        return collectArtifactsForSession(sessionId, sessionTitle, getAgent37SessionHistory(result));
      }));
      collected.push(...sessionArtifacts.flat());

      collected.sort((a, b) => b.timestamp - a.timestamp);
      setArtifacts(collected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deliverables');
      setArtifacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { artifacts, loading, error, refresh };
}

/** @deprecated legacy mock shape */
export interface AssetCategory {
  key: string;
  label: string;
  count: number;
  jobs: never[];
}

/** @deprecated Use useDeliverables */
export function useAssets() {
  const { artifacts, loading, error, refresh } = useDeliverables();
  return {
    categories: [] as AssetCategory[],
    loading,
    running: false,
    totalIdle: 0,
    totalQueued: 0,
    totalRunning: 0,
    totalDone: artifacts.length,
    refresh,
    queueCategory: () => {},
    runNext: async () => {},
    resetAll: () => {},
    artifacts,
    error,
  };
}
