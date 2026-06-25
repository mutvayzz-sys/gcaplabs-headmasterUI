/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  clearHermeshqProvision,
  getHermeshqConfig,
  setHermeshqProvision,
  setConnectionMode,
  setRemoteConfig,
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

interface HermeshqProvisionResponse extends HermeshqProvisionSnapshot {
  runtime: {
    validate_url: string;
    ttl_seconds: number;
  };
}

function resolveHermeshqBaseUrl(): string {
  const config = getHermeshqConfig();
  return config.url.trim().replace(/\/$/, '');
}

function buildProvisionUrl(): string {
  const baseUrl = resolveHermeshqBaseUrl();
  return `${baseUrl}/api/desktop/provision`;
}

function buildValidationUrl(): string {
  const provision = getHermeshqConfig().provision;
  if (provision?.runtime?.validate_url) {
    return provision.runtime.validate_url.trim();
  }
  return `${resolveHermeshqBaseUrl()}/api/desktop/runtime/validate`;
}

async function postJson<TResponse>(
  url: string,
  token: string,
  body: unknown
): Promise<{ response: Response; data: TResponse | null }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let data: TResponse | null = null;
  try {
    data = (await response.json()) as TResponse;
  } catch {
    data = null;
  }

  return { response, data };
}

export async function provisionHermeshqDesktop(request: HermeshqProvisionRequest): Promise<{
  success: boolean;
  provision?: HermeshqProvisionSnapshot;
  status?: number;
  error?: string;
}> {
  const config = getHermeshqConfig();
  if (!config.url || !config.token) {
    clearHermeshqProvision();
    return { success: false, error: 'HermesHQ session is not configured.' };
  }

  try {
    const { response, data } = await postJson<HermeshqProvisionResponse>(buildProvisionUrl(), config.token, request);
    if (!response.ok || !data) {
      if (response.status === 401 || response.status === 403) {
        clearHermeshqProvision();
      }
      return {
        success: false,
        status: response.status,
        error: typeof (data as { detail?: string } | null)?.detail === 'string' ? (data as { detail?: string }).detail : 'Provisioning failed',
      };
    }

    const provision: HermeshqProvisionSnapshot = {
      ...data,
      refreshed_at: new Date().toISOString(),
    };
    setHermeshqProvision(provision);

    // Phase 3: If cloud container is provisioned, switch to remote mode
    const cloudContainer = (provision as Record<string, unknown>).cloud_container_config as Record<string, unknown> | undefined;
    if (cloudContainer?.endpoint_url) {
      const endpointUrl = String(cloudContainer.endpoint_url);
      try {
        const url = new URL(endpointUrl);
        setConnectionMode('remote');
        setRemoteConfig({
          host: url.hostname,
          port: parseInt(url.port, 10) || (url.protocol === 'https:' ? 443 : 80),
          token: config.token,
        });
      } catch {
        // Invalid URL — keep local mode
      }
    }

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

  try {
    const { response, data } = await postJson<HermeshqRuntimeValidationResponse>(
      buildValidationUrl(),
      config.token,
      request
    );
    if (!response.ok || !data) {
      if (response.status === 401 || response.status === 403) {
        clearHermeshqProvision();
      }
      return {
        success: false,
        status: response.status,
        error: typeof (data as { detail?: string } | null)?.detail === 'string' ? (data as { detail?: string }).detail : 'Runtime validation failed',
      };
    }

    return { success: true, validation: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
