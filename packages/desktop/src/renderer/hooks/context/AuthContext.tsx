import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
// M6: CSRF removed with legacy webserver — stub functions for compatibility, re-implement in M7
const withCsrfToken = <T extends Record<string, unknown>>(data: T): T => data;
const hasValidCsrfToken = (): boolean => true;
const clearCookie = (_name: string, _path?: string): void => {};
const CSRF_COOKIE_NAME = 'csrf-token';
declare const __APP_VERSION__: string;

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export interface AuthUser {
  id: string;
  username: string;
}

interface LoginParams {
  username: string;
  password: string;
  remember?: boolean;
}

type LoginErrorCode =
  | 'invalidCredentials'
  | 'tooManyAttempts'
  | 'serverError'
  | 'networkError'
  | 'csrfError'
  | 'unknown';

interface LoginResult {
  success: boolean;
  message?: string;
  code?: LoginErrorCode;
  shouldClearCache?: boolean;
}

interface DesktopAgent37User {
  id: string;
  username: string;
  role: string;
}

interface DesktopAgent37Provision {
  mode: string;
  user: DesktopAgent37User;
  capabilities: string[];
  runtime: {
    base_url?: string | null;
    api_base_path?: string | null;
    health_url?: string | null;
    validate_url: string;
    version_url?: string | null;
    ttl_seconds: number;
  };
  cloud_container_config?: {
    endpoint_url: string;
    api_server_key?: string | null;
    forward_auth_token?: string | null;
    forward_auth_expires_at?: string | null;
  };
  session_namespace?: string | null;
}

interface DesktopAgent37Config {
  url: string;
  token: string;
  provision?: DesktopAgent37Provision | null;
}


interface RegisterParams {
  email: string;
  password: string;
}

interface RegisterResult {
  success: boolean;
  message: string;
}

interface AuthContextValue {
  ready: boolean;
  user: AuthUser | null;
  status: AuthStatus;
  login: (params: LoginParams) => Promise<LoginResult>;
  loginWithOAuthToken: (token: string) => Promise<LoginResult>;
  register: (params: RegisterParams) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearAuthCache: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_USER_ENDPOINT = '/api/auth/user';

const isDesktopRuntime = typeof window !== 'undefined' && Boolean(window.electronAPI);

// Build-time Console URL. The canonical env var is `VITE_CONSOLE_URL`;
// `VITE_AGENT37_URL` is still read for one release as a transition shim.
// The console provisions Agent37 Cloud runtimes (no longer a Agent37
// control plane). Live host is `www.console.gcaplabs.com` — the bare apex
// 308s to it and the cross-host follow-up breaks POST bodies and bearer
// headers under Electron's Node fetch.
const CONSOLE_URL = (
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CONSOLE_URL as
    | string
    | undefined) ??
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_AGENT37_URL as
    | string
    | undefined) ??
  'https://www.console.gcaplabs.com'
).replace(/\/$/, '');

// Clear expired auth cache including cookies and localStorage
// 清除过期的认证缓存，包括 Cookie 和 localStorage
function clearAuthCache(): void {
  if (typeof window === 'undefined') return;

  try {
    // Clear CSRF cookie
    clearCookie(CSRF_COOKIE_NAME);
    clearCookie(CSRF_COOKIE_NAME, '/');

    // Clear localStorage auth-related items
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('auth') || key.includes('csrf') || key.includes('token'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error('Failed to clear auth cache:', error);
  }
}

async function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser | null> {
  try {
    const response = await fetch(AUTH_USER_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
      signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      success: boolean;
      user?: AuthUser;
    };
    if (data.success && data.user) {
      return data.user;
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      return null;
    }
    console.error('Failed to fetch current user:', error);
  }

  return null;
}

function resolveDesktopServerUrl(configUrl?: string): string {
  const url = (configUrl || CONSOLE_URL).trim().replace(/\/$/, '');
  // Migrate retired control-plane domains so clients with a stale stored URL
  // land on the Agent37-backed Headmaster Console. Also collapse the bare
  // apex (which 308s to `www.`) so the next request doesn't cross hosts —
  // Node fetch drops the Authorization header on cross-host POST follow-ups.
  return url
    .replace('://agent37.gcaplabs.com', '://www.console.gcaplabs.com')
    .replace(/^(https?:\/\/)console\.gcaplabs\.com(\/|$)/, '$1www.console.gcaplabs.com$2');
}

async function extractRemoteSessionToken(endpointUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`${endpointUrl}/`, { signal: AbortSignal.timeout(3000) });
    const html = await res.text();
    const match = /window\.__HERMES_SESSION_TOKEN__\s*=\s*("(?:\\.|[^"\\])*")/.exec(html);
    if (!match) return null;
    return JSON.parse(match[1]) as string;
  } catch {
    return null;
  }
}

