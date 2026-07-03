// WebUI 状态接口 / WebUI status interface
export interface WebUIStatus {
  running: boolean;
  port: number;
  allowRemote: boolean;
  localUrl: string;
  networkUrl?: string;
  lanIP?: string;
  adminUsername: string;
  initialPassword?: string;
}

export interface ElectronBridgeAPI {
  emit: (name: string, data: unknown) => Promise<unknown> | void;
  on: (callback: (event: { value: string }) => void) => void;
  getPathForFile?: (file: File) => string;
  collectFeedbackLogs?: () => Promise<{ filename: string; data: number[] } | null>;
  captureFeedbackScreenshot?: () => Promise<{ filename: string; data: number[] } | null>;
  getConnectionMode?: () => Promise<'local' | 'remote'>;
  setConnectionMode?: (mode: 'local' | 'remote') => Promise<unknown>;
  getRemoteConnectionConfig?: () => Promise<{ host: string; port: number; token: string }>;
  setRemoteConnectionConfig?: (config: { host: string; port: number; token: string }) => Promise<unknown>;
  restartRuntime?: () => Promise<{ ok: boolean; port?: number; error?: string }>;
  checkHermesRuntime?: () => Promise<{ detected: boolean; path?: string; choice?: string; customPath?: string }>;
  // Agent37 Console BFF config.
  getAgent37Config?: () => Promise<{ url: string; token: string; provision?: unknown | null }>;
  getAgent37Provision?: () => Promise<unknown | null>;
  setAgent37Url?: (url: string) => Promise<{ success: boolean }>;
  setAgent37Token?: (token: string) => Promise<{ success: boolean }>;
  clearAgent37Token?: () => Promise<{ success: boolean }>;
  clearAgent37Provision?: () => Promise<{ success: boolean }>;
  provisionAgent37?: (request: {
    client: 'headmaster_desktop';
    version: string;
    platform: NodeJS.Platform;
  }) => Promise<{
    success: boolean;
    provision?: unknown;
    status?: number;
    error?: string;
  }>;
  validateAgent37Runtime?: (request: { runtime_id: string; requested_capability: string }) => Promise<{
    success: boolean;
    validation?: unknown;
    status?: number;
    error?: string;
  }>;

  saveCredentials?: (creds: { username: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  loadCredentials?: () => Promise<{ success: boolean; credentials: { username: string; password: string } | null }>;
  clearCredentials?: () => Promise<{ success: boolean }>;
  triggerOAuthLogin?: (provider: string) => Promise<{ success: boolean; token?: string; error?: string }>;
  onInstallProgress?: (callback: (progress: unknown) => void) => () => void;
}

export type ElectronAPI = ElectronBridgeAPI;

export type BackendStartupFailureReason =
  | 'backend_incompatible_runtime'
  | 'backend_incomplete_installation'
  | 'backend_package_architecture_mismatch'
  | 'backend_startup_failed';

export type BackendIncompleteInstallationKind = 'missing_backend_binary' | 'missing_directory_resources';

export interface BackendStartupFailureInfo {
  incompleteInstallationKind?: BackendIncompleteInstallationKind;
  missingBackendBinary?: boolean;
  missingBundledHermesDir?: boolean;
  missingHubDir?: boolean;
  missingPwaDir?: boolean;
  reason: BackendStartupFailureReason;
  backendBoundaryCode?: string;
  backendBoundaryStage?: string;
  runtime?: 'glibc';
  requiredVersions?: string[];
  missingResources?: string[];
  missingRuntimeDir?: boolean;
  packageArch?: string;
  deviceArch?: string;
  expectedDownloadArch?: string;
  isRosettaTranslated?: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI;
    __initialLanguage?: string | null;
    __backendStartupFailed?: boolean;
    __backendStartupFailure?: BackendStartupFailureInfo | null;
  }
}
