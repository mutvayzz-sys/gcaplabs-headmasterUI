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
 *   - `useDashboardUrl()` — `http://127.0.0.1:{port}` or `null`
 *   - `useDashboardWsUrl()` — `ws://127.0.0.1:{port}/api/ws?token={token}` or `null`
 *
 * Recon reference: `headmaster-hermes/RECON.md` §1 (dashboard server).
 */

import { useEffect, useRef, useState } from 'react';
import { ipcBridge } from '@/common';

declare global {
  interface Window {
    __backendPort?: number;
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

export function useDashboardStatus(): HermesDashboardStatusSnapshot {
  const [snapshot, setSnapshot] = useState<HermesDashboardStatusSnapshot>(IDLE_SNAPSHOT);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const next = await ipcBridge.hermes.getDashboardStatus.invoke();
        if (cancelled) return;
        setSnapshot(next);
        // Mirror to window globals so existing httpBridge.ts keep working.
        // Guard: don't overwrite a non-zero port with 0 (aioncore path may have
        // already set __backendPort via preload before the hook mounts).
        if (typeof window !== 'undefined') {
          if (next.port || !window.__hermesPort) {
            window.__hermesPort = next.port;
          }
          if (next.port || !window.__backendPort) {
            window.__backendPort = next.port;
          }
          if (next.sessionToken || !window.__hermesSessionToken) {
            window.__hermesSessionToken = next.sessionToken;
          }
          window.__hermesHome = next.hermesHome;
        }
      } catch (err) {
        if (cancelled) return;
        setSnapshot((prev) => ({ ...prev, lastError: (err as Error)?.message ?? String(err) }));
      }
      const nextMs = snapshotRef.current.status === 'ready' ? POLL_READY_MS : POLL_BOOT_MS;
      timer = setTimeout(poll, nextMs);
    };

    // Kick off immediately so we don't wait POLL_BOOT_MS for the first read.
    void poll();

    return () => {
      cancelled = true;
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
  return `http://127.0.0.1:${port}`;
}

/** Returns the dashboard WebSocket URL with `?token=` query param, or `null` until ready. */
export function useDashboardWsUrl(): string | null {
  const { status, port, sessionToken } = useDashboardStatus();
  if (status !== 'ready' || !port) return null;
  const params = new URLSearchParams({ token: sessionToken });
  return `ws://127.0.0.1:${port}/api/ws?${params.toString()}`;
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
