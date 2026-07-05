/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Empty, Spin, Tag } from '@arco-design/web-react';
import { Plugs, ArrowCounterClockwise } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useIntegrations } from './useIntegrations';
import { BACKEND_GATED_FEATURES } from '@/renderer/utils/backendFeatureGates';

const COMPOSIO_GATE = BACKEND_GATED_FEATURES.composio_integrations;

const IntegrationsPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const { webhooks, loading, error, remoteModeUnavailable, refresh } = useIntegrations();

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
          disabled={loading || remoteModeUnavailable}
        >
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      <p className='text-13px text-t-secondary mb-12px'>
        {t('integrations.webhooksHint', {
          defaultValue: 'Webhook subscriptions for runtime events. MCP servers are managed under Settings → Tools.',
        })}
      </p>

      <Card className='mb-14px bg-fill-1 border border-border-2' bordered={false}>
        <div className='flex items-start justify-between gap-16px'>
          <div className='min-w-0'>
            <div className='flex items-center gap-8px mb-6px'>
              <span className='text-15px font-600 text-t-primary'>
                {t('integrations.composioTitle', { defaultValue: 'Composio connected apps' })}
              </span>
              <Tag size='small' color='purple'>
                Beta
              </Tag>
              {!COMPOSIO_GATE.active && <Tag size='small'>Gated</Tag>}
            </div>
            <p className='text-13px text-t-secondary m-0 leading-relaxed'>
              {t('integrations.composioHint', {
                defaultValue:
                  'Connect Gmail, Drive, Slack, GitHub, and other Composio apps so Headmaster can expose their tools to the runtime.',
              })}
            </p>
            {!COMPOSIO_GATE.active && (
              <div className='mt-10px rd-10px border border-warning-3 bg-warning-1 px-10px py-8px text-12px text-warning-7 leading-relaxed'>
                {COMPOSIO_GATE.label} are disabled until the backend contract is implemented. {COMPOSIO_GATE.reason}
              </div>
            )}
          </div>
          <Button type='primary' disabled={!COMPOSIO_GATE.active}>
            {t('integrations.connectApp', { defaultValue: 'Connect app' })}
          </Button>
        </div>
      </Card>

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
          ) : remoteModeUnavailable ? (
            <Empty
              description={t('integrations.remoteModeUnavailable', {
                defaultValue:
                  'Integrations and webhooks are managed by the cloud workspace in this mode. Local integration controls are available when using a local runtime.',
              })}
            />
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
