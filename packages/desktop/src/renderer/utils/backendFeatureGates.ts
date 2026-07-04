export type BackendGatedFeatureId =
  | 'channels'
  | 'webui_remote_access'
  | 'extensions_install_permissions'
  | 'terminal_pty'
  | 'git_worktree_review'
  | 'share_timeline'
  | 'office_conversion';

export interface BackendFeatureGate {
  id: BackendGatedFeatureId;
  active: boolean;
  label: string;
  reason: string;
  contractPath: string;
}

export const BACKEND_GATED_FEATURES: Record<BackendGatedFeatureId, BackendFeatureGate> = {
  channels: {
    id: 'channels',
    active: false,
    label: 'Channels',
    reason: 'Channel credential and session APIs are not contracted yet.',
    contractPath: 'docs/backend-contracts.md#channels-telegram-lark-dingtalk-wechat-wecom',
  },
  webui_remote_access: {
    id: 'webui_remote_access',
    active: false,
    label: 'WebUI remote access',
    reason: 'Remote access, QR pairing, and password access need short-lived token and audit-log contracts first.',
    contractPath: 'docs/backend-contracts.md#webui-remote-access-qr-access-password-access',
  },
  extensions_install_permissions: {
    id: 'extensions_install_permissions',
    active: false,
    label: 'Extension install and permissions',
    reason: 'Signed catalog, sandbox, and permission enforcement APIs are not contracted yet.',
    contractPath: 'docs/backend-contracts.md#extension-install-and-permissions',
  },
  terminal_pty: {
    id: 'terminal_pty',
    active: false,
    label: 'Terminal / PTY',
    reason: 'Scoped PTY session, input, output, and kill APIs are not contracted yet.',
    contractPath: 'docs/backend-contracts.md#terminal--pty',
  },
  git_worktree_review: {
    id: 'git_worktree_review',
    active: false,
    label: 'Git / worktree / review tools',
    reason: 'Workspace-scoped status, diff, worktree, and review APIs are not contracted yet.',
    contractPath: 'docs/backend-contracts.md#git--worktree--review-tools',
  },
  share_timeline: {
    id: 'share_timeline',
    active: false,
    label: 'Share / timeline',
    reason: 'Private expiring share and normalized timeline APIs are not contracted yet.',
    contractPath: 'docs/backend-contracts.md#share--timeline',
  },
  office_conversion: {
    id: 'office_conversion',
    active: false,
    label: 'Office conversion',
    reason: 'Sandboxed document conversion and artifact APIs are not contracted yet.',
    contractPath: 'docs/backend-contracts.md#office-conversion',
  },
};

export const isBackendFeatureActive = (id: BackendGatedFeatureId): boolean => BACKEND_GATED_FEATURES[id].active;
