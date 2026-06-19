/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Button, Card, Empty, Input, InputNumber, Message, Select, Spin, Switch, Typography } from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import { httpGet, httpPut } from '@/common/adapter/httpBridge';

const { Text, Title } = Typography;

type SchemaFieldType = 'string' | 'number' | 'boolean' | 'list' | 'object' | 'select';

interface ConfigSchemaField {
  type: SchemaFieldType;
  description?: string;
  category?: string;
  options?: string[];
}

interface ConfigSchemaResponse {
  fields: Record<string, ConfigSchemaField>;
  category_order: string[];
}

type ConfigData = Record<string, unknown>;
type ConnectionMode = 'local' | 'remote';

interface RemoteConnectionConfig {
  host: string;
  port: number;
  token: string;
}

type RuntimeElectronApi = {
  getConnectionMode?: () => Promise<ConnectionMode>;
  setConnectionMode?: (mode: ConnectionMode) => Promise<unknown>;
  getRemoteConnectionConfig?: () => Promise<RemoteConnectionConfig>;
  setRemoteConnectionConfig?: (config: RemoteConnectionConfig) => Promise<unknown>;
};

function getRuntimeElectronApi(): RuntimeElectronApi | null {
  if (typeof window === 'undefined') return null;
  const maybeWindow = window as Window & { electronAPI?: RuntimeElectronApi };
  return maybeWindow.electronAPI ?? null;
}

