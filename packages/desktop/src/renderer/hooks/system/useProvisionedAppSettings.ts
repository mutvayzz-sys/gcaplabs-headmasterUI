/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import type { Agent37ProvisionAppSettings } from '@/process/connection/connectionConfig';

/**
End Patch
 * Agent37 Console2 BFF provision response. Returns null when unauthenticated
 * or when the provision has not yet been received.
 *
 * This is the unified settings source — the desktop should read branding/theme
 * from here instead of local config or separate API calls.
 */
export function useProvisionedAppSettings(): Agent37ProvisionAppSettings | null {
  return useMemo(() => {
    if (typeof window === 'undefined') return null;
    // Canonical Agent37 global, with the legacy `__hermeshqProvision` kept
    // as a one-release read alias.
    const provision = (window as any).__agent37Provision ?? (window as any).__hermeshqProvision;
    if (!provision?.app_settings) return null;
    return provision.app_settings as Agent37ProvisionAppSettings;
  }, []);
}

/**
 * Hook that returns the app name from the provision response, falling back
 * to the default "Headmaster" string.
 */
export function useProvisionedAppName(): string {
  const settings = useProvisionedAppSettings();
  return settings?.app_name || 'Headmaster';
}

/**
 * Hook that returns the theme mode from the provision response, falling back
 * to 'dark'.
 */
export function useProvisionedThemeMode(): string {
  const settings = useProvisionedAppSettings();
  return settings?.theme_mode || 'dark';
}
