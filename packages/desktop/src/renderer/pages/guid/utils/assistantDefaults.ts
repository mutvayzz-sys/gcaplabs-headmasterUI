import type { AssistantDetail } from '@/common/types/agent/assistantTypes';

export type ResolvedGuidAssistantDefaults = {
  modelId?: string;
  permissionMode?: string;
  skillIds: string[];
  disabledBuiltinSkillIds: string[];
  mcpIds: string[];
};

export const resolveGuidAssistantDefaults = (
  detail: AssistantDetail | null | undefined
): ResolvedGuidAssistantDefaults => {
  if (!detail) {
    return {
      modelId: undefined,
      permissionMode: undefined,
      skillIds: [],
      disabledBuiltinSkillIds: [],
      mcpIds: [],
    };
  }

  const defaults = detail.defaults;
  const preferences = detail.preferences;
  const capabilities = detail.capabilities;
  if (!defaults || !preferences || !capabilities) {
    return {
      modelId: undefined,
      permissionMode: undefined,
      skillIds: [],
      disabledBuiltinSkillIds: [],
      mcpIds: [],
    };
  }

  const modelId =
    defaults.model?.mode === 'fixed'
      ? defaults.model.value
      : defaults.model?.mode === 'auto'
        ? preferences.last_model_id
        : undefined;

  const permissionMode =
    defaults.permission?.mode === 'fixed'
      ? defaults.permission.value
      : defaults.permission?.mode === 'auto'
        ? preferences.last_permission_value
        : undefined;

  const skillIds =
    defaults.skills?.mode === 'fixed'
      ? (defaults.skills.value ?? [])
      : defaults.skills?.mode === 'auto'
        ? (preferences.last_skill_ids ?? [])
        : [];

  const disabledBuiltinSkillIds =
    defaults.skills?.mode === 'fixed'
      ? (capabilities.default_disabled_builtin_skill_ids ?? [])
      : defaults.skills?.mode === 'auto'
        ? (preferences.last_disabled_builtin_skill_ids ?? [])
        : [];

  const mcpIds =
    defaults.mcps?.mode === 'fixed'
      ? (defaults.mcps.value ?? [])
      : defaults.mcps?.mode === 'auto'
        ? (preferences.last_mcp_ids ?? [])
        : [];

  return {
    modelId: modelId || undefined,
    permissionMode: permissionMode || undefined,
    skillIds,
    disabledBuiltinSkillIds,
    mcpIds,
  };
};
