/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { gatewayRpcRequest, httpRequest } from '@/common/adapter/httpBridge';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDashboardStatus } from './useDashboardStatus';

export type RuntimeConnectionState = 'starting' | 'connected' | 'reconnecting' | 'failed';

export interface RuntimeConnectionSnapshot {
  state: RuntimeConnectionState;
  reason?: string;
  retry: () => Promise<void>;
}

const safeReason = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/[A-Za-z]:\\[^\s|]+/g, '[local path]')
    .replace(/(?:token|password|secret)=([^&\s]+)/gi, '$1=[redacted]')
    .slice(0, 240);
};

export function useRuntimeConnectionState(): RuntimeConnectionSnapshot {
  const dashboard = useDashboardStatus();
  const [state, setState] = useState<RuntimeConnectionState>('starting');
  const [reason, setReason] = useState<string>();
  const connectedRef = useRef(false);

  const probe = useCallback(async () => {
    const port = window.__backendPort;
    if (!port) {
      connectedRef.current = false;
      setState(dashboard.status === 'failed' || dashboard.status === 'not-installed' ? 'failed' : 'starting');
      setReason(dashboard.lastError || undefined);
      return;
    }

    try {
      await httpRequest('GET', '/api/status');
      await gatewayRpcRequest('session.list', { limit: 1 }, 10_000);
      connectedRef.current = true;
      setState('connected');
      setReason(undefined);
    } catch (error) {
      const wasConnected = connectedRef.current;
      connectedRef.current = false;
      setState(wasConnected ? 'reconnecting' : 'failed');
      setReason(safeReason(error));
    }
  }, [dashboard.lastError, dashboard.status]);

  useEffect(() => {
    void probe();
    const timer = window.setInterval((): void => {
      void probe();
    }, state === 'connected' ? 15_000 : 3_000);
    return () => window.clearInterval(timer);
  }, [probe, state]);

  return { state, reason, retry: probe };
}
