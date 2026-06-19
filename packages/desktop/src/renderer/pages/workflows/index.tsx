/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Spin, Tag, Input, Switch } from '@arco-design/web-react';
import { GitBranch, ArrowCounterClockwise, Lock, Globe } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useSkills } from './useSkills';

const WorkflowsPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const { skills, loading, error, refresh, filter, setFilter } = useSkills();

  const filtered = filter
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(filter.toLowerCase()) ||
          s.description?.toLowerCase().includes(filter.toLowerCase())
      )
    : skills;

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      <div className='flex items-center justify-between mb-16px shrink-0'>
        <div className='flex items-center gap-8px'>
          <GitBranch size={20} weight='duotone' className='text-t-primary' />
          <h1 className='text-18px font-semibold text-t-primary'>
            {t('workflows.title', { defaultValue: 'Skills Library' })}
          </h1>
          <Tag size='small' color='arcoblue'>
            {skills.length}
          </Tag>
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

      <div className='px-0 pb-12px shrink-0'>
        <Input
          size='small'
          placeholder={t('workflows.search', { defaultValue: 'Search skills…' })}
          value={filter}
          onChange={setFilter}
          allowClear
        />
      </div>

      <div className='flex-1 min-h-0 overflow-y-auto'>
        {loading && skills.length === 0 && (
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
        {!loading && !error && filtered.length === 0 && (
          <Empty description={t('workflows.empty', { defaultValue: 'No skills found' })} />
        )}
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12px'>
          {filtered.map((skill) => (
            <div
              key={skill.id}
              className='bg-fill-1 rd-8px border border-border-2 px-14px py-12px flex flex-col gap-8px'
            >
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-8px min-w-0'>
                  {skill.builtin ? (
                    <Lock size={14} className='text-amber-300 shrink-0' />
                  ) : (
                    <Globe size={14} className='text-t-tertiary shrink-0' />
                  )}
                  <span className='text-14px font-medium text-t-primary truncate'>{skill.name}</span>
                </div>
                <Switch size='small' checked={skill.enabled} disabled />
              </div>
              {skill.description && <p className='text-12px text-t-secondary line-clamp-2'>{skill.description}</p>}
              {skill.category && (
                <Tag size='small' color='gray' className='self-start'>
                  {skill.category}
                </Tag>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowsPage;
