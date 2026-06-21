/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { BackendLifecycleManager } from '@aionui/web-host';
import type { BackendDirConfig, BackendStartOptions } from '@aionui/web-host';
import { resolveBinaryPath } from './binaryResolver';

export type AioncoreBootstrapStatus = 'stopped' | 'starting' | 'running' | 'unavailable' | 'error';

export type AioncoreBootstrapStartResult =
  | { ok: true; port: number; status: AioncoreBootstrapStatus }
  | { ok: false; status: AioncoreBootstrapStatus; error?: string };

export class AioncoreBootstrap {
  private readonly manager: BackendLifecycleManager;
  private _status: AioncoreBootstrapStatus = 'stopped';
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
      resolveBinaryPath
    );
  }

  get port(): number {
    return this.manager.port;
  }

  get status(): AioncoreBootstrapStatus {
    return this._status;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  /**
   * Start the AionCore sidecar. Non-fatal when the binary is missing — Council
   * falls back to the native in-process team layer.
   */
  async start(
    dataDir: string,
    logDir: string,
    dirs: BackendDirConfig,
    options?: BackendStartOptions
  ): Promise<AioncoreBootstrapStartResult> {
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
        console.warn('[Headmaster] AionCore sidecar unavailable — Council uses native fallback:', message);
        return { ok: false, status: 'unavailable', error: message };
      }
      this._status = 'error';
      console.error('[Headmaster] AionCore sidecar failed to start:', message);
      return { ok: false, status: 'error', error: message };
    }
  }

  async stop(): Promise<void> {
    await this.manager.stop();
    this._status = 'stopped';
  }
}

let singleton: AioncoreBootstrap | null = null;

export function getAioncoreBootstrap(): AioncoreBootstrap | null {
  return singleton;
}

export function setAioncoreBootstrap(bootstrap: AioncoreBootstrap): void {
  singleton = bootstrap;
}

export function exposeAioncorePort(port: number): void {
  (globalThis as typeof globalThis & { __aioncorePort?: number }).__aioncorePort = port;
}

export function clearAioncorePort(): void {
  delete (globalThis as typeof globalThis & { __aioncorePort?: number }).__aioncorePort;
}