async function applyProvisionGlobals(provision: DesktopAgent37Provision): Promise<void> {
  if (typeof window === 'undefined') return;
  const runtimeWindow = window as Window & {
    __agent37Provision?: DesktopAgent37Provision;
    __agent37Endpoint?: string;
    __runtimeApiBasePath?: string;
    __runtimeBearerToken?: string;
    __apiServerKey?: string;
    __hermesSessionKey?: string;
    __hermesSessionToken?: string;
  };
  runtimeWindow.__agent37Provision = provision;
  if (provision.session_namespace) {
    runtimeWindow.__hermesSessionKey = provision.session_namespace;
  }
  const containerUrl = provision.runtime?.base_url || provision.cloud_container_config?.endpoint_url;
  if (containerUrl) {
    const normalizedEndpoint = containerUrl.replace(/\/$/, '');
    window.__cloudContainerEndpoint = normalizedEndpoint;
    runtimeWindow.__agent37Endpoint = normalizedEndpoint;
    runtimeWindow.__runtimeApiBasePath = provision.runtime?.api_base_path || '/v1';
    const bearerToken =
      provision.cloud_container_config?.forward_auth_token ?? provision.cloud_container_config?.api_server_key;
    if (bearerToken) {
      runtimeWindow.__apiServerKey = bearerToken;
      runtimeWindow.__runtimeBearerToken = bearerToken;
    }
    if (!provision.cloud_container_config?.forward_auth_token) {
      const token = await extractRemoteSessionToken(containerUrl);
      if (token) runtimeWindow.__hermesSessionToken = token;
    }
  } else {
    delete window.__cloudContainerEndpoint;
    delete runtimeWindow.__agent37Endpoint;
    delete runtimeWindow.__runtimeApiBasePath;
    delete runtimeWindow.__runtimeBearerToken;
  }
  queueMicrotask(() => {
    window.dispatchEvent(new CustomEvent('agent37:provision-updated'));
  });
}

// Node's `process` global does not exist
// derive the platform from the user agent instead (using `process.platform` here
// throws "process is not defined" and stalls bootstrap on "Preparing your workspace…").
function getRendererPlatform(): NodeJS.Platform {
  const ua = (typeof navigator !== 'undefined' ? navigator.userAgent : '').toLowerCase();
  if (ua.includes('win')) return 'win32';
  if (ua.includes('mac')) return 'darwin';
  if (ua.includes('linux')) return 'linux';
  return 'win32';
}

async function provisionDesktopSession(): Promise<{ provision: DesktopAgent37Provision } | { error: string }> {
  const result = await window.electronAPI?.provisionAgent37?.({
    client: 'headmaster_desktop',
    version: __APP_VERSION__,
    platform: getRendererPlatform(),
  });

  if (!result?.success || !result.provision) {
    const detail = (result as { error?: string } | undefined)?.error ?? 'Provisioning failed';
    const status = (result as { status?: number } | undefined)?.status;
    const reason = status ? `${detail} (HTTP ${status})` : detail;
    return { error: reason };
  }

  return { provision: result.provision as DesktopAgent37Provision };
}

