/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackendLifecycleManager } from '@aionui/web-host';
import type { BackendDirConfig, BackendStartOptions } from '@aionui/web-host';
import { resolveGcapcoreBinaryPath } from './gcapcoreBinaryResolver';

export type GcapcoreBootstrapStatus = 'stopped' | 'starting' | 'running' | 'unavailable' | 'error';

export type GcapcoreBootstrapStartResult =
  | { ok: true; port: number; status: GcapcoreBootstrapStatus }
  | { ok: false; status: GcapcoreBootstrapStatus; error?: string };

export class GcapcoreBootstrap {
  private readonly manager: BackendLifecycleManager;
  private _status: GcapcoreBootstrapStatus = 'stopped';
  private _lastError: string | null = null;

  constructor(
    private readonly appMeta: {
      version: string;
      isPackaged: boolean;
      resourcesPath: string;
      userDataPath: string;
    }
  ) {
    this.manager = new BackendLifecycleManager(
      {
        version: appMeta.version,
        isPackaged: appMeta.isPackaged,
        resourcesPath: appMeta.resourcesPath,
        userDataPath: appMeta.userDataPath,
      },
      resolveGcapcoreBinaryPath
    );
  }

  get port(): number {
    return this.manager.port;
  }

  get status(): GcapcoreBootstrapStatus {
    return this._status;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  /**
   * Start the GCAPCore sidecar for Council, MCP, cron, Office CLI, and preview
   * compatibility. Missing core is non-fatal so remote/container mode can still run.
   */
  async start(
    dataDir: string,
    logDir: string,
    dirs: BackendDirConfig,
    options?: BackendStartOptions
  ): Promise<GcapcoreBootstrapStartResult> {
    if (this._status === 'running' && this.manager.port > 0) {
      return { ok: true, port: this.manager.port, status: 'running' };
    }

    this._status = 'starting';
    this._lastError = null;

    try {
      const port = await this.manager.start(dataDir, logDir, dirs, options);
      this._status = this.manager.status === 'running' ? 'running' : 'starting';
      return { ok: true, port, status: this._status };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this._lastError = message;
      if (message.includes('resolve') || message.includes('Cannot find')) {
        this._status = 'unavailable';
        console.warn('[Headmaster] GCAPCore sidecar unavailable:', message);
        return { ok: false, status: 'unavailable', error: message };
      }
      this._status = 'error';
      console.error('[Headmaster] GCAPCore sidecar failed to start:', message);
      return { ok: false, status: 'error', error: message };
    }
  }

  async stop(): Promise<void> {
    await this.manager.stop();
    this._status = 'stopped';
  }
}

let singleton: GcapcoreBootstrap | null = null;

export function getGcapcoreBootstrap(): GcapcoreBootstrap | null {
  return singleton;
}

export function setGcapcoreBootstrap(bootstrap: GcapcoreBootstrap): void {
  singleton = bootstrap;
}

export function exposeGcapcorePort(port: number): void {
  const globalState = globalThis as typeof globalThis & { __gcapcorePort?: number; __aioncorePort?: number };
  globalState.__gcapcorePort = port;
  globalState.__aioncorePort = port;
}

export function clearGcapcorePort(): void {
  const globalState = globalThis as typeof globalThis & { __gcapcorePort?: number; __aioncorePort?: number };
  delete globalState.__gcapcorePort;
  delete globalState.__aioncorePort;
}
