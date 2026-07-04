/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * Agent37-backed desktop provision service.
 *
 * Replaces the legacy Agent37 provision client. The desktop still speaks the
 * same `Agent37ProvisionSnapshot` shape (it is the internal seam between the
 * provision service and every consumer in the renderer), but the HTTP target
 * is now the Headmaster Console BFF, which proxies provisioning to the user's
 * managed Agent37 Cloud runtime.
 *
 * Endpoints used (all served by Console2 at the configured agent37 URL):
 *   POST /api/auth/login                  — exchange username/password for a bearer
 *   GET  /api/desktop/provision/current   — return the synthesized provision snapshot
 *   POST /api/desktop/runtime/validate    — re-check the Agent37 runtime is healthy
 *
 * The legacy `Agent37*` symbols are kept for compatibility with downstream
 * consumers (`Agent37ProvisionService` would be the long-term rename target —
 * see TODO in the seam comment above `setHermesRuntimeRestarter`).
 */

import {
  clearAgent37Provision,
  clearAgent37Token,
  getAgent37Config,
  setAgent37Provision,
  setAgent37Token,
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
    // Legacy control-plane hostname → current Console host.
    .replace('://agent37.gcaplabs.com', '://www.console.gcaplabs.com')
    // The bare apex 308s everything to `www.` and the cross-host follow-up
    // breaks POST bodies / Authorization headers under Node fetch. Canonicalise
    // both stored config and env-var fallbacks to the live host up front.
    .replace(/^(https?:\/\/)console\.gcaplabs\.com(\/|$)/, '$1www.console.gcaplabs.com$2');
}

function resolveBaseUrl(): string {
  const config = getAgent37Config();
  const fallback = (process.env.AGENT37_BASE_URL || 'https://www.console.gcaplabs.com').trim();
  return normalizeBaseUrl(config.url || fallback);
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

// Console error bodies are `{ error: { code, message } }` (see ApiError/handleError in
// src/lib/http.ts on the console side) — never a bare string, so the extraction has to unwrap it.
function extractErrorMessage(payload: unknown, fallback: string): string {
  const err = (payload as { error?: unknown } | null)?.error;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
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
      const detail = await readJson<unknown>(response);
      return {
        success: false,
        status: response.status,
        error: extractErrorMessage(detail, `Provision failed (HTTP ${response.status})`),
      };
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

// --- Auth (login/register/refresh/logout) ---
//
// Runs in the main process rather than the renderer: the renderer loads from
// file:// (packaged) or http://localhost:5173 (dev), and a direct fetch to
// console.gcaplabs.com from there is cross-origin and subject to CORS, which
// the console does not allow. A Node fetch from here has no such restriction.
// The console's own auth is Supabase email+password — there is no username
// concept and no MFA, so neither is modeled here.

export interface Agent37LoginRequest {
  email: string;
  password: string;
}

export interface Agent37RegisterRequest {
  email: string;
  password: string;
}

export interface Agent37AuthResult {
  success: boolean;
  status?: number;
  error?: string;
  // Only set by register: the console has email confirmation disabled by default, so this
  // should never be true in practice, but is surfaced in case that project setting changes.
  confirmationRequired?: boolean;
}

export async function loginAgent37Desktop(request: Agent37LoginRequest): Promise<Agent37AuthResult> {
  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email, password: request.password }),
    });
    const payload = await readJson<{ access_token?: string }>(response);
    if (!response.ok || !payload?.access_token) {
      return {
        success: false,
        status: response.status,
        error: extractErrorMessage(payload, `Login failed (HTTP ${response.status})`),
      };
    }
    setAgent37Token(payload.access_token);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error contacting Agent37.' };
  }
}

export async function registerAgent37Desktop(request: Agent37RegisterRequest): Promise<Agent37AuthResult> {
  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: request.email, password: request.password }),
    });
    const payload = await readJson<{ access_token?: string; confirmation_required?: boolean }>(response);
    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        error: extractErrorMessage(payload, `Registration failed (HTTP ${response.status})`),
      };
    }
    if (payload?.confirmation_required) {
      return { success: true, confirmationRequired: true };
    }
    if (!payload?.access_token) {
      return { success: false, error: 'Registration succeeded but no session was returned.' };
    }
    setAgent37Token(payload.access_token);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error contacting Agent37.' };
  }
}

