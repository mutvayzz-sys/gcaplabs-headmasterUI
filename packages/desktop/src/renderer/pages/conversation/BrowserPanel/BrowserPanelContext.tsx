/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useState } from 'react';

interface BrowserPanelContextValue {
  isOpen: boolean;
  vncUrl: string | null;
  openBrowserPanel: (url: string) => void;
  closeBrowserPanel: () => void;
}

const BrowserPanelContext = createContext<BrowserPanelContextValue | null>(null);

export const BrowserPanelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [vncUrl, setVncUrl] = useState<string | null>(null);

  const openBrowserPanel = useCallback((url: string) => {
    setVncUrl(url);
    setIsOpen(true);
  }, []);

  const closeBrowserPanel = useCallback(() => {
    setIsOpen(false);
    setVncUrl(null);
  }, []);

  return (
    <BrowserPanelContext.Provider value={{ isOpen, vncUrl, openBrowserPanel, closeBrowserPanel }}>
      {children}
    </BrowserPanelContext.Provider>
  );
};

export const useBrowserPanelContext = (): BrowserPanelContextValue => {
  const context = useContext(BrowserPanelContext);
  if (!context) throw new Error('useBrowserPanelContext must be used within BrowserPanelProvider');
  return context;
};
