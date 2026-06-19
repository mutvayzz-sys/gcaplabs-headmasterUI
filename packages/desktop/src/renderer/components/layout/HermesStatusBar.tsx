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
import { resetHttpBridgeConnections } from '@/common/adapter/httpBridge';
import { useRuntimeConnectionState } from '@renderer/hooks/system/useRuntimeConnectionState';

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
  const { state, reason, retry } = useRuntimeConnectionState();
  const [restarting, setRestarting] = React.useState(false);

  if (state === 'connected') return null;

  const status = state === 'reconnecting' ? 'restarting' : state;
  const colorClass = STATUS_COLORS[status] ?? 'bg-gray-400';
  const label =
    state === 'starting'
      ? 'Connecting to the runtime…'
      : state === 'reconnecting'
        ? 'Runtime connection lost. Reconnecting…'
        : 'Runtime is not connected';

  const restart = async () => {
    if (!window.electronAPI?.restartRuntime) return;
    setRestarting(true);
    resetHttpBridgeConnections();
    try {
      await window.electronAPI.restartRuntime();
    } finally {
      setRestarting(false);
    }
  };

  return (
    <div className={`w-full min-h-32px ${colorClass} flex items-center justify-center gap-8px px-12px`}>
      <span className='text-11px text-white font-medium leading-tight select-none'>
        {label}
        {reason ? `: ${reason}` : ''}
      </span>
      <button className='text-11px text-white underline' onClick={() => void retry()} type='button'>
        Retry
      </button>
      {window.electronAPI?.restartRuntime && (
        <button
          className='text-11px text-white underline disabled:opacity-50'
          disabled={restarting}
          onClick={() => void restart()}
          type='button'
        >
          Restart
        </button>
      )}
    </div>
  );
};
