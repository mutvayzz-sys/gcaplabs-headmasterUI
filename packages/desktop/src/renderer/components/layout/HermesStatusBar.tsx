/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tiny inline status bar for the Hermes Python dashboard lifecycle.
 *
 * Shown only while the dashboard is NOT ready. Once `ready`, the bar
 * disappears completely (no persistent badge clutter).
 *
 * Mounted inside `Layout.tsx` at the top level so it spans the full app width.
 */

import React from 'react';
import { useDashboardStatus } from '@renderer/hooks/system/useDashboardStatus';

const STATUS_LABELS: Record<string, string> = {
  stopped: 'Dashboard stopped',
  installing: 'Installing Hermes…',
  'not-installed': 'Hermes not installed',
  starting: 'Starting Headmaster dashboard…',
  ready: 'Ready',
  restarting: 'Restarting dashboard…',
  failed: 'Dashboard failed',
};

const STATUS_COLORS: Record<string, string> = {
  stopped: 'bg-gray-400',
  installing: 'bg-amber-400',
  'not-installed': 'bg-gray-400',
  starting: 'bg-amber-400',
  ready: 'bg-emerald-500',
  restarting: 'bg-amber-400',
  failed: 'bg-red-500',
};

export const HermesStatusBar: React.FC = () => {
  const { status, lastError } = useDashboardStatus();

  if (status === 'ready') return null;

  const colorClass = STATUS_COLORS[status] ?? 'bg-gray-400';
  const label = STATUS_LABELS[status] ?? 'Dashboard unknown';

  return (
    <div className={`w-full h-6px ${colorClass} flex items-center justify-center gap-6px`}>
      <span className='text-10px text-white font-medium leading-none px-8px select-none'>
        {label}
        {lastError ? `: ${lastError}` : ''}
      </span>
    </div>
  );
};
