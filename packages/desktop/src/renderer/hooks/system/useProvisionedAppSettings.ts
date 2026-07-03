/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import type { Agent37ProvisionAppSettings } from '@/process/connection/connectionConfig';

/**
 * Agent37 Console BFF provision response. Returns null when unauthenticated
 * or when the provision has not yet been received.

 * This is the unified settings source — the desktop should read branding/theme
 * from here instead of local config or separate API calls.
 */
export function useProvisionedAppSettings(): Agent37ProvisionAppSettings | null {
  return useMemo(() => {
    if (typeof window === 'undefined') return null;
    const provision = (window as Window & { __agent37Provision?: { app_settings?: Agent37ProvisionAppSettings } })
      .__agent37Provision;

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
