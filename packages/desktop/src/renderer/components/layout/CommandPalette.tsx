import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type PaletteAction = {
  id: string;
  label: string;
  hint: string;
  run: () => void;
};

const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const actions = useMemo<PaletteAction[]>(
    () => [
      { id: 'new-chat', label: 'New chat', hint: 'Start a fresh Work Along session', run: () => navigate('/guid') },
      { id: 'switch-session', label: 'Switch session', hint: 'Open the session search picker', run: () => navigate('/guid?focus=session') },
      { id: 'settings', label: 'Open settings', hint: 'Models, tools, channels, runtime', run: () => navigate('/settings/model') },
      { id: 'workspace', label: 'Open workspace', hint: 'Show deliverables and files', run: () => navigate('/documents') },
      { id: 'diagnostics', label: 'Open diagnostics', hint: 'Runtime and update diagnostics', run: () => navigate('/settings/runtime') },
    ],
    [navigate]
  );

  const visibleActions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return actions;
    return actions.filter((action) => `${action.label} ${action.hint}`.toLowerCase().includes(normalized));
  }, [actions, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCommandK = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k';
      if (!isCommandK) return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;

  const runAction = (action: PaletteAction) => {
    action.run();
    setOpen(false);
    setQuery('');
  };

  return (
    <div
      data-testid='command-palette-overlay'
      role='dialog'
      aria-label='Command palette'
      className='fixed inset-0 z-1000 flex justify-center pt-15vh bg-[rgba(0,0,0,0.28)]'
      onMouseDown={() => setOpen(false)}
    >
      <div
        className='w-560px max-w-[calc(100vw-32px)] h-fit rd-16px bg-bg-1 border border-solid border-[var(--color-border-2)] shadow-[0_24px_80px_rgba(0,0,0,0.28)] overflow-hidden'
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              return;
            }
            if (event.key === 'Enter' && visibleActions[0]) {
              runAction(visibleActions[0]);
            }
          }}
          placeholder='Search commands…'
          className='w-full box-border px-18px py-14px text-16px bg-transparent border-0 outline-none text-t-primary border-b border-solid border-[var(--color-border-2)]'
        />
        <div className='max-h-360px overflow-y-auto p-8px'>
          {visibleActions.length === 0 ? (
            <div className='px-12px py-18px text-14px text-t-secondary'>No matching commands</div>
          ) : (
            visibleActions.map((action) => (
              <button
                key={action.id}
                type='button'
                className='w-full text-left px-12px py-10px rd-10px border-0 bg-transparent hover:bg-fill-2 cursor-pointer flex flex-col gap-2px'
                onClick={() => runAction(action)}
              >
                <span className='text-14px font-600 text-t-primary'>{action.label}</span>
                <span className='text-12px text-t-secondary'>{action.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
