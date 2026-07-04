/**
 * HTTP/WS bridge factory — drop-in replacement for bridge.buildProvider / bridge.buildEmitter
 * that routes calls to the active backend via REST API and WebSocket.
 *
 * Exported helpers produce objects with the same shape as @office-ai/platform bridge,
 * so existing renderer code works without changes.
 *
 * NOTE (Phase 1): this module reads `window.__backendPort` (the backend port).
 * The new Hermes dashboard port is exposed as `window.__hermesPort` via the
 * `useDashboardStatus` hook and consumed by Phase 2 code paths that migrate
 * endpoints to the Hermes REST surface. AionCore (Council / ACP) uses
 * `window.__aioncorePort` via `aioncoreBridge.ts`.
 */

import {
  bindAioncoreWsListeners,
  ensureAioncoreWs,
  isAioncoreAvailable,
  isAioncoreWsEvent,
  resetAioncoreWsConnection,
} from './aioncoreBridge';
import {
  DEFAULT_LOCAL_DASHBOARD_PORT,
  isRemoteContainerMode,
  isWebUiBrowserMode,
  resolveBackendHost,
  resolveBackendPort,
  resolveCloudContainerEndpoint,
} from './backendUrl';

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __backendPort?: number;
    __backendHost?: string;
    __hermesPort?: number;
    __hermesSessionToken?: string;
    __hermesHome?: string;
    __aioncorePort?: number;
    /** Active Hermes profile name (set by the renderer from the active profile). */
    __hermesProfile?: string;
    /** Per-conversation memory scope key (set by the renderer from provision.session_namespace). */
    __hermesSessionKey?: string;
    /** Cloud container endpoint URL when in headmaster_remote mode. */
    __cloudContainerEndpoint?: string;
    /** Runtime API base path for Agent37-style runtimes. */
    __runtimeApiBasePath?: string;
    /** Bearer token for routed runtime calls (forward-auth in remote mode). */
    __runtimeBearerToken?: string;
  }
}

/**
 * Resolve the backend port for local-Hermes / legacy-manual-remote mode.
 *
 * The renderer hook `useDashboardStatus` (renderer/hooks/system/useDashboardStatus.ts)
 * populates `window.__backendPort` from the Hermes dashboard status once
 * the dashboard is `ready`. The main process mirrors the same value onto
 * `globalThis.__backendPort` immediately after `hermesBootstrap.start()`
 * resolves, so any main-process caller (e.g. the one-shot assistant
 * migration hook) hits the correct port.
 *
 * The `DEFAULT_LOCAL_DASHBOARD_PORT` (9119) fallback is the upstream Hermes
 * CLI's own hardcoded default (`hermes_cli/subcommands/dashboard.py:26`) —
 * it is NOT reserved for our Headmaster-managed instance. Our own dashboard
 * binds an OS-assigned port; 9119 could just as easily belong to a
 * completely unrelated Hermes install on the machine (the user's own, or
 * another user's on a shared machine). Substituting it as a live guess in
 * the renderer would mean sending session-token'd requests to a stranger's
 * process — one that can execute real local actions. So the fallback is
 * only honored in the Node/vitest environment (`typeof window ===
 * 'undefined'`), where nothing is actually listening and it merely satisfies
 * type expectations. The renderer always gets the real published port, or 0.
 */
function getBackendPort(): number {
  if (typeof window === 'undefined') {
    return resolveBackendPort(DEFAULT_LOCAL_DASHBOARD_PORT);
  }
  return resolveBackendPort();
}

function getApiServerKey(): string | null {
  // The Agent37 instance bearer (`sk_live_...`) is set on `window.__apiServerKey`
  // by AuthContext when the provision response carries a `forward_auth_token`
  // (or, as a fallback, an `api_server_key` for the local Hermes dashboard).
  if (typeof window !== 'undefined') {
    const w = (window as Window & { __apiServerKey?: string }).__apiServerKey;
    if (typeof w === 'string' && w) return w;
  }
  const g = globalThis as typeof globalThis & { __apiServerKey?: string };
  const k = g.__apiServerKey;
  return typeof k === 'string' && k ? k : null;
}

function getRuntimeBearerToken(): string | null {
  if (typeof window !== 'undefined') {
    const bearer = (window as Window).__runtimeBearerToken;
    if (typeof bearer === 'string' && bearer) return bearer;
  }
  return getApiServerKey();
}

/**
 * Read the active Hermes profile name. Profile-scoped API calls use
 * ?profile=<name> query param per the Hermes dashboard docs.
 */
