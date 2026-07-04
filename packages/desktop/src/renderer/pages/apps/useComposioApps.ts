/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComposioConnection, ComposioToolkit } from '@/common/types/platform/electron';

export type { ComposioConnection, ComposioToolkit };

const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH = 3; // matches the console's /api/chat/integrations/toolkits route's own guard

function isActive(connection: ComposioConnection): boolean {
  return connection.status.toUpperCase() === 'ACTIVE';
}

export function toolkitLogoUrl(slug: string): string {
  return `https://logos.composio.dev/api/${slug}`;
}

interface UseComposioAppsReturn {
  toolkits: ComposioToolkit[];
  connections: ComposioConnection[];
  connectedSlugs: Set<string>;
  loadingToolkits: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  loadingConnections: boolean;
  connecting: string | null;
  disconnecting: string | null;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  connect: (slug: string) => Promise<void>;
  disconnect: (connectionId: string) => Promise<void>;
  refreshConnections: () => Promise<ComposioConnection[]>;
}

export function useComposioApps(): UseComposioAppsReturn {
  const [toolkits, setToolkits] = useState<ComposioToolkit[]>([]);
  const [connections, setConnections] = useState<ComposioConnection[]>([]);
  const [loadingToolkits, setLoadingToolkits] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  // Not state: a page load shouldn't itself trigger a re-render/re-fetch, only reads at the
  // moment loadMore() is called need the latest cursor.
  const cursorRef = useRef<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const refreshConnections = useCallback(async (): Promise<ComposioConnection[]> => {
    const result = await window.electronAPI?.listComposioConnections?.();
    if (!result?.success) throw new Error(result?.error ?? 'Failed to load connections');
    const conns = result.data?.connections ?? [];
    setConnections(conns);
    return conns;
  }, []);

  useEffect(() => {
    setLoadingConnections(true);
    refreshConnections()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingConnections(false));
  }, [refreshConnections]);

  const fetchPage = useCallback((query: string, cursor: string | null, seq: number) => {
    return window.electronAPI
      ?.listComposioToolkits?.({ search: query || undefined, cursor: cursor ?? undefined })
      .then((result) => {
        if (seq !== requestSeq.current) return; // a newer search superseded this request
        if (!result?.success) {
          setError(result?.error ?? 'Failed to load apps');
          return;
        }
        const page = result.data?.toolkits ?? [];
        setToolkits((prev) => (cursor ? [...prev, ...page] : page));
        cursorRef.current = result.data?.nextCursor ?? null;
        setHasMore(Boolean(cursorRef.current));
      });
  }, []);

  // Reset and refetch from page one whenever the search query changes.
  useEffect(() => {
    const query = search.trim();
    if (query.length > 0 && query.length < MIN_SEARCH) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++requestSeq.current;
    debounceRef.current = setTimeout(() => {
      setLoadingToolkits(true);
      setError(null);
      cursorRef.current = null;
      fetchPage(query, null, seq)
        .catch((e: Error) => {
          if (seq === requestSeq.current) setError(e.message);
        })
        .finally(() => {
          if (seq === requestSeq.current) setLoadingToolkits(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, fetchPage]);

  const loadMore = useCallback(() => {
    if (!cursorRef.current || loadingMore || loadingToolkits) return;
    const seq = requestSeq.current;
    setLoadingMore(true);
    fetchPage(search.trim(), cursorRef.current, seq)
      .catch((e: Error) => {
        if (seq === requestSeq.current) setError(e.message);
      })
      .finally(() => setLoadingMore(false));
  }, [fetchPage, loadingMore, loadingToolkits, search]);

  const connect = useCallback(
    async (slug: string) => {
      setConnecting(slug);
      setError(null);
      try {
        const connectResult = await window.electronAPI?.connectComposioToolkit?.(slug);
        if (!connectResult?.success || !connectResult.data?.redirectUrl) {
          throw new Error(connectResult?.error ?? 'Failed to start the connection.');
        }

        const popupResult = await window.electronAPI?.runComposioOAuthPopup?.(connectResult.data.redirectUrl);
        if (!popupResult?.success || !popupResult.data?.connectedAccountId) {
          throw new Error(popupResult?.error ?? 'OAuth was canceled or failed. You can retry the connection.');
        }

        const conns = await refreshConnections();
        const conn = conns.find((c) => c.id === popupResult.data!.connectedAccountId);
        if (conn) {
          await window.electronAPI?.registerComposioMcp?.(conn.toolkit.slug);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setConnecting(null);
      }
    },
    [refreshConnections]
  );

  const disconnect = useCallback(async (connectionId: string) => {
    setDisconnecting(connectionId);
    setError(null);
    try {
      const result = await window.electronAPI?.disconnectComposioConnection?.(connectionId);
      if (!result?.success) throw new Error(result?.error ?? 'Failed to disconnect.');
      const updated = await window.electronAPI?.listComposioConnections?.();
      if (updated?.success) setConnections(updated.data?.connections ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDisconnecting(null);
    }
  }, []);

  const connectedSlugs = new Set(connections.filter(isActive).map((c) => c.toolkit.slug));

  return {
    toolkits,
    connections,
    connectedSlugs,
    loadingToolkits,
    loadingMore,
    hasMore,
    loadMore,
    loadingConnections,
    connecting,
    disconnecting,
    error,
    search,
    setSearch,
    connect,
    disconnect,
    refreshConnections,
  };
}

export { isActive };
export { MIN_SEARCH };
