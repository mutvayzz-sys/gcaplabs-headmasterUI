/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Renderer hooks for the Hermes Python dashboard lifecycle.
 *
 * The Hermes dashboard is spawned by the main process and exposes its
 * status via the `hermes.*` IPC bridge (see `process/bridge/hermesBridge.ts`).
 * The renderer polls the status until `ready`, then mirrors the resolved
 * port + session token into the global `window.__backendPort` /
 * `window.__hermesSessionToken` slots that `common/adapter/httpBridge.ts`
 * already reads from.
 *
 * Three hooks:
 *   - `useDashboardStatus()` — full status (status, port, token, error, home)
 *   - `useDashboardUrl()` — `{backendHost}:{port}` or `null`
 *   - `useDashboardWsUrl()` — `ws://{backendHost}:{port}/api/ws?token={token}` or `null`
 *
 * Recon reference: `headmaster-hermes/RECON.md` §1 (dashboard server).
 */

import { useEffect, useRef, useState } from 'react';
import { ipcBridge } from '@/common';
import { resolveBackendHost } from '@/common/adapter/backendUrl';
import { resetHttpBridgeConnections } from '@/common/adapter/httpBridge';

declare global {
  interface Window {
    __backendPort?: number;
    __backendHost?: string;
    __hermesPort?: number;
    __hermesSessionToken?: string;
    __hermesHome?: string;
  }
}

export interface HermesDashboardStatusSnapshot {
  status: 'stopped' | 'installing' | 'not-installed' | 'starting' | 'ready' | 'restarting' | 'failed';
  port: number;
  lastError: string | null;
  hermesHome: string;
  sessionToken: string;
}

const IDLE_SNAPSHOT: HermesDashboardStatusSnapshot = {
  status: 'stopped',
  port: 0,
  lastError: null,
  hermesHome: '',
  sessionToken: '',
};

/** Poll interval while the dashboard is booting. */
const POLL_BOOT_MS = 500;
/** Poll interval once the dashboard is ready (heartbeat — cheap). */
const POLL_READY_MS = 5_000;

const DEGRADED_STATUSES = new Set<HermesDashboardStatusSnapshot['status']>([
  'restarting',
  'starting',
  'stopped',
  'failed',
  'not-installed',
  'installing',
]);

/** Keep renderer HTTP/WS globals aligned with the live bootstrap snapshot. */
export function mirrorHermesDashboardGlobals(snapshot: HermesDashboardStatusSnapshot): {
  portChanged: boolean;
  tokenChanged: boolean;
} {
  if (typeof window === 'undefined') {
    return { portChanged: false, tokenChanged: false };
  }

  const prevPort = window.__backendPort ?? 0;
  const prevToken = window.__hermesSessionToken ?? '';
  window.__hermesHome = snapshot.hermesHome;

  // Use defineProperty so we can write even if a stale read-only descriptor
  // was left by a prior contextBridge.exposeInMainWorld call. Writable +
  // configurable lets future updates reassign freely.
  const assignPort = (v: number): void => {
    try {
      window.__backendPort = v;
    } catch {
      Object.defineProperty(window, '__backendPort', {
        value: v,
        writable: true,
        configurable: true,
      });
    }
  };
  const assignToken = (v: string): void => {
    try {
      window.__hermesSessionToken = v;
    } catch {
      Object.defineProperty(window, '__hermesSessionToken', {
        value: v,
        writable: true,
        configurable: true,
      });
    }
  };

  if (snapshot.status === 'ready' && snapshot.port > 0) {
    window.__hermesPort = snapshot.port;
    assignPort(snapshot.port);
    if (snapshot.sessionToken) {
      assignToken(snapshot.sessionToken);
    }
  } else if (DEGRADED_STATUSES.has(snapshot.status)) {
    // Upstream Hermes Desktop: never serve REST/WS against a dead dashboard.
    assignPort(0);
    window.__hermesPort = 0;
    // Keep the latest spawn token so the next ready cycle does not reuse a stale secret.
    if (snapshot.sessionToken) {
      assignToken(snapshot.sessionToken);
    }
  }

  const nextToken = window.__hermesSessionToken ?? '';
  return {
    portChanged: (window.__backendPort ?? 0) !== prevPort,
    tokenChanged: nextToken !== prevToken,
  };
}

export function useDashboardStatus(): HermesDashboardStatusSnapshot {
  const [snapshot, setSnapshot] = useState<HermesDashboardStatusSnapshot>(IDLE_SNAPSHOT);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const applySnapshot = (next: HermesDashboardStatusSnapshot) => {
      setSnapshot(next);
      const { portChanged, tokenChanged } = mirrorHermesDashboardGlobals(next);
      if (portChanged || tokenChanged) {
        resetHttpBridgeConnections();
      }
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const next = await ipcBridge.hermes.getDashboardStatus.invoke();
        if (cancelled) return;
        applySnapshot(next);
      } catch (err) {
        if (cancelled) return;
        setSnapshot((prev) => ({ ...prev, lastError: (err as Error)?.message ?? String(err) }));
      }
      const nextMs = snapshotRef.current.status === 'ready' ? POLL_READY_MS : POLL_BOOT_MS;
      timer = setTimeout(poll, nextMs);
    };

    const onRuntimeChanged = () => {
      void ipcBridge.hermes.getDashboardStatus
        .invoke()
        .then((next) => {
          if (!cancelled) applySnapshot(next);
        })
        .catch((): void => undefined);
    };

    window.addEventListener('hermes:runtime-changed', onRuntimeChanged);

    // Kick off immediately so we don't wait POLL_BOOT_MS for the first read.
    void poll();

    return () => {
      cancelled = true;
      window.removeEventListener('hermes:runtime-changed', onRuntimeChanged);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return snapshot;
}

/** Returns the dashboard HTTP base URL, or `null` until the dashboard is ready. */
export function useDashboardUrl(): string | null {
  const { status, port } = useDashboardStatus();
  if (status !== 'ready' || !port) return null;
  return `http://${resolveBackendHost()}:${port}`;
}

/** Returns the dashboard WebSocket URL with `?token=` query param, or `null` until ready. */
export function useDashboardWsUrl(): string | null {
  const { status, port, sessionToken } = useDashboardStatus();
  if (status !== 'ready' || !port) return null;
  const params = new URLSearchParams({ token: sessionToken });
  return `ws://${resolveBackendHost()}:${port}/api/ws?${params.toString()}`;
}

/**
 * Returns the session token. Useful for components that need to make their
 * own REST calls (e.g. screenshot upload, custom `X-Hermes-Session-Token`
 * header). The hook returns `null` until the dashboard is ready.
 */
export function useSessionToken(): string | null {
  const { status, sessionToken } = useDashboardStatus();
  if (status !== 'ready') return null;
  return sessionToken;
}
