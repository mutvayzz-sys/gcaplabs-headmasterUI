/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAgents } from '@renderer/hooks/agent/useAgents';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Empty, Input, Spin, Switch, Tag } from '@arco-design/web-react';
import { Users, ArrowCounterClockwise, Robot, ChatCircle, Code, MagnifyingGlass } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { getAgentLogo } from '@renderer/utils/model/agentLogo';
import type { AgentMetadata } from '@renderer/utils/model/agentTypes';

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  acp: { icon: <Robot size={14} />, color: 'bg-amber-500/10 text-amber-300', label: 'ACP' },
  aionrs: { icon: <ChatCircle size={14} />, color: 'bg-emerald-500/10 text-emerald-300', label: 'CLI' },
  remote: { icon: <Code size={14} />, color: 'bg-blue-500/10 text-blue-300', label: 'Remote' },
  nanobot: { icon: <Robot size={14} />, color: 'bg-purple-500/10 text-purple-300', label: 'Nano' },
  'openclaw-gateway': { icon: <Code size={14} />, color: 'bg-rose-500/10 text-rose-300', label: 'Gateway' },
};

const AgentsPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agents, isLoading, error, refreshCustomAgents } = useAgents();
  const [search, setSearch] = useState('');
  const [showBuiltin, setShowBuiltin] = useState(true);

  const filtered = agents.filter((a: AgentMetadata) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.id ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesBuiltin = showBuiltin || a.agent_source !== 'builtin';
    return matchesSearch && matchesBuiltin;
  });

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      <div className='flex items-center justify-between mb-16px shrink-0'>
        <div className='flex items-center gap-8px'>
          <Users size={20} weight='duotone' className='text-t-primary' />
          <h1 className='text-18px font-semibold text-t-primary'>
            {t('agents.title', { defaultValue: 'Agents & Profiles' })}
          </h1>
          <Tag size='small' color='arcoblue'>
            {filtered.length}
          </Tag>
        </div>
        <Button
          type='secondary'
          size='small'
          icon={<ArrowCounterClockwise size={16} />}
          onClick={refreshCustomAgents}
          disabled={isLoading}
        >
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      <div className='flex items-center gap-10px mb-16px shrink-0'>
        <Input
          className='flex-1'
          size='small'
          value={search}
          onChange={setSearch}
          placeholder={t('agents.search', { defaultValue: 'Search agents...' })}
          prefix={<MagnifyingGlass size={14} className='text-t-secondary' />}
        />
        <div className='flex items-center gap-6px'>
          <Switch size='small' checked={showBuiltin} onChange={setShowBuiltin} />
          <span className='text-12px text-t-secondary'>{t('agents.showBuiltin', { defaultValue: 'Built-in' })}</span>
        </div>
      </div>

      <div className='flex-1 min-h-0 overflow-y-auto'>
        {isLoading && agents.length === 0 && (
          <div className='flex justify-center py-40px'>
            <Spin size={24} />
          </div>
        )}
        {error && (
          <div className='text-center py-24px text-t-secondary'>
            <p className='text-14px mb-12px'>{String(error)}</p>
            <Button type='primary' size='small' onClick={refreshCustomAgents}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Button>
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <Empty description={t('agents.empty', { defaultValue: 'No agents found' })} />
        )}

        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12px'>
          {filtered.map((agent: AgentMetadata) => {
            const meta = TYPE_META[agent.agent_type] ?? TYPE_META.acp;
            const logo = getAgentLogo(agent.name);
            return (
              <div
                key={agent.id}
                className='bg-fill-1 rd-10px border border-border-2 p-16px flex flex-col gap-10px hover:border-t-primary transition-colors cursor-pointer'
                onClick={() =>
                  navigate('/guid', {
                    state: { selectedAgentKey: agent.id },
                  })
                }
              >
                <div className='flex items-center gap-10px'>
                  {logo ? (
                    <img src={logo} alt={agent.name} className='w-36px h-36px object-contain rd-8px' />
                  ) : (
                    <div className='w-36px h-36px rd-8px bg-fill-2 flex items-center justify-center'>
                      <Robot size={20} className='text-t-secondary' />
                    </div>
                  )}
                  <div className='flex flex-col gap-2px'>
                    <span className='text-14px font-semibold text-t-primary'>{agent.name}</span>
                    <span className='text-11px text-t-tertiary'>{agent.id}</span>
                  </div>
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
                  {agent.agent_source === 'builtin' && (
                    <Tag size='small' color='gray'>
                      {t('agents.builtin', { defaultValue: 'Built-in' })}
                    </Tag>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AgentsPage;
