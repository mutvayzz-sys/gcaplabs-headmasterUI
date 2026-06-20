/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Spin, Switch, Tag, Tabs, Input } from '@arco-design/web-react';
import { Plugs, ArrowCounterClockwise } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useMcpServers } from '@renderer/hooks/mcp/useMcpServers';
import { useIntegrations } from './useIntegrations';

const TAB_KEYS = ['mcp', 'webhooks'] as const;

const IntegrationsPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const { webhooks, loading, error, refresh } = useIntegrations();
  const { allMcpServers, isMcpServersLoading } = useMcpServers();
  const [activeTab, setActiveTab] = useState<(typeof TAB_KEYS)[number]>('mcp');

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      <div className='flex items-center justify-between mb-16px shrink-0'>
        <div className='flex items-center gap-8px'>
          <Plugs size={20} weight='duotone' className='text-t-primary' />
          <h1 className='text-18px font-semibold text-t-primary'>
            {t('integrations.title', { defaultValue: 'Integrations' })}
          </h1>
        </div>
        <Button
          type='secondary'
          size='small'
          icon={<ArrowCounterClockwise size={16} />}
          onClick={refresh}
          disabled={loading}
        >
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      <Tabs
        activeTab={activeTab}
        onChange={(key: string) => setActiveTab(key as (typeof TAB_KEYS)[number])}
        type='rounded'
        className='shrink-0'
      >
        <Tabs.TabPane key='mcp' title={t('integrations.mcp', { defaultValue: 'Tool Servers' })} />
        <Tabs.TabPane key='webhooks' title={t('integrations.webhooks', { defaultValue: 'Webhooks' })} />
      </Tabs>

      <div className='flex-1 min-h-0 overflow-y-auto mt-12px'>
        {error && (
          <div className='text-center py-24px text-t-secondary'>
            <p className='text-14px mb-12px'>{error}</p>
            <Button type='primary' size='small' onClick={refresh}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        )}

        {activeTab === 'mcp' && (
          <div className='flex flex-col gap-10px'>
            {isMcpServersLoading ? (
              <div className='flex justify-center py-40px'>
                <Spin size={24} />
              </div>
            ) : allMcpServers.length === 0 ? (
              <Empty description={t('integrations.noMcp', { defaultValue: 'No MCP servers' })} />
            ) : (
              allMcpServers.map((s) => (
                <div
                  key={s.id}
                  className='flex items-center justify-between bg-fill-1 rd-8px border border-border-2 px-14px py-12px'
                >
                  <div className='flex flex-col gap-4px'>
                    <span className='text-14px font-medium text-t-primary'>{s.name}</span>
                    {s.description && <span className='text-12px text-t-secondary'>{s.description}</span>}
                    <span className='text-11px text-t-tertiary'>
                      {String(s.transport)} · {s.id}
                    </span>
                  </div>
                  <Switch size='small' checked={s.enabled} disabled />
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'webhooks' && (
          <div className='flex flex-col gap-10px'>
            {loading ? (
              <div className='flex justify-center py-40px'>
                <Spin size={24} />
              </div>
            ) : webhooks.length === 0 ? (
              <Empty description={t('integrations.noWebhooks', { defaultValue: 'No webhooks configured' })} />
            ) : (
              webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className='flex flex-col gap-6px bg-fill-1 rd-8px border border-border-2 px-14px py-12px'
                >
                  <div className='flex items-center justify-between'>
                    <span className='text-14px font-medium text-t-primary truncate'>{wh.url}</span>
                    <Switch size='small' checked={wh.active} disabled />
                  </div>
                  <div className='flex items-center gap-8px'>
                    {wh.events.map((e) => (
                      <Tag key={e} size='small' color='arcoblue'>
                        {e}
                      </Tag>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntegrationsPage;