function getActiveProfile(): string | null {
  if (typeof window !== 'undefined' && (window as any).__hermesProfile) {
    const p = (window as any).__hermesProfile as string;
    return p && p !== 'default' ? p : null;
  }
  const g = globalThis as any;
  const p = g.__hermesProfile;
  return p && p !== 'default' ? p : null;
}

// ── Agent37 /v1/responses transport ──────────────────────────────────────────
//
// The Hermes HQ Runs API (`/v1/runs`, `/v1/runs/{id}/events`, `/v1/capabilities`)
// was retired in favor of the Agent37 Cloud `/v1/responses` family
// (https://www.agent37.com/docs/agents-api/chat). Every chat adapter call site
// now routes through `submitResponseAndStream` / `cancelResponse` below.
// The local-dashboard Hermes runtime also exposes the Agent37 gateway surface
// when the bundled `hermes` Python process is up-to-date.

/**
 * Read the per-launch session token that the Hermes dashboard uses to auth
 * REST + WS calls. Set by `useDashboardStatus` once the dashboard is ready.
 *
 * In the WebUI browser path, the same-origin reverse proxy in web-host
 * strips the header / query param so the renderer doesn't need to know
 * about the token at all. The fallback `''` keeps the call site simple
 * (it'll fail upstream if the token is required and missing).
 */
function getSessionToken(): string {
  if (typeof window !== 'undefined' && (window as Window).__hermesSessionToken) {
    return (window as Window).__hermesSessionToken as string;
  }
  const g = globalThis as typeof globalThis & { __hermesSessionToken?: string };
  return g.__hermesSessionToken ?? '';
}

/**
 * Read the per-session memory scope key. Set by the renderer from
 * provision.session_namespace. Sent as X-Hermes-Session-Key header so
 * the runtime scopes Honcho long-term memory per-conversation.
 */
function getSessionKey(): string {
  if (typeof window !== 'undefined' && (window as any).__hermesSessionKey) {
    return (window as any).__hermesSessionKey as string;
  }
  const g = globalThis as any;
  return g.__hermesSessionKey ?? '';
}

/**
 * WebUI (browser) mode: no Electron preload, so `window.__backendPort` is not
 * injected. Use same-origin URLs; web-host's static-server handles the reverse
 * proxy / WS upgrade to the backend.
 */
// isWebUiBrowserMode is re-exported from backendUrl for callers that need it.

function getBackendHost(): string {
  return resolveBackendHost();
}

function getRuntimeApiBasePath(): string {
  const fromWindow =
    typeof window !== 'undefined' && typeof window.__runtimeApiBasePath === 'string' ? window.__runtimeApiBasePath : '';
  const g = globalThis as typeof globalThis & { __runtimeApiBasePath?: string };
  const raw = fromWindow || g.__runtimeApiBasePath || '/v1';
  const normalized = raw.trim() || '/v1';
  return normalized.startsWith('/') ? normalized.replace(/\/$/, '') : `/${normalized.replace(/\/$/, '')}`;
}

function getRuntimeV1BaseUrl(): string {
  return `${getBaseUrl().replace(/\/$/, '')}${getRuntimeApiBasePath()}`;
}

export function supportsResponsesApi(): boolean {
  if (!isRemoteContainerMode()) return false;
  return getRuntimeApiBasePath() === '/v1' || Boolean(getRuntimeBearerToken());
}

/**
 * Probe the remote runtime's /health endpoint.
 * Returns true if the runtime is healthy, false otherwise.
 * Use this instead of WS-RPC session.list in remote container mode.
 */
