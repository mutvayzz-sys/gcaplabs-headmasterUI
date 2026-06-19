/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';

export interface AssetJob {
  id: string;
  folder: string;
  category: string;
  prompt: string;
  status: 'idle' | 'queued' | 'running' | 'done' | 'error';
  progress: number;
  outputs: string[];
  error?: string;
}

export interface AssetCategory {
  key: string;
  label: string;
  count: number;
  jobs: AssetJob[];
}

const MOCK_CATEGORIES: AssetCategory[] = [
  {
    key: 'icons',
    label: 'Icons',
    count: 9,
    jobs: Array.from({ length: 9 }).map(
      (_, i): AssetJob => ({
        id: `icon-${i}`,
        folder: `icons/set-${i + 1}`,
        category: 'icons',
        prompt: `Icon set ${i + 1} — minimal line art, dark theme compatible, Phosphor style`,
        status: 'idle',
        progress: 0,
        outputs: [],
      })
    ),
  },
  {
    key: 'mascots',
    label: 'Mascots',
    count: 21,
    jobs: Array.from({ length: 21 }).map(
      (_, i): AssetJob => ({
        id: `mascot-${i}`,
        folder: `mascots/variant-${i + 1}`,
        category: 'mascots',
        prompt: `Sorting Hat mascot variant ${i + 1} — wizarding theme, expressive pose, transparent background`,
        status: 'idle',
        progress: 0,
        outputs: [],
      })
    ),
  },
  {
    key: 'ui',
    label: 'UI Screens',
    count: 3,
    jobs: Array.from({ length: 3 }).map(
      (_, i): AssetJob => ({
        id: `ui-${i}`,
        folder: `ui/screen-${i + 1}`,
        category: 'ui',
        prompt: `UI screen reference ${i + 1} — dark mode dashboard, Arco Design tokens, 1440px wide`,
        status: 'idle',
        progress: 0,
        outputs: [],
      })
    ),
  },
  {
    key: 'marketing',
    label: 'Marketing',
    count: 1,
    jobs: [
      {
        id: 'mkt-0',
        folder: 'marketing/hero',
        category: 'marketing',
        prompt: 'Hero banner — Headmaster Command Center, multi-agent orchestration, cinematic dark theme',
        status: 'idle',
        progress: 0,
        outputs: [],
      } as AssetJob,
    ],
  },
];

export function useAssets() {
  const [categories, setCategories] = useState<AssetCategory[]>(MOCK_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    // In a real implementation, this would IPC to main to scan staging/assets/
    // and read each prompt.md + reference.*
    await new Promise((r) => setTimeout(r, 400));
    setLoading(false);
  }, []);

  const queueCategory = useCallback((categoryKey: string) => {
    setCategories((prev) =>
      prev.map((c) =>
        c.key === categoryKey
          ? { ...c, jobs: c.jobs.map((j) => (j.status === 'idle' ? { ...j, status: 'queued' as const } : j)) }
          : c
      )
    );
  }, []);

  const runNext = useCallback(async () => {
    setRunning(true);
    // No Hermes HTTP route currently exposes the agent image_generate tool.
    // Do not fake completion with placeholders; keep this visibly blocked until
    // a real backend route exists for batch asset generation.
    setCategories((prev) =>
      prev.map((c) => ({
        ...c,
        jobs: c.jobs.map((j) =>
          j.status === 'queued'
            ? {
                ...j,
                status: 'error' as const,
                progress: 0,
                error: 'No backend route is available for batch asset generation yet.',
              }
            : j
        ),
      }))
    );
    setRunning(false);
  }, []);

  const resetAll = useCallback(() => {
    setCategories((prev) =>
      prev.map((c) => ({
        ...c,
        jobs: c.jobs.map((j) => ({ ...j, status: 'idle' as const, progress: 0, outputs: [] as string[] })),
      }))
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalIdle = categories.reduce((n, c) => n + c.jobs.filter((j) => j.status === 'idle').length, 0);
  const totalQueued = categories.reduce((n, c) => n + c.jobs.filter((j) => j.status === 'queued').length, 0);
  const totalRunning = categories.reduce((n, c) => n + c.jobs.filter((j) => j.status === 'running').length, 0);
  const totalDone = categories.reduce((n, c) => n + c.jobs.filter((j) => j.status === 'done').length, 0);

  return {
    categories,
    loading,
    running,
    totalIdle,
    totalQueued,
    totalRunning,
    totalDone,
    refresh,
    queueCategory,
    runNext,
    resetAll,
  };
}
