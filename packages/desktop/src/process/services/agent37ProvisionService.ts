/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Agent37-backed desktop provision service.
 *
 * Replaces the legacy HermesHQ provision client. The desktop still speaks the
 * same `HermeshqProvisionSnapshot` shape (it is the internal seam between the
 * provision service and every consumer in the renderer), but the HTTP target
 * is now the Headmaster Console BFF, which proxies provisioning to the user's
 * managed Agent37 Cloud runtime.
 *
 * Endpoints used (all served by Console2 at the configured agent37 URL):
 *   POST /api/auth/login                  — exchange username/password for a bearer
 *   GET  /api/desktop/provision/current   — return the synthesized provision snapshot
 *   POST /api/desktop/runtime/validate    — re-check the Agent37 runtime is healthy
 *
 * The legacy `Hermeshq*` symbols are kept for compatibility with downstream
 * consumers (`Agent37ProvisionService` would be the long-term rename target —
 * see TODO in the seam comment above `setHermesRuntimeRestarter`).
 */

import {
  clearAgent37Provision,
  getAgent37Config,
  setAgent37Provision,
  type Agent37ProvisionSnapshot,
} from '../connection/connectionConfig';
import { getRendererPlatform } from '../utils/rendererPlatform';

export interface Agent37ProvisionRequest {
  client: 'headmaster_desktop';
  version: string;
  platform: NodeJS.Platform;
}

export interface Agent37RuntimeValidationRequest {
  runtime_id: string;
  requested_capability: string;
}

export interface Agent37RuntimeValidationResponse {
  allowed: boolean;
  reason?: string;
  expires_at?: string;
  capabilities?: string[];
}

export interface Agent37ProvisionResult {
  success: boolean;
  provision?: Agent37ProvisionSnapshot;
  status?: number;
  error?: string;
}

const APP_VERSION = '0.1.3';

function normalizeBaseUrl(url: string): string {
  return url
    .trim()
    .replace(/\/$/, '')
    .replace('://hermeshq.gcaplabs.com', '://console.gcaplabs.com')
    .replace('://hq.gcaplabs.com', '://console.gcaplabs.com');
}

function resolveBaseUrl(): string {
  const config = getAgent37Config();
  const fallback = (process.env.AGENT37_BASE_URL || 'https://console.gcaplabs.com').trim();
  return normalizeBaseUrl(config.url || fallback);
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function mapProvisionResponse(payload: Record<string, unknown>): Agent37ProvisionSnapshot | null {
  if (!payload || typeof payload !== 'object') return null;
  const runtime = (payload.runtime as Record<string, unknown> | undefined) ?? null;
  const cloud = (payload.cloud_container_config as Record<string, unknown> | undefined) ?? null;
  const user = (payload.user as Record<string, unknown> | undefined) ?? null;
  if (!user || !runtime) return null;
  const validateUrl = typeof runtime.validate_url === 'string' ? runtime.validate_url : '';
  if (!validateUrl) return null;

  const snapshot: Agent37ProvisionSnapshot = {
    mode: typeof payload.mode === 'string' ? payload.mode : 'headmaster_remote',
    user: {
      id: String(user.id ?? ''),
      username: String(user.username ?? user.id ?? ''),
      role: String(user.role ?? 'user'),
    },
    capabilities: Array.isArray(payload.capabilities)
      ? (payload.capabilities.filter((c) => typeof c === 'string') as string[])
      : [],
    runtime: {
      base_url: typeof runtime.base_url === 'string' ? runtime.base_url : null,
      api_base_path: typeof runtime.api_base_path === 'string' ? runtime.api_base_path : '/v1',
      health_url: typeof runtime.health_url === 'string' ? runtime.health_url : null,
      validate_url: validateUrl,
      version_url: typeof runtime.version_url === 'string' ? runtime.version_url : null,
      ttl_seconds: Number.isFinite(Number(runtime.ttl_seconds)) ? Number(runtime.ttl_seconds) : 3600,
    },
  };
  if (cloud) {
    snapshot.cloud_container_config = {
      endpoint_url: typeof cloud.endpoint_url === 'string' ? cloud.endpoint_url : null,
      container_id: String(cloud.container_id ?? ''),
      api_server_key: typeof cloud.api_server_key === 'string' ? cloud.api_server_key : null,
      forward_auth_token: typeof cloud.forward_auth_token === 'string' ? cloud.forward_auth_token : null,
      forward_auth_expires_at:
        typeof cloud.forward_auth_expires_at === 'string' ? cloud.forward_auth_expires_at : null,
    };
  }
  if (typeof payload.session_namespace === 'string') {
    snapshot.session_namespace = payload.session_namespace;
  }
  if (Array.isArray(payload.providers)) {
    snapshot.providers = payload.providers as Agent37ProvisionSnapshot['providers'];
  }
  if (typeof payload.default_model === 'string') snapshot.default_model = payload.default_model;
  if (typeof payload.default_provider === 'string') snapshot.default_provider = payload.default_provider;
  if (typeof payload.default_base_url === 'string') snapshot.default_base_url = payload.default_base_url;
  if (typeof payload.system_prompt_override === 'string') {
    snapshot.system_prompt_override = payload.system_prompt_override;
  }
  if (typeof payload.refreshed_at === 'string') snapshot.refreshed_at = payload.refreshed_at;
  return snapshot;
}

export async function provisionAgent37Desktop(
  request: Agent37ProvisionRequest
): Promise<Agent37ProvisionResult> {
  const config = getAgent37Config();
  if (!config.token) {
    return { success: false, error: 'Agent37 session is not configured.' };
  }
  const baseUrl = resolveBaseUrl();
  const platform = request.platform || getRendererPlatform();

  try {
    const response = await fetch(`${baseUrl}/api/desktop/provision/current`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'X-Headmaster-Client': request.client,
        'X-Headmaster-Version': request.version || APP_VERSION,
        'X-Headmaster-Platform': platform,
      },
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAgent37Provision();
        return {
          success: false,
          status: response.status,
          error: 'Agent37 session expired — sign in again.',
        };
      }
      const detail = (await readJson<{ error?: string }>(response))?.error;
      return { success: false, status: response.status, error: detail || `Provision failed (HTTP ${response.status})` };
    }
    const payload = (await readJson<Record<string, unknown>>(response)) ?? {};
    const provision = mapProvisionResponse(payload);
    if (!provision) {
      return { success: false, error: 'Invalid provision response from Agent37.' };
    }
    provision.client = request.client;
    provision.version = request.version || APP_VERSION;
    provision.platform = platform;
    setAgent37Provision(provision);
    return { success: true, provision };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Network error contacting Agent37.';
    return { success: false, error: reason };
  }
}

