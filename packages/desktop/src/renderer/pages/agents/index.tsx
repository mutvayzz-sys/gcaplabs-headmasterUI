/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Tabs } from '@arco-design/web-react';
import { Users } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import AssistantSettings from '@renderer/pages/settings/AssistantSettings';
import AgentsEnginesTab from './AgentsEnginesTab';
import AgentsAutomationsTab from './AgentsAutomationsTab';

type AgentsTab = 'engines' | 'specialists' | 'automations';

const isAgentsTab = (value: string | null): value is AgentsTab =>
  value === 'engines' || value === 'specialists' || value === 'automations';

const AgentsPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<AgentsTab>(() => {
    const tab = searchParams.get('tab');
    return isAgentsTab(tab) ? tab : 'engines';
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isAgentsTab(tab) && tab !== activeTab) setActiveTab(tab);
  }, [searchParams, activeTab]);

  const handleTabChange = (key: string) => {
    if (!isAgentsTab(key)) return;
    setActiveTab(key);
    setSearchParams({ tab: key }, { replace: true });
  };

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      <div className='flex items-center gap-8px mb-12px shrink-0'>
        <Users size={20} weight='duotone' className='text-t-primary' />
        <h1 className='text-18px font-semibold text-t-primary'>{t('sidebar.agents', { defaultValue: 'Agents' })}</h1>
      </div>

      <Tabs activeTab={activeTab} onChange={handleTabChange} type='rounded' className='shrink-0 mb-12px'>
        <Tabs.TabPane
          key='engines'
          title={
            <span className='inline-flex items-center gap-6px'>
              {t('settings.agents', { defaultValue: 'Engines' })}
            </span>
          }
        />
        <Tabs.TabPane key='specialists' title={t('settings.specialists', { defaultValue: 'Specialists' })} />
        <Tabs.TabPane key='automations' title={t('sidebar.automations', { defaultValue: 'Automations' })} />
      </Tabs>

      <div className='flex-1 min-h-0 overflow-hidden'>
        {activeTab === 'engines' && <AgentsEnginesTab />}
        {activeTab === 'specialists' && (
          <div className='h-full min-h-0 overflow-hidden rd-10px border border-border-2 bg-fill-1'>
            <AssistantSettings embedded />
          </div>
        )}
        {activeTab === 'automations' && <AgentsAutomationsTab />}
      </div>
    </div>
  );
};

export default AgentsPage;
