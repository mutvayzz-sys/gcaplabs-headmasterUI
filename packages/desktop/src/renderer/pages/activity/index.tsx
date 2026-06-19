/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Spin, Tag, Tooltip } from '@arco-design/web-react';
import { Pulse, ArrowCounterClockwise, CaretDown, CaretUp } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useActivity, STATUS_OPTIONS } from './useActivity';

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  running: { label: 'Running', color: 'arcoblue', dot: 'bg-blue-400' },
  thinking: { label: 'Thinking', color: 'orange', dot: 'bg-amber-400' },
  complete: { label: 'Done', color: 'green', dot: 'bg-emerald-400' },
  failed: { label: 'Failed', color: 'red', dot: 'bg-red-400' },
  idle: { label: 'Idle', color: 'gray', dot: 'bg-slate-400' },
};

function formatAge(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function formatTokens(n?: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const ActivityPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const {
    sessions,
    loading,
    error,
    refresh,
    filterStatus,
    setFilterStatus,
    expandedSessionId,
    setExpandedSessionId,
    messages,
    messagesLoading,
  } = useActivity();

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      {/* Header */}
      <div className='flex items-center justify-between mb-16px shrink-0'>
        <div className='flex items-center gap-8px'>
          <Pulse size={20} weight='duotone' className='text-t-primary' />
          <h1 className='text-18px font-semibold text-t-primary'>
            {t('activity.title', { defaultValue: 'Activity' })}
          </h1>
          <Tag size='small' color='arcoblue'>
            {sessions.length}
          </Tag>
        </div>
        <Button
          type='secondary'
          size='small'
          icon={<ArrowCounterClockwise size={16} weight='bold' />}
          onClick={refresh}
          disabled={loading}
        >
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      {/* Status filter chips */}
      <div className='flex items-center gap-6px mb-16px shrink-0 flex-wrap'>
        <Button
          type={filterStatus === null ? 'primary' : 'secondary'}
          size='small'
          onClick={() => setFilterStatus(null)}
        >
          {t('common.all', { defaultValue: 'All' })}
        </Button>
        {STATUS_OPTIONS.map((s) => (
          <Button
            key={s}
            type={filterStatus === s ? 'primary' : 'secondary'}
            size='small'
            onClick={() => setFilterStatus(s)}
          >
            <span className={classNames('inline-block w-6px h-6px rd-full mr-4px', STATUS_META[s].dot)} />
            {STATUS_META[s].label}
          </Button>
        ))}
      </div>

      {/* Session list */}
      <div className='flex-1 min-h-0 overflow-y-auto'>
        {loading && sessions.length === 0 && (
          <div className='flex items-center justify-center h-200px'>
            <Spin size={28} />
          </div>
        )}

        {error && (
          <div className='text-center py-40px text-t-secondary'>
            <p className='text-14px mb-12px'>{error}</p>
            <Button type='primary' size='small' onClick={refresh}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <Empty description={t('activity.empty', { defaultValue: 'No activity yet' })} />
        )}

        <div className='flex flex-col gap-8px'>
          {sessions.map((session) => {
            const meta = STATUS_META[session.status] ?? STATUS_META.idle;
            const isExpanded = expandedSessionId === session.id;
            return (
              <div
                key={session.id}
                className={classNames(
                  'flex flex-col gap-0 bg-fill-1 rd-8px border border-border-2 px-12px py-10px cursor-pointer transition-colors',
                  isExpanded ? 'border-t-primary' : 'hover:bg-fill-2'
                )}
                onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
              >
                {/* Row */}
                <div className='flex items-center justify-between gap-8px'>
                  <div className='flex items-center gap-8px min-w-0'>
                    <Tooltip content={meta.label} position='top'>
                      <span className={classNames('inline-block w-8px h-8px rd-full shrink-0', meta.dot)} />
                    </Tooltip>
                    <span className='text-14px font-medium text-t-primary truncate'>
                      {session.agent_name || session.name || session.id.slice(0, 8)}
                    </span>
                    {session.task && (
                      <span className='text-12px text-t-secondary truncate max-w-200px'>{session.task}</span>
                    )}
                  </div>
                  <div className='flex items-center gap-8px shrink-0'>
                    {session.token_count != null && (
                      <span className='text-12px text-t-tertiary'>{formatTokens(session.token_count)} tokens</span>
                    )}
                    <span className='text-12px text-t-tertiary'>{formatAge(session.updated_at)}</span>
                    {isExpanded ? (
                      <CaretUp size={14} className='text-t-secondary' />
                    ) : (
                      <CaretDown size={14} className='text-t-secondary' />
                    )}
                  </div>
                </div>

                {/* Expanded messages */}
                {isExpanded && (
                  <div className='mt-8px pl-20px border-l-2 border-border-2'>
                    {messagesLoading ? (
                      <div className='py-20px flex justify-center'>
                        <Spin size={20} />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className='text-12px text-t-tertiary py-12px'>
                        {t('activity.noMessages', { defaultValue: 'No messages in this session' })}
                      </p>
                    ) : (
                      <div className='flex flex-col gap-6px py-8px'>
                        {messages.map((msg) => (
                          <div key={msg.id} className='flex gap-8px'>
                            <span
                              className={classNames(
                                'text-11px font-semibold uppercase shrink-0 w-64px',
                                msg.role === 'user' ? 'text-t-primary' : 'text-t-secondary'
                              )}
                            >
                              {msg.role}
                            </span>
                            <span className='text-13px text-t-primary whitespace-pre-wrap break-words'>
                              {msg.content.slice(0, 200)}
                              {msg.content.length > 200 && '…'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ActivityPage;
