/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface Window {
    __gcapcorePort?: number;
    __aioncorePort?: number;
  }
}

function isCouncilSidecarAvailable(): boolean {
  const globalState = globalThis as typeof globalThis & { __gcapcorePort?: number; __aioncorePort?: number };
  const globalPort = globalState.__gcapcorePort ?? globalState.__aioncorePort;
  if (typeof globalPort === 'number' && globalPort > 0) {
    return true;
  }
  if (typeof window !== 'undefined') {
    const windowPort = window.__gcapcorePort ?? window.__aioncorePort;
    if (typeof windowPort === 'number' && windowPort > 0) {
      return true;
    }
  }
  return false;
}

export class CouncilSidecarUnavailableError extends Error {
  readonly code = 'COUNCIL_SIDECAR_UNAVAILABLE';

  constructor(message = 'Council requires the local runtime sidecar. Restart Headmaster or check logs in AppData.') {
    super(message);
    this.name = 'CouncilSidecarUnavailableError';
  }
}

/** Council mutating operations require the GCAPCore sidecar. */
export function requireCouncilSidecar(): void {
  if (!isCouncilSidecarAvailable()) {
    throw new CouncilSidecarUnavailableError();
  }
}

export function isCouncilSidecarUnavailableError(error: unknown): error is CouncilSidecarUnavailableError {
  return error instanceof CouncilSidecarUnavailableError;
}
