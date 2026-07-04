/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { gatewayRpcRequest, httpRequest, probeRemoteHealth } from '@/common/adapter/httpBridge';
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
    .replace(/((?:token|password|secret)=)([^&\s]+)/gi, '$1[redacted]')
    .slice(0, 240);
};

// A single slow/timed-out health check (cold container, brief network blip) shouldn't flip an
// already-connected runtime to "Reconnecting…" and flash the banner — only report the drop once
// this many consecutive checks have failed.
const CONSECUTIVE_FAILURES_BEFORE_RECONNECTING = 2;

export function useRuntimeConnectionState(): RuntimeConnectionSnapshot {
  const dashboard = useDashboardStatus();
  const [state, setState] = useState<RuntimeConnectionState>('starting');
  const [reason, setReason] = useState<string>();
  const connectedRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);

  const reportSuccess = useCallback(() => {
    consecutiveFailuresRef.current = 0;
    connectedRef.current = true;
    setState('connected');
    setReason(undefined);
  }, []);

  // Swallows the first failure after a successful connection (state stays 'connected', no
  // banner) so a single slow check doesn't flicker; only reports once failures accumulate.
  const reportFailure = useCallback((message: string) => {
    const wasConnected = connectedRef.current;
    consecutiveFailuresRef.current += 1;
    if (wasConnected && consecutiveFailuresRef.current < CONSECUTIVE_FAILURES_BEFORE_RECONNECTING) {
      return;
    }
    connectedRef.current = false;
    setState(wasConnected ? 'reconnecting' : 'failed');
    setReason(message);
  }, []);

  const probe = useCallback(async () => {
    // Remote container mode: probe /v1/health directly (no WS available).
    // The Agent37 runtime has no /api/ws endpoint, so the WS probe below would
    // always fail. This makes the status indicator reflect real runtime health.
    if (
      typeof window !== 'undefined' &&
      ((window as any).__agent37Endpoint ?? (window as any).__cloudContainerEndpoint)
    ) {
      const healthy = await probeRemoteHealth();
      if (healthy) {
        reportSuccess();
      } else {
        reportFailure('Runtime health check failed');
      }
      return;
    }

    // Local dashboard mode: use existing WS-RPC probe.
    const port = window.__backendPort;
    if (!port) {
      connectedRef.current = false;
      consecutiveFailuresRef.current = 0;
      setState(dashboard.status === 'failed' || dashboard.status === 'not-installed' ? 'failed' : 'starting');
      setReason(dashboard.lastError || undefined);
      return;
    }

    try {
      await gatewayRpcRequest('session.list', { limit: 1 }, 10_000);
      try {
        await httpRequest('GET', '/api/status');
      } catch {
        // Optional status endpoint; RPC success is authoritative.
      }
      reportSuccess();
    } catch (error) {
      reportFailure(safeReason(error));
    }
  }, [dashboard.lastError, dashboard.status, reportFailure, reportSuccess]);

  useEffect(() => {
    void probe();
    const timer = window.setInterval(
      (): void => {
        void probe();
      },
      state === 'connected' ? 15_000 : 3_000
    );
    return () => window.clearInterval(timer);
  }, [probe, state]);

  return { state, reason, retry: probe };
}
