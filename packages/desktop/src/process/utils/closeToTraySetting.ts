/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProcessConfig } from './initStorage';

const CLOSE_TO_TRAY_CONFIG_KEY = 'system.closeToTray';

export const readCloseToTraySetting = async (): Promise<boolean> => {
  const localValue = await ProcessConfig.get(CLOSE_TO_TRAY_CONFIG_KEY);
  return typeof localValue === 'boolean' ? localValue : false;
};

export const writeCloseToTraySetting = async (enabled: boolean): Promise<void> => {
  await ProcessConfig.set(CLOSE_TO_TRAY_CONFIG_KEY, enabled);
};
