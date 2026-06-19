/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, Badge } from '@arco-design/web-react';
import { ArrowUp } from '@phosphor-icons/react';
import { ipcBridge } from '@/common';
import classNames from 'classnames';

const CHECK_DELAY = 20_000; // 20 s after startup (let app settle)
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // every 6 hours

const AppUpdateChecker: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const { t } = useTranslation();
  const [newVersion, setNewVersion] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await ipcBridge.update.check.invoke({ includePrerelease: false });
      if (res?.success && res.data?.updateAvailable && res.data.latest?.version) {
        setNewVersion(res.data.latest.version);
      } else {
        setNewVersion(null);
      }
    } catch {
      // network unavailable or repo has no releases yet — stay silent
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(check, CHECK_DELAY);
    const interval = setInterval(check, CHECK_INTERVAL);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [check]);

  if (!newVersion) return null;

  const label = t('common.appUpdateAvailable', {
    defaultValue: 'New version available: v{{version}}',
    version: newVersion,
  });

  const openUpdateModal = () => {
    window.dispatchEvent(new CustomEvent('headmaster-open-update-modal', { detail: { source: 'sidebar' } }));
  };

  return (
    <div className={classNames('flex items-center gap-6px px-10px h-28px', collapsed && 'justify-center px-0')}>
      <Tooltip content={label} position='right'>
        <div onClick={openUpdateModal} className='flex items-center gap-4px cursor-pointer w-full'>
          <Badge dot={true} color='var(--color-success-6)'>
            <span className='flex items-center justify-center w-16px h-16px rd-4px bg-success-light-3'>
              <ArrowUp size={12} weight='bold' className='text-success-6' />
            </span>
          </Badge>
          {!collapsed && <span className='text-11px text-t-secondary truncate'>{label}</span>}
        </div>
      </Tooltip>
    </div>
  );
};

export default AppUpdateChecker;
