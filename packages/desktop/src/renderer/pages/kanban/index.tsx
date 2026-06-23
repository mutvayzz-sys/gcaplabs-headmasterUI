/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Message, Spin } from '@arco-design/web-react';
import { ArrowCounterClockwise, Kanban as KanbanIcon } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { type KanbanColumnId, type KanbanTask, useKanban } from './useKanban';

const COLUMN_META: Record<KanbanColumnId, { color: string }> = {
  triage: { color: 'bg-slate-500/10 text-slate-300' },
  ready: { color: 'bg-amber-500/10 text-amber-300' },
  running: { color: 'bg-blue-500/10 text-blue-300' },
  blocked: { color: 'bg-rose-500/10 text-rose-300' },
  done: { color: 'bg-emerald-500/10 text-emerald-300' },
};

const KanbanPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const { columns, loading, error, unavailable, refresh, moveTask } = useKanban();
  const [movingId, setMovingId] = useState<string | null>(null);

  const handleMove = useCallback(
    async (task: KanbanTask, target: KanbanColumnId) => {
      if (task.status === target) return;
      setMovingId(task.id);
      try {
        await moveTask(task.id, target);
      } catch (err) {
        Message.error(err instanceof Error ? err.message : String(err));
        void refresh();
      } finally {
        setMovingId(null);
      }
    },
    [moveTask, refresh]
  );

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      <div className='flex items-center justify-between mb-16px shrink-0'>
        <div className='flex items-center gap-8px'>
          <KanbanIcon size={20} weight='duotone' className='text-t-primary' />
          <h1 className='text-18px font-semibold text-t-primary'>
            {t('sidebar.kanban', { defaultValue: 'Kanban' })}
          </h1>
        </div>
        <Button
          type='secondary'
          size='small'
          icon={<ArrowCounterClockwise size={16} />}
          onClick={() => void refresh()}
          disabled={loading}
        >
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      {unavailable && (
        <div className='mb-12px px-14px py-10px rd-10px bg-fill-1 border border-border-2 text-13px text-t-secondary'>
          {t('kanban.unavailable', {
            defaultValue:
              'Kanban plugin is not enabled on this runtime. Enable the kanban plugin in your runtime dashboard to use this board.',
          })}
        </div>
      )}

      {error && (
        <div className='mb-12px px-14px py-10px rd-10px bg-fill-1 border border-border-2 text-13px text-danger-6'>
          {error}
        </div>
      )}

      <div className='flex-1 min-h-0 overflow-x-auto overflow-y-hidden'>
        {loading && columns.every((c) => c.tasks.length === 0) ? (
          <div className='flex justify-center py-40px'>
            <Spin size={24} />
          </div>
        ) : (
          <div className='flex gap-12px h-full min-w-max pb-8px'>
            {columns.map((column) => (
              <div
                key={column.id}
                className='w-260px shrink-0 flex flex-col bg-fill-1 rd-10px border border-border-2 overflow-hidden'
              >
                <div className='px-12px py-10px border-b border-border-2 flex items-center justify-between'>
                  <span
                    className={classNames(
                      'px-8px py-3px rd-6px text-11px font-medium',
                      COLUMN_META[column.id].color
                    )}
                  >
                    {column.label}
                  </span>
                  <span className='text-12px text-t-tertiary'>{column.tasks.length}</span>
                </div>
                <div className='flex-1 min-h-0 overflow-y-auto p-8px flex flex-col gap-8px'>
                  {column.tasks.length === 0 ? (
                    <Empty description={t('kanban.emptyColumn', { defaultValue: 'No tasks' })} />
                  ) : (
                    column.tasks.map((task) => (
                      <div
                        key={task.id}
                        className={classNames(
                          'bg-fill-2 rd-8px border border-border-2 p-10px flex flex-col gap-6px',
                          movingId === task.id && 'opacity-60'
                        )}
                      >
                        <span className='text-13px font-medium text-t-primary'>{task.title}</span>
                        {task.description && (
                          <span className='text-11px text-t-tertiary line-clamp-2'>{task.description}</span>
                        )}
                        <div className='flex flex-wrap gap-4px mt-4px'>
                          {columns
                            .filter((c) => c.id !== task.status)
                            .map((c) => (
                              <button
                                key={c.id}
                                type='button'
                                className='text-10px px-6px py-2px rd-4px border border-border-2 bg-base text-t-secondary hover:text-t-primary hover:border-t-primary transition-colors'
                                disabled={movingId === task.id}
                                onClick={() => void handleMove(task, c.id)}
                              >
                                → {c.label}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanPage;