export async function refreshAgent37TokenDesktop(): Promise<Agent37AuthResult> {
  const config = getAgent37Config();
  if (!config.token) return { success: false, error: 'Agent37 session is not configured.' };
  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}` },
    });
    const payload = await readJson<{ access_token?: string }>(response);
    if (!response.ok || !payload?.access_token) {
      if (response.status === 401 || response.status === 403) clearAgent37Provision();
      return {
        success: false,
        status: response.status,
        error: extractErrorMessage(payload, 'Session refresh failed'),
      };
    }
    setAgent37Token(payload.access_token);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error refreshing session.' };
  }
}

export function logoutAgent37Desktop(): Agent37AuthResult {
  // Desktop only ever holds a bearer access token (no refresh token to revoke server-side), so
  // logout is purely local: drop the stored token/provision and let the renderer redirect.
  clearAgent37Token();
  clearAgent37Provision();
  return { success: true };
}

export async function validateAgent37RuntimeAccess(
  request: Agent37RuntimeValidationRequest
): Promise<{ success: boolean; validation?: Agent37RuntimeValidationResponse; error?: string; status?: number }> {
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
        return { success: false, status: response.status, error: 'Agent37 session expired' };
      }
      return { success: false, status: response.status, error: `Runtime validation failed (HTTP ${response.status})` };
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

export function setAgent37RuntimeRestarter(restarter: Restarter): void {
  runtimeRestarter = restarter;
}

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

// --- Managed-runtime lifecycle (Agent37 instances, surfaced through the console BFF) ---
//
// The Headmaster console owns the lifecycle of the user's Agent37 instance via
// /api/chat/runtime/*. The desktop proxies those calls so any settings panel
// here can Start/Stop/Restart/Update/Resize the runtime without leaving the
// Electron shell. The console is still the source of truth (the singleton is
// resolved server-side from the logged-in user), so the desktop does not need
// to know the runtime id — it just needs the user's session token, which is
// already loaded into getAgent37Config().

export interface ManagedRuntime {
  agent37_id: string;
  name: string | null;
  status: string | null;
  template: string | null;
  cpu: number | null;
  memory: number | null;
  disk: number | null;
  live_status: string | null;
  past_due: boolean;
  update_available: boolean;
  ports: Array<{ port: number; default: boolean; url: string }>;
  created_at: string;
}

export interface RuntimeLifecycleResult<T = unknown> {
  success: boolean;
  data?: T;
  status?: number;
  error?: string;
}

const RUNTIME_ACTIONS = ['start', 'stop', 'restart', 'update'] as const;
type RuntimeAction = (typeof RUNTIME_ACTIONS)[number];

async function runtimeActionRequest<T = unknown>(action: RuntimeAction): Promise<RuntimeLifecycleResult<T>> {
  const config = getAgent37Config();
  if (!config.token) {
    return { success: false, error: 'Agent37 session is not configured.' };
  }
  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/chat/runtime/${action}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAgent37Provision();
        return { success: false, status: response.status, error: 'Agent37 session expired — sign in again.' };
      }
      const detail = await readJson<unknown>(response);
      return {
        success: false,
        status: response.status,
        error: extractErrorMessage(detail, `Runtime ${action} failed (HTTP ${response.status})`),
      };
    }
    const data = (await readJson<T>(response)) ?? null;
    return { success: true, data: (data ?? undefined) as T | undefined };
  } catch (err) {
    const reason = err instanceof Error ? err.message : `Network error during runtime ${action}`;
    return { success: false, error: reason };
  }
}

export function getManagedRuntime(): Promise<RuntimeLifecycleResult<ManagedRuntime>> {
  return getManagedRuntimeImpl();
}

export function startManagedRuntime(): Promise<RuntimeLifecycleResult> {
  return runtimeActionRequest('start');
}

export function stopManagedRuntime(): Promise<RuntimeLifecycleResult> {
  return runtimeActionRequest('stop');
}

export function restartManagedRuntime(): Promise<RuntimeLifecycleResult> {
  return runtimeActionRequest('restart');
}

export function updateManagedRuntime(): Promise<RuntimeLifecycleResult> {
  return runtimeActionRequest('update');
}

export interface ResizeInput {
  cpu?: number;
  memory?: number;
  disk?: number;
}

export async function resizeManagedRuntime(input: ResizeInput): Promise<RuntimeLifecycleResult> {
  const config = getAgent37Config();
  if (!config.token) {
    return { success: false, error: 'Agent37 session is not configured.' };
  }
  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/chat/runtime/resize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAgent37Provision();
        return { success: false, status: response.status, error: 'Agent37 session expired — sign in again.' };
      }
      const detail = await readJson<unknown>(response);
      return {
        success: false,
        status: response.status,
        error: extractErrorMessage(detail, `Runtime resize failed (HTTP ${response.status})`),
      };
    }
    return { success: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Network error during runtime resize';
    return { success: false, error: reason };
  }
}

async function getManagedRuntimeImpl(): Promise<RuntimeLifecycleResult<ManagedRuntime>> {
  const config = getAgent37Config();
  if (!config.token) {
    return { success: false, error: 'Agent37 session is not configured.' };
  }
  const baseUrl = resolveBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/chat/runtime`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.token}` },
      cache: 'no-store',
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        clearAgent37Provision();
        return { success: false, status: response.status, error: 'Agent37 session expired — sign in again.' };
      }
      return { success: false, status: response.status, error: `Runtime fetch failed (HTTP ${response.status})` };
    }
    const data = (await readJson<ManagedRuntime>(response)) ?? null;
    if (!data) return { success: false, error: 'Empty runtime response' };
    return { success: true, data };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Network error fetching runtime';
    return { success: false, error: reason };
  }
}

