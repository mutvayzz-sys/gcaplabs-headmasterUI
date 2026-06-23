/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

const LEGACY_WORKSPACE_UPDATE_TIME_KEY = 'aionui_workspace_update_time';
const WORKSPACE_UPDATE_TIME_KEY = 'headmaster_workspace_update_time';

const migrateWorkspaceUpdateTimeKey = (): void => {
  try {
    if (localStorage.getItem(WORKSPACE_UPDATE_TIME_KEY) != null) return;
    const legacy = localStorage.getItem(LEGACY_WORKSPACE_UPDATE_TIME_KEY);
    if (legacy != null) {
      localStorage.setItem(WORKSPACE_UPDATE_TIME_KEY, legacy);
      localStorage.removeItem(LEGACY_WORKSPACE_UPDATE_TIME_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

/**
 * 获取 workspace 的最后更新时间
 */
export const getWorkspaceUpdateTime = (workspace: string): number => {
  migrateWorkspaceUpdateTimeKey();
  try {
    const stored = localStorage.getItem(WORKSPACE_UPDATE_TIME_KEY);
    if (stored) {
      const times = JSON.parse(stored) as Record<string, number>;
      return times[workspace] || 0;
    }
  } catch {
    // Ignore parsing errors and fall back to default
  }
  return 0;
};

/**
 * 更新 workspace 的最后更新时间
 * 在创建新会话时调用此函数
 */
export const updateWorkspaceTime = (workspace: string): void => {
  migrateWorkspaceUpdateTimeKey();
  try {
    const stored = localStorage.getItem(WORKSPACE_UPDATE_TIME_KEY);
    const times = stored ? JSON.parse(stored) : {};
    times[workspace] = Date.now();
    localStorage.setItem(WORKSPACE_UPDATE_TIME_KEY, JSON.stringify(times));
  } catch (error) {
    console.error('[WorkspaceHistory] Failed to update workspace time:', error);
  }
};
