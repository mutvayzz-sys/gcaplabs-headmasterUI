/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Input, Spin, Tabs, Tag } from '@arco-design/web-react';
import {
  ArrowCounterClockwise,
  File,
  Image as ImageIcon,
  LinkSimple,
  Package,
} from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { openExternalUrl } from '@renderer/utils/platform';
import { type ArtifactKind } from './artifactUtils';
import { type DeliverableFilter, useDeliverables } from './useAssets';

const FILTER_TABS: DeliverableFilter[] = ['all', 'image', 'file', 'link'];

const KIND_META: Record<ArtifactKind, { icon: React.ReactNode; color: string; label: string }> = {
  image: { icon: <ImageIcon size={12} />, color: 'bg-purple-500/10 text-purple-300', label: 'Image' },
  file: { icon: <File size={12} />, color: 'bg-blue-500/10 text-blue-300', label: 'File' },
  link: { icon: <LinkSimple size={12} />, color: 'bg-emerald-500/10 text-emerald-300', label: 'Link' },
};

const AssetsPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const { artifacts, loading, error, refresh } = useDeliverables();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DeliverableFilter>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return artifacts.filter((item) => {
      if (filter !== 'all' && item.kind !== filter) return false;
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        item.sessionTitle.toLowerCase().includes(q)
      );
    });
  }, [artifacts, filter, search]);

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      <div className='flex items-center justify-between mb-16px shrink-0'>
        <div className='flex items-center gap-8px'>
          <Package size={20} weight='duotone' className='text-t-primary' />
          <h1 className='text-18px font-semibold text-t-primary'>
            {t('sidebar.deliverables', { defaultValue: 'Deliverables' })}
          </h1>
          <Tag size='small' color='arcoblue'>
            {filtered.length}
          </Tag>
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

      <p className='text-13px text-t-secondary mb-12px shrink-0'>
        {t('deliverables.subtitle', {
          defaultValue: 'Files, images, and links produced across your recent sessions.',
        })}
      </p>

      <Tabs
        activeTab={filter}
        onChange={(key) => setFilter(key as DeliverableFilter)}
        type='rounded'
        className='shrink-0 mb-12px'
      >
        {FILTER_TABS.map((tab) => (
          <Tabs.TabPane
            key={tab}
            title={tab === 'all' ? t('common.all', { defaultValue: 'All' }) : KIND_META[tab as ArtifactKind].label}
          />
        ))}
      </Tabs>

      <Input
        className='mb-12px shrink-0'
        size='small'
        value={search}
        onChange={setSearch}
        placeholder={t('deliverables.search', { defaultValue: 'Search deliverables or sessions...' })}
      />

      {error && <div className='text-13px text-danger-6 mb-12px'>{error}</div>}

      <div className='flex-1 min-h-0 overflow-y-auto flex flex-col gap-8px'>
        {loading && artifacts.length === 0 ? (
          <div className='flex justify-center py-40px'>
            <Spin size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <Empty description={t('deliverables.empty', { defaultValue: 'No deliverables yet' })} />
        ) : (
          filtered.map((item) => {
            const meta = KIND_META[item.kind];
            return (
              <div
                key={item.id}
                className='bg-fill-1 rd-10px border border-border-2 px-14px py-12px flex items-start gap-12px hover:border-t-primary transition-colors cursor-pointer'
                onClick={() => void openExternalUrl(item.href)}
              >
                {item.kind === 'image' && (item.value.startsWith('http') || item.value.startsWith('data:')) ? (
                  <img src={item.value} alt='' className='w-48px h-48px object-cover rd-8px shrink-0 bg-fill-2' />
                ) : (
                  <div className='w-48px h-48px rd-8px bg-fill-2 flex items-center justify-center shrink-0'>
                    {meta.icon}
                  </div>
                )}
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center gap-8px mb-4px'>
                    <span className='text-14px font-medium text-t-primary truncate'>{item.label}</span>
                    <span
                      className={classNames(
                        'px-8px py-3px rd-6px text-11px font-medium flex items-center gap-4px shrink-0',
                        meta.color
                      )}
                    >
                      {meta.icon} {meta.label}
                    </span>
                  </div>
                  <div className='text-11px text-t-tertiary truncate'>{item.value}</div>
                  <div className='text-11px text-t-secondary mt-4px'>{item.sessionTitle}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AssetsPage;
