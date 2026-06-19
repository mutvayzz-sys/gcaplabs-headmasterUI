/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, Notification } from '@arco-design/web-react';
import { ArrowUp } from '@phosphor-icons/react';
import { httpRequest } from '@/common/adapter/httpBridge';
import classNames from 'classnames';

type UpdateCheckResponse = {
  install_method?: string;
  current_version?: string;
  behind?: number | null;
  update_available?: boolean;
  can_apply?: boolean;
  update_command?: string;
  message?: string | null;
};

type Phase = 'idle' | 'triggering' | 'polling' | 'installed' | 'restarting';

const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const POLL_INTERVAL = 5_000; // 5 s between polls while update is running
const POLL_TIMEOUT = 3 * 60 * 1000;

const UpdateChecker: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollStartRef = useRef<number>(0);

  const clearPollTimer = () => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const checkUpdate = useCallback(async () => {
    try {
      const data = await httpRequest<UpdateCheckResponse>('GET', '/api/hermes/update/check');
      setUpdateInfo(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkUpdate, 5000);
    const interval = setInterval(checkUpdate, UPDATE_CHECK_INTERVAL);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkUpdate]);

  // Poll until the runtime reports no update available. Keep the current
  // conversation and UI alive; restart only when the user explicitly chooses.
  const startPollingForCompletion = useCallback(() => {
    clearPollTimer();
    pollStartRef.current = Date.now();

    const poll = async () => {
      const elapsed = Date.now() - pollStartRef.current;
      if (elapsed > POLL_TIMEOUT) {
        clearPollTimer();
        setPhase('idle');
        Notification.warning({
          title: t('common.updateFailed', { defaultValue: 'Update status unknown' }),
          content: t('common.updateFailedMsg', {
            defaultValue: 'The update is still running or could not be verified.',
          }),
        });
        return;
      }

      const data = await checkUpdate();
      if (!data?.update_available) {
        clearPollTimer();
        setUpdateInfo(data);
        setPhase('installed');
        Notification.success({
          title: t('common.runtimeUpdateInstalled', { defaultValue: 'Update installed' }),
          content: t('common.runtimeUpdateRestartReady', {
            defaultValue: 'Restart when ready to use the new runtime.',
          }),
        });
        return;
      }

      // Still updating — check again in 5 s.
      pollTimerRef.current = setTimeout(() => void poll(), POLL_INTERVAL);
    };

    void poll();
  }, [checkUpdate, t]);

  // Cleanup on unmount
  useEffect(() => () => clearPollTimer(), []);

  const handleUpdate = useCallback(async () => {
    if (phase !== 'idle') return;
    setPhase('triggering');
    try {
      await httpRequest('POST', '/api/hermes/update');
    } catch {
      Notification.error({
        title: t('common.updateFailed', { defaultValue: 'Update Failed' }),
        content: t('common.updateFailedMsg', { defaultValue: 'Could not start the update. Try again later.' }),
        duration: 5000,
      });
      setPhase('idle');
      return;
    }
    setPhase('polling');
    startPollingForCompletion();
  }, [phase, t, startPollingForCompletion]);

  const updateAvailable = updateInfo?.update_available ?? false;

  if (!updateAvailable && phase === 'idle') {
    return null;
  }

  const handleRestart = async () => {
    if (!window.electronAPI?.restartRuntime) return;
    setPhase('restarting');
    try {
      await window.electronAPI.restartRuntime();
    } catch {
      setPhase('installed');
    }
  };

  const label = (() => {
    switch (phase) {
      case 'triggering':
        return t('common.runtimeUpdating', { defaultValue: 'Runtime updating…' });
      case 'polling':
        return t('common.runtimeUpdating', { defaultValue: 'Runtime updating…' });
      case 'installed':
        return t('common.runtimeUpdateRestartReady', { defaultValue: 'Update installed—restart when ready' });
      case 'restarting':
        return t('common.runtimeUpdateRestarting', { defaultValue: 'Applying update…' });
      default:
        return t('common.runtimeUpdateAvailable', { defaultValue: 'Runtime update available' });
    }
  })();

  const busy = phase === 'triggering' || phase === 'polling' || phase === 'restarting';

  return (
    <div className={classNames('flex items-center gap-6px px-10px h-28px', collapsed && 'justify-center px-0')}>
      <Tooltip content={label} position='right'>
        <div
          onClick={busy ? undefined : phase === 'installed' ? () => void handleRestart() : handleUpdate}
          className={classNames('flex items-center gap-4px w-full', busy ? 'cursor-default' : 'cursor-pointer')}
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <span className='flex items-center justify-center w-16px h-16px rd-4px bg-warning-light-3'>
            <ArrowUp size={12} weight='bold' className={classNames('text-warning-6', busy && 'animate-pulse')} />
          </span>
          {!collapsed && <span className='text-11px text-t-secondary truncate'>{label}</span>}
        </div>
      </Tooltip>
    </div>
  );
};

export default UpdateChecker;
