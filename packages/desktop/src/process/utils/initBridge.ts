/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { logger } from '@office-ai/platform';
import { initAllBridges, type BridgeDependencies } from '../bridge';
import { getHermesBootstrap } from './hermesBootstrapSingleton';

logger.config({ print: true });

/**
 * Initialize all process-side bridges. The caller (which constructs the
 * HermesBootstrap singleton) is expected to pass it via `deps.hermesBootstrap`.
 *
 * If the caller does not pass `deps`, the singleton is used (if it has been
 * set via `setHermesBootstrap`). Otherwise the Hermes bridge handlers simply
 * aren't registered.
 */
export function initBridges(deps: BridgeDependencies = {}): void {
  const merged: BridgeDependencies = { hermesBootstrap: getHermesBootstrap() ?? deps.hermesBootstrap };
  initAllBridges(merged);
}
