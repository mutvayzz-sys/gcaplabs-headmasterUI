/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, Badge, Button, Notification } from '@arco-design/web-react';
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

const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

const UpdateChecker: React.FC<{ collapsed?: boolean }> = ({ collapsed = false }) => {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResponse | null>(null);
  const [updating, setUpdating] = useState(false);

  const checkUpdate = useCallback(async () => {
    try {
      const data = await httpRequest<UpdateCheckResponse>('GET', '/api/hermes/update/check');
      setUpdateInfo(data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    // Delay initial check to let the dashboard come up
    const timer = setTimeout(checkUpdate, 5000);
    const interval = setInterval(checkUpdate, UPDATE_CHECK_INTERVAL);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkUpdate]);

  const handleUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      await httpRequest('POST', '/api/hermes/update');
      Notification.success({
        title: t('common.updateStarted', { defaultValue: 'Update Started' }),
        content: t('common.updateStartedMsg', { defaultValue: 'Headmaster update is downloading. Restart Headmaster to apply the update.' }),
        duration: 8000,
      });
    } catch {
      Notification.error({
        title: t('common.updateFailed', { defaultValue: 'Update Failed' }),
        content: t('common.updateFailedMsg', { defaultValue: 'Could not start the update. Try again later.' }),
        duration: 5000,
      });
    }
    setUpdating(false);
  }, [t]);

  const updateAvailable = updateInfo?.update_available ?? false;

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className={classNames('flex items-center gap-6px px-10px h-28px', collapsed && 'justify-center px-0')}>
      <Tooltip
        content={t('common.updateAvailable', { defaultValue: 'Headmaster update available' })}
        position='right'
      >
        <div
          onClick={handleUpdate}
          className='flex items-center gap-4px cursor-pointer w-full'
          style={{ opacity: updating ? 0.5 : 1 }}
        >
          <Badge dot={true} color='var(--color-warning-6)'>
            <span className='flex items-center justify-center w-16px h-16px rd-4px bg-warning-light-3'>
              <ArrowUp size={12} weight='bold' className='text-warning-6' />
            </span>
          </Badge>
          {!collapsed && (
            <span className='text-11px text-t-secondary truncate'>
              {updating
                ? t('common.updating', { defaultValue: 'Updating…' })
                : t('common.updateAvailable', { defaultValue: 'Update Available' })}
            </span>
          )}
        </div>
      </Tooltip>
    </div>
  );
};

export default UpdateChecker;