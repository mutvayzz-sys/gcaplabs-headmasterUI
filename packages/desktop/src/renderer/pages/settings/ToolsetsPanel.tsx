/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Collapse, Empty, Input, Select, Spin, Switch, Tag } from '@arco-design/web-react';
import { ArrowCounterClockwise } from '@phosphor-icons/react';
import classNames from 'classnames';
import { type ToolsetConfig, useToolsets } from './useToolsets';

const ToolsetConfigForm: React.FC<{
  name: string;
  loadConfig: (name: string) => Promise<ToolsetConfig>;
  selectProvider: (name: string, provider: string) => Promise<void>;
  setEnvVar: (key: string, value: string) => Promise<void>;
  onSaved: () => void;
}> = ({ name, loadConfig, selectProvider, setEnvVar, onSaved }) => {
  const { t } = useTranslation();
  const [config, setConfig] = useState<ToolsetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadConfig(name)
      .then((data) => {
        if (!cancelled) setConfig(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadConfig, name]);

  const handleSaveEnv = async (key: string) => {
    const value = drafts[key]?.trim();
    if (!value) return;
    setSavingKey(key);
    try {
      await setEnvVar(key, value);
      setDrafts((prev) => ({ ...prev, [key]: '' }));
      onSaved();
      const refreshed = await loadConfig(name);
      setConfig(refreshed);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className='flex justify-center py-16px'>
        <Spin size={20} />
      </div>
    );
  }
  if (!config) return null;

  return (
    <div className='flex flex-col gap-12px pt-8px'>
      {config.providers.length > 1 && (
        <Select
          size='small'
          value={config.selected_provider}
          onChange={(value) => void selectProvider(name, String(value)).then(onSaved)}
          options={config.providers.map((p) => ({ label: p.label || p.name, value: p.name }))}
        />
      )}
      {(config.providers.find((p) => p.name === config.selected_provider) ?? config.providers[0])?.env_vars.map(
        (envVar) => {
          const isSet = config.env_state?.[envVar.key] === true;
          return (
            <div key={envVar.key} className='flex flex-col gap-6px'>
              <div className='flex items-center justify-between gap-8px'>
                <span className='text-12px text-t-primary font-medium'>{envVar.prompt || envVar.key}</span>
                <Tag size='small' color={isSet ? 'green' : 'gray'}>
                  {isSet
                    ? t('settings.toolsets.configured', { defaultValue: 'Configured' })
                    : t('settings.toolsets.needsKeys', { defaultValue: 'Needs keys' })}
                </Tag>
              </div>
              {envVar.description && <span className='text-11px text-t-tertiary'>{envVar.description}</span>}
              <div className='flex gap-8px'>
                <Input.Password
                  size='small'
                  className='flex-1'
                  value={drafts[envVar.key] ?? ''}
                  onChange={(value) => setDrafts((prev) => ({ ...prev, [envVar.key]: value }))}
                  placeholder={envVar.prompt || envVar.key}
                />
                <Button
                  type='primary'
                  size='small'
                  loading={savingKey === envVar.key}
                  onClick={() => void handleSaveEnv(envVar.key)}
                >
                  {t('common.save', { defaultValue: 'Save' })}
                </Button>
              </div>
            </div>
          );
        }
      )}
    </div>
  );
};

const ToolsetsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { toolsets, loading, error, refresh, toggleToolset, loadConfig, selectProvider, setEnvVar } = useToolsets();
  const [expanded, setExpanded] = useState<string[]>([]);

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className='mt-24px pt-24px border-t border-border-2'>
      <div className='flex items-center justify-between mb-14px'>
        <div>
          <h2 className='text-18px font-600 text-t-primary m-0'>
            {t('settings.toolsets.title', { defaultValue: 'Runtime toolsets' })}
          </h2>
          <p className='text-13px text-t-secondary mt-4px mb-0'>
            {t('settings.toolsets.subtitle', {
              defaultValue: 'Enable and configure Headmaster tool backends (search, browser, voice, etc.).',
            })}
          </p>
        </div>
        <Button type='secondary' size='small' icon={<ArrowCounterClockwise size={16} />} onClick={handleRefresh}>
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      {error && <div className='text-13px text-danger-6 mb-12px'>{error}</div>}

      {loading ? (
        <div className='flex justify-center py-32px'>
          <Spin size={24} />
        </div>
      ) : toolsets.length === 0 ? (
        <Empty description={t('settings.toolsets.empty', { defaultValue: 'No toolsets available' })} />
      ) : (
        <Collapse
          activeKey={expanded}
          onChange={(keys) => setExpanded(Array.isArray(keys) ? keys.map(String) : [String(keys)])}
          className='flex flex-col gap-8px'
        >
          {toolsets.map((toolset) => (
            <Collapse.Item
              key={toolset.name}
              name={toolset.name}
              header={
                <div className='flex items-center justify-between gap-12px w-full pr-8px'>
                  <div className='min-w-0'>
                    <div className='text-14px font-500 text-t-primary'>{toolset.label || toolset.name}</div>
                    {toolset.description && (
                      <div className='text-11px text-t-tertiary truncate'>{toolset.description}</div>
                    )}
                  </div>
                  <div className='flex items-center gap-8px shrink-0' onClick={(e) => e.stopPropagation()}>
                    <Tag size='small' color={toolset.configured ? 'green' : 'gray'}>
                      {toolset.configured
                        ? t('settings.toolsets.configured', { defaultValue: 'Configured' })
                        : t('settings.toolsets.needsKeys', { defaultValue: 'Needs keys' })}
                    </Tag>
                    <Switch
                      size='small'
                      checked={toolset.enabled !== false}
                      onChange={(enabled) => void toggleToolset(toolset.name, enabled)}
                    />
                  </div>
                </div>
              }
              className={classNames(
                'bg-fill-1 rd-10px border border-border-2 overflow-hidden',
                '[&_.arco-collapse-item-header]:bg-fill-1'
              )}
            >
              <ToolsetConfigForm
                name={toolset.name}
                loadConfig={loadConfig}
                selectProvider={selectProvider}
                setEnvVar={setEnvVar}
                onSaved={() => void refresh()}
              />
            </Collapse.Item>
          ))}
        </Collapse>
      )}
    </section>
  );
};

export default ToolsetsPanel;