export async function probeRemoteHealth(): Promise<boolean> {
  if (!isRemoteContainerMode()) return false;
  try {
    const res = await fetch(`${getRuntimeV1BaseUrl()}/health`, {
      headers: runtimeHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function getBaseUrl(): string {
  if (isRemoteContainerMode()) {
    return resolveCloudContainerEndpoint();
  }
  if (isWebUiBrowserMode()) {
    // Same-origin: calls like fetch(`${baseUrl}/api/foo`) resolve to `/api/foo`
    // on whatever host the page was served from.
    return '';
  }
  return `http://${getBackendHost()}:${getBackendPort()}`;
}

function runtimeHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  const bearer = getRuntimeBearerToken();
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return headers;
}

type ResponseUsage = { input_tokens: number; output_tokens: number; cost_usd?: number | null };

type ResponseStreamCallbacks = {
  onResponseCreated?: (responseId: string, sessionId: string) => void;
  onChunk: (text: string) => void;
  onToolEvent: (name: string, status: 'running' | 'completed' | 'failed', preview?: string) => void;
  onReasoning: (text: string) => void;
  onDone: (usage?: ResponseUsage | null, outputText?: string) => void;
  onError: (message: string) => void;
  onInteractiveRequest?: (data: {
    kind: 'approval' | 'clarify' | 'sudo' | 'secret';
    request_id: string;
    description?: string;
    question?: string;
    choices?: string[];
    command?: string;
    env_var?: string;
    prompt?: string;
  }) => void;
};

async function* parseSse(response: Response): AsyncGenerator<{ event: string; data: Record<string, unknown> }> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let index: number;
    while ((index = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (!frame.trim() || frame.startsWith(':')) continue;
      let event = '';
      const dataLines: string[] = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      if (!event || dataLines.length === 0) continue;
      try {
        yield { event, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> };
      } catch {
        // skip malformed SSE block
      }
    }
  }
}

async function consumeResponseStream(
  response: Response,
  callbacks: ResponseStreamCallbacks
): Promise<{ sawTerminal: boolean; responseId: string | null; sessionId: string | null }> {
  let sawTerminal = false;
  let responseId: string | null = null;
  let sessionId: string | null = null;
  for await (const { event, data } of parseSse(response)) {
    switch (event) {
      case 'response.created':
        responseId = typeof data.id === 'string' ? data.id : responseId;
        sessionId = typeof data.session_id === 'string' ? data.session_id : sessionId;
        if (responseId && sessionId) callbacks.onResponseCreated?.(responseId, sessionId);
        break;
      case 'response.reasoning.delta':
        callbacks.onReasoning(typeof data.text === 'string' ? data.text : '');
        break;
      case 'response.output_text.delta':
        callbacks.onChunk(typeof data.text === 'string' ? data.text : '');
        break;
      case 'response.tool_call.started':
        callbacks.onToolEvent(
          String(data.label ?? data.tool ?? 'tool'),
          'running',
          String(data.label ?? data.tool ?? '')
        );
        break;
      case 'response.tool_call.completed':
        callbacks.onToolEvent(String(data.tool ?? 'tool'), 'completed');
        break;
      case 'response.tool_call.failed':
        callbacks.onToolEvent(String(data.tool ?? 'tool'), 'failed', String(data.error ?? ''));
        break;
      // Note: `response.interactive.requested` was a Agent37/Hermes-dialect
      // event. Agent37's gateway has no such event in its eight-event stream
      // contract (response.created / reasoning.delta / tool_call.{started,
      // completed, failed} / output_text.delta / response.completed /
      // response.failed). The renderer-side PendingInteractiveRequest
      // pipeline in hermesChatAdapter.ts remains in place for the local
      // dashboard WS-RPC mode only; remote Agent37 mode flows through
      // `cancelResponse` + a new `POST /v1/responses` turn.
      case 'response.completed':
        sawTerminal = true;
        callbacks.onDone(data.usage as ResponseUsage | null | undefined, String(data.output_text ?? ''));
        break;
      case 'response.failed': {
        sawTerminal = true;
        const error = data.error && typeof data.error === 'object' ? (data.error as { message?: unknown }) : null;
        callbacks.onError(typeof error?.message === 'string' ? error.message : 'Response failed');
        break;
      }
    }
  }
  return { sawTerminal, responseId, sessionId };
}

const RESPONSE_STREAM_RECOVERY_ATTEMPTS = 8;
const RESPONSE_STREAM_RECOVERY_DELAY_MS = 1500;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function submitResponseAndStream(
  input: string,
  sessionId: string,
  callbacks: ResponseStreamCallbacks,
  signal?: AbortSignal,
  files: string[] = []
): Promise<{ responseId: string; sessionId: string } | null> {
  const baseUrl = getRuntimeV1BaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/responses`, {
      method: 'POST',
      headers: runtimeHeaders(true),
      body: JSON.stringify({
        input,
        session_id: sessionId,
        stream: true,
        ...(files.length ? { files } : {}),
      }),
      signal,
    });
  } catch {
    return null;
  }
  if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
    return null;
  }

  let outcome = await consumeResponseStream(response, callbacks);
  let responseId = outcome.responseId;
  let resolvedSessionId = outcome.sessionId ?? sessionId;
  let attempts = 0;
  while (!outcome.sawTerminal && responseId && attempts < RESPONSE_STREAM_RECOVERY_ATTEMPTS) {
    attempts += 1;
    if (attempts > 1) await delay(RESPONSE_STREAM_RECOVERY_DELAY_MS);
    try {
      const replay = await fetch(`${baseUrl}/responses/${encodeURIComponent(responseId)}/stream`, {
        headers: runtimeHeaders(),
        signal,
      });
      if (!replay.ok || !replay.headers.get('content-type')?.includes('text/event-stream')) continue;
      outcome = await consumeResponseStream(replay, callbacks);
      responseId = outcome.responseId ?? responseId;
      resolvedSessionId = outcome.sessionId ?? resolvedSessionId;
    } catch {
      // retry until the retention window or network recovers
    }
  }
  if (!responseId) return null;
  if (!outcome.sawTerminal) callbacks.onError('Lost the runtime stream and could not reattach.');
  return { responseId, sessionId: resolvedSessionId };
}

export async function cancelResponse(responseId: string): Promise<void> {
  await fetch(`${getRuntimeV1BaseUrl()}/responses/${encodeURIComponent(responseId)}/cancel`, {
    method: 'POST',
    headers: runtimeHeaders(),
  }).catch(() => {});
}

/**
 * Submit a response to an interactive prompt (approval/clarify/sudo/secret)
 * on a running response in remote container mode.
 */
/**
 * @deprecated Agent37 Cloud has no mid-turn `/v1/responses/{id}/interactive`
 * endpoint. The gateway's stream contract is purely response-style; human
 * input resumes the session by sending a new `POST /v1/responses` turn on
 * the same `session_id`. The Agent37 dialect's approval/clarify/sudo/secret
 * was a local-dashboard WS-RPC concern that does not map onto Agent37. See
 * `respondToPendingRequest` in `hermesChatAdapter.ts` for the Agent37-native
 * resume path: cancel the in-flight turn, then post a fresh `input` on the
 * session that carries the human's decision.
 *
 * Kept as a no-op so older call sites that still import it do not break the
 * build. New code MUST NOT call this — it will be removed in a later pass.
 */
export async function submitRemoteInteractive(
  _responseId: string,
  _requestId: string,
  _responseValue: string
): Promise<void> {
  // Intentionally empty: Agent37 has no mid-turn interactive endpoint. See
  // the deprecation note above. Callers must use cancel + a new turn.
}
function getWsUrl(): string {
  if (isRemoteContainerMode()) {
    // Agent37 runtime has no /api/ws endpoint — remote mode uses /v1 REST only.
    // Calling this in remote mode is a bug; throw so it fails fast instead of
    // silently connecting to a non-existent endpoint and hanging.
    throw new Error('WebSocket is not available in remote container mode — use /v1 REST instead');
  }
  if (isWebUiBrowserMode()) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  // Hermes dashboard: WS path is `/api/ws`; auth is via `?token=` query param
  // (verified at hermes-agent/apps/desktop/electron/gateway-ws-probe.cjs:39).
  const token = getSessionToken();
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  const profile = getActiveProfile();
  if (profile) params.set('profile', profile);
  const qs = params.toString();
  return `ws://${getBackendHost()}:${getBackendPort()}/api/ws${qs ? `?${qs}` : ''}`;
}

// ---------------------------------------------------------------------------
// Structured backend error
// ---------------------------------------------------------------------------

/**
 * Error thrown by `httpRequest` when the backend returns a non-2xx response.
 * Carries the structured error envelope (`success: false, error, code`) so
 * callers can branch on `code` without parsing the stringified message.
 *
 * @example
 *   try { await ipcBridge.conversation.sendMessage.invoke(...); }
 *   catch (e) {
 *     if (isBackendHttpError(e) && e.code === 'CONVERSATION_ARCHIVED') { ... }
 *   }
 */
export class BackendHttpError extends Error {
  readonly status: number;
  /** Machine-readable error code from the backend `ErrorResponse.code`, or `''` when parse failed. */
  readonly code: string;
  /** Backend-provided human message from `ErrorResponse.error`, or the raw body when parse failed. */
  readonly backendMessage: string;
  /** Structured backend metadata from `ErrorResponse.details`, when present. */
  readonly details: unknown;
  /** Raw parsed body (object on JSON response, string on text/non-JSON). */
  readonly body: unknown;

  constructor(params: { method: string; path: string; status: number; body: unknown }) {
    const { method, path, status, body } = params;
    let code = '';
    let backendMessage = '';
    let details: unknown;
    if (body && typeof body === 'object') {
      const b = body as { code?: unknown; error?: unknown; details?: unknown };
      if (typeof b.code === 'string') code = b.code;
      if (typeof b.error === 'string') backendMessage = b.error;
      details = b.details;
    } else if (typeof body === 'string') {
      backendMessage = body;
    }
    super(`Backend ${method} ${path} failed (${status}): ${JSON.stringify(body)}`);
    this.name = 'BackendHttpError';
    this.status = status;
    this.code = code;
    this.backendMessage = backendMessage;
    this.details = details;
    this.body = body;
  }
}

export function isBackendHttpError(error: unknown): error is BackendHttpError {
  // Prefer instanceof — fast path in production/bundled contexts.
  if (error instanceof BackendHttpError) return true;
  // Fallback: vite-dev HMR can split the module across chunks, breaking
  // instanceof. Detect by duck-typing on the shape produced by our
  // constructor.
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: unknown }).name === 'BackendHttpError' &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  ) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// HTTP request helper
// ---------------------------------------------------------------------------

