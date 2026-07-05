/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Badge } from '@arco-design/web-react';
import { Plugs, MagnifyingGlass, PlugsConnected, Spinner } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { isActive, MIN_SEARCH, toolkitLogoUrl, useComposioApps } from './useComposioApps';

type SubTab = 'browse' | 'connected';

const AppsPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const [tab, setTab] = useState<SubTab>('browse');
  const {
    toolkits,
    connections,
    connectedSlugs,
    loadingToolkits,
    loadingMore,
    hasMore,
    loadMore,
    loadingConnections,
    connecting,
    disconnecting,
    error,
    gated,
    gateReason,
    search,
    setSearch,
    connect,
    disconnect,
  } = useComposioApps();

  const activeConnections = connections.filter(isActive);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Infinite scroll: load the next page once the sentinel below the grid is visible.
  useEffect(() => {
    if (tab !== 'browse') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [tab, loadMore]);

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      <div className='flex items-center gap-8px mb-16px shrink-0'>
        <Plugs size={20} weight='duotone' className='text-t-primary' />
        <h1 className='text-18px font-semibold text-t-primary'>
          {t('apps.title', { defaultValue: 'Apps' })}
        </h1>
        <span className='rd-100px border border-[rgba(var(--primary-6),0.25)] bg-[rgba(var(--primary-6),0.10)] px-7px py-2px text-10px font-600 text-[rgb(var(--primary-6))]'>
          Beta
        </span>
        {gated ? <span className='rd-100px border border-line px-7px py-2px text-10px font-600 text-t-secondary'>Gated</span> : null}
      </div>

      {gated ? (
        <div className='mb-16px rounded-10px border border-warning-3 bg-warning-1 px-12px py-10px text-12px text-warning-7 leading-relaxed shrink-0'>
          {t('apps.gatedNotice', {
            defaultValue:
              'Composio connected apps are visible as a beta entry, but disabled until the Console exposes the required integration APIs.',
          })}{' '}
          {gateReason}
        </div>
      ) : null}

      <div className='flex items-center gap-4px border-b border-line-1 mb-16px shrink-0'>
        <button
          type='button'
          onClick={() => setTab('browse')}
          className={classNames(
            '-mb-1px border-b-2 px-12px py-8px text-13px font-medium transition-colors',
            tab === 'browse' ? 'border-t-primary text-t-primary' : 'border-transparent text-t-secondary hover:text-t-primary'
          )}
        >
          {t('apps.browse', { defaultValue: 'Browse' })}
        </button>
        <button
          type='button'
          onClick={() => setTab('connected')}
          className={classNames(
            '-mb-1px border-b-2 px-12px py-8px text-13px font-medium transition-colors',
            tab === 'connected' ? 'border-t-primary text-t-primary' : 'border-transparent text-t-secondary hover:text-t-primary'
          )}
        >
          {t('apps.connected', { defaultValue: 'Connected' })}
          {activeConnections.length > 0 ? ` (${activeConnections.length})` : ''}
        </button>
      </div>

      {error ? (
        <div className='mb-16px rounded-8px border border-red-300/40 bg-red-500/5 p-12px text-13px text-red-500 shrink-0'>
          {error}
        </div>
      ) : null}

      <div className='flex-1 min-h-0 overflow-y-auto'>
        {tab === 'browse' ? (
          <div className='flex flex-col gap-16px'>
            <div className='relative'>
              <MagnifyingGlass size={16} className='absolute left-10px top-1/2 -translate-y-1/2 text-t-secondary z-1' />
              <Input
                value={search}
                onChange={setSearch}
                disabled={gated}
                placeholder={t('apps.searchPlaceholder', { defaultValue: 'Search 1000+ apps…' })}
                className='pl-32px!'
              />
            </div>

            {toolkits.length === 0 && !loadingToolkits ? (
              <div className='rounded-8px border border-dashed border-line-1 p-24px text-center text-13px text-t-secondary'>
                {search.trim().length > 0 && search.trim().length < MIN_SEARCH
                  ? t('apps.searchMinChars', { defaultValue: `Type at least ${MIN_SEARCH} characters to search.` })
                  : gated
                    ? t('apps.gatedEmpty', { defaultValue: 'Connectors will appear here once the backend is ready.' })
                    : t('apps.noneFound', { defaultValue: 'No apps found.' })}
              </div>
            ) : (
              <>
                <div className='grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-8px'>
                  {toolkits.map((toolkit) => {
                    const connected = connectedSlugs.has(toolkit.slug);
                    return (
                      <div key={toolkit.slug} className='flex flex-col gap-6px rounded-8px border border-line-1 p-8px'>
                        <div className='flex-1 flex flex-col gap-4px'>
                          <div className='flex items-center gap-6px'>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={toolkit.logo || toolkitLogoUrl(toolkit.slug)}
                              alt=''
                              className='size-18px shrink-0 rounded-4px'
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.visibility = 'hidden';
                              }}
                            />
                            <span className='min-w-0 truncate text-12px font-medium text-t-primary'>{toolkit.name}</span>
                          </div>
                          {toolkit.description ? (
                            <p className='line-clamp-2 text-11px text-t-secondary'>{toolkit.description}</p>
                          ) : null}
                        </div>
                        <Button
                          size='mini'
                          type={connected ? 'secondary' : 'primary'}
                          disabled={gated || connected || connecting === toolkit.slug}
                          onClick={() => void connect(toolkit.slug)}
                          icon={
                            connecting === toolkit.slug ? (
                              <Spinner size={12} className='animate-spin' />
                            ) : connected ? undefined : (
                              <Plugs size={12} />
                            )
                          }
                        >
                          {connected
                            ? t('apps.connected', { defaultValue: 'Connected' })
                            : t('apps.connect', { defaultValue: 'Connect' })}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                {hasMore ? (
                  <div ref={sentinelRef} className='flex justify-center py-8px'>
                    {loadingMore ? <Spinner size={16} className='animate-spin text-t-secondary' /> : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : loadingConnections ? (
          <div className='rounded-8px border border-dashed border-line-1 p-24px text-13px text-t-secondary text-center'>
            {t('common.loading', { defaultValue: 'Loading…' })}
          </div>
        ) : connections.length === 0 ? (
          <div className='rounded-8px border border-dashed border-line-1 p-24px text-center text-13px text-t-secondary'>
            {t('apps.noneConnected', { defaultValue: 'No apps connected yet. Switch to Browse to connect one.' })}
          </div>
        ) : (
          <div className='overflow-hidden rounded-8px border border-line-1 text-13px'>
            {connections.map((conn, i) => (
              <div
                key={conn.id}
                className={classNames(
                  'flex items-center justify-between gap-16px px-16px py-12px',
                  i < connections.length - 1 && 'border-b border-line-1'
                )}
              >
                <div className='flex min-w-0 items-center gap-8px'>
                  {conn.toolkitSlug ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={toolkitLogoUrl(conn.toolkitSlug)} alt='' className='size-20px shrink-0 rounded-4px' />
                  ) : null}
                  <span className='min-w-0 truncate font-medium text-t-primary'>
                    {conn.toolkitName || conn.toolkitSlug || conn.id}
                  </span>
                  <Badge status={isActive(conn) ? 'success' : 'default'} text={conn.status.toLowerCase()} />
                </div>
                <Button
                  size='small'
                  type='secondary'
                  disabled={gated || disconnecting === conn.id}
                  onClick={() => void disconnect(conn.id)}
                  icon={
                    disconnecting === conn.id ? (
                      <Spinner size={14} className='animate-spin' />
                    ) : (
                      <PlugsConnected size={14} />
                    )
                  }
                >
                  {t('apps.disconnect', { defaultValue: 'Disconnect' })}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppsPage;
