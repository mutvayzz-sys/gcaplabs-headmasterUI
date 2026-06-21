/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAioncorePort, isAioncoreAvailable } from '@/common/adapter/aioncoreBridge';
import { useEffect, useState } from 'react';

/**
 * Polls AionCore sidecar availability for Council gating UI.
 * Port is set synchronously in preload; re-check on an interval for late startup.
 */
export function useCouncilSidecar(): { available: boolean; port: number } {
  const [available, setAvailable] = useState(() => isAioncoreAvailable());

  useEffect(() => {
    const sync = () => setAvailable(isAioncoreAvailable());
    sync();
    const timer = window.setInterval(sync, 2000);
    return () => window.clearInterval(timer);
  }, []);

  return { available, port: getAioncorePort() };
}