/**
 * Per-request overrides for `httpRequest`.
 *
 * `silentStatuses` lets known-soft failures (e.g. `GET /:id/model` returning
 * 404 before the agent has attached) skip the noisy `console.error` and the
 * Sentry breadcrumb that comes with it. The error is still thrown so the
 * caller's existing try/catch keeps working.
 */
export type HttpRequestOptions = {
  silentStatuses?: number[];
};

const SENSITIVE_LOG_KEY_PATTERN = /api[_-]?key|authorization|auth[_-]?token|access[_-]?token|refresh[_-]?token|secret/i;

function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactForLog(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENSITIVE_LOG_KEY_PATTERN.test(key) ? '[REDACTED]' : redactForLog(entry, depth + 1),
    ])
  );
}

export async function httpRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: HttpRequestOptions
): Promise<T> {
  let url = `${getBaseUrl()}${path}`;
  const profile = getActiveProfile();
  if (profile && !path.includes('?profile=')) {
    const separator = url.includes('?') ? '&' : '?';
    url += `${separator}profile=${encodeURIComponent(profile)}`;
  }

  // Guard: in Electron renderer mode, skip requests when the backend port
  // is 0 (dashboard not ready yet). Prevents ERR_CONNECTION_REFUSED spam
  // against the 9119 fallback. WebUI and remote-container modes bypass
  // this (same-origin or cloud endpoint). Node test env has no `window`
  // so this guard never fires in unit tests.
  //
  // Must check resolveBackendPort() (no fallback) here, NOT getBackendPort()
  // — the latter substitutes DEFAULT_LOCAL_DASHBOARD_PORT (9119) whenever
  // the real port is unpublished, so `getBackendPort() <= 0` can never be
  // true and this guard would never fire.
  if (typeof window !== 'undefined' && !isWebUiBrowserMode() && !isRemoteContainerMode()) {
    if (resolveBackendPort() <= 0) {
      throw new Error('Backend not ready (port=0)');
    }
  }

  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (isRemoteContainerMode()) {
    // Remote container's /api/* routes sit behind the same gateway as /v1 and
    // expect the provisioned Bearer token, not the local-dashboard session
    // token (which is never populated when the container issues a
    // forward_auth_token — see AuthContext.applyProvisionGlobals).
    const bearer = getRuntimeBearerToken();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
  } else if (!isWebUiBrowserMode()) {
    // Inject the Hermes session token for REST calls. Header name is
    // `X-Hermes-Session-Token` (verified at hermes_cli/web_server.py:186 —
    // NOT `Authorization: Bearer`). Skipped in the WebUI browser path where
    // the same-origin reverse proxy already attaches the token.
    const token = getSessionToken();
    if (token) headers['X-Hermes-Session-Token'] = token;
    const sessionKey = getSessionKey();
    if (sessionKey) headers['X-Hermes-Session-Key'] = sessionKey;
  }

  console.debug(
    `[httpBridge] ${method} ${path}`,
    body !== undefined ? JSON.stringify(redactForLog(body)).slice(0, 500) : '(no body)'
  );

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    // Response body can only be consumed once — read as text, then try JSON
    const rawText = await response.text().catch(() => '');
    let errorBody: unknown;
    try {
      errorBody = JSON.parse(rawText);
    } catch {
      errorBody = rawText;
    }
    if (options?.silentStatuses?.includes(response.status)) {
      console.debug(`[httpBridge] ${method} ${path} → ${response.status} (silenced)`, errorBody);
    } else {
      console.error(`[httpBridge] ${method} ${path} → ${response.status}`, errorBody);
    }
    throw new BackendHttpError({ method, path, status: response.status, body: errorBody });
  }

  console.debug(`[httpBridge] ${method} ${path} → ${response.status} OK`);

  const contentType = response.headers.get('Content-Type');
  if (!contentType?.includes('application/json')) {
    return undefined as T;
  }

  const json = await response.json();
  // Backend wraps in { success, data, ... } — unwrap when present
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Provider factories (same shape as bridge.buildProvider)
// ---------------------------------------------------------------------------

