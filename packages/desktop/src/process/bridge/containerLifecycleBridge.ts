/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcMain } from 'electron';
import { getHermeshqConfig } from '../connection/connectionConfig';

async function hermeshqFetch(
  path: string,
  method: string,
  body?: unknown
): Promise<{ ok: boolean; data: unknown; status: number }> {
  const config = getHermeshqConfig();
  if (!config.url || !config.token) {
    return { ok: false, data: null, status: 401 };
  }
  const url = `${config.url.replace(/\/$/, '')}${path}`;
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const response = await fetch(url, init);
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // empty body or non-JSON
  }
  return { ok: response.ok, data, status: response.status };
}

export function initContainerLifecycleBridge(): void {
  ipcMain.handle('container:list', async () => {
    try {
      const { ok, data } = await hermeshqFetch('/api/containers', 'GET');
      if (!ok) return { success: false, containers: [] };
      const result = data as { containers?: unknown[] } | unknown[] | null;
      const containers = Array.isArray(result)
        ? result
        : Array.isArray((result as { containers?: unknown[] })?.containers)
          ? (result as { containers: unknown[] }).containers
          : [];
      return { success: true, containers };
    } catch (err) {
      console.error('[containerLifecycleBridge] container:list failed:', err);
      return { success: false, containers: [] };
    }
  });

  ipcMain.handle('container:create', async (_event, payload: unknown) => {
    try {
      const { ok, data } = await hermeshqFetch('/api/containers', 'POST', payload);
      if (!ok) return { success: false, container: null };
      return { success: true, container: data };
    } catch (err) {
      console.error('[containerLifecycleBridge] container:create failed:', err);
      return { success: false, container: null };
    }
  });

  ipcMain.handle('container:start', async (_event, containerId: string) => {
    try {
      const { ok } = await hermeshqFetch(`/api/containers/${containerId}/start`, 'POST');
      return { success: ok, containerId };
    } catch (err) {
      console.error('[containerLifecycleBridge] container:start failed:', err);
      return { success: false, containerId };
    }
  });

  ipcMain.handle('container:stop', async (_event, containerId: string) => {
    try {
      const { ok } = await hermeshqFetch(`/api/containers/${containerId}/stop`, 'POST');
      return { success: ok, containerId };
    } catch (err) {
      console.error('[containerLifecycleBridge] container:stop failed:', err);
      return { success: false, containerId };
    }
  });

  ipcMain.handle('container:destroy', async (_event, containerId: string) => {
    try {
      const { ok } = await hermeshqFetch(`/api/containers/${containerId}`, 'DELETE');
      return { success: ok, containerId };
    } catch (err) {
      console.error('[containerLifecycleBridge] container:destroy failed:', err);
      return { success: false, containerId };
    }
  });
}