export async function provisionViaAuthMe(
  token: string,
  request: Agent37ProvisionRequest
): Promise<Agent37ProvisionResult> {
  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Headmaster-Client': request.client,
        'X-Headmaster-Version': request.version || APP_VERSION,
      },
    });
    if (!response.ok) {
      return { success: false, status: response.status, error: 'Identity check failed' };
    }
    const me = (await readJson<Record<string, unknown>>(response)) ?? {};
    const user = me.user as Record<string, unknown> | undefined;
    if (!user) return { success: false, error: 'Identity response missing user' };
    const fallback: Agent37ProvisionSnapshot = {
      mode: 'headmaster_remote',
      user: {
        id: String(user.id ?? ''),
        username: String(user.username ?? user.id ?? ''),
        role: String(user.role ?? 'user'),
      },
      capabilities: ['chat', 'files', 'integrations', 'model_selection'],
      runtime: {
        base_url: baseUrl,
        api_base_path: '/v1',
        health_url: `${baseUrl}/api/v1/health`,
        validate_url: `${baseUrl}/api/desktop/runtime/validate`,
        version_url: `${baseUrl}/api/v1/version`,
        ttl_seconds: 3600,
      },
    };
    fallback.client = request.client;
    fallback.version = request.version || APP_VERSION;
    fallback.platform = request.platform;
    setAgent37Provision(fallback);
    return { success: true, provision: fallback };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Identity check failed';
    return { success: false, error: reason };
  }
}

export async function validateAgent37RuntimeAccess(
  request: Agent37RuntimeValidationRequest
): Promise<{ success: boolean; validation?: Agent37RuntimeValidationResponse; error?: string }> {
  const config = getAgent37Config();
  if (!config.token) {
    return { success: false, error: 'Agent37 session is not configured.' };
  }
  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/desktop/runtime/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAgent37Provision();
        return { success: false, error: 'Agent37 session expired' };
      }
      return { success: false, error: `Runtime validation failed (HTTP ${response.status})` };
    }
    const data = (await readJson<Agent37RuntimeValidationResponse>(response)) ?? null;
    if (!data) return { success: false, error: 'Empty validation response' };
    return { success: true, validation: data };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Network error';
    return { success: false, error: reason };
  }
}

type Restarter = () => Promise<{ success: boolean; error?: string } | void>;
let runtimeRestarter: Restarter | null = null;

export function setHermesRuntimeRestarter(restarter: Restarter): void {
  runtimeRestarter = restarter;
}

// Canonical name — new main-process code should use this.
export const setAgent37RuntimeRestarter = setHermesRuntimeRestarter;

export function broadcastApiServerKey(_key: string | null): void {
  // No-op: Agent37 bearer tokens live in IPC, not the renderer window. The
  // local Hermes dashboard does not need an API key when the runtime is fully
  // remote. The hook is preserved so future Composer-style integrations can
  // surface a runtime key in the renderer without touching call sites.
  if (runtimeRestarter) {
    void runtimeRestarter().catch(() => {
      /* restarter is best-effort; failures logged by the restarter itself */
    });
  }
}

// ---------------------------------------------------------------------------
// Legacy-symbol compatibility aliases
//
// The IPC channel names still carry the `hermeshq:*` prefix (kept stable to
// avoid a renderer-side bridge churn) and the main process imports these
// symbols under their historical names. Re-export under the old names so the
// Agent37-backed implementation can drop in without rippling through every
// main-process caller.
// ---------------------------------------------------------------------------

export const validateHermeshqRuntimeAccess = validateAgent37RuntimeAccess;
export const provisionHermeshqDesktop = provisionAgent37Desktop;
