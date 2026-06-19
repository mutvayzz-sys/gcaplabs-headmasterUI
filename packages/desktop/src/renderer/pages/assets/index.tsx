/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Input, Spin, Tag } from '@arco-design/web-react';
import {
  Image,
  Play,
  ArrowCounterClockwise,
  Queue,
  CheckCircle,
  WarningCircle,
  Hourglass,
  Lightning,
  Images,
} from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useAssets } from './useAssets';

const STATUS_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  idle: { icon: <Hourglass size={12} />, color: 'bg-slate-500/10 text-slate-300', label: 'Idle' },
  queued: { icon: <Queue size={12} />, color: 'bg-amber-500/10 text-amber-300', label: 'Queued' },
  running: { icon: <Lightning size={12} />, color: 'bg-blue-500/10 text-blue-300', label: 'Running' },
  done: { icon: <CheckCircle size={12} />, color: 'bg-emerald-500/10 text-emerald-300', label: 'Done' },
  error: { icon: <WarningCircle size={12} />, color: 'bg-red-500/10 text-red-300', label: 'Error' },
};

const AssetsPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const {
    categories,
    loading,
    running,
    totalIdle,
    totalQueued,
    totalRunning,
    totalDone,
    queueCategory,
    runNext,
    resetAll,
  } = useAssets();
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      <div className='flex items-center justify-between mb-16px shrink-0'>
        <div className='flex items-center gap-8px'>
          <Images size={20} weight='duotone' className='text-t-primary' />
          <h1 className='text-18px font-semibold text-t-primary'>
            {t('assets.title', { defaultValue: 'Asset Regeneration' })}
          </h1>
        </div>
        <div className='flex items-center gap-8px'>
          <Button type='secondary' size='small' icon={<ArrowCounterClockwise size={16} />} onClick={resetAll}>
            {t('assets.reset', { defaultValue: 'Reset' })}
          </Button>
          <Button
            type='primary'
            size='small'
            icon={<Play size={16} />}
            onClick={runNext}
            disabled={running || totalQueued === 0}
            loading={running}
          >
            {t('assets.run', { defaultValue: 'Run Batch' })}
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className='flex items-center gap-8px mb-16px shrink-0'>
        {[
          { key: 'idle', label: 'Idle', value: totalIdle },
          { key: 'queued', label: 'Queued', value: totalQueued },
          { key: 'running', label: 'Running', value: totalRunning },
          { key: 'done', label: 'Done', value: totalDone },
        ].map((s) => (
          <div
            key={s.key}
            className='flex-1 bg-fill-1 rd-8px border border-border-2 px-12px py-8px flex items-center justify-between'
          >
            <span className='text-12px text-t-secondary'>{s.label}</span>
            <span className='text-18px font-bold text-t-primary'>{s.value}</span>
          </div>
        ))}
      </div>

      <Input
        className='mb-12px shrink-0'
        size='small'
        value={search}
        onChange={setSearch}
        placeholder={t('assets.search', { defaultValue: 'Search prompts or folders...' })}
      />

      <div className='flex-1 min-h-0 overflow-y-auto flex flex-col gap-12px'>
        {loading && categories.length === 0 && (
          <div className='flex justify-center py-40px'>
            <Spin size={24} />
          </div>
        )}
        {!loading && categories.length === 0 && (
          <Empty description={t('assets.empty', { defaultValue: 'No asset categories found' })} />
        )}

        {categories.map((cat) => {
          const isExpanded = expandedCategory === cat.key;
          const filteredJobs = cat.jobs.filter(
            (j) =>
              !search ||
              j.prompt.toLowerCase().includes(search.toLowerCase()) ||
              j.folder.toLowerCase().includes(search.toLowerCase())
          );
          if (search && filteredJobs.length === 0) return null;

          return (
            <div key={cat.key} className='bg-fill-1 rd-10px border border-border-2 overflow-hidden'>
              <div
                className='flex items-center justify-between px-16px py-12px cursor-pointer hover:bg-fill-2 transition-colors'
                onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
              >
                <div className='flex items-center gap-10px'>
                  <Image size={18} className='text-t-primary' />
                  <span className='text-14px font-semibold text-t-primary'>{cat.label}</span>
                  <Tag size='small' color='arcoblue'>
                    {cat.count}
                  </Tag>
                </div>
                <div className='flex items-center gap-8px'>
                  <Button
                    type='secondary'
                    size='small'
                    onClick={(e: any) => {
                      e.stopPropagation();
                      queueCategory(cat.key);
                    }}
                  >
                    {t('assets.queueAll', { defaultValue: 'Queue All' })}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className='px-16px pb-12px flex flex-col gap-8px'>
                  {(search ? filteredJobs : cat.jobs).map((job) => {
                    const meta = STATUS_META[job.status];
                    return (
                      <div key={job.id} className='flex items-center gap-10px px-12px py-8px rd-8px bg-fill-2'>
                        <div className='flex-1 flex flex-col gap-4px'>
                          <span className='text-12px text-t-primary font-medium'>{job.folder}</span>
                          <span className='text-11px text-t-tertiary truncate max-w-400px'>{job.prompt}</span>
                        </div>
                        <div className='flex items-center gap-8px'>
                          <span
                            className={classNames(
                              'px-8px py-3px rd-6px text-11px font-medium flex items-center gap-4px',
                              meta.color
                            )}
                          >
                            {meta.icon} {meta.label}
                          </span>
                          {job.progress > 0 && <span className='text-11px text-t-secondary'>{job.progress}%</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AssetsPage;
