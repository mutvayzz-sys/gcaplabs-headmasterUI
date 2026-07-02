/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ElectronAPI } from './common/types/platform/electron';

declare global {
  interface Window {
    __backendPort?: number;
    __backendHost?: string;
    __hermesPort?: number;
    __hermesSessionToken?: string;
    __hermesHome?: string;
    __gcapcorePort?: number;
    __aioncorePort?: number;
    __initialLanguage?: string;
    __backendStartupFailed?: boolean;
    __backendStartupFailure?: string;
    electronAPI?: ElectronAPI;
  }
}

export {};
