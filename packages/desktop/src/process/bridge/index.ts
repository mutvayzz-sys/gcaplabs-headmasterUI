/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { initApplicationBridge } from './applicationBridge';
import { initDialogBridge } from './dialogBridge';
import { initUpdateBridge } from './updateBridge';
import { initSystemSettingsBridge } from './systemSettingsBridge';
import { initWindowControlsBridge } from './windowControlsBridge';
import { initNotificationBridge } from './notificationBridge';
import { initWebuiBridge } from './webuiBridge';
import { initThemeBridge } from './themeBridge';
import { initHermesBridge } from './hermesBridge';
import { initBrowserBridge } from './browserBridge';
import { initAgentBridge } from './agentBridge';
import { initConnectionBridge } from './connectionBridge';
import { initHermeshqProvisionBridge } from './hermeshqProvisionBridge';
import { initFileSystemBridge } from './fsBridge';
import { initRuntimeDetectionBridge } from './runtimeDetectionBridge';
import { initContainerLifecycleBridge } from './containerLifecycleBridge';
import { initTeamBridge } from './teamBridge';
import { initCredentialsBridge } from './credentialsBridge';
import type { HermesBootstrap } from '@process/backend/hermesBootstrap';
import { disposeAllTeamSessions as disposeTeamSessions } from '@process/team/TeamSessionManager';

export interface BridgeDependencies {
  hermesBootstrap?: HermesBootstrap;
}

export function initAllBridges(deps: BridgeDependencies = {}): void {
  initDialogBridge();
  if (deps.hermesBootstrap) {
    initHermesBridge(deps.hermesBootstrap);
    initRuntimeDetectionBridge(deps.hermesBootstrap);
  }
  initApplicationBridge();
  initWindowControlsBridge();
  initUpdateBridge();
  initSystemSettingsBridge();
  initNotificationBridge();
  initWebuiBridge();
  initThemeBridge();
  initBrowserBridge();
  initAgentBridge();
  initConnectionBridge();
  initHermeshqProvisionBridge();
  initFileSystemBridge();
  initTeamBridge();
  initContainerLifecycleBridge();
  initCredentialsBridge();
}

export {
  initApplicationBridge,
  initDialogBridge,
  initNotificationBridge,
  initSystemSettingsBridge,
  initThemeBridge,
  initUpdateBridge,
  initWindowControlsBridge,
  initWebuiBridge,
};
export { registerWindowMaximizeListeners } from './windowControlsBridge';
export const disposeAllTeamSessions = (): Promise<void> => disposeTeamSessions();
