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

interface DesktopHermeshqUser {
  id: string;
  username: string;
  role: string;
}

interface DesktopHermeshqProvision {
  mode: string;
  user: DesktopHermeshqUser;
  capabilities: string[];
  runtime: {
    validate_url: string;
    ttl_seconds: number;
  };
}

interface DesktopHermeshqConfig {
  url: string;
  token: string;
  provision?: DesktopHermeshqProvision | null;
}

interface AuthContextValue {
  ready: boolean;
  user: AuthUser | null;
  status: AuthStatus;
  login: (params: LoginParams) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  clearAuthCache: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_USER_ENDPOINT = '/api/auth/user';

const isDesktopRuntime = typeof window !== 'undefined' && Boolean(window.electronAPI);

// Build-time server URL — set VITE_HERMESHQ_URL in .env before building
const HERMESHQ_URL = (
  ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_HERMESHQ_URL as
    | string
    | undefined) ?? ''
).replace(/\/$/, '');

async function refreshHermeshqToken(serverUrl: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(`${serverUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token: string };
    return data.access_token || null;
  } catch {
    return null;
  }
}

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
  return (configUrl || HERMESHQ_URL).trim().replace(/\/$/, '');
}

async function provisionDesktopSession(): Promise<DesktopHermeshqProvision | null> {
  const result = await window.electronAPI?.provisionHermeshq?.({
    client: 'headmaster_desktop',
    version: __APP_VERSION__,
    platform: process.platform as NodeJS.Platform,
  });

  if (!result?.success || !result.provision) {
    return null;
  }

  return result.provision as DesktopHermeshqProvision;
}

function provisionUserToAuthUser(user: DesktopHermeshqUser): AuthUser {
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
      // Desktop mode: validate stored HermesHQ JWT against the baked-in server URL
      const config = (await window.electronAPI?.getHermeshqConfig?.()) as DesktopHermeshqConfig | undefined;
      const serverUrl = resolveDesktopServerUrl(config?.url);
      const token = config?.token ?? '';

      if (!serverUrl || !token) {
        setUser(null);
        setStatus('unauthenticated');
        setReady(true);
        return;
      }

      // Try to refresh the token first so sessions stay alive silently
      const freshToken = await refreshHermeshqToken(serverUrl, token);
      if (freshToken) {
        await window.electronAPI?.setHermeshqToken?.(freshToken);
      }

      if (!config?.url && serverUrl) {
        await window.electronAPI?.setHermeshqUrl?.(serverUrl);
      }

      const provision = await provisionDesktopSession();
      if (!provision) {
        await window.electronAPI?.clearHermeshqToken?.();
        await window.electronAPI?.clearHermeshqProvision?.();
        setUser(null);
        setStatus('unauthenticated');
      } else {
        setUser(provisionUserToAuthUser(provision.user));
        setStatus('authenticated');
        // Phase 3: Set cloud container endpoint for remote mode
        if (typeof window !== 'undefined' && (provision as any).cloud_container_config?.endpoint_url) {
          window.__cloudContainerEndpoint = (provision as any).cloud_container_config.endpoint_url;
        }
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
      const config = (await window.electronAPI?.getHermeshqConfig?.()) as DesktopHermeshqConfig | undefined;
      const serverUrl = resolveDesktopServerUrl(config?.url);

      if (!serverUrl) {
        return { success: false, message: 'Server not configured. Please contact your administrator.', code: 'serverError' };
      }

      try {
        const response = await fetch(`${serverUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });

        const data = (await response.json()) as {
          access_token?: string;
          mfa_required?: boolean;
          detail?: string;
        };

        if (!response.ok) {
          let code: LoginErrorCode = 'unknown';
          const message = data?.detail ?? 'Login failed';
          if (response.status === 401) code = 'invalidCredentials';
          else if (response.status === 429) code = 'tooManyAttempts';
          else if (response.status >= 500) code = 'serverError';
          return { success: false, message, code };
        }

        if (data.mfa_required) {
          return {
            success: false,
            message: 'MFA is required. Please contact your administrator.',
            code: 'serverError',
          };
        }

        if (!data.access_token) {
          return { success: false, message: 'Unexpected server response.', code: 'serverError' };
        }

        await window.electronAPI?.setHermeshqUrl?.(serverUrl);
        await window.electronAPI?.setHermeshqToken?.(data.access_token);

        const provision = await provisionDesktopSession();
        if (!provision) {
          await window.electronAPI?.clearHermeshqToken?.();
          await window.electronAPI?.clearHermeshqProvision?.();
          setUser(null);
          setStatus('unauthenticated');
          setReady(true);
          return {
            success: false,
            message: 'Provisioning was rejected by HermesHQ.',
            code: 'serverError',
          };
        }

        setUser(provisionUserToAuthUser(provision.user));
        setStatus('authenticated');
        setReady(true);

        // Phase 3: Set cloud container endpoint for remote mode
        if (typeof window !== 'undefined' && provision.cloud_container_config?.endpoint_url) {
          window.__cloudContainerEndpoint = provision.cloud_container_config.endpoint_url;
        }

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

  const logout = useCallback(async () => {
    if (isDesktopRuntime) {
      const config = await window.electronAPI?.getHermeshqConfig?.();
      if (config?.url && config?.token) {
        try {
          await fetch(`${config.url}/api/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${config.token}` },
          });
        } catch {
          // ignore network errors on logout
        }
      }
      await window.electronAPI?.clearHermeshqToken?.();
      await window.electronAPI?.clearHermeshqProvision?.();
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
      logout,
      refresh,
      clearAuthCache,
    }),
    [login, logout, ready, refresh, status, user]
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
