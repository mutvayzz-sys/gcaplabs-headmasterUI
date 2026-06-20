/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Spin } from '@arco-design/web-react';
import { Plugs, ArrowCounterClockwise } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useIntegrations } from './useIntegrations';

const IntegrationsPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const { webhooks, loading, error, refresh } = useIntegrations();

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

      <p className='text-13px text-t-secondary mb-12px'>
        {t('integrations.webhooksHint', {
          defaultValue: 'Webhook subscriptions for runtime events. MCP servers are managed under Settings → Tools.',
        })}
      </p>

      <div className='flex-1 min-h-0 overflow-y-auto mt-12px'>
        {error && (
          <div className='text-center py-24px text-t-secondary'>
            <p className='text-14px mb-12px'>{error}</p>
            <Button type='primary' size='small' onClick={refresh}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        )}

        <div className='flex flex-col gap-10px'>
          {loading ? (
            <div className='flex justify-center py-40px'>
              <Spin size={24} />
            </div>
          ) : webhooks.length === 0 ? (
            <Empty description={t('integrations.noWebhooks', { defaultValue: 'No webhooks configured' })} />
          ) : (
            webhooks.map((hook) => (
              <div
                key={hook.id}
                className='flex items-center justify-between bg-fill-1 rd-8px border border-border-2 px-14px py-12px'
              >
                <div className='flex flex-col gap-4px min-w-0'>
                  <span className='text-14px font-medium text-t-primary truncate'>{hook.url || hook.id}</span>
                  <span className='text-11px text-t-tertiary'>{hook.events.join(', ') || '—'}</span>
                </div>
                <span
                  className={classNames(
                    'px-8px py-3px rd-6px text-11px font-medium',
                    hook.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-500/10 text-slate-300'
                  )}
                >
                  {hook.active
                    ? t('integrations.active', { defaultValue: 'Active' })
                    : t('integrations.inactive', { defaultValue: 'Inactive' })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