type ProviderLike<Data, Params> = {
  provider: (handler: (params: Params) => Promise<Data>) => void;
  invoke: Params extends undefined ? () => Promise<Data> : (params: Params) => Promise<Data>;
};

export function withResponseMap<Raw, Mapped, Params>(
  inner: ProviderLike<Raw, Params>,
  map: (data: Raw) => Mapped
): ProviderLike<Mapped, Params> {
  return {
    provider: () => {},
    invoke: (async (params?: Params) => {
      const raw = await (inner.invoke as (p?: Params) => Promise<Raw>)(params);
      return map(raw);
    }) as ProviderLike<Mapped, Params>['invoke'],
  };
}

export function httpGet<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  options?: HttpRequestOptions
): ProviderLike<Data, Params> {
  return {
    provider: () => {},
    invoke: (async (params?: Params) => {
      const resolvedPath = typeof path === 'function' ? path(params!) : path;
      return httpRequest<Data>('GET', resolvedPath, undefined, options);
    }) as ProviderLike<Data, Params>['invoke'],
  };
}

export function httpPost<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  mapBody?: (params: Params) => unknown
): ProviderLike<Data, Params> {
  return {
    provider: () => {},
    invoke: (async (params?: Params) => {
      const resolvedPath = typeof path === 'function' ? path(params!) : path;
      const body = mapBody ? mapBody(params!) : params;
      return httpRequest<Data>('POST', resolvedPath, body);
    }) as ProviderLike<Data, Params>['invoke'],
  };
}

export function httpPut<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  mapBody?: (params: Params) => unknown
): ProviderLike<Data, Params> {
  return {
    provider: () => {},
    invoke: (async (params?: Params) => {
      const resolvedPath = typeof path === 'function' ? path(params!) : path;
      const body = mapBody ? mapBody(params!) : params;
      return httpRequest<Data>('PUT', resolvedPath, body);
    }) as ProviderLike<Data, Params>['invoke'],
  };
}

export function httpPatch<Data, Params = undefined>(
  path: string | ((params: Params) => string),
  mapBody?: (params: Params) => unknown
): ProviderLike<Data, Params> {
  return {
    provider: () => {},
    invoke: (async (params?: Params) => {
      const resolvedPath = typeof path === 'function' ? path(params!) : path;
      const body = mapBody ? mapBody(params!) : params;
      return httpRequest<Data>('PATCH', resolvedPath, body);
    }) as ProviderLike<Data, Params>['invoke'],
  };
}

export function httpDelete<Data, Params = undefined>(
  path: string | ((params: Params) => string)
): ProviderLike<Data, Params> {
  return {
    provider: () => {},
    invoke: (async (params?: Params) => {
      const resolvedPath = typeof path === 'function' ? path(params!) : path;
      return httpRequest<Data>('DELETE', resolvedPath);
    }) as ProviderLike<Data, Params>['invoke'],
  };
}

/** In-process provider registry (renderer event bus). Used where upstream used IPC .provider() hooks. */
export function callbackProvider<Data, Params = undefined>(
  _name: string,
  defaultValue: Data
): ProviderLike<Data, Params> {
  const handlers = new Set<(params: Params) => Promise<Data>>();
  return {
    provider: (handler: (params: Params) => Promise<Data>) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    invoke: (async (params?: Params) => {
      for (const handler of handlers) {
        await handler(params as Params);
      }
      return defaultValue;
    }) as ProviderLike<Data, Params>['invoke'],
  };
}

// ---------------------------------------------------------------------------
// WebSocket singleton
// ---------------------------------------------------------------------------

type WsCallback = (data: unknown) => void;
const wsListeners = new Map<string, Set<WsCallback>>();
let aioncoreListenersBound = false;

function ensureAioncoreListenersBound(): void {
  if (aioncoreListenersBound) return;
  bindAioncoreWsListeners(wsListeners);
  aioncoreListenersBound = true;
}
type GatewayEventCallback = (event: { type: string; session_id?: string; payload?: unknown }) => void;
const gatewayEventListeners = new Set<GatewayEventCallback>();
let ws: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let wsReconnectAttempt = 0;

type RpcId = number;
type PendingRpc = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

let rpcWs: WebSocket | null = null;
let rpcConnectPromise: Promise<void> | null = null;
let rpcReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let rpcReconnectAttempt = 0;
const RPC_RECONNECT_MAX_ATTEMPTS = 12;
let rpcNextId = 0;
const rpcPending = new Map<RpcId, PendingRpc>();

function emitGatewayEvent(event: { type: string; session_id?: string; payload?: unknown }): void {
  for (const listener of gatewayEventListeners) {
    try {
      listener(event);
    } catch {
      // A renderer listener must never break the shared RPC transport.
    }
  }
}

function rejectAllRpc(error: Error): void {
  for (const [id, pending] of rpcPending) {
    clearTimeout(pending.timer);
    pending.reject(error);
    rpcPending.delete(id);
  }
}

