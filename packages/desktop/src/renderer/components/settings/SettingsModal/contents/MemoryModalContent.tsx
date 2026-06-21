/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alert, Button, Card, Form, Input, Modal, Radio, Space, Spin, Tag, Typography } from '@arco-design/web-react';
import { Link as LinkIcon, Refresh } from '@icon-park/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configService } from '@/common/config/configService';
import { openExternalUrl } from '@/renderer/utils/platform';
import { DEFAULT_OPENCONCHO_URL, MEMORY_URL_KEY, useMemory } from '@/renderer/pages/memory/useMemory';

const { Text, Title } = Typography;
const HONCHO_DEFAULT_URL = 'https://honcho.gcaplabs.com';
const HONCHO_URL_KEY = 'memory.honchoUrl' as const;

const MemoryModalContent: React.FC = () => {
  const { t } = useTranslation();
  const { providers, provider, loading, error, refresh, updateProvider, resetMemory } = useMemory();
  const [memoryUrl, setMemoryUrl] = useState(() => {
    const stored = configService.get(MEMORY_URL_KEY);
    return typeof stored === 'string' && stored.trim() ? stored : DEFAULT_OPENCONCHO_URL;
  });
  const [honchoUrl, setHonchoUrl] = useState(() => {
    const stored = configService.get(HONCHO_URL_KEY);
    return typeof stored === 'string' && stored.trim() ? stored : HONCHO_DEFAULT_URL;
  });
  const [savingUrls, setSavingUrls] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const isValidUrl = (s: string): boolean => {
    try {
      const u = new URL(s);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSaveUrls = async () => {
    setUrlError(null);
    if (!isValidUrl(memoryUrl) || !isValidUrl(honchoUrl)) {
      setUrlError(t('settings.memory.invalidUrl', { defaultValue: 'Enter a valid http(s) URL.' }));
      return;
    }
    setSavingUrls(true);
    try {
      await Promise.all([
        configService.set(MEMORY_URL_KEY, memoryUrl.trim()),
        configService.set(HONCHO_URL_KEY, honchoUrl.trim()),
      ]);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingUrls(false);
    }
  };

  const handleResetMemory = () => {
    Modal.confirm({
      title: t('settings.memory.resetConfirmTitle', { defaultValue: 'Reset memory?' }),
      content: t('settings.memory.resetConfirmBody', {
        defaultValue: 'This clears persisted runtime memory. This cannot be undone.',
      }),
      okButtonProps: { status: 'danger' },
      onOk: async () => {
        setResetting(true);
        try {
          await resetMemory();
          refresh();
        } finally {
          setResetting(false);
        }
      },
    });
  };

  const builtinFiles = (provider?.config?.files as Record<string, number> | undefined) ?? {};

  return (
    <div className='flex flex-col gap-16px pb-16px max-w-960px'>
      <header className='flex flex-col gap-4px'>
        <Title heading={4} style={{ margin: 0 }}>
          {t('settings.memory.title', { defaultValue: 'Memory & Context' })}
        </Title>
        <Text type='secondary'>
          {t('settings.memory.runtimeSubtitle', {
            defaultValue: 'Configure how the runtime stores and retrieves persistent memory.',
          })}
        </Text>
      </header>

      {(error || urlError) && <Alert type='error' content={error || urlError} />}

      <Card
        title={t('settings.memory.providerTitle', { defaultValue: 'Active memory provider' })}
        extra={
          <Button type='text' size='small' icon={<Refresh theme='outline' size={14} />} onClick={refresh} disabled={loading}>
            {t('common.refresh', { defaultValue: 'Refresh' })}
          </Button>
        }
        bordered
      >
        {loading ? (
          <div className='flex justify-center py-24px'>
            <Spin />
          </div>
        ) : (
          <Radio.Group
            value={provider?.id}
            onChange={(value) => void updateProvider(String(value), { enabled: true })}
            direction='vertical'
            className='flex flex-col gap-8px'
          >
            {providers.map((p) => (
              <div key={p.id} className='flex min-h-32px items-center'>
                <Radio value={p.id} className='!m-0 !leading-normal'>
                  <span className='text-14px text-t-primary'>{p.name}</span>
                  {p.enabled && (
                    <Tag size='small' color='green' className='ml-8px'>
                      {t('settings.memory.active', { defaultValue: 'Active' })}
                    </Tag>
                  )}
                </Radio>
              </div>
            ))}
          </Radio.Group>
        )}

        {Object.keys(builtinFiles).length > 0 && (
          <div className='mt-16px pt-12px border-t border-border-2'>
            <Text bold className='text-13px'>
              {t('settings.memory.builtinFiles', { defaultValue: 'Built-in markdown files' })}
            </Text>
            <div className='mt-8px flex flex-col gap-4px'>
              {Object.entries(builtinFiles).map(([name, count]) => (
                <div key={name} className='flex justify-between text-12px text-t-secondary'>
                  <span>{name}</span>
                  <span>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className='mt-16px'>
          <Button status='danger' type='outline' loading={resetting} onClick={handleResetMemory}>
            {t('settings.memory.resetRuntime', { defaultValue: 'Reset runtime memory' })}
          </Button>
        </div>
      </Card>

      <Card title={t('settings.memory.externalTitle', { defaultValue: 'External memory dashboards' })} bordered>
        <Space direction='vertical' size={12} className='w-full'>
          <div className='flex items-center justify-between gap-12px'>
            <div>
              <Text bold>{t('settings.memory.openconchoTitle', { defaultValue: 'OpenConcho Memory screen' })}</Text>
              <div>
                <Text type='secondary' style={{ fontSize: 12 }}>
                  {t('settings.memory.openconchoEmbedHint', {
                    defaultValue: 'Shown in the sidebar Memory tab.',
                  })}
                </Text>
              </div>
            </div>
            <Button icon={<LinkIcon />} onClick={() => void openExternalUrl(memoryUrl)}>
              {t('settings.memory.open', { defaultValue: 'Open' })}
            </Button>
          </div>
          <div className='flex items-center justify-between gap-12px'>
            <div>
              <Text bold>{t('settings.memory.honchoTitle', { defaultValue: 'Honcho dashboard' })}</Text>
            </div>
            <Button icon={<LinkIcon />} onClick={() => void openExternalUrl(honchoUrl)}>
              {t('settings.memory.open', { defaultValue: 'Open' })}
            </Button>
          </div>
        </Space>
      </Card>

      <Card title={t('settings.memory.connectionsTitle', { defaultValue: 'Connection URLs' })} bordered>
        <Form layout='vertical'>
          <Form.Item label={t('settings.memory.memoryUrlLabel', { defaultValue: 'OpenConcho URL' })}>
            <Input value={memoryUrl} onChange={setMemoryUrl} placeholder={DEFAULT_OPENCONCHO_URL} disabled={savingUrls} />
          </Form.Item>
          <Form.Item label={t('settings.memory.honchoUrlLabel', { defaultValue: 'Honcho dashboard URL' })}>
            <Input value={honchoUrl} onChange={setHonchoUrl} placeholder={HONCHO_DEFAULT_URL} disabled={savingUrls} />
          </Form.Item>
        </Form>
        <div className='flex justify-end'>
          <Button type='primary' onClick={() => void handleSaveUrls()} loading={savingUrls}>
            {t('settings.memory.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default MemoryModalContent;
