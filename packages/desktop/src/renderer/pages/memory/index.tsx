/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Spin } from '@arco-design/web-react';
import { useLayoutContext } from '@renderer/hooks/context/LayoutContext';

const MEMORY_URL = 'https://memory.gcaplabs.com';

const MemoryPage: React.FC = () => {
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(true);

  return (
    <div className={isMobile ? 'size-full' : 'size-full'}>
      {loading && (
        <div className='flex justify-center items-center size-full'>
          <Spin size={32} />
        </div>
      )}
      <iframe
        src={MEMORY_URL}
        className='size-full border-0'
        style={{ display: loading ? 'none' : 'block' }}
        onLoad={() => setLoading(false)}
        title={t('memory.title', { defaultValue: 'Memory' })}
        allow='clipboard-read; clipboard-write'
      />
    </div>
  );
};

export default MemoryPage;