function scheduleRpcReconnect(): void {
  if (typeof window === 'undefined') return;
  if (rpcReconnectTimer) return;
  if (rpcReconnectAttempt >= RPC_RECONNECT_MAX_ATTEMPTS) return;
  const delay = Math.min(1000 * 2 ** rpcReconnectAttempt, 30_000);
  rpcReconnectAttempt += 1;
  rpcReconnectTimer = setTimeout(() => {
    rpcReconnectTimer = null;
    void connectRpcWs().catch(() => scheduleRpcReconnect());
  }, delay);
}

function connectRpcWs(): Promise<void> {
  if (isRemoteContainerMode()) {
    return Promise.reject(new Error('WebSocket RPC is not available in remote container mode'));
  }
  ensureAioncoreListenersBound();
  if (rpcWs?.readyState === WebSocket.OPEN) return Promise.resolve();
  if (rpcConnectPromise) return rpcConnectPromise;

  rpcConnectPromise = new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(getWsUrl());
    rpcWs = socket;

    const cleanup = () => {
      socket.removeEventListener('open', onOpen);
      socket.removeEventListener('error', onError);
    };

    const onOpen = () => {
      cleanup();
      rpcConnectPromise = null;
      rpcReconnectAttempt = 0;
      if (rpcReconnectTimer) {
        clearTimeout(rpcReconnectTimer);
        rpcReconnectTimer = null;
      }
      emitGatewayEvent({ type: 'gateway.connected' });
      resolve();
    };

    const onError = () => {
      cleanup();
      rpcConnectPromise = null;
      if (rpcWs === socket) rpcWs = null;
      reject(new Error('Could not connect to the Headmaster runtime'));
    };

    socket.addEventListener('open', onOpen, { once: true });
    socket.addEventListener('error', onError, { once: true });
    socket.addEventListener('close', () => {
      if (rpcWs === socket) rpcWs = null;
      rpcConnectPromise = null;
      rejectAllRpc(new Error('Headmaster runtime connection closed'));
      emitGatewayEvent({
        type: 'gateway.disconnected',
        payload: { message: 'Headmaster runtime connection closed' },
      });
      scheduleRpcReconnect();
    });
    socket.addEventListener('message', (event) => {
      let frame: {
        id?: RpcId;
        result?: unknown;
        error?: { message?: string };
        method?: string;
        params?: {
          type?: string;
          session_id?: string;
          payload?: unknown;
        };
      };
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (frame.method === 'event' && typeof frame.params?.type === 'string') {
        const gatewayEvent = {
          type: frame.params.type,
          session_id: frame.params.session_id,
          payload: frame.params.payload,
        };
        emitGatewayEvent(gatewayEvent);
        return;
      }
      if (frame.id === undefined || frame.id === null) return;
      const pending = rpcPending.get(frame.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      rpcPending.delete(frame.id);
      if (frame.error) {
        pending.reject(new Error(frame.error.message || 'Runtime request failed'));
      } else {
        pending.resolve(frame.result);
      }
    });
  });

  return rpcConnectPromise;
}

export async function gatewayRpcRequest<T>(
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 120_000
): Promise<T> {
  if (typeof window === 'undefined') {
    throw new Error('Runtime calls are only available in the renderer');
  }
  await connectRpcWs();
  const socket = rpcWs;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    throw new Error('Headmaster runtime is not connected');
  }
  const id = ++rpcNextId;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (rpcPending.delete(id)) reject(new Error(`request timed out: ${method}`));
    }, timeoutMs);
    rpcPending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
      timer,
    });
    try {
      socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    } catch (error) {
      clearTimeout(timer);
      rpcPending.delete(id);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function onGatewayEvent(callback: GatewayEventCallback): () => void {
  gatewayEventListeners.add(callback);
  return () => gatewayEventListeners.delete(callback);
}

export function broadcastWsEvent(eventName: string, payload: unknown): void {
  const handlers = wsListeners.get(eventName);
  if (!handlers) return;
  for (const handler of handlers) {
    try {
      handler(payload);
    } catch {
      // Keep event delivery isolated across subscribers.
    }
  }
}

export function resetHttpBridgeConnections(): void {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = null;
  wsReconnectAttempt = 0;
  ws?.close();
  ws = null;
  rpcWs?.close();
  rpcWs = null;
  rpcConnectPromise = null;
  rejectAllRpc(new Error('Headmaster runtime connection reset'));
  resetAioncoreWsConnection();
}

function ensureWs(): void {
  ensureAioncoreListenersBound();
  if (typeof window === 'undefined') {
    console.debug('[ensureWs] skipped: no window');
    return;
  }
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    console.debug('[ensureWs] skipped: already open/connecting, readyState=', ws.readyState);
    return;
  }
  connectWs();
}

