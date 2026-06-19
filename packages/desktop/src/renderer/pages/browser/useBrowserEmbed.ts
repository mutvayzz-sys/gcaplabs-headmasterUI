/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ipcBridge } from '@/common';

export interface BrowserTarget {
  targetId: string;
  url: string;
  wsUrl: string;
}

export function useBrowserEmbed() {
  const [targets, setTargets] = useState<BrowserTarget[]>([]);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await ipcBridge.browser.startCdp.invoke({ url });
      if (!result) {
        throw new Error('CDP not available — enable remote debugging in Settings > System');
      }
      const target = { targetId: result.targetId, url, wsUrl: result.wsUrl };
      setTargets((prev) => [...prev, target]);
      setActiveTargetId(target.targetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start browser session');
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(
    async (targetId: string) => {
      await ipcBridge.browser.stopCdp.invoke({ targetId });
      setTargets((prev) => prev.filter((t) => t.targetId !== targetId));
      if (activeTargetId === targetId) {
        setActiveTargetId(null);
        setScreenshot(null);
      }
    },
    [activeTargetId]
  );

  const capture = useCallback(async (targetId: string) => {
    try {
      const data = await ipcBridge.browser.sendCdpCommand.invoke({
        targetId,
        method: 'Page.captureScreenshot',
        params: { format: 'jpeg', quality: 80 },
      });
      const base64 = (data as { data?: string })?.data ?? null;
      if (base64) setScreenshot(`data:image/jpeg;base64,${base64}`);
    } catch (err) {
      console.warn('[BrowserEmbed] Screenshot failed:', err);
    }
  }, []);

  // Auto-capture every 3s for the active target
  useEffect(() => {
    if (!activeTargetId) return;
    capture(activeTargetId);
    intervalRef.current = setInterval(() => capture(activeTargetId), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTargetId, capture]);

  return {
    targets,
    activeTargetId,
    screenshot,
    loading,
    error,
    start,
    stop,
    setActiveTargetId,
  };
}
