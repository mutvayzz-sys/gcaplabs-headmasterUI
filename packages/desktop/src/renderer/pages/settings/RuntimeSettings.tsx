/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Button,
  Card,
  Empty,
  Input,
  InputNumber,
  Message,
  Select,
  Spin,
  Switch,
  Typography,
} from '@arco-design/web-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { httpGet, httpPut } from '@/common/adapter/httpBridge';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const { Text, Title } = Typography;

type SchemaFieldType = 'string' | 'text' | 'number' | 'boolean' | 'list' | 'object' | 'select';

interface ConfigSchemaField {
  type: SchemaFieldType;
  description?: string;
  category?: string;
  options?: unknown[];
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  required?: boolean;
  [key: string]: unknown;
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

type FieldState = {
  draft?: string;
  error?: string;
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

function deleteConfigValue(obj: ConfigData, path: string): ConfigData {
  const keys = path.split('.');
  const next: ConfigData = { ...obj };
  let current: Record<string, unknown> = next;

  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    const existing = current[key];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      return next;
    }
    current[key] = { ...(existing as Record<string, unknown>) };
    current = current[key] as Record<string, unknown>;
  }

  delete current[keys[keys.length - 1]];
  return next;
}

function isSchemaFieldType(value: unknown): value is SchemaFieldType {
  return (
    typeof value === 'string' && ['string', 'text', 'number', 'boolean', 'list', 'object', 'select'].includes(value)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function prettyValue(value: unknown): string {
  if (value === undefined) return 'unset';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.length > 0 ? value : '(empty)';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeOptions(options: unknown[] | undefined): Array<{ label: string; value: string }> {
  return (options ?? [])
    .map((option) => {
      if (typeof option === 'string' || typeof option === 'number') {
        return { label: String(option), value: String(option) };
      }
      if (isPlainObject(option)) {
        const value = option.value ?? option.id ?? option.name ?? option.label;
        const label = option.label ?? option.name ?? value;
        if (typeof value === 'string' || typeof value === 'number') {
          return { label: String(label ?? value), value: String(value) };
        }
      }
      return null;
    })
    .filter((entry): entry is { label: string; value: string } => Boolean(entry));
}

function validateFieldValue(field: ConfigSchemaField, value: unknown): string | null {
  switch (field.type) {
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Expected a boolean value.';
    case 'number':
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'Expected a number.';
      if (typeof field.min === 'number' && value < field.min) return `Minimum value is ${field.min}.`;
      if (typeof field.max === 'number' && value > field.max) return `Maximum value is ${field.max}.`;
      return null;
    case 'select': {
      if (value === undefined || value === null || value === '') return null;
      const options = normalizeOptions(field.options);
      if (options.length === 0) return typeof value === 'string' ? null : 'Expected a string value.';
      return typeof value === 'string' && options.some((option) => option.value === value)
        ? null
        : 'Choose one of the available options.';
    }
    case 'list':
      return Array.isArray(value) ? null : 'Expected a JSON array.';
    case 'object':
      return isPlainObject(value) ? null : 'Expected a JSON object.';
    case 'text':
    case 'string':
    default:
      return typeof value === 'string' ? null : 'Expected a string value.';
  }
}

function parseStructuredDraft(field: ConfigSchemaField, raw: string): { value?: unknown; error?: string } {
  if (field.type !== 'list' && field.type !== 'object') {
    return { value: raw };
  }

  if (!raw.trim()) {
    return { value: field.type === 'list' ? [] : {} };
  }

  try {
    const parsed = JSON.parse(raw);
    if (field.type === 'list' && !Array.isArray(parsed)) {
      return { error: 'Expected JSON array.' };
    }
    if (field.type === 'object' && !isPlainObject(parsed)) {
      return { error: 'Expected JSON object.' };
    }
    return { value: parsed };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Invalid JSON.',
    };
  }
}

function formatDraftValue(field: ConfigSchemaField, value: unknown): string {
  if (field.type !== 'list' && field.type !== 'object') return String(value ?? '');
  if (value === undefined || value === null) return field.type === 'list' ? '[]' : '{}';
  return JSON.stringify(value, null, 2);
}

function getSectionLabel(path: string): string {
  const section = path.split('.')[0] || 'general';
  return section.replace(/_/g, ' ');
}

const RuntimeSettings: React.FC = () => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [defaults, setDefaults] = useState<ConfigData | null>(null);
  const [schema, setSchema] = useState<ConfigSchemaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionMode, setConnectionModeState] = useState<ConnectionMode>('local');
  const [remoteConfig, setRemoteConfigState] = useState<RemoteConnectionConfig>({ host: '', port: 9119, token: '' });
  const [savingConnection, setSavingConnection] = useState(false);
  const [fieldStates, setFieldStates] = useState<Record<string, FieldState>>({});

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

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configData, defaultsData, schemaData] = await Promise.all([
        httpGet<ConfigData>('/api/config').invoke(),
        httpGet<ConfigData>('/api/config/defaults').invoke(),
        httpGet<ConfigSchemaResponse>('/api/config/schema').invoke(),
      ]);
      setConfig(configData);
      setDefaults(defaultsData);
      setSchema(schemaData);
      setFieldStates({});
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

  const updateFieldState = useCallback((path: string, patch: Partial<FieldState> | null) => {
    setFieldStates((prev) => {
      const next = { ...prev };
      if (!patch) {
        delete next[path];
        return next;
      }
      next[path] = { ...next[path], ...patch };
      if (!next[path].draft && !next[path].error) {
        delete next[path];
      }
      return next;
    });
  }, []);

  const setFieldValue = useCallback(
    (path: string, field: ConfigSchemaField, rawValue: unknown) => {
      if (!config) return;

      if (field.type === 'list' || field.type === 'object') {
        const rawText = typeof rawValue === 'string' ? rawValue : String(rawValue ?? '');
        const parsed = parseStructuredDraft(field, rawText);
        if (parsed.error) {
          updateFieldState(path, { draft: rawText, error: parsed.error });
          return;
        }
        setConfig((prev) => (prev ? setConfigValue(prev, path, parsed.value) : prev));
        updateFieldState(path, { draft: rawText, error: undefined });
        return;
      }

      let nextValue: unknown = rawValue;
      if (field.type === 'number') {
        nextValue = typeof rawValue === 'number' ? rawValue : undefined;
      } else if (field.type === 'boolean') {
        nextValue = Boolean(rawValue);
      } else if (field.type === 'select' || field.type === 'string' || field.type === 'text') {
        nextValue = typeof rawValue === 'string' ? rawValue : '';
      }

      const validationError = validateFieldValue(field, nextValue);
      if (validationError) {
        updateFieldState(path, { error: validationError });
        return;
      }

      setConfig((prev) => (prev ? setConfigValue(prev, path, nextValue) : prev));
      updateFieldState(path, { draft: undefined, error: undefined });
    },
    [config, updateFieldState]
  );

  const handleResetField = useCallback(
    (path: string, field: ConfigSchemaField) => {
      if (!defaults) return;
      const defaultValue = getConfigValue(defaults, path);
      if (defaultValue === undefined) {
        setConfig((prev) => (prev ? deleteConfigValue(prev, path) : prev));
      } else {
        setConfig((prev) => (prev ? setConfigValue(prev, path, defaultValue) : prev));
      }
      if (field.type === 'list' || field.type === 'object') {
        updateFieldState(path, { draft: formatDraftValue(field, defaultValue) });
      } else {
        updateFieldState(path, null);
      }
    },
    [defaults, updateFieldState]
  );

  const handleSaveConnection = useCallback(async () => {
    const api = getRuntimeElectronApi();
    if (!api?.setConnectionMode || !api.setRemoteConnectionConfig) return;

    if (connectionMode === 'remote' && !remoteConfig.host.trim()) {
      Message.error(t('settings.runtime.remoteHostRequired', { defaultValue: 'Remote host is required.' }));
      return;
    }

    setSavingConnection(true);
    try {
      await api.setRemoteConnectionConfig({
        host: remoteConfig.host.trim(),
        port: remoteConfig.port,
        token: remoteConfig.token,
      });
      await api.setConnectionMode(connectionMode);
      Message.success(
        t('settings.runtime.connectionSaved', {
          defaultValue: 'Connection settings saved. Restart Headmaster to apply.',
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Message.error(message);
      console.error('[RuntimeSettings] failed to save connection settings', err);
    } finally {
      setSavingConnection(false);
    }
  }, [connectionMode, remoteConfig.host, remoteConfig.port, remoteConfig.token, t]);

  const handleSave = useCallback(async () => {
    if (!config) return;
    const blockingError = Object.values(fieldStates).find((state) => state.error)?.error;
    if (blockingError) {
      Message.error(blockingError);
      return;
    }

    setSaving(true);
    try {
      await httpPut<unknown, ConfigData>('/api/config').invoke(config);
      Message.success(t('settings.runtime.saved', { defaultValue: 'Settings saved' }));
      await fetchConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      Message.error(message);
      console.error('[RuntimeSettings] failed to save config', err);
    } finally {
      setSaving(false);
    }
  }, [config, fetchConfig, fieldStates, t]);

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

    for (const field of Object.values(schema.fields ?? {})) {
      if (!field || typeof field !== 'object') continue;
      const category = typeof field.category === 'string' ? field.category : 'other';
      if (!seen.has(category)) {
        seen.add(category);
        ordered.push(category);
      }
    }

    return ordered;
  }, [schema]);

  const fieldsByCategory = useMemo(() => {
    if (!schema) return new Map<string, [string, ConfigSchemaField][]>();
    const map = new Map<string, [string, ConfigSchemaField][]>();
    for (const [path, field] of Object.entries(schema.fields ?? {})) {
      if (!field || typeof field !== 'object') continue;
      if (!isSchemaFieldType(field.type)) continue;
      const category = field.category || 'other';
      const list = map.get(category) ?? [];
      list.push([path, field]);
      map.set(category, list);
    }
    for (const list of map.values()) {
      list.sort(([left], [right]) => left.localeCompare(right));
    }
    return map;
  }, [schema]);

  const renderControl = (path: string, field: ConfigSchemaField): React.ReactNode => {
    if (!config) return null;
    const fieldState = fieldStates[path];
    const currentValue = getConfigValue(config, path);
    const rawValue =
      fieldState?.draft ??
      (field.type === 'list' || field.type === 'object'
        ? formatDraftValue(field, currentValue ?? getConfigValue(defaults ?? {}, path))
        : undefined);
    const effectiveValue = field.type === 'list' || field.type === 'object' ? rawValue : currentValue;

    switch (field.type) {
      case 'boolean':
        return <Switch checked={Boolean(effectiveValue)} onChange={(checked) => setFieldValue(path, field, checked)} />;
      case 'number':
        return (
          <InputNumber
            value={typeof effectiveValue === 'number' ? effectiveValue : undefined}
            onChange={(value) => setFieldValue(path, field, typeof value === 'number' ? value : undefined)}
            min={typeof field.min === 'number' ? field.min : undefined}
            max={typeof field.max === 'number' ? field.max : undefined}
            step={typeof field.step === 'number' ? field.step : undefined}
            style={{ width: '100%' }}
          />
        );
      case 'select':
        return (
          <Select
            value={typeof effectiveValue === 'string' ? effectiveValue : undefined}
            onChange={(value) => setFieldValue(path, field, value)}
            options={normalizeOptions(field.options)}
            style={{ width: '100%' }}
            allowClear
          />
        );
      case 'list':
      case 'object':
        return (
          <Input.TextArea
            value={typeof rawValue === 'string' ? rawValue : formatDraftValue(field, effectiveValue)}
            onChange={(value) => setFieldValue(path, field, value)}
            autoSize={{ minRows: 4, maxRows: 12 }}
          />
        );
      case 'text':
        return (
          <Input.TextArea
            value={typeof effectiveValue === 'string' ? effectiveValue : ''}
            onChange={(value) => setFieldValue(path, field, value)}
            autoSize={{ minRows: 3, maxRows: 10 }}
            placeholder={typeof field.placeholder === 'string' ? field.placeholder : undefined}
          />
        );
      case 'string':
      default:
        return (
          <Input
            value={
              typeof effectiveValue === 'string'
                ? effectiveValue
                : typeof effectiveValue === 'number'
                  ? String(effectiveValue)
                  : ''
            }
            onChange={(value) => setFieldValue(path, field, value)}
            placeholder={typeof field.placeholder === 'string' ? field.placeholder : undefined}
          />
        );
    }
  };

  const hasBlockingErrors = Object.values(fieldStates).some((state) => Boolean(state.error));

  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <div className='flex flex-col gap-16px pb-24px'>
        <header className='flex items-center justify-between gap-12px flex-wrap'>
          <div>
            <Title heading={4} style={{ margin: 0 }}>
              {t('settings.runtime.title', { defaultValue: 'Runtime' })}
            </Title>
            <Text type='secondary'>
              {t('settings.runtime.subtitle', {
                defaultValue: 'Inspect and edit the active runtime configuration using the live schema.',
              })}
            </Text>
          </div>
          <Button
            type='primary'
            loading={saving || loading}
            disabled={loading || !config || hasBlockingErrors}
            onClick={() => void handleSave()}
          >
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
                  {
                    label: t('settings.runtime.connectionRemote', { defaultValue: 'Remote Runtime' }),
                    value: 'remote',
                  },
                ]}
              />
              <Text type='secondary'>
                {t('settings.runtime.connectionHelp', {
                  defaultValue:
                    'Local starts the runtime on this machine. Remote connects to a runtime on another machine.',
                })}
              </Text>
            </div>

            <div className='flex flex-col gap-6px'>
              <label className='text-14px font-medium'>
                {t('settings.runtime.remoteHost', { defaultValue: 'Remote host' })}
              </label>
              <Input
                disabled={connectionMode !== 'remote'}
                placeholder='192.168.1.20'
                value={remoteConfig.host}
                onChange={(host) => setRemoteConfigState((prev) => ({ ...prev, host }))}
              />
            </div>

            <div className='flex flex-col gap-6px'>
              <label className='text-14px font-medium'>
                {t('settings.runtime.remotePort', { defaultValue: 'Remote port' })}
              </label>
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
              <label className='text-14px font-medium'>
                {t('settings.runtime.remoteToken', { defaultValue: 'Session token' })}
              </label>
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

            const grouped = fields.reduce<Map<string, [string, ConfigSchemaField][]>>((acc, entry) => {
              const [path, field] = entry;
              const section = getSectionLabel(path);
              const list = acc.get(section) ?? [];
              list.push([path, field]);
              acc.set(section, list);
              return acc;
            }, new Map());

            return (
              <Card
                key={category}
                title={
                  <span className='capitalize'>
                    {category === 'other' ? t('settings.runtime.unknownCategory', { defaultValue: 'Other' }) : category}
                  </span>
                }
                bordered
              >
                <div className='flex flex-col gap-18px'>
                  {Array.from(grouped.entries()).map(([section, sectionFields]) => (
                    <div key={`${category}:${section}`} className='flex flex-col gap-12px'>
                      {sectionFields.some(([path]) => path.includes('.')) ? (
                        <div className='text-12px font-600 uppercase tracking-[0.08em] text-t-secondary'>{section}</div>
                      ) : null}
                      <div
                        className='grid gap-16px'
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
                      >
                        {sectionFields.map(([path, field]) => {
                          const currentValue = getConfigValue(config, path);
                          const defaultValue = defaults ? getConfigValue(defaults, path) : field.default;
                          const fieldState = fieldStates[path];
                          const hasError = Boolean(fieldState?.error);

                          return (
                            <div
                              key={path}
                              className='flex flex-col gap-6px rounded-8px border border-solid border-color-border-2 p-12px'
                            >
                              <div className='flex items-start justify-between gap-8px'>
                                <div className='flex flex-col gap-4px'>
                                  <label className='text-14px font-medium'>{field.description || path}</label>
                                  <Text type='secondary' style={{ fontSize: 12 }}>
                                    {t('settings.runtime.defaultValue', { defaultValue: 'Default' })}:{' '}
                                    {prettyValue(defaultValue)}
                                  </Text>
                                  <Text type='secondary' style={{ fontSize: 12 }}>
                                    {t('settings.runtime.currentValue', { defaultValue: 'Current' })}:{' '}
                                    {prettyValue(currentValue)}
                                  </Text>
                                </div>
                                <Button
                                  size='mini'
                                  onClick={() => handleResetField(path, field)}
                                  disabled={defaults === null}
                                >
                                  {t('settings.runtime.resetField', { defaultValue: 'Reset' })}
                                </Button>
                              </div>

                              {renderControl(path, field)}

                              {hasError ? (
                                <Text type='error' style={{ fontSize: 12 }}>
                                  {fieldState?.error}
                                </Text>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
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
