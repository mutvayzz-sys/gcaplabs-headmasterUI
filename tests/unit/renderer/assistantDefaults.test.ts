import { describe, expect, it } from 'vitest';
import { resolveGuidAssistantDefaults } from '@/renderer/pages/guid/utils/assistantDefaults';
import type { AssistantDetail } from '@/common/types/agent/assistantTypes';

describe('resolveGuidAssistantDefaults', () => {
  it('returns safe defaults for incomplete profile metadata', () => {
    const incomplete = {
      id: 'recruiter',
      profile: { name: 'recruiter' },
    } as unknown as AssistantDetail;

    expect(resolveGuidAssistantDefaults(incomplete)).toEqual({
      modelId: undefined,
      permissionMode: undefined,
      skillIds: [],
      disabledBuiltinSkillIds: [],
      mcpIds: [],
    });
  });
});
