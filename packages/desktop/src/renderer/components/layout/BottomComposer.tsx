/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Input, Button } from '@arco-design/web-react';
import { PaperPlaneRight, Command, Sparkle } from '@phosphor-icons/react';

/**
 * Persistent bottom composer — quick-command bar available on every screen.
 * Sends messages to the default "guid" conversation or jumps to Chat.
 */
const BottomComposer: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    // Navigate to chat with the draft pre-filled
    navigate(`/guid?draft=${encodeURIComponent(text.trim())}`);
    setText('');
  };

  return (
    <div className='shrink-0 bg-fill-1 border-t border-border-2 px-16px py-10px flex items-center gap-10px z-30'>
      <Button
        type='secondary'
        size='mini'
        icon={<Command size={14} />}
        className='shrink-0'
        onClick={() => navigate('/guid')}
      >
        {t('composer.chat', { defaultValue: 'Chat' })}
      </Button>

      <Input
        className='flex-1'
        size='small'
        value={text}
        onChange={setText}
        placeholder={t('composer.placeholder', { defaultValue: 'Ask anything...' })}
        onPressEnter={handleSend}
        suffix={
          <span
            className='cursor-pointer p-4px hover:bg-fill-2 rd-4px transition-colors'
            onClick={handleSend}
          >
            <PaperPlaneRight
              size={16}
              weight='bold'
              className={text.trim() ? 'text-t-primary' : 'text-t-tertiary'}
            />
          </span>
        }
      />

      <Button
        type='primary'
        size='mini'
        icon={<Sparkle size={14} />}
        className='shrink-0'
        onClick={() => navigate('/guid')}
      >
        {t('composer.new', { defaultValue: 'New' })}
      </Button>
    </div>
  );
};

export default BottomComposer;
