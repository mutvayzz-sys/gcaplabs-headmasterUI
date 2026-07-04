/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TMessage } from '@/common/chat/chatLib';

const mocks = vi.hoisted(() => ({
  messages: [] as TMessage[],
  loading: false,
  locationState: {} as Record<string, unknown>,
}));

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data,
    itemContent,
    components,
  }: {
    data: TMessage[];
    itemContent: (index: number, item: TMessage) => React.ReactNode;
    components?: { Header?: React.ComponentType; Footer?: React.ComponentType };
  }) => (
    <div data-testid='message-list-virtuoso' data-count={data.length}>
      {components?.Header ? <components.Header /> : null}
      {data.slice(0, 10).map((item, index) => (
        <div data-testid='virtual-message-row' key={item.id}>
          {itemContent(index, item)}
        </div>
      ))}
      {components?.Footer ? <components.Footer /> : null}
    </div>
  ),
}));

vi.mock('@/renderer/pages/conversation/Messages/hooks', () => ({
  useMessageList: () => mocks.messages,
  useMessageListLoading: () => mocks.loading,
}));

vi.mock('@/renderer/pages/conversation/Messages/artifacts', () => ({
  useConversationArtifacts: () => [],
}));

vi.mock('@/renderer/hooks/context/ConversationContext', () => ({
  useConversationContextSafe: () => ({ conversation_id: 'conversation-1' }),
}));

vi.mock('@/renderer/hooks/file/useAutoPreviewOfficeFiles', () => ({
  useAutoPreviewOfficeFiles: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ key: 'location-1', state: mocks.locationState }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@arco-design/web-react', () => ({
  Image: { PreviewGroup: ({ children }: React.PropsWithChildren) => <>{children}</> },
}));

vi.mock('@icon-park/react', () => ({
  Down: () => null,
}));

vi.mock('@/renderer/styles/colors', () => ({ iconColors: { secondary: '#999' } }));
vi.mock('@/renderer/utils/common', () => ({ uuid: () => 'uuid' }));
vi.mock('@/renderer/utils/chat/chatMinimapEvents', () => ({ CHAT_MESSAGE_JUMP_EVENT: 'chat-message-jump' }));

vi.mock('@/renderer/pages/conversation/Messages/components/MessageText', () => ({
  default: ({ message }: { message: TMessage }) => <span>{String((message.content as { content?: string }).content)}</span>,
}));
vi.mock('@/renderer/pages/conversation/Messages/components/MessageTips', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/components/MessageToolCall', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/components/MessageToolGroup', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/components/MessageToolGroupSummary', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/components/MessageCronTrigger', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/components/MessageSkillSuggest', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/components/MessageThinking', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/components/MessagePermission', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/acp/MessageAcpPermission', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/acp/MessageAcpToolCall', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/components/MessageAgentStatus', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/components/MessagePlan', () => ({ default: () => null }));
vi.mock('@/renderer/pages/conversation/Messages/MessageFileChanges', () => ({
  default: () => null,
  parseDiff: vi.fn(() => []),
}));
vi.mock('@/renderer/pages/conversation/Messages/components/SelectionReplyButton', () => ({ default: () => null }));

const makeMessage = (index: number): TMessage =>
  ({
    id: `message-${index}`,
    msg_id: `msg-${index}`,
    conversation_id: 'conversation-1',
    type: 'text',
    position: index % 2 === 0 ? 'left' : 'right',
    created_at: index,
    content: { content: `Message ${index}` },
  }) as TMessage;

describe('MessageList virtualization', () => {
  beforeEach(() => {
    mocks.messages = [];
    mocks.loading = false;
    mocks.locationState = {};
  });

  it('renders long message history through Virtuoso instead of mounting every row', async () => {
    mocks.messages = Array.from({ length: 80 }, (_, index) => makeMessage(index));

    const { default: MessageList } = await import('@/renderer/pages/conversation/Messages/MessageList');
    render(<MessageList />);

    const virtualizer = await screen.findByTestId('message-list-virtuoso');
    expect(virtualizer).toHaveAttribute('data-count', '80');
    expect(screen.getByText('Message 0')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Message 79')).not.toBeInTheDocument());
    expect(screen.getAllByTestId('virtual-message-row')).toHaveLength(10);
  });
});
