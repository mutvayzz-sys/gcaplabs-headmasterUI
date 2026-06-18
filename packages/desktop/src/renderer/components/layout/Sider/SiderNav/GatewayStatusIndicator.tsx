/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from '@arco-design/web-react';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { httpRequest } from '@/common/adapter/httpBridge';
import classNames from 'classnames';

type GatewayStatus = {
  gateway_running?: boolean;
  gateway_state?: string | null;
};

const GatewayStatusIndicator: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [restarting, setRestarting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await httpRequest<GatewayStatus>('GET', '/api/status');
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleRestart = useCallback(async () => {
    setRestarting(true);
    try {
      await httpRequest('POST', '/api/gateway/restart');
    } catch {
      // silent
    }
    setRestarting(false);
    setTimeout(fetchStatus, 2000);
  }, [fetchStatus]);

  const running = status?.gateway_running ?? false;

  return (
    <div className={classNames('flex items-center gap-6px px-10px h-28px', collapsed && 'justify-center px-0')}>
      <Tooltip content={running ? t('common.gatewayRunning', { defaultValue: 'Gateway: Running' }) : t('common.gatewayStopped', { defaultValue: 'Gateway: Stopped' })} position='right'>
        <span className='flex items-center gap-4px cursor-pointer' onClick={handleRestart}>
          <span
            className={classNames('inline-block w-8px h-8px rd-full', running ? 'bg-success-6' : 'bg-danger-6')}
            style={{ boxShadow: running ? '0 0 4px var(--color-success-6)' : 'none' }}
          />
          {!collapsed && (
            <span className='text-11px text-t-secondary leading-none'>
              {running
                ? t('common.gatewayRunning', { defaultValue: 'Gateway: Running' })
                : t('common.gatewayStopped', { defaultValue: 'Gateway: Stopped' })}
            </span>
          )}
        </span>
      </Tooltip>
      {!collapsed && (
        <Tooltip content={t('common.restartGateway', { defaultValue: 'Restart Gateway' })} position='right'>
          <button
            type='button'
            onClick={handleRestart}
            disabled={restarting}
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