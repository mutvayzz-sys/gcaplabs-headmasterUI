/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SendBox from '@/renderer/components/chat/SendBox';

vi.mock('@/common', () => ({
  ipcBridge: {
    mcp: {
      listAvailableFiles: { invoke: vi.fn(async () => []) },
    },
  },
}));

vi.mock('@arco-design/web-react', () => ({
  Button: ({
    children,
    icon,
    onClick,
    disabled,
    shape: _shape,
    type: _type,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ReactNode; shape?: string; type?: string }) => (
    <button type='button' disabled={disabled} onClick={onClick} {...props}>
      {icon}
      {children}
    </button>
  ),
  Input: {
    TextArea: ({
      onChange,
      value,
      autoSize: _autoSize,
      ...props
    }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { autoSize?: unknown }) => (
      <textarea value={value as string} onChange={onChange} {...props} />
    ),
  },
  Message: {
    useMessage: () => [{ warning: vi.fn(), error: vi.fn(), success: vi.fn() }, null],
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
  Tag: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@icon-park/react', () => ({
  ArrowUp: () => <span>send-icon</span>,
  CloseSmall: () => <span>close</span>,
  Plus: () => <span>plus</span>,
  Quote: () => <span>quote</span>,
}));

vi.mock('@office-ai/platform', () => ({
  theme: { Color: { PrimaryColor: '#2563ff' } },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}));

vi.mock('@/renderer/components/chat/AtFileMenu', () => ({ default: () => null }));
vi.mock('@/renderer/components/chat/BtwOverlay', () => ({ default: () => null }));
vi.mock('@/renderer/components/chat/BtwOverlay/useBtwCommand', () => ({
  useBtwCommand: () => ({ isLoading: false, answer: '', isOpen: false, dismiss: vi.fn(), question: '', ask: vi.fn() }),
}));
vi.mock('@/renderer/components/chat/SlashCommandMenu', () => ({ default: () => null }));
vi.mock('@/renderer/components/chat/SpeechInputButton', () => ({ default: () => null }));
vi.mock('@/renderer/components/media/UploadProgressBar', () => ({ default: () => null }));

vi.mock('@/renderer/hooks/chat/useInputFocusRing', () => ({
  useInputFocusRing: () => ({ activeBorderColor: 'blue', inactiveBorderColor: 'gray', activeShadow: 'none' }),
}));
vi.mock('@/renderer/hooks/chat/useSlashCommandController', () => ({
  useSlashCommandController: () => ({
    isOpen: false,
    filteredCommands: [],
    activeIndex: 0,
    setActiveIndex: vi.fn(),
    selectCommand: vi.fn(),
    close: vi.fn(),
  }),
}));
vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false }),
}));
vi.mock('@/renderer/hooks/context/ConversationContext', () => ({
  useConversationContextSafe: () => ({ conversation_id: 'conv-1' }),
}));
vi.mock('@/renderer/pages/team/hooks/TeamPermissionContext', () => ({
  useTeamPermission: () => null,
}));
vi.mock('@/renderer/pages/conversation/utils/warmupConversation', () => ({
  warmupConversation: vi.fn(async () => undefined),
}));
vi.mock('@/renderer/utils/emitter', () => ({
  emitter: { emit: vi.fn() },
  useAddEventListener: vi.fn(),
}));
vi.mock('@/renderer/utils/ui/clipboard', () => ({ copyText: vi.fn() }));
vi.mock('@/renderer/utils/ui/focus', () => ({
  blurActiveElement: vi.fn(),
  shouldBlockMobileInputFocus: () => false,
}));
vi.mock('@renderer/hooks/file/useConversationExport', () => ({
  useConversationExport: () => ({
    step: 'idle',
    menuItems: [],
    activeIndex: 0,
    loading: false,
    setActiveIndex: vi.fn(),
    onSelectMenuItem: vi.fn(),
    close: vi.fn(),
  }),
}));
vi.mock('@renderer/hooks/file/useDragUpload', () => ({
  useDragUpload: () => ({ isFileDragging: false, dragHandlers: {} }),
}));
vi.mock('@renderer/hooks/file/usePasteService', () => ({
  usePasteService: () => ({ onPaste: vi.fn(), onFocus: vi.fn() }),
}));
vi.mock('@renderer/hooks/file/useUploadState', () => ({
  useUploadState: () => ({ isUploading: false, uploadProgress: 0 }),
}));
vi.mock('@renderer/hooks/file/useAbortUploadsOnConversationChange', () => ({
  useAbortUploadsOnConversationChange: vi.fn(),
}));
vi.mock('@renderer/pages/conversation/Messages/hooks', () => ({
  useMessageList: () => ({ data: [] }),
}));
vi.mock('@renderer/services/FileService', () => ({ allSupportedExts: [] }));
vi.mock('@/renderer/hooks/system/useLiveTranscriptInsertion', () => ({
  appendSpeechTranscript: (prev: string, transcript: string) => `${prev}${transcript}`,
  createChainedDispatch: () => ({ dispatch: vi.fn(), reset: vi.fn() }),
  useLiveTranscriptInsertion: () => ({ handleLiveTranscript: vi.fn() }),
}));
vi.mock('@/renderer/hooks/system/useSpeechInput', () => ({
  appendSpeechTranscript: (prev: string, transcript: string) => `${prev}${transcript}`,
}));

describe('SendBox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not call onSend more than once for same-tick repeated clicks on the same draft', () => {
    const onSend = vi.fn(() => new Promise<void>(() => {}));
    vi.spyOn(console, 'info').mockImplementation(() => {});

    render(<SendBox value='hello' onChange={vi.fn()} onSend={onSend} allowSendWhileLoading />);

    const send = screen.getByTestId('sendbox-send-btn');
    act(() => {
      send.click();
      send.click();
      send.click();
      send.click();
      send.click();
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('hello');
  });
});
