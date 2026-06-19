/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@arco-design/web-react';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { resetHttpBridgeConnections } from '@/common/adapter/httpBridge';
import { useRuntimeConnectionState } from '@/renderer/hooks/system/useRuntimeConnectionState';
import classNames from 'classnames';

const GatewayStatusIndicator: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const { t } = useTranslation();
  const { state, retry } = useRuntimeConnectionState();
  const [restarting, setRestarting] = useState(false);

  const handleRestart = useCallback(async () => {
    setRestarting(true);
    try {
      if (window.electronAPI?.restartRuntime) {
        resetHttpBridgeConnections();
        await window.electronAPI.restartRuntime();
        // Window will reload once the runtime is ready — nothing more to do here.
        return;
      }
    } catch {
      // silent
    }
    setRestarting(false);
    setTimeout(() => void retry(), 2000);
  }, [retry]);

  const running = state === 'connected';

  return (
    <div className={classNames('flex items-center gap-6px px-10px h-28px', collapsed && 'justify-center px-0')}>
      <Tooltip
        content={
          running
            ? t('common.runtimeActive', { defaultValue: 'Headmaster: Active' })
            : t('common.runtimeInactive', { defaultValue: 'Headmaster: Inactive' })
        }
        position='right'
      >
        <span className='flex items-center gap-4px cursor-pointer' onClick={handleRestart}>
          <span
            className={classNames('inline-block w-8px h-8px rd-full', running ? 'bg-success-6' : 'bg-danger-6')}
            style={{ boxShadow: running ? '0 0 4px var(--color-success-6)' : 'none' }}
          />
          {!collapsed && (
            <span className='text-11px text-t-secondary leading-none'>
              {running
                ? t('common.runtimeActive', { defaultValue: 'Headmaster: Active' })
                : t('common.runtimeInactive', { defaultValue: 'Headmaster: Inactive' })}
            </span>
          )}
        </span>
      </Tooltip>
      {!collapsed && (
        <Tooltip content={t('common.restartRuntime', { defaultValue: 'Restart Headmaster' })} position='right'>
          <button
            type='button'
            onClick={handleRestart}
            disabled={restarting}
            title={t('common.restartRuntime', { defaultValue: 'Restart Headmaster' })}
            className='ml-auto p-2px hover:bg-fill-2 rd-4px transition-colors text-t-tertiary hover:text-t-primary disabled:opacity-40'
          >
            <ArrowsClockwise size={12} weight='regular' className={restarting ? 'animate-spin' : ''} />
          </button>
        </Tooltip>
      )}
    </div>
  );
};

export default GatewayStatusIndicator;
