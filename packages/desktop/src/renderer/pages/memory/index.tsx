/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@arco-design/web-react';
import { ArrowCounterClockwise, ArrowSquareOut } from '@phosphor-icons/react';
import { configService } from '@/common/config/configService';
import WebviewHost from '@/renderer/components/media/WebviewHost';
import { isElectronDesktop, openExternalUrl } from '@/renderer/utils/platform';

import { DEFAULT_OPENCONCHO_URL, MEMORY_URL_KEY } from '@/renderer/pages/memory/useMemory';

function resolveMemoryUrl(): string {
  const stored = configService.get(MEMORY_URL_KEY);
  return typeof stored === 'string' && stored.trim() ? stored.trim() : DEFAULT_OPENCONCHO_URL;
}

const MemoryPage: React.FC = () => {
  const { t } = useTranslation();
  const memoryUrl = useMemo(() => resolveMemoryUrl(), []);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const isDesktop = isElectronDesktop();

  return (
    <div className='size-full flex flex-col relative'>
      <div className='flex items-center justify-end gap-8px px-12px py-8px border-b border-border-2 shrink-0'>
        <Button
          type='secondary'
          size='small'
          icon={<ArrowCounterClockwise size={14} />}
          onClick={() => setReloadKey((k) => k + 1)}
        >
          {t('common.refresh', { defaultValue: 'Refresh' })}
        </Button>
        <Button
          type='secondary'
          size='small'
          icon={<ArrowSquareOut size={14} />}
          onClick={() => void openExternalUrl(memoryUrl)}
        >
          {t('memory.openExternal', { defaultValue: 'Open in browser' })}
        </Button>
      </div>

      {loadError && (
        <div className='px-12px py-8px text-13px text-danger-6 bg-fill-1 border-b border-border-2 shrink-0'>
          {loadError}
          <Button type='text' size='mini' className='ml-8px' onClick={() => void openExternalUrl(memoryUrl)}>
            {t('memory.openExternal', { defaultValue: 'Open in browser' })}
          </Button>
        </div>
      )}

      <div className='flex-1 min-h-0 relative'>
        {isDesktop ? (
          <WebviewHost
            key={`${memoryUrl}-${reloadKey}`}
            url={memoryUrl}
            id='openconcho-memory'
            partition='persist:headmaster-memory'
            className='size-full'
            onDidFailLoad={(_code, description) => {
              setLoadError(description || t('memory.loadFailed', { defaultValue: 'Failed to load Memory screen.' }));
            }}
            onDidFinishLoad={() => setLoadError(null)}
          />
        ) : (
          <iframe
            key={`${memoryUrl}-${reloadKey}`}
            src={memoryUrl}
            className='size-full border-0'
            title={t('memory.title', { defaultValue: 'Memory' })}
            onError={() => setLoadError(t('memory.loadFailed', { defaultValue: 'Failed to load Memory screen.' }))}
          />
        )}
      </div>
    </div>
  );
};

export default MemoryPage;
