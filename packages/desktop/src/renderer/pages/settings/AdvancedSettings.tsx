/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useState } from 'react';
import { Tabs } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const WebuiSettings = React.lazy(() => import('@renderer/pages/settings/WebuiSettings'));
const CapabilitiesSettings = React.lazy(() => import('@renderer/pages/settings/CapabilitiesSettings'));
const IntegrationsPage = React.lazy(() => import('@renderer/pages/integrations'));

const TabPane = Tabs.TabPane;

const AdvancedSettings: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('webui');

  return (
    <SettingsPageWrapper contentClassName='max-w-1000px'>
      <Tabs activeTab={activeTab} onChange={setActiveTab} type='line'>
        <TabPane key='webui' title={t('settings.webui', { defaultValue: 'Web UI' })}>
          <Suspense fallback={<div />}>
            <WebuiSettings />
          </Suspense>
        </TabPane>
        <TabPane key='capabilities' title={t('settings.capabilities', { defaultValue: 'Capabilities' })}>
          <Suspense fallback={<div />}>
            <CapabilitiesSettings />
          </Suspense>
        </TabPane>
        <TabPane key='integrations' title={t('settings.integrations', { defaultValue: 'Integrations' })}>
          <Suspense fallback={<div />}>
            <IntegrationsPage />
          </Suspense>
        </TabPane>
      </Tabs>
    </SettingsPageWrapper>
  );
};

export default AdvancedSettings;
