/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

const ApprovalsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className='size-full flex flex-col items-center justify-center p-24px'>
      <h1 className='text-24px font-semibold text-t-primary mb-12px'>
        {t('approvals.title', { defaultValue: 'Approvals' })}
      </h1>
      <p className='text-14px text-t-secondary'>
        {t('approvals.comingSoon', { defaultValue: 'Human-in-the-loop approvals — coming in Phase 5B' })}
      </p>
    </div>
  );
};

export default ApprovalsPage;
