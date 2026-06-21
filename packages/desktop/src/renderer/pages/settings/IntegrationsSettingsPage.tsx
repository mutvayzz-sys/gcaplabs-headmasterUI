/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import IntegrationsPage from '@/renderer/pages/integrations';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const IntegrationsSettingsPage: React.FC = () => (
  <SettingsPageWrapper contentClassName='max-w-1100px'>
    <IntegrationsPage />
  </SettingsPageWrapper>
);

export default IntegrationsSettingsPage;
