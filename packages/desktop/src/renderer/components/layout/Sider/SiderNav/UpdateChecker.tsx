/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect } from 'react';
import { Notification } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import { httpRequest } from '@/common/adapter/httpBridge';

type UpdateCheckResponse = {
  current_version?: string;
  update_available?: boolean;
  message?: string | null;
};

const NOTICE_DATE_KEY = 'headmaster.runtimeUpdate.noticeDate';

const localDateKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * Runtime update notices are intentionally transient. The persistent sidebar
 * update affordance belongs to Headmaster Desktop, while Hermes runtime
 * availability is announced at most once on the first launch each day.
 */
const UpdateChecker: React.FC<{ collapsed?: boolean }> = () => {
  const { t } = useTranslation();

  const checkOncePerDay = useCallback(async () => {
    const today = localDateKey();
    if (localStorage.getItem(NOTICE_DATE_KEY) === today) return;
    localStorage.setItem(NOTICE_DATE_KEY, today);

    try {
      const data = await httpRequest<UpdateCheckResponse>('GET', '/api/hermes/update/check');
      if (!data.update_available) return;
      Notification.info({
        title: t('common.runtimeUpdateAvailable', { defaultValue: 'Runtime update available' }),
        content:
          data.message ||
          t('common.runtimeUpdateNotice', {
            defaultValue: 'A runtime update is available. Install it when convenient from Runtime settings.',
          }),
        duration: 8000,
      });
    } catch {
      // Runtime update checks are advisory and should never disturb startup.
    }
  }, [t]);

  useEffect(() => {
    const timer = setTimeout(() => void checkOncePerDay(), 5000);
    return () => clearTimeout(timer);
  }, [checkOncePerDay]);

  return null;
};

export default UpdateChecker;
