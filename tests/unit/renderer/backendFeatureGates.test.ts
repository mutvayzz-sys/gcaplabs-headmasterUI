import { describe, expect, it } from 'vitest';
import { BACKEND_GATED_FEATURES, isBackendFeatureActive } from '@/renderer/utils/backendFeatureGates';

describe('backend feature gates', () => {
  it('keeps backend-gated features inactive until contracts are implemented', () => {
    expect(isBackendFeatureActive('channels')).toBe(false);
    expect(isBackendFeatureActive('webui_remote_access')).toBe(false);
    expect(isBackendFeatureActive('extensions_install_permissions')).toBe(false);
    expect(isBackendFeatureActive('terminal_pty')).toBe(false);
    expect(isBackendFeatureActive('git_worktree_review')).toBe(false);
    expect(isBackendFeatureActive('share_timeline')).toBe(false);
    expect(isBackendFeatureActive('office_conversion')).toBe(false);
  });

  it('points each gated feature to the backend contract document', () => {
    Object.values(BACKEND_GATED_FEATURES).forEach((feature) => {
      expect(feature.contractPath).toContain('docs/backend-contracts.md#');
      expect(feature.reason.length).toBeGreaterThan(12);
    });
  });
});
