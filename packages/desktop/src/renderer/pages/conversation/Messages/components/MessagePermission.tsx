/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessagePermission } from '@/common/chat/chatLib';
import { ipcBridge } from '@/common';
import { Button, Card, Input, Radio, Typography } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface MessagePermissionProps {
  message: IMessagePermission;
}

const actionIcons: Record<string, string> = {
  exec: '⚡',
  edit: '✏️',
  info: '📖',
  mcp: '🔌',
  approval: '🔐',
  clarify: '❓',
  sudo: '🔒',
  secret: '🗝️',
};

const MessagePermission: React.FC<MessagePermissionProps> = React.memo(({ message }) => {
  const { t } = useTranslation();
  const { options = [], description, title, action, call_id, command_type } = message.content || {};
  const requestAction = action || '';
  const isApproval = requestAction === 'approval';
  const isClarify = requestAction === 'clarify';
  const isMaskedPrompt = requestAction === 'sudo' || requestAction === 'secret';
  const needsTextResponse = isClarify || isMaskedPrompt;

  const [selected, setSelected] = useState<string | null>(null);
  const [textValue, setTextValue] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);

  useEffect(() => {
    setSelected(null);
    setTextValue('');
    setIsResponding(false);
    setHasResponded(false);
  }, [message.id]);

  const icon = actionIcons[action || ''] || '🔐';
  const displayTitle = title || description || t('messages.permissionRequest');
  const textPlaceholder = useMemo(() => {
    if (requestAction === 'sudo') return 'Enter the sudo password';
    if (requestAction === 'secret') return command_type ? `Enter the value for ${command_type}` : 'Enter the secret value';
    if (requestAction === 'clarify') return 'Type a custom answer';
    return 'Enter a response';
  }, [command_type, requestAction]);

  const handleConfirm = async () => {
    if (hasResponded) return;

    const responseValue = needsTextResponse ? textValue.trim() || selected : selected;
    if (!responseValue) return;

    setIsResponding(true);
    try {
      const always_allow = isApproval && responseValue === 'always';
      await ipcBridge.conversation.confirmation.confirm.invoke({
        conversation_id: message.conversation_id,
        call_id,
        msg_id: message.msg_id || '',
        data: { value: responseValue },
        always_allow,
      });
      setHasResponded(true);
    } catch (error) {
      console.error('Error confirming permission:', error);
    } finally {
      setIsResponding(false);
    }
  };

  return (
    <Card className='mb-4' bordered={false} style={{ background: 'var(--bg-1)' }} data-testid='message-permission-card'>
      <div className='space-y-4'>
        <div className='flex items-center space-x-2'>
          <span className='text-2xl'>{icon}</span>
          <Text className='block'>{displayTitle}</Text>
        </div>
        {command_type && (
          <div>
            <Text className='text-xs text-t-secondary mb-1'>{t('messages.command')}</Text>
            <code className='text-xs bg-1 p-2 rounded block text-t-primary break-all'>{command_type}</code>
          </div>
        )}
        {description && description !== displayTitle && (
          <div>
            <Text className='text-xs text-t-secondary'>{description}</Text>
          </div>
        )}
        {!hasResponded && (
          <>
            <div className='mt-10px'>{t('messages.chooseAction')}</div>
            <Radio.Group direction='vertical' size='mini' value={selected} onChange={setSelected}>
              {options.length > 0 ? (
                options.map((option, index) => (
                  <div
                    key={String(option.value) || `option_${index}`}
                    data-testid={`message-permission-option-${String(option.value) || `option_${index}`}`}
                  >
                    <Radio value={String(option.value)}>{t(option.label, { ...option.params, defaultValue: option.label })}</Radio>
                  </div>
                ))
              ) : !needsTextResponse ? (
                <Text type='secondary'>{t('messages.noOptionsAvailable')}</Text>
              ) : null}
            </Radio.Group>
            {needsTextResponse && (
              <div className='mt-8px'>
                {isMaskedPrompt ? (
                  <Input.Password
                    autoFocus
                    value={textValue}
                    onChange={setTextValue}
                    placeholder={textPlaceholder}
                    visibilityToggle
                  />
                ) : (
                  <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    value={textValue}
                    onChange={setTextValue}
                    placeholder={textPlaceholder}
                  />
                )}
              </div>
            )}
            <div className='flex justify-start pl-20px'>
              <Button
                type='primary'
                size='mini'
                disabled={isResponding || !(selected || textValue.trim())}
                onClick={handleConfirm}
                data-testid='message-permission-confirm'
              >
                {isResponding ? t('messages.processing') : t('messages.confirm')}
              </Button>
            </div>
          </>
        )}
        {hasResponded && (
          <div
            className='mt-10px p-2 rounded-md border'
            style={{ backgroundColor: 'var(--color-success-light-1)', borderColor: 'rgb(var(--success-3))' }}
          >
            <Text className='text-sm' style={{ color: 'rgb(var(--success-6))' }}>
              ✓ {t('messages.responseSentSuccessfully')}
            </Text>
          </div>
        )}
      </div>
    </Card>
  );
});

export default MessagePermission;
