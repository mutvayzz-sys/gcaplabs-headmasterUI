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
  getHermeshqConfig?: () => Promise<{ url: string; token: string }>;
  setHermeshqUrl?: (url: string) => Promise<{ success: boolean }>;
  setHermeshqToken?: (token: string) => Promise<{ success: boolean }>;
  clearHermeshqToken?: () => Promise<{ success: boolean }>;
}

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
