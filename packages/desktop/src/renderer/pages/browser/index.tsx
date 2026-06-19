/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Empty, Input, Spin, Tag } from '@arco-design/web-react';
import { Globe, ArrowCounterClockwise, X, Play, Image as ImageIcon } from '@phosphor-icons/react';
import classNames from 'classnames';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';
import { useBrowserEmbed } from './useBrowserEmbed';

const BrowserPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const { targets, activeTargetId, screenshot, loading, error, start, stop, setActiveTargetId } = useBrowserEmbed();
  const [urlInput, setUrlInput] = useState('https://example.com');

  return (
    <div className={classNames('size-full flex flex-col', isMobile ? 'p-12px' : 'p-24px')}>
      <div className='flex items-center justify-between mb-16px shrink-0'>
        <div className='flex items-center gap-8px'>
          <Globe size={20} weight='duotone' className='text-t-primary' />
          <h1 className='text-18px font-semibold text-t-primary'>{t('browser.title', { defaultValue: 'Browser' })}</h1>
        </div>
      </div>

      <div className='flex items-center gap-10px mb-16px shrink-0'>
        <Input
          className='flex-1'
          size='small'
          value={urlInput}
          onChange={setUrlInput}
          placeholder='https://...'
          prefix={<Globe size={14} className='text-t-secondary' />}
          onPressEnter={() => {
            if (urlInput.trim()) start(urlInput.trim());
          }}
        />
        <Button
          type='primary'
          size='small'
          icon={<Play size={16} />}
          onClick={() => start(urlInput.trim())}
          loading={loading}
          disabled={!urlInput.trim()}
        >
          {t('browser.start', { defaultValue: 'Start' })}
        </Button>
      </div>

      <div className='flex-1 min-h-0 overflow-hidden flex gap-12px'>
        {/* Target list */}
        <div className='w-240px flex flex-col gap-8px shrink-0 overflow-y-auto'>
          {targets.length === 0 && !loading && (
            <Empty description={t('browser.empty', { defaultValue: 'No sessions' })} />
          )}
          {targets.map((tgt) => (
            <div
              key={tgt.targetId}
              onClick={() => setActiveTargetId(tgt.targetId)}
              className={classNames(
                'cursor-pointer px-12px py-10px rd-8px border flex flex-col gap-4px',
                activeTargetId === tgt.targetId
                  ? 'border-t-primary bg-fill-2'
                  : 'border-border-2 bg-fill-1 hover:border-t-secondary'
              )}
            >
              <div className='flex items-center justify-between'>
                <span className='text-12px font-medium text-t-primary truncate'>{tgt.url}</span>
                <span
                  className='cursor-pointer p-2px hover:bg-fill-2 rd-4px'
                  onClick={(e) => {
                    e.stopPropagation();
                    stop(tgt.targetId);
                  }}
                >
                  <X size={14} className='text-t-tertiary' />
                </span>
              </div>
              <Tag size='small' color='arcoblue'>
                CDP
              </Tag>
            </div>
          ))}
        </div>

        {/* Viewport */}
        <div className='flex-1 bg-black rd-8px border border-border-2 flex items-center justify-center overflow-hidden relative'>
          {loading && !screenshot && <Spin size={32} />}
          {error && (
            <div className='text-center p-24px'>
              <p className='text-14px text-t-secondary mb-12px'>{error}</p>
              <Button type='primary' size='small' onClick={() => start(urlInput)}>
                {t('common.retry', { defaultValue: 'Retry' })}
              </Button>
            </div>
          )}
          {screenshot ? (
            <img
              src={screenshot}
              alt='browser viewport'
              className='max-w-full max-h-full object-contain'
              draggable={false}
            />
          ) : (
            !loading &&
            !error && (
              <div className='text-center'>
                <ImageIcon size={48} className='text-t-tertiary mb-12px mx-auto' />
                <p className='text-14px text-t-secondary'>
                  {t('browser.noScreenshot', { defaultValue: 'Enter a URL and click Start' })}
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default BrowserPage;
