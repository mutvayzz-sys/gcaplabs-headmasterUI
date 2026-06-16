/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Spin, Switch, Tag } from '@arco-design/web-react';
import { Brain, ArrowCounterClockwise, Warning } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useMemory } from './useMemory';

const MemoryPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const { providers, loading, error, refresh, updateProvider, resetMemory } = useMemory();

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      <div className='flex items-center justify-between mb-16px shrink-0'>
        <div className='flex items-center gap-8px'>
          <Brain size={20} weight='duotone' className='text-t-primary' />
          <h1 className='text-18px font-semibold text-t-primary'>
            {t('memory.title', { defaultValue: 'Memory' })}
          </h1>
        </div>
        <div className='flex items-center gap-8px'>
          <Button
            type='secondary'
            size='small'
            icon={<ArrowCounterClockwise size={16} />}
            onClick={refresh}
            disabled={loading}
          >
            {t('common.refresh', { defaultValue: 'Refresh' })}
          </Button>
          <Button
            type='primary'
            status='danger'
            size='small'
            icon={<Warning size={16} />}
            onClick={async () => {
              if (confirm(t('memory.resetConfirm', { defaultValue: 'Reset all memory? This cannot be undone.' }))) {
                await resetMemory();
              }
            }}
          >
            {t('memory.reset', { defaultValue: 'Reset' })}
          </Button>
        </div>
      </div>

      <div className='flex-1 min-h-0 overflow-y-auto'>
        {loading && providers.length === 0 && (
          <div className='flex justify-center py-40px'>
            <Spin size={24} />
          </div>
        )}
        {error && (
          <div className='text-center py-24px text-t-secondary'>
            <p className='text-14px mb-12px'>{error}</p>
            <Button type='primary' size='small' onClick={refresh}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        )}
        {!loading && !error && providers.length === 0 && (
          <Empty description={t('memory.empty', { defaultValue: 'No memory provider configured' })} />
        )}
        <div className='flex flex-col gap-12px'>
          {providers.map((p) => (
            <div
              key={p.id}
              className='flex items-center justify-between bg-fill-1 rd-8px border border-border-2 px-16px py-12px'
            >
              <div className='flex flex-col gap-4px'>
                <span className='text-15px font-medium text-t-primary'>{p.name}</span>
                <div className='flex items-center gap-8px'>
                  {p.enabled ? (
                    <Tag size='small' color='green'>
                      {t('common.enabled', { defaultValue: 'Enabled' })}
                    </Tag>
                  ) : (
                    <Tag size='small' color='gray'>
                      {t('common.disabled', { defaultValue: 'Disabled' })}
                    </Tag>
                  )}
                  <span className='text-12px text-t-tertiary'>ID: {p.id}</span>
                </div>
              </div>
              <Switch
                checked={p.enabled}
                onChange={async (checked: boolean) => {
                  await updateProvider(p.id, { enabled: checked });
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemoryPage;
