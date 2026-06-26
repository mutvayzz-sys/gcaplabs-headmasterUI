/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { applyProvisionToRuntime } from './applyProvisionToRuntime';
import {
  clearHermeshqProvision,
  getHermeshqConfig,
  setHermeshqProvision,
  type HermeshqProvisionSnapshot,
} from '../connection/connectionConfig';

export interface HermeshqProvisionRequest {
  client: 'headmaster_desktop';
  version: string;
  platform: NodeJS.Platform;
}

export interface HermeshqRuntimeValidationRequest {
  runtime_id: string;
  requested_capability: string;
}

export interface HermeshqRuntimeValidationResponse {
  allowed: boolean;
  capabilities: string[];
  role: string;
  ttl_seconds: number;
}

function buildValidationUrl(): string {
  const config = getHermeshqConfig();
  const baseUrl = config.url.trim().replace(/\/$/, '');
  const provision = config.provision;
  if (provision?.runtime?.validate_url) {
    return provision.runtime.validate_url.trim();
  }
  return `${baseUrl}/api/desktop/runtime/validate`;
}

const AUTH_ME_TIMEOUT_MS = 10_000;

export interface HermeshqProvisionApiResponse {
  mode: string;
  hermeshq_url: string;
  user: { id: string; username: string; role: string };
  capabilities: string[];
  runtime: { validate_url: string; ttl_seconds: number };
  cloud_container_config?: { endpoint_url: string; container_id: string } | null;
  system_prompt_override?: string | null;
  session_namespace?: string | null;
  honcho_base_url?: string | null;
  honcho_api_key?: string | null;
  providers?: Array<{
    slug: string;
    name: string;
    runtime_provider: string;
    auth_type: string;
    base_url: string | null;
    default_model: string | null;
    available_models: string[];
    enabled: boolean;
  }> | null;
  default_model?: string | null;
  default_provider?: string | null;
  default_base_url?: string | null;
  app_settings?: {
    app_name: string;
    app_short_name: string;
    theme_mode: string;
    default_locale: string;
    logo_url?: string | null;
    favicon_url?: string | null;
    has_logo?: boolean;
    has_favicon?: boolean;
  } | null;
}

export async function provisionHermeshqDesktop(request: HermeshqProvisionRequest): Promise<{
  success: boolean;
  provision?: HermeshqProvisionSnapshot;
  error?: string;
}> {
  const config = getHermeshqConfig();
  if (!config.url || !config.token) {
    clearHermeshqProvision();
    return { success: false, error: 'HermesHQ session is not configured.' };
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), AUTH_ME_TIMEOUT_MS);
  try {
    // Call the provision endpoint to get full provision data including
    // the provider catalog and default model. Falls back to /api/auth/me
    // if the provision endpoint is unavailable (backward compat).
    const baseUrl = config.url.trim().replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/api/desktop/provision`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: abort.signal,
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearHermeshqProvision();
      }
      // Fall back to /api/auth/me for backward compat
      return provisionViaAuthMe(config, abort.signal);
    }
    const data = (await response.json()) as HermeshqProvisionApiResponse;
    if (!data.user?.id || !data.user?.username) {
      return provisionViaAuthMe(config, abort.signal);
    }
    const provision: HermeshqProvisionSnapshot = {
      mode: data.mode ?? 'local',
      user: { id: data.user.id, username: data.user.username, role: data.user.role ?? 'user' },
      capabilities: data.capabilities ?? [],
      runtime: data.runtime ?? { validate_url: '', ttl_seconds: 3600 },
      cloud_container_config: data.cloud_container_config ?? null,
      system_prompt_override: data.system_prompt_override ?? null,
      session_namespace: data.session_namespace ?? null,
      honcho_base_url: data.honcho_base_url ?? null,
      honcho_api_key: data.honcho_api_key ?? null,
      providers: data.providers ?? [],
      default_model: data.default_model ?? null,
      default_provider: data.default_provider ?? null,
      default_base_url: data.default_base_url ?? null,
      app_settings: data.app_settings ?? null,
      refreshed_at: new Date().toISOString(),
    };
    setHermeshqProvision(provision);
    applyProvisionToRuntime(provision);
    return { success: true, provision };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

/** Fallback: build a minimal provision snapshot from /api/auth/me. */
async function provisionViaAuthMe(
  config: { url: string; token: string },
  signal: AbortSignal
): Promise<{ success: boolean; provision?: HermeshqProvisionSnapshot; error?: string }> {
  try {
    const response = await fetch(`${config.url}/api/auth/me`, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal,
    });
    if (!response.ok) {
      return { success: false, error: `Authentication check failed (HTTP ${response.status})` };
    }
    const data = (await response.json()) as { id?: string; username?: string; role?: string };
    if (!data.id || !data.username) {
      return { success: false, error: 'Unexpected response from authentication server.' };
    }
    const provision: HermeshqProvisionSnapshot = {
      mode: 'local',
      user: { id: data.id, username: data.username, role: data.role ?? 'user' },
      capabilities: [],
      runtime: { validate_url: '', ttl_seconds: 3600 },
      refreshed_at: new Date().toISOString(),
    };
    setHermeshqProvision(provision);
    applyProvisionToRuntime(provision);
    return { success: true, provision };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function validateHermeshqRuntimeAccess(request: HermeshqRuntimeValidationRequest): Promise<{
  success: boolean;
  validation?: HermeshqRuntimeValidationResponse;
  status?: number;
  error?: string;
}> {
  const config = getHermeshqConfig();
  if (!config.url || !config.token) {
    clearHermeshqProvision();
    return { success: false, error: 'HermesHQ session is not configured.' };
  }

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), AUTH_ME_TIMEOUT_MS);
  try {
    const response = await fetch(buildValidationUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: abort.signal,
    });
    let data: HermeshqRuntimeValidationResponse | null = null;
    try {
      data = (await response.json()) as HermeshqRuntimeValidationResponse;
    } catch {
      data = null;
    }
    if (!response.ok || !data) {
      if (response.status === 401 || response.status === 403) {
        clearHermeshqProvision();
      }
      return {
        success: false,
        status: response.status,
        error:
          typeof (data as { detail?: string } | null)?.detail === 'string'
            ? (data as { detail?: string }).detail
            : 'Runtime validation failed',
      };
    }
    return { success: true, validation: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}