function provisionUserToAuthUser(user: DesktopAgent37User): AuthUser {
  return {
    id: user.id,
    username: user.username,
  };
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [ready, setReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (isDesktopRuntime) {
        // Desktop mode: validate stored Agent37 JWT against the baked-in server URL
        const config = (await window.electronAPI?.getAgent37Config?.()) as DesktopAgent37Config | undefined;
        const serverUrl = resolveDesktopServerUrl(config?.url);
        const token = config?.token ?? '';

        if (!serverUrl || !token) {
          setUser(null);
          setStatus('unauthenticated');
          setReady(true);
          return;
        }

        // Try to refresh the token first so sessions stay alive silently. The IPC handler
        // already persists a fresh token internally on success (see loginAgent37Desktop et al.).
        await window.electronAPI?.refreshAgent37Token?.();

        if (!config?.url && serverUrl) {
          await window.electronAPI?.setAgent37Url?.(serverUrl);
        }

        const provisionResult = await provisionDesktopSession();
        if ('error' in provisionResult) {
          await window.electronAPI?.clearAgent37Token?.();
          await window.electronAPI?.clearAgent37Provision?.();
          setUser(null);
          setStatus('unauthenticated');
        } else {
          const { provision } = provisionResult;
          setUser(provisionUserToAuthUser(provision.user));
          setStatus('authenticated');
          await applyProvisionGlobals(provision);
        }
        setReady(true);
        return;
      }

      // WebUI mode: use cookie-based session
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus('checking');

      const currentUser = await fetchCurrentUser(controller.signal);
      if (currentUser) {
        setUser(currentUser);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
      setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
    return () => {
      abortRef.current?.abort();
    };
  }, [refresh]);

  const login = useCallback(async ({ username, password, remember }: LoginParams): Promise<LoginResult> => {
    if (isDesktopRuntime) {
      const config = (await window.electronAPI?.getAgent37Config?.()) as DesktopAgent37Config | undefined;
      const serverUrl = resolveDesktopServerUrl(config?.url);

      if (!serverUrl) {
        return {
          success: false,
          message: 'Server not configured. Please contact your administrator.',
          code: 'serverError',
        };
      }

      try {
        // Persist the server URL before logging in — loginAgent37Desktop (main process) resolves
        // the base URL from stored config, not from an argument.
        await window.electronAPI?.setAgent37Url?.(serverUrl);
        // The UI field is still labeled "username", but the console only has email+password
        // accounts — whatever the user typed here is sent straight through as the email.
        const result = await window.electronAPI?.login?.({ email: username, password });

        if (!result?.success) {
          let code: LoginErrorCode = 'unknown';
          if (result?.status === 401) code = 'invalidCredentials';
          else if (result?.status === 429) code = 'tooManyAttempts';
          else if (result?.status && result.status >= 500) code = 'serverError';
          return { success: false, message: result?.error ?? 'Login failed', code };
        }

        const provisionResult = await provisionDesktopSession();
        if ('error' in provisionResult) {
          await window.electronAPI?.clearAgent37Token?.();
          await window.electronAPI?.clearAgent37Provision?.();
          setUser(null);
          setStatus('unauthenticated');
          setReady(true);
          return {
            success: false,
            message: provisionResult.error,
            code: 'serverError',
          };
        }

        const { provision } = provisionResult;
        setUser(provisionUserToAuthUser(provision.user));
        setStatus('authenticated');
        setReady(true);
        await applyProvisionGlobals(provision);

        return { success: true };
      } catch {
        return { success: false, message: 'Could not reach server. Check your connection.', code: 'networkError' };
      }
    }

    // WebUI mode: cookie-based login (unchanged)
    try {
      const csrfTokenValid = hasValidCsrfToken();
      if (!csrfTokenValid) {
        clearAuthCache();
      }

      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(withCsrfToken({ username, password, remember })),
      });

      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        user?: AuthUser;
      };

      if (!response.ok || !data.success || !data.user) {
        let code: LoginErrorCode = 'unknown';
        let message = data?.message ?? 'Login failed';
        let shouldClearCache = false;

        if (response.status === 401) {
          code = 'invalidCredentials';
        } else if (response.status === 403) {
          code = 'csrfError';
          message = 'Security token expired. Please try again.';
          shouldClearCache = true;
        } else if (response.status === 429) {
          code = 'tooManyAttempts';
        } else if (response.status >= 500) {
          code = 'serverError';
        } else if (!csrfTokenValid) {
          code = 'csrfError';
          message = 'Login failed due to cached data. Please clear your browser cache and try again.';
          shouldClearCache = true;
        }

        if (shouldClearCache) clearAuthCache();
        return { success: false, message, code, shouldClearCache };
      }

      setUser(data.user);
      setStatus('authenticated');
      setReady(true);

      if (typeof window !== 'undefined' && (window as any).__websocketReconnect) {
        (window as any).__websocketReconnect();
      }

      return { success: true };
    } catch (error) {
      console.error('Login request failed:', error);
      const errorMessage = (error as Error).message;
      if (errorMessage?.includes('parse') || errorMessage?.includes('csrf') || errorMessage?.includes('cookie')) {
        clearAuthCache();
        return {
          success: false,
          message: 'Login failed due to cached data. Please clear your browser cache and try again.',
          code: 'csrfError',
          shouldClearCache: true,
        };
      }
      return { success: false, message: 'Network error. Please try again.', code: 'networkError' };
    }
  }, []);

  const loginWithOAuthToken = useCallback(async (token: string): Promise<LoginResult> => {
    if (!isDesktopRuntime)
      return { success: false, message: 'OAuth login only available in desktop mode.', code: 'serverError' };
    const config = (await window.electronAPI?.getAgent37Config?.()) as DesktopAgent37Config | undefined;
    const serverUrl = resolveDesktopServerUrl(config?.url);
    if (!serverUrl) return { success: false, message: 'Server not configured.', code: 'serverError' };
    try {
      await window.electronAPI?.setAgent37Url?.(serverUrl);
      await window.electronAPI?.setAgent37Token?.(token);
      const provisionResult = await provisionDesktopSession();
      if ('error' in provisionResult) {
        await window.electronAPI?.clearAgent37Token?.();
        return { success: false, message: provisionResult.error, code: 'serverError' };
      }
      const { provision } = provisionResult;
      setUser(provisionUserToAuthUser(provision.user));
      setStatus('authenticated');
      setReady(true);
      await applyProvisionGlobals(provision);
      return { success: true };
    } catch {
      return { success: false, message: 'Could not reach server.', code: 'networkError' };
    }
  }, []);

  const register = useCallback(async ({ email, password }: RegisterParams): Promise<RegisterResult> => {
    if (!isDesktopRuntime) {
      return { success: false, message: 'Registration is only available in the desktop app.' };
    }
    const config = (await window.electronAPI?.getAgent37Config?.()) as DesktopAgent37Config | undefined;
    const serverUrl = resolveDesktopServerUrl(config?.url);
    if (!serverUrl) return { success: false, message: 'Server not configured. Please contact your administrator.' };
    await window.electronAPI?.setAgent37Url?.(serverUrl);
    const result = await window.electronAPI?.register?.({ email, password });
    if (!result?.success) {
      return { success: false, message: result?.error ?? 'Registration failed.' };
    }
    if (result.confirmationRequired) {
      return { success: true, message: 'Check your email to confirm your account, then sign in.' };
    }
    return { success: true, message: 'Account created.' };
  }, []);

  const logout = useCallback(async () => {
    if (isDesktopRuntime) {
      // No server round-trip: the desktop only ever holds a bearer access token (no refresh
      // token to revoke), so logoutAgent37Desktop just drops the local token/provision.
      await window.electronAPI?.logoutAgent37?.();
      setUser(null);
      setStatus('unauthenticated');
      clearAuthCache();
      return;
    }

    // WebUI mode
    try {
      await fetch('/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(withCsrfToken({})),
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    } finally {
      setUser(null);
      setStatus('unauthenticated');
      clearAuthCache();
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      status,
      login,
      loginWithOAuthToken,
      register,
      logout,
      refresh,
      clearAuthCache,
    }),
    [login, loginWithOAuthToken, register, logout, ready, refresh, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
