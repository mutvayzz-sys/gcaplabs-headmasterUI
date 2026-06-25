/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useCapabilities } from '@renderer/hooks/system/useCapabilities';

interface BootstrapScreenProps {
  isVisible: boolean;
}

export default function BootstrapScreen({ isVisible }: BootstrapScreenProps) {
  const { mode, role } = useCapabilities();

  if (!isVisible) return null;

  const modeLabel =
    mode === 'headmaster_local'
      ? 'Local Mode'
      : mode === 'headmaster_remote'
        ? 'Cloud Mode'
        : mode === 'headmaster_plus_thin'
          ? 'Thin Client'
          : 'Preparing';

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
      <div className='flex flex-col items-center gap-4 rounded-xl bg-white p-8 shadow-2xl dark:bg-gray-900'>
        <div className='h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent' />
        <div className='text-lg font-semibold text-gray-900 dark:text-white'>
          Preparing your workspace…
        </div>
        <div className='text-sm text-gray-500 dark:text-gray-400'>
          {modeLabel} · Role: {role}
        </div>
      </div>
    </div>
  );
}
