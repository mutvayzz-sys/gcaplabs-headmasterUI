/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alert } from '@arco-design/web-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCouncilSidecar } from '../hooks/useCouncilSidecar';

type Props = {
  className?: string;
};

const CouncilSidecarBanner: React.FC<Props> = ({ className }) => {
  const { t } = useTranslation();
  const { available } = useCouncilSidecar();

  if (available) return null;

  return (
    <Alert
      type='warning'
      className={className}
      content={t('team.sidecar.required', {
        defaultValue:
          'Council requires the local runtime sidecar. Restart Headmaster or check logs in AppData before creating or messaging a Council.',
      })}
    />
  );
};

export default CouncilSidecarBanner;