function getConfigValue(obj: ConfigData, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function setConfigValue(obj: ConfigData, path: string, value: unknown): ConfigData {
  const keys = path.split('.');
  const next: ConfigData = { ...obj };
  let current: Record<string, unknown> = next;

  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const existing = current[key];
    current[key] =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
  return next;
}

function isSchemaFieldType(value: unknown): value is SchemaFieldType {
  return typeof value === 'string' && ['string', 'number', 'boolean', 'list', 'object', 'select'].includes(value);
}

const RuntimeSettings: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [schema, setSchema] = useState<ConfigSchemaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionMode, setConnectionModeState] = useState<ConnectionMode>('local');
  const [remoteConfig, setRemoteConfigState] = useState<RemoteConnectionConfig>({ host: '', port: 9119, token: '' });
  const [savingConnection, setSavingConnection] = useState(false);

  const fetchConnectionSettings = useCallback(async () => {
    const api = getRuntimeElectronApi();
    if (!api?.getConnectionMode || !api.getRemoteConnectionConfig) return;
    try {
      const [mode, remote] = await Promise.all([api.getConnectionMode(), api.getRemoteConnectionConfig()]);
      setConnectionModeState(mode);
      setRemoteConfigState(remote);
    } catch (err) {
      console.error('[RuntimeSettings] failed to load connection settings', err);
    }
  }, []);

  const handleSaveConnection = useCallback(async () => {
    const api = getRuntimeElectronApi();
    if (!api?.setConnectionMode || !api.setRemoteConnectionConfig) return;
    setSavingConnection(true);
    try {
      await api.setRemoteConnectionConfig(remoteConfig);
      await api.setConnectionMode(connectionMode);
      Message.success(t('settings.runtime.connectionSaved', { defaultValue: 'Connection settings saved. Restart Headmaster to apply.' }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Message.error(message);
      console.error('[RuntimeSettings] failed to save connection settings', err);
    } finally {
      setSavingConnection(false);
    }
  }, [connectionMode, remoteConfig, t]);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configData, schemaData] = await Promise.all([
        httpGet<ConfigData>('/api/config').invoke(),
        httpGet<ConfigSchemaResponse>('/api/config/schema').invoke(),
      ]);
      setConfig(configData);
      setSchema(schemaData);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('[RuntimeSettings] failed to load config', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
    void fetchConnectionSettings();
  }, [fetchConfig, fetchConnectionSettings]);

  const handleChange = useCallback((path: string, value: unknown) => {
    setConfig((prev) => (prev ? setConfigValue(prev, path, value) : prev));
  }, []);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      await httpPut<unknown, ConfigData>('/api/config').invoke(config);
      Message.success(t('settings.runtime.saved', { defaultValue: 'Settings saved' }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Message.error(message);
      console.error('[RuntimeSettings] failed to save config', err);
    } finally {
      setSaving(false);
    }
  }, [config, t]);

  const categories = useMemo(() => {
    if (!schema) return [];
    const order = Array.isArray(schema.category_order) ? schema.category_order : [];
    const seen = new Set<string>();
    const ordered: string[] = [];

    for (const category of order) {
      if (typeof category === 'string' && !seen.has(category)) {
        seen.add(category);
        ordered.push(category);
      }
    }

    const others = Object.values(schema.fields)
      .map((field) => field.category)
      .filter((category): category is string => typeof category === 'string' && !seen.has(category));

    for (const category of others) {
      seen.add(category);
      ordered.push(category);
    }

    return ordered;
  }, [schema]);

  const fieldsByCategory = useMemo(() => {
    if (!schema) return new Map<string, [string, ConfigSchemaField][]>();
    const map = new Map<string, [string, ConfigSchemaField][]>();
    for (const [path, field] of Object.entries(schema.fields)) {
      if (!field || typeof field !== 'object') continue;
      if (!isSchemaFieldType(field.type)) continue;
      const category = field.category || 'other';
      const list = map.get(category) ?? [];
      list.push([path, field]);
      map.set(category, list);
    }
    return map;
  }, [schema]);

  const renderControl = (path: string, field: ConfigSchemaField): React.ReactNode => {
    if (!config) return null;
    const value = getConfigValue(config, path);

    switch (field.type) {
      case 'boolean':
        return (
          <Switch
            checked={Boolean(value)}
            onChange={(checked) => handleChange(path, checked)}
          />
        );
      case 'number':
        return (
          <InputNumber
            value={typeof value === 'number' ? value : undefined}
            onChange={(v) => handleChange(path, typeof v === 'number' ? v : undefined)}
            style={{ width: '100%' }}
          />
        );
      case 'select':
        return (
          <Select
            value={typeof value === 'string' ? value : undefined}
            onChange={(v) => handleChange(path, v)}
            options={(field.options ?? []).map((option) => ({ label: option, value: option }))}
            style={{ width: '100%' }}
            allowClear
          />
        );
      case 'list':
      case 'object':
        return (
          <Input.TextArea
            value={JSON.stringify(value ?? null, null, 2)}
            readOnly
            autoSize={{ minRows: 2, maxRows: 8 }}
          />
        );
      case 'string':
      default:
        return (
          <Input
            value={typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''}
            onChange={(v) => handleChange(path, v)}
          />
        );
    }
  };

  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <div className='flex flex-col gap-16px pb-24px'>
        <header className='flex items-center justify-between gap-12px flex-wrap'>
          <div>
            <Title heading={4} style={{ margin: 0 }}>
              {t('settings.runtime.title', { defaultValue: 'Runtime' })}
            </Title>
            <Text type='secondary'>
              {t('settings.runtime.subtitle', { defaultValue: 'Configure the Runtime settings for your active profile.' })}
            </Text>
          </div>
          <Button type='primary' loading={saving} disabled={loading || !config} onClick={() => void handleSave()}>
            {saving
              ? t('settings.runtime.saving', { defaultValue: 'Saving…' })
              : t('settings.runtime.save', { defaultValue: 'Save' })}
          </Button>
        </header>

        <Card
          bordered
          title={t('settings.runtime.connectionTitle', { defaultValue: 'Runtime Connection' })}
          extra={
            <Button size='small' loading={savingConnection} onClick={() => void handleSaveConnection()}>
              {t('settings.runtime.connectionSave', { defaultValue: 'Save connection' })}
            </Button>
          }
        >
          <div className='grid gap-16px' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div className='flex flex-col gap-6px'>
              <label className='text-14px font-medium'>
                {t('settings.runtime.connectionMode', { defaultValue: 'Connection mode' })}
              </label>
              <Select
                value={connectionMode}
                onChange={(value) => setConnectionModeState(value as ConnectionMode)}
                options={[
                  { label: t('settings.runtime.connectionLocal', { defaultValue: 'Local Runtime' }), value: 'local' },
                  { label: t('settings.runtime.connectionRemote', { defaultValue: 'Remote Runtime' }), value: 'remote' },
                ]}
              />
              <Text type='secondary'>
                {t('settings.runtime.connectionHelp', {
                  defaultValue: 'Local starts the runtime on this machine. Remote connects to a runtime on another machine.',
                })}
              </Text>
            </div>

            <div className='flex flex-col gap-6px'>
              <label className='text-14px font-medium'>{t('settings.runtime.remoteHost', { defaultValue: 'Remote host' })}</label>
              <Input
                disabled={connectionMode !== 'remote'}
                placeholder='192.168.1.20'
                value={remoteConfig.host}
                onChange={(host) => setRemoteConfigState((prev) => ({ ...prev, host }))}
              />
            </div>

            <div className='flex flex-col gap-6px'>
              <label className='text-14px font-medium'>{t('settings.runtime.remotePort', { defaultValue: 'Remote port' })}</label>
              <InputNumber
                disabled={connectionMode !== 'remote'}
                min={1}
                max={65535}
                value={remoteConfig.port}
                onChange={(port) =>
                  setRemoteConfigState((prev) => ({ ...prev, port: typeof port === 'number' ? port : 9119 }))
                }
              />
            </div>

            <div className='flex flex-col gap-6px'>
              <label className='text-14px font-medium'>{t('settings.runtime.remoteToken', { defaultValue: 'Session token' })}</label>
              <Input.Password
                disabled={connectionMode !== 'remote'}
                value={remoteConfig.token}
                onChange={(token) => setRemoteConfigState((prev) => ({ ...prev, token }))}
              />
            </div>
          </div>
        </Card>

        {loading ? (
          <Card bordered>
            <div className='flex flex-col items-center gap-12px py-32px'>
              <Spin />
              <Text type='secondary'>
                {t('settings.runtime.loading', { defaultValue: 'Loading runtime settings…' })}
              </Text>
            </div>
          </Card>
        ) : error ? (
          <Card bordered>
            <div className='flex flex-col gap-12px py-16px'>
              <Text type='error'>
                {t('settings.runtime.loadError', { defaultValue: 'Failed to load runtime settings' })}: {error}
              </Text>
              <Button onClick={() => void fetchConfig()}>
                {t('settings.runtime.retry', { defaultValue: 'Retry' })}
              </Button>
            </div>
          </Card>
        ) : categories.length === 0 ? (
          <Card bordered>
            <Empty description={t('settings.runtime.noFields', { defaultValue: 'No configurable settings found' })} />
          </Card>
        ) : (
          categories.map((category) => {
            const fields = fieldsByCategory.get(category) ?? [];
            if (fields.length === 0) return null;
            return (
              <Card
                key={category}
                title={
                  <span className='capitalize'>
                    {category === 'other'
                      ? t('settings.runtime.unknownCategory', { defaultValue: 'Other' })
                      : category}
                  </span>
                }
                bordered
              >
                <div className='grid gap-16px' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                  {fields.map(([path, field]) => (
                    <div key={path} className='flex flex-col gap-6px'>
                      <label className='text-14px font-medium'>{field.description || path}</label>
                      {renderControl(path, field)}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </SettingsPageWrapper>
  );
};

export default RuntimeSettings;
