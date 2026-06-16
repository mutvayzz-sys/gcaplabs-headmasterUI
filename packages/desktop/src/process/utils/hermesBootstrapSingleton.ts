/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hermes Bootstrap singleton holder.
 *
 * `src/index.ts` constructs the `HermesBootstrap` early in app boot and
 * stores it via `setHermesBootstrap()`. The bridge init code (which runs
 * as a side-effect import during module load) reads it via
 * `getHermesBootstrap()` and wires the IPC handlers against this instance.
 *
 * This is the simplest way to pass the bootstrap into the bridge init flow
 * without reordering the module-load sequence in `process/index.ts`.
 *
 * Recon reference: `headmaster-hermes/RECON.md` §1 (process spawn lifecycle).
 */

import type { HermesBootstrap } from '@process/backend/hermesBootstrap';

let instance: HermesBootstrap | null = null;

export function setHermesBootstrap(bootstrap: HermesBootstrap): void {
  instance = bootstrap;
}

export function getHermesBootstrap(): HermesBootstrap | null {
  return instance;
}

export function clearHermesBootstrap(): void {
  instance = null;
}
