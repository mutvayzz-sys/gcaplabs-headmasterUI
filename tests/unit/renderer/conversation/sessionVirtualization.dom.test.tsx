/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TChatConversation } from '@/common/config/storage';

const mocks = vi.hoisted(() => ({
  loadAllUserConversations: vi.fn(),
  navigate: vi.fn(),
  params: { id: 'conversation-0' } as { id?: string },
}));

vi.mock('react-virtuoso', () => ({
  Virtuoso: ({
    data,
    itemContent,
    className,
    computeItemKey,
  }: {
    data: TChatConversation[];
    itemContent: (index: number, item: TChatConversation) => React.ReactNode;
    className?: string;
    computeItemKey?: (index: number, item: TChatConversation) => React.Key;
  }) => (
    <div data-testid='session-history-virtuoso' data-count={data.length} className={className}>
      {data.slice(0, 8).map((item, index) => (
        <div data-testid='virtual-session-row' key={computeItemKey?.(index, item) ?? item.id}>
          {itemContent(index, item)}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('@/renderer/utils/chat/pagedConversationData', () => ({
  loadAllUserConversations: mocks.loadAllUserConversations,
}));

vi.mock('@/common', () => ({
  ipcBridge: {
    conversation: {
      remove: { invoke: vi.fn() },
      update: { invoke: vi.fn() },
    },
  },
}));

vi.mock('@/renderer/pages/cron', () => ({
  CronJobIndicator: () => null,
  useCronJobsMap: () => ({
    getJobStatus: () => 'none',
    markAsRead: vi.fn(),
  }),
}));

vi.mock('@/renderer/pages/conversation/utils/conversationCache', () => ({
  refreshConversationCache: vi.fn(),
}));

vi.mock('@/renderer/utils/emitter', () => ({
  addEventListener: vi.fn(() => vi.fn()),
  emitter: { emit: vi.fn() },
}));

vi.mock('@/renderer/utils/ui/focus', () => ({
  blockMobileInputFocus: vi.fn(),
  blurActiveElement: vi.fn(),
}));

vi.mock('@/renderer/utils/ui/siderTooltip', () => ({
  cleanupSiderTooltips: vi.fn(),
  getSiderTooltipProps: () => ({}),
}));

vi.mock('@/renderer/hooks/context/LayoutContext', () => ({
  useLayoutContext: () => ({ isMobile: false, siderCollapsed: false, setSiderCollapsed: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.params,
}));

vi.mock('@arco-design/web-react', () => ({
  Empty: ({ description }: { description?: string }) => <div>{description}</div>,
  Input: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input value={value} onChange={(event) => onChange(event.currentTarget.value)} />
  ),
  Popconfirm: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

vi.mock('@icon-park/react', () => ({
  DeleteOne: () => null,
  EditOne: () => null,
  MessageOne: () => null,
}));

const makeConversation = (index: number): TChatConversation =>
  ({
    id: `conversation-${index}`,
    name: `Conversation ${index}`,
    created_at: Date.now() - index * 1000,
    modified_at: Date.now() - index * 1000,
    user_id: 'user-1',
    extra: {},
  }) as TChatConversation;

describe('ChatHistory virtualization', () => {
  beforeEach(() => {
    mocks.loadAllUserConversations.mockReset();
    mocks.navigate.mockReset();
  });

  it('renders long session history through Virtuoso instead of mounting every row', async () => {
    mocks.loadAllUserConversations.mockResolvedValue(Array.from({ length: 50 }, (_, index) => makeConversation(index)));

    const { default: ChatHistory } = await import('@/renderer/pages/conversation/components/ChatHistory');
    render(<ChatHistory />);

    const virtualizer = await screen.findByTestId('session-history-virtuoso');
    expect(virtualizer).toHaveAttribute('data-count', '50');
    expect(await screen.findByText('Conversation 0')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Conversation 49')).not.toBeInTheDocument());
    expect(screen.getAllByTestId('virtual-session-row')).toHaveLength(8);
  });
});
