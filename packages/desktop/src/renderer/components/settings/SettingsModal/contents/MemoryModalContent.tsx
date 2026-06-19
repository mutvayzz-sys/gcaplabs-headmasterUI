/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Alert, Avatar, Button, Card, Form, Input, Space, Tag, Tooltip, Typography } from '@arco-design/web-react';
import { BookOne, Link as LinkIcon, Refresh, Right } from '@icon-park/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configService } from '@/common/config/configService';
import { openExternalUrl } from '@/renderer/utils/platform';

const { Text, Title } = Typography;

/**
 * Where the Memory tab points by default. Matches the published openconcho
 * Docker / prod container which serves the SPA on 8080. The user can change
 * this to any URL where they host openconcho.
 */
const DEFAULT_MEMORY_URL = 'http://localhost:8080';
const HONCHO_DEFAULT_URL = 'https://honcho.gcaplabs.com';

const MEMORY_URL_KEY = 'memory.openconchoUrl' as const;
const HONCHO_URL_KEY = 'memory.honchoUrl' as const;

/**
 * Shared content used by both:
 *  - `pages/settings/MemorySettings.tsx` (the routed page in the sider)
 *  - `SettingsModal` when the user opens the Memory tab
 *
 * Renders two large "Open" cards: one for the openconcho Memory screen
 * (configurable URL, defaults to localhost:8080), one for the upstream
 * Honcho dashboard. Both use the existing openExternalUrl helper so they
 * open in the OS browser from a packaged build, and in a new tab from the
 * WebUI build.
 */
