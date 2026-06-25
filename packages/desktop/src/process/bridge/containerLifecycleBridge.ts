/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcMain } from 'electron';

/**
 * IPC bridge for container lifecycle management.
 * These handlers are stubs that will be wired to the ContainerSupervisor
 * when the backend integration is complete.
 */
export function initContainerLifecycleBridge(): void {
  ipcMain.handle('container:list', async () => {
    // TODO: Call HermesHQ /api/containers endpoint
    return { success: true, containers: [] };
  });

  ipcMain.handle('container:create', async () => {
    // TODO: Call HermesHQ POST /api/containers endpoint
    return { success: true, container: null };
  });

  ipcMain.handle('container:start', async (_event, containerId: string) => {
    // TODO: Call HermesHQ POST /api/containers/{id}/start endpoint
    return { success: true, containerId };
  });

  ipcMain.handle('container:stop', async (_event, containerId: string) => {
    // TODO: Call HermesHQ POST /api/containers/{id}/stop endpoint
    return { success: true, containerId };
  });

  ipcMain.handle('container:destroy', async (_event, containerId: string) => {
    // TODO: Call HermesHQ DELETE /api/containers/{id} endpoint
    return { success: true, containerId };
  });
}
