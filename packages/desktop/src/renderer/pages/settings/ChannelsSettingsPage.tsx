/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Button, Collapse, Empty, Input, Spin, Switch, Tag } from '@arco-design/web-react';
import { ArrowCounterClockwise, ChatCircle, CheckCircle, XCircle } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import ChannelDiscordLogo from '@/renderer/assets/channel-logos/discord.svg';
import ChannelSlackLogo from '@/renderer/assets/channel-logos/slack.svg';
import ChannelTelegramLogo from '@/renderer/assets/channel-logos/telegram.svg';
import WebuiModalContent from '@/renderer/components/settings/SettingsModal/contents/WebuiModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import { type PlatformConfig, useIntegrations } from '@/renderer/pages/integrations/useIntegrations';

const CHANNEL_LOGOS: Record<string, string> = {
  telegram: ChannelTelegramLogo,
  slack: ChannelSlackLogo,
  discord: ChannelDiscordLogo,
};

const PlatformRow: React.FC<{
  platform: PlatformConfig;
  onToggle: (enabled: boolean) => void;
  onSaveEnv: (env: Record<string, string>) => Promise<void>;
}> = ({ platform, onToggle, onSaveEnv }) => {
  const { t } = useTranslation();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const logo = platform.icon || CHANNEL_LOGOS[platform.id];

  const handleSave = async () => {
    const env = Object.fromEntries(Object.entries(drafts).filter(([, v]) => v.trim()));
    if (!Object.keys(env).length) return;
    setSaving(true);
    try {
      await onSaveEnv(env);
      setDrafts({});
    } finally {
      setSaving(false);
    }
  };

  const hasDrafts = Object.values(drafts).some((v) => v.trim());

  return (
    <Collapse.Item
      name={platform.id}
      header={
        <div className='flex items-center justify-between gap-12px w-full pr-8px'>
          <div className='flex items-center gap-10px min-w-0'>
            {logo ? (
              <img src={logo} alt='' className='w-22px h-22px object-contain shrink-0' />
            ) : (
              <ChatCircle size={20} className='shrink-0' />
            )}
            <div className='min-w-0'>
              <div className='text-14px font-500 text-t-primary truncate'>{platform.name}</div>
              {platform.lastError && <div className='text-11px text-t-tertiary'>{platform.lastError}</div>}
            </div>
          </div>
          <div className='flex items-center gap-10px shrink-0' onClick={(e) => e.stopPropagation()}>
            <Tag
              size='small'
              color={platform.connected ? 'green' : 'gray'}
              icon={platform.connected ? <CheckCircle size={12} /> : <XCircle size={12} />}
            >
              {platform.connected
                ? t('integrations.connected', { defaultValue: 'Connected' })
                : t('integrations.disconnected', { defaultValue: 'Disconnected' })}
            </Tag>
            <Switch size='small' checked={platform.enabled} onChange={onToggle} />
          </div>
        </div>
      }
      className='bg-fill-1 rd-10px border border-border-2 mb-8px overflow-hidden [&_.arco-collapse-item-header]:bg-fill-1'
    >
      <div className='flex flex-col gap-10px pb-8px'>
        {platform.description && <p className='text-12px text-t-secondary m-0'>{platform.description}</p>}
        {(platform.envVars ?? []).map((field) => (
          <div key={field.key} className='flex flex-col gap-4px'>
            <span className='text-12px text-t-primary font-medium'>{field.prompt || field.key}</span>
            {field.description && <span className='text-11px text-t-tertiary'>{field.description}</span>}
            <Input.Password
              size='small'
              value={drafts[field.key] ?? ''}
              onChange={(value) => setDrafts((prev) => ({ ...prev, [field.key]: value }))}
              placeholder={field.is_set ? field.redacted_value || '••••••' : field.prompt || field.key}
            />
          </div>
        ))}
        {hasDrafts && (
          <Button type='primary' size='small' loading={saving} onClick={() => void handleSave()}>
            {t('common.save', { defaultValue: 'Save' })}
          </Button>
        )}
      </div>
    </Collapse.Item>
  );
};

const ChannelsSettingsPage: React.FC<{ withWrapper?: boolean }> = ({ withWrapper = true }) => {
  const { t } = useTranslation();
  const { platforms, loading, error, refresh, updatePlatform, savePlatformEnv } = useIntegrations();
  const [expanded, setExpanded] = useState<string[]>([]);

  const content = (
    <div className='flex flex-col gap-20px'>
      <section className='bg-2 rd-16px p-18px'>
        <div className='flex items-center justify-between gap-12px mb-14px'>
          <div>
            <h1 className='text-20px font-600 text-t-primary m-0'>
              {t('settings.channels.title', { defaultValue: 'Channels' })}
            </h1>
            <p className='text-13px text-t-secondary mt-4px mb-0'>{t('settings.webui.featureChannelsDesc')}</p>
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
          <Collapse
            activeKey={expanded}
            onChange={(keys) => setExpanded(Array.isArray(keys) ? keys.map(String) : [String(keys)])}
            bordered={false}
          >
            {platforms.map((platform) => (
              <PlatformRow
                key={platform.id}
                platform={platform}
                onToggle={(enabled) => void updatePlatform(platform.id, { enabled })}
                onSaveEnv={(env) => savePlatformEnv(platform.id, env)}
              />
            ))}
          </Collapse>
        )}
      </section>

      <section className='bg-2 rd-16px p-18px'>
        <WebuiModalContent webuiOnly />
      </section>
    </div>
  );

  if (!withWrapper) {
    return content;
  }

  return <SettingsPageWrapper contentClassName='max-w-1100px'>{content}</SettingsPageWrapper>;
};

export default ChannelsSettingsPage;
