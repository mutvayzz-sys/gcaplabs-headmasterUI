/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

const LEGACY_RECENT_WS_KEY = 'aionui:recent-workspaces';
export const DEFAULT_RECENT_WS_KEY = 'headmaster:recent-workspaces';
const MAX_RECENT_WORKSPACES = 5;

const migrateRecentWorkspacesKey = (storageKey: string): void => {
  if (storageKey !== DEFAULT_RECENT_WS_KEY) return;
  try {
    if (localStorage.getItem(storageKey) != null) return;
    const legacy = localStorage.getItem(LEGACY_RECENT_WS_KEY);
    if (legacy != null) {
      localStorage.setItem(storageKey, legacy);
      localStorage.removeItem(LEGACY_RECENT_WS_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

export const getRecentWorkspaces = (storageKey: string = DEFAULT_RECENT_WS_KEY): string[] => {
  migrateRecentWorkspacesKey(storageKey);
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? '[]');
  } catch {
    return [];
  }
};

export const addRecentWorkspace = (path: string, storageKey: string = DEFAULT_RECENT_WS_KEY): void => {
  try {
    const prev = getRecentWorkspaces(storageKey);
    const next = [path, ...prev.filter((item) => item !== path)].slice(0, MAX_RECENT_WORKSPACES);
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {}
};
