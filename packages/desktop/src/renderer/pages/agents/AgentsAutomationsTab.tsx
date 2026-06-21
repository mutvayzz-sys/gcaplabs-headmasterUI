/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Empty, Spin, Switch } from '@arco-design/web-react';
import { useAllCronJobs } from '@renderer/pages/cron/useCronJobs';
import { formatNextRun, formatSchedule } from '@renderer/pages/cron/cronUtils';
import CronStatusTag from '@renderer/pages/cron/ScheduledTasksPage/CronStatusTag';
import type { ICronJob } from '@/common/adapter/ipcBridge';

const AgentsAutomationsTab: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { jobs, loading, pauseJob, resumeJob } = useAllCronJobs();

  const handleToggle = async (job: ICronJob) => {
    if (job.enabled) await pauseJob(job.id);
    else await resumeJob(job.id);
  };

  return (
    <div className='flex flex-col h-full min-h-0'>
      <div className='flex items-center justify-between mb-12px shrink-0'>
        <p className='text-13px text-t-secondary m-0'>
          {t('agents.automationsHint', {
            defaultValue: 'Scheduled tasks detected from your runtime. Manage the full list in Automations.',
          })}
        </p>
        <Button type='primary' size='small' onClick={() => navigate('/scheduled')}>
          {t('agents.manageAutomations', { defaultValue: 'Manage all' })}
        </Button>
      </div>

      <div className='flex-1 min-h-0 overflow-y-auto flex flex-col gap-8px'>
        {loading ? (
          <div className='flex justify-center py-40px'>
            <Spin size={24} />
          </div>
        ) : jobs.length === 0 ? (
          <div className='text-center py-40px'>
            <Empty description={t('agents.noAutomations', { defaultValue: 'No scheduled tasks yet' })} />
            <Button type='primary' size='small' className='mt-12px' onClick={() => navigate('/scheduled')}>
              {t('cron.page.newTask', { defaultValue: 'New task' })}
            </Button>
          </div>
        ) : (
          jobs.slice(0, 12).map((job) => (
            <div
              key={job.id}
              className='bg-fill-1 rd-10px border border-border-2 px-14px py-12px flex items-center justify-between gap-12px cursor-pointer hover:border-t-primary transition-colors'
              onClick={() => navigate(`/scheduled/${job.id}`)}
            >
              <div className='min-w-0 flex-1'>
                <div className='text-14px font-medium text-t-primary truncate'>{job.name || job.id}</div>
                <div className='text-11px text-t-tertiary mt-2px'>{formatSchedule(job, t)}</div>
                <div className='text-11px text-t-secondary mt-2px'>{formatNextRun(job.state.next_run_at_ms)}</div>
              </div>
              <div className='flex items-center gap-10px shrink-0' onClick={(e) => e.stopPropagation()}>
                <CronStatusTag job={job} />
                <Switch size='small' checked={job.enabled} onChange={() => void handleToggle(job)} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AgentsAutomationsTab;