function connectWs(): void {
  // Remote container mode has no /api/ws endpoint (Agent37 runtime uses /v1
  // REST only) — mirrors the isRemoteContainerMode() guard in connectRpcWs().
  if (isRemoteContainerMode()) {
    console.debug('[ensureWs] skipped: remote container mode (use /v1 REST instead)');
    return;
  }

  // Guard: don't attempt WS connection when backend port is 0 (dashboard
  // not ready). Prevents reconnect storm against the 9119 fallback.
  // Same resolveBackendPort() vs getBackendPort() distinction as httpRequest above.
  if (typeof window !== 'undefined' && !isWebUiBrowserMode()) {
    if (resolveBackendPort() <= 0) {
      console.debug('[ensureWs] skipped: backend port is 0 (dashboard not ready)');
      return;
    }
  }

  let url: string;
  try {
    url = getWsUrl();
  } catch (e) {
    console.debug('[ensureWs] skipped: getWsUrl threw', e);
    return;
  }
  console.debug('[ensureWs] connecting to', url);
  try {
    ws = new WebSocket(url);
  } catch (e) {
    console.error('[ensureWs] WebSocket constructor threw:', e);
    scheduleWsReconnect();
    return;
  }

  const current = ws;

  current.addEventListener('open', () => {
    console.debug('[ensureWs] CONNECTED');
    wsReconnectAttempt = 0;
  });

  current.addEventListener('close', (e) => {
    console.debug('[ensureWs] CLOSED code=' + e.code + ' reason=' + e.reason);
    if (ws === current) ws = null;
    scheduleWsReconnect();
  });

  current.addEventListener('error', (e) => {
    console.error('[ensureWs] ERROR', e);
    current.close();
  });

  current.addEventListener('message', (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string) as {
        name?: string;
        event?: string;
        data?: unknown;
        payload?: unknown;
      };
      const eventName = msg.name ?? msg.event;
      const payload = msg.data ?? msg.payload;
      console.debug('[WS:msg]', eventName, JSON.stringify(payload).slice(0, 200));
      if (eventName) {
        const handlers = wsListeners.get(eventName);
        if (handlers) {
          for (const h of handlers) {
            try {
              h(payload);
            } catch {
              /* never crash listener */
            }
          }
        }
      }
    } catch {
      // ignore non-JSON
    }
  });
}

function scheduleWsReconnect(): void {
  if (wsReconnectTimer) return;
  const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempt), 30000);
  wsReconnectAttempt++;
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null;
    ensureWs();
  }, delay);
}

// ---------------------------------------------------------------------------
// Emitter factory (same shape as bridge.buildEmitter)
// ---------------------------------------------------------------------------

type EmitterLike<Params> = {
  on: (callback: Params extends undefined ? () => void : (params: Params) => void) => () => void;
  emit: Params extends undefined ? () => void : (params: Params) => void;
};

export function wsEmitter<Params = undefined>(eventName: string): EmitterLike<Params> {
  return {
    on: (callback: (params: Params) => void) => {
      // Hermes chat events arrive on the JSON-RPC socket and are translated locally.
      const hermesRpcEvents = ['message.stream', 'message.userCreated', 'turn.completed'];
      if (isAioncoreAvailable() && isAioncoreWsEvent(eventName)) {
        ensureAioncoreWs();
      } else if (!hermesRpcEvents.includes(eventName)) {
        ensureWs();
      }
      if (!wsListeners.has(eventName)) {
        wsListeners.set(eventName, new Set());
      }
      const cb = callback as WsCallback;
      wsListeners.get(eventName)!.add(cb);
      return () => {
        wsListeners.get(eventName)?.delete(cb);
      };
    },
    emit: (() => {}) as EmitterLike<Params>['emit'],
  };
}

export function wsMappedEmitter<Params = undefined>(
  eventName: string,
  transform: (raw: unknown) => Params
): EmitterLike<Params> {
  const inner = wsEmitter<unknown>(eventName);
  return {
    on: (callback: (params: Params) => void) => {
      return inner.on((raw) => {
        callback(transform(raw));
      });
    },
    emit: (() => {}) as EmitterLike<Params>['emit'],
  };
}

/**
 * Stub emitter for events not yet implemented in the backend.
 */
export function stubEmitter<Params = undefined>(_name: string): EmitterLike<Params> {
  return {
    on: () => () => {},
    emit: (() => {}) as EmitterLike<Params>['emit'],
  };
}