const MemoryModalContent: React.FC = () => {
  const { t } = useTranslation();

  const [memoryUrl, setMemoryUrl] = useState<string>(() => {
    const stored = configService.get(MEMORY_URL_KEY);
    return typeof stored === 'string' && stored.trim() ? stored : DEFAULT_MEMORY_URL;
  });
  const [honchoUrl, setHonchoUrl] = useState<string>(() => {
    const stored = configService.get(HONCHO_URL_KEY);
    return typeof stored === 'string' && stored.trim() ? stored : HONCHO_DEFAULT_URL;
  });
  const [savedMemory, setSavedMemory] = useState<string>(memoryUrl);
  const [savedHoncho, setSavedHoncho] = useState<string>(honchoUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pick up any later changes to the cached values (e.g. from another tab).
  useEffect(() => {
    setSavedMemory(memoryUrl);
  }, [memoryUrl]);
  useEffect(() => {
    setSavedHoncho(honchoUrl);
  }, [honchoUrl]);

  const isValidUrl = (s: string): boolean => {
    try {
      const u = new URL(s);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!isValidUrl(memoryUrl)) {
      setError(t('settings.memory.invalidUrl', { defaultValue: 'Enter a valid http(s) URL.' }));
      return;
    }
    if (!isValidUrl(honchoUrl)) {
      setError(t('settings.memory.invalidUrl', { defaultValue: 'Enter a valid http(s) URL.' }));
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        configService.set(MEMORY_URL_KEY, memoryUrl.trim()),
        configService.set(HONCHO_URL_KEY, honchoUrl.trim()),
      ]);
      setSavedMemory(memoryUrl.trim());
      setSavedHoncho(honchoUrl.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setMemoryUrl(DEFAULT_MEMORY_URL);
    setHonchoUrl(HONCHO_DEFAULT_URL);
  };

  const openMemory = () => {
    void openExternalUrl(savedMemory);
  };
  const openHoncho = () => {
    void openExternalUrl(savedHoncho);
  };

  const dirty = memoryUrl.trim() !== savedMemory || honchoUrl.trim() !== savedHoncho;

  return (
    <div className='flex flex-col gap-16px pb-16px max-w-960px'>
      <header className='flex flex-col gap-4px'>
        <Title heading={4} style={{ margin: 0 }}>
          {t('settings.memory.title', { defaultValue: 'Memory' })}
        </Title>
        <Text type='secondary'>
          {t('settings.memory.subtitle', {
            defaultValue:
              'Open the Memory screen to browse peer memory, sessions, conclusions, and dream history for this workspace.',
          })}
        </Text>
      </header>

      {error ? <Alert type='error' content={error} /> : null}

      <Card bordered>
        <div className='flex items-center gap-12px'>
          <Avatar size={40} style={{ background: 'var(--color-primary-light-3, #e8f3ff)' }}>
            <BookOne theme='outline' size='20' />
          </Avatar>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-8px'>
              <Text bold style={{ fontSize: 15 }}>
                {t('settings.memory.openconchoTitle', { defaultValue: 'OpenConcho Memory screen' })}
              </Text>
              <Tag size='small' color='gray'>
                {t('settings.memory.beta', { defaultValue: 'External' })}
              </Tag>
            </div>
            <Text type='secondary' style={{ fontSize: 12 }} ellipsis>
              {t('settings.memory.openconchoSubtitle', {
                defaultValue: 'Browse memories, peers, sessions, and conclusions for the active Honcho instance.',
              })}
            </Text>
          </div>
          <Tooltip content={t('settings.memory.openTooltip', { defaultValue: 'Open in browser' })}>
            <Button type='primary' icon={<LinkIcon />} onClick={openMemory}>
              {t('settings.memory.open', { defaultValue: 'Open' })}
            </Button>
          </Tooltip>
        </div>
      </Card>

      <Card bordered>
        <div className='flex items-center gap-12px'>
          <Avatar size={40} style={{ background: 'var(--color-primary-light-3, #e8f3ff)' }}>
            <Right theme='outline' size='20' />
          </Avatar>
          <div className='flex-1 min-w-0'>
            <Text bold style={{ fontSize: 15 }}>
              {t('settings.memory.honchoTitle', { defaultValue: 'Honcho dashboard' })}
            </Text>
            <div>
              <Text type='secondary' style={{ fontSize: 12 }}>
                {t('settings.memory.honchoSubtitle', {
                  defaultValue: 'The raw Honcho API surface, used by the Memory screen above.',
                })}
              </Text>
            </div>
          </div>
          <Tooltip content={t('settings.memory.openTooltip', { defaultValue: 'Open in browser' })}>
            <Button icon={<LinkIcon />} onClick={openHoncho}>
              {t('settings.memory.open', { defaultValue: 'Open' })}
            </Button>
          </Tooltip>
        </div>
      </Card>

      <Card title={t('settings.memory.connectionsTitle', { defaultValue: 'Connection URLs' })} bordered>
        <Form layout='vertical'>
          <Form.Item
            label={t('settings.memory.memoryUrlLabel', { defaultValue: 'Memory screen URL' })}
            extra={t('settings.memory.memoryUrlHelp', {
              defaultValue:
                'The web URL where openconcho is hosted. Defaults to the published container on localhost:8080.',
            })}
          >
            <Input
              value={memoryUrl}
              onChange={setMemoryUrl}
              placeholder={DEFAULT_MEMORY_URL}
              allowClear
              disabled={saving}
            />
          </Form.Item>
          <Form.Item
            label={t('settings.memory.honchoUrlLabel', { defaultValue: 'Honcho dashboard URL' })}
            extra={t('settings.memory.honchoUrlHelp', {
              defaultValue: 'Upstream Honcho base URL. Used by the Memory screen.',
            })}
          >
            <Input
              value={honchoUrl}
              onChange={setHonchoUrl}
              placeholder={HONCHO_DEFAULT_URL}
              allowClear
              disabled={saving}
            />
          </Form.Item>
        </Form>

        <div className='flex items-center justify-end gap-8px mt-8px'>
          <Button icon={<Refresh theme='outline' size='14' />} onClick={handleReset} disabled={saving}>
            {t('settings.memory.reset', { defaultValue: 'Reset to defaults' })}
          </Button>
          <Button type='primary' onClick={handleSave} disabled={saving || !dirty}>
            {saving
              ? t('settings.memory.saving', { defaultValue: 'Saving…' })
              : t('settings.memory.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      </Card>

      <Card bordered>
        <Space direction='vertical' size={4}>
          <Text bold>{t('settings.memory.footerTitle', { defaultValue: 'About this screen' })}</Text>
          <Text type='secondary'>
            {t('settings.memory.footerBody', {
              defaultValue:
                'The Memory screen is a separate web app. The links above open it in your system browser with the connection details it needs to talk to the upstream Honcho instance. URL changes here only affect which address the Open buttons point to — they do not change how Headmaster talks to the runtime.',
            })}
          </Text>
        </Space>
      </Card>
    </div>
  );
};

export default MemoryModalContent;
