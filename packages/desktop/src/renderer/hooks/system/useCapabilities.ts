/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';

const ALL_CAPABILITIES = [
  'chat',
  'terminal',
  'local_files',
  'cowork',
  'model_selection',
  'runtime_settings',
  'admin_audit',
  'integrations',
] as const;

export type DesktopCapability = (typeof ALL_CAPABILITIES)[number];

export interface CapabilityContext {
  capabilities: DesktopCapability[];
  role: string;
  mode: string;
}

function readCapabilitiesFromWindow(): CapabilityContext {
  // AuthContext sets this after successful Agent37 provision.
  const provision = (window as Window & { __agent37Provision?: Record<string, unknown> }).__agent37Provision;
  if (provision) {
    const caps = Array.isArray(provision.capabilities)
      ? provision.capabilities.filter((c): c is string => typeof c === 'string')
      : [];
    const user = provision.user as Record<string, unknown> | undefined;
    return {
      capabilities: caps.filter((c): c is DesktopCapability =>
        ALL_CAPABILITIES.includes(c as DesktopCapability)
      ),
      role: typeof user?.role === 'string' ? user.role : 'user',
      mode: typeof provision.mode === 'string' ? provision.mode : 'headmaster_local',
    };
  }
  // Fallback: all capabilities enabled (backward compatibility)
  return {
    capabilities: [...ALL_CAPABILITIES],
    role: 'user',
    mode: 'headmaster_local',
  };
}

export function useCapabilities(): CapabilityContext {
  const [caps, setCaps] = useState(() => readCapabilitiesFromWindow());
  useEffect(() => {
    const handler = () => setCaps(readCapabilitiesFromWindow());
    window.addEventListener('agent37:provision-updated', handler);
    return () => {
      window.removeEventListener('agent37:provision-updated', handler);
    };
  }, []);
  return caps;
}

export function useCapabilityCheck(capability: DesktopCapability): boolean {
  const { capabilities } = useCapabilities();
  return capabilities.includes(capability);
}

export function useIsAdmin(): boolean {
  const { role } = useCapabilities();
  return role === 'admin' || role === 'school_admin';
}

export function useIsStudent(): boolean {
  const { role } = useCapabilities();
  return role === 'student';
}

export function useIsThinClient(): boolean {
  const { mode } = useCapabilities();
  return mode === 'headmaster_plus_thin';
}
