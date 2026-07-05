/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import AppsPage from '@/renderer/pages/apps';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const IntegrationsSettingsPage: React.FC = () => (
  <SettingsPageWrapper contentClassName='max-w-1100px'>
    <AppsPage />
  </SettingsPageWrapper>
);

export default IntegrationsSettingsPage;
