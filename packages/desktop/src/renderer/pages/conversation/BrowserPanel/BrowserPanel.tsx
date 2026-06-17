/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Close } from '@icon-park/react';
import { useTranslation } from 'react-i18next';
import WebviewHost from '@/renderer/components/media/WebviewHost';
import { useBrowserPanelContext } from './BrowserPanelContext';

const BrowserPanel: React.FC = () => {
  const { t } = useTranslation();
  const { isOpen, vncUrl, closeBrowserPanel } = useBrowserPanelContext();

  if (!isOpen || !vncUrl) return null;

  return (
    <div className='h-full w-full flex flex-col bg-bg-1'>
      <div className='flex items-center justify-between px-12px h-40px border-b border-border-1 flex-shrink-0 bg-bg-2'>
        <div className='flex items-center gap-8px'>
          <span
            className='w-8px h-8px rounded-full bg-green-500'
            style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
          />
          <span className='text-13px font-medium text-t-primary'>{t('conversation.browser.title')}</span>
        </div>
        <button
          type='button'
          onClick={closeBrowserPanel}
          aria-label={t('conversation.browser.close')}
          className='w-24px h-24px flex items-center justify-center rounded-6px hover:bg-bg-3 transition-colors cursor-pointer border-none bg-transparent'
        >
          <Close theme='outline' size={14} />
        </button>
      </div>
      <div className='flex-1 overflow-hidden'>
        <WebviewHost url={vncUrl} className='bg-bg-1' />
      </div>
    </div>
  );
};

export default BrowserPanel;
