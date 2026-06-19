/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Empty, Spin, Tag } from '@arco-design/web-react';
import {
  HouseLine,
  Pulse,
  ChatCircle,
  CheckSquare,
  Books,
  Brain,
  Plugs,
  ArrowCounterClockwise,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useDashboard } from './useDashboard';

const STAT_CARDS = [
  {
    key: 'activeSessions',
    icon: Pulse,
    label: 'Active Sessions',
    color: 'bg-amber-500/10 text-amber-300',
    route: '/activity',
  },
  {
    key: 'messagesToday',
    icon: ChatCircle,
    label: 'Messages Today',
    color: 'bg-blue-500/10 text-blue-300',
    route: '/guid',
  },
  {
    key: 'pendingTasks',
    icon: CheckSquare,
    label: 'Pending Tasks',
    color: 'bg-purple-500/10 text-purple-300',
    route: '/kanban',
  },
  {
    key: 'connectedPlatforms',
    icon: Plugs,
    label: 'Connected Platforms',
    color: 'bg-emerald-500/10 text-emerald-300',
    route: '/integrations',
  },
  {
    key: 'documentsCount',
    icon: Books,
    label: 'Documents',
    color: 'bg-slate-500/10 text-slate-300',
    route: '/documents',
  },
  { key: 'totalTokens', icon: Brain, label: 'Total Tokens', color: 'bg-rose-500/10 text-rose-300', route: '/memory' },
] as const;

const DashboardPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { stats, recent, loading, error, refresh } = useDashboard();

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      {/* Header */}
      <div className='flex items-center justify-between mb-20px shrink-0'>
        <div className='flex items-center gap-8px'>
          <HouseLine size={22} weight='duotone' className='text-t-primary' />
          <h1 className='text-20px font-semibold text-t-primary'>
            {t('dashboard.title', { defaultValue: 'Command Center' })}
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

      {/* Stat cards */}
      <div className='grid grid-cols-2 lg:grid-cols-3 gap-12px mb-20px shrink-0'>
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            onClick={() => navigate(card.route)}
            className='cursor-pointer bg-fill-1 rd-10px border border-border-2 px-16px py-14px flex flex-col gap-8px hover:border-t-primary transition-colors'
          >
            <div className='flex items-center justify-between'>
              <span className={classNames('px-8px py-4px rd-6px text-11px font-medium', card.color)}>{card.label}</span>
              <card.icon size={18} className='text-t-secondary' />
            </div>
            <span className='text-24px font-bold text-t-primary'>
              {stats[card.key as keyof typeof stats]?.toLocaleString?.() ?? stats[card.key as keyof typeof stats]}
            </span>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className='flex-1 min-h-0 bg-fill-1 rd-10px border border-border-2 p-16px flex flex-col'>
        <div className='flex items-center justify-between mb-12px shrink-0'>
          <div className='flex items-center gap-8px'>
            <ClockCounterClockwise size={18} className='text-t-primary' />
            <h2 className='text-16px font-semibold text-t-primary'>
              {t('dashboard.recent', { defaultValue: 'Recent Activity' })}
            </h2>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto min-h-0'>
          {loading && recent.length === 0 && (
            <div className='flex justify-center py-40px'>
              <Spin size={24} />
            </div>
          )}
          {error && (
            <div className='text-center py-24px'>
              <p className='text-14px text-t-secondary mb-12px'>{error}</p>
              <Button type='primary' size='small' onClick={refresh}>
                {t('common.retry', { defaultValue: 'Retry' })}
              </Button>
            </div>
          )}
          {!loading && !error && recent.length === 0 && (
            <Empty description={t('dashboard.empty', { defaultValue: 'No recent activity' })} />
          )}

          <div className='flex flex-col gap-8px'>
            {recent.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className='flex items-center justify-between px-12px py-10px rd-8px bg-fill-2 hover:bg-fill-3 transition-colors cursor-pointer'
                onClick={() => {
                  if (item.type === 'session') navigate(`/activity`);
                  if (item.type === 'task') navigate(`/kanban`);
                }}
              >
                <div className='flex items-center gap-10px'>
                  <Tag
                    size='small'
                    color={item.type === 'session' ? 'arcoblue' : item.type === 'task' ? 'purple' : 'gray'}
                  >
                    {item.type}
                  </Tag>
                  <span className='text-13px text-t-primary truncate max-w-300px'>{item.title}</span>
                </div>
                <div className='flex items-center gap-10px'>
                  <span className='text-11px text-t-tertiary'>
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {item.meta && (
                    <span
                      className={classNames(
                        'text-10px px-6px py-2px rd-4px font-medium',
                        item.meta === 'running' || item.meta === 'in_progress'
                          ? 'bg-amber-500/10 text-amber-300'
                          : item.meta === 'done'
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-slate-500/10 text-slate-300'
                      )}
                    >
                      {item.meta}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
