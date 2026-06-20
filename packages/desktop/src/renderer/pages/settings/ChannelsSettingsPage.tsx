/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Button, Empty, Spin, Switch, Tag } from '@arco-design/web-react';
import { ArrowCounterClockwise, ChatCircle, CheckCircle, XCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { useIntegrations } from '@/renderer/pages/integrations/useIntegrations';
import WebuiSettings from './WebuiSettings';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const ChannelsSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { platforms, loading, error, refresh, updatePlatform } = useIntegrations();

  return (
    <SettingsPageWrapper contentClassName='max-w-1100px'>
      <div className='flex flex-col gap-20px'>
        <section className='bg-2 rd-16px p-18px'>
          <div className='flex items-center justify-between gap-12px mb-14px'>
            <div>
              <h1 className='text-20px font-600 text-t-primary m-0'>
                {t('settings.channels.title', { defaultValue: 'Channels' })}
              </h1>
              <p className='text-13px text-t-secondary mt-4px mb-0'>
                {t('settings.webui.featureChannelsDesc')}
              </p>
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

          {error && <div className='text-13px text-danger-6 mb-12px'>{error}</div>}
          {loading && platforms.length === 0 ? (
            <div className='flex justify-center py-36px'>
              <Spin size={24} />
            </div>
          ) : platforms.length === 0 ? (
            <Empty description={t('integrations.noChannels', { defaultValue: 'No channels available' })} />
          ) : (
            <div className='flex flex-col gap-8px'>
              {platforms.map((platform) => (
                <div
                  key={platform.id}
                  className='flex items-center justify-between gap-12px bg-fill-1 rd-10px border border-border-2 px-14px py-12px'
                >
                  <div className='flex items-center gap-10px min-w-0'>
                    {platform.icon ? (
                      <img src={platform.icon} alt='' className='w-22px h-22px object-contain' />
                    ) : (
                      <ChatCircle size={20} />
                    )}
                    <div className='min-w-0'>
                      <div className='text-14px font-500 text-t-primary truncate'>{platform.name}</div>
                      {platform.lastError && <div className='text-11px text-t-tertiary'>{platform.lastError}</div>}
                    </div>
                  </div>
                  <div className='flex items-center gap-10px'>
                    <Tag
                      size='small'
                      color={platform.connected ? 'green' : 'gray'}
                      icon={platform.connected ? <CheckCircle size={12} /> : <XCircle size={12} />}
                    >
                      {platform.connected
                        ? t('integrations.connected', { defaultValue: 'Connected' })
                        : t('integrations.disconnected', { defaultValue: 'Disconnected' })}
                    </Tag>
                    <Switch
                      size='small'
                      checked={platform.enabled}
                      onChange={(enabled) => void updatePlatform(platform.id, { enabled })}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <WebuiSettings />
      </div>
    </SettingsPageWrapper>
  );
};

export default ChannelsSettingsPage;
