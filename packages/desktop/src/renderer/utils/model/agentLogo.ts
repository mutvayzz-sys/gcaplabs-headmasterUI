/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 *
 * 统一的 Agent Logo 映射工具
 * Unified Agent Logo mapping utility
 *
 * 所有需要显示 agent 图标的地方都应该使用这个工具，而不是各自维护列表
 * All places that need to display agent icons should use this utility instead of maintaining separate lists
 */

import { resolveAgentAssetUrl } from './resolveAgentAssetUrl';
import claudeLogo from '@/renderer/assets/logos/ai-major/claude.svg';
import codexLogo from '@/renderer/assets/logos/tools/coding/codex.svg';
import geminiLogo from '@/renderer/assets/logos/ai-major/gemini.svg';
import grokLogo from '@/renderer/assets/logos/ai-major/grok.svg';
import headmasterLogo from '@/renderer/assets/logos/brand/headmaster.png';

/**
 * Agent Logo 映射表
 * Agent Logo mapping table
 *
 * 注意：key 使用小写，支持多种变体（如 openclaw-gateway 和 openclaw）
 * Note: keys are lowercase, supports multiple variants (e.g., openclaw-gateway and openclaw)
 */
const AGENT_LOGO_PATH_MAP = {
  claude: claudeLogo,
  gemini: geminiLogo,
  codex: codexLogo,
  grok: grokLogo,
  'claude-code': claudeLogo,
  'gemini-cli': geminiLogo,
  'openai-codex': codexLogo,
  aionrs: headmasterLogo,
  hermes: headmasterLogo,
  headmaster: headmasterLogo,
} as const satisfies Record<string, string>;

const OPEN_CODE_LIGHT_FILE_NAME = 'opencode-light.svg';
const OPEN_CODE_DARK_FILE_NAME = 'opencode-dark.svg';

function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false;
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

function applyThemeVariant(logo: string): string {
  if (!isDarkTheme()) return logo;
  if (!logo.endsWith(OPEN_CODE_LIGHT_FILE_NAME)) return logo;
  return logo.replace(new RegExp(`${OPEN_CODE_LIGHT_FILE_NAME}$`), OPEN_CODE_DARK_FILE_NAME);
}

function normalizeLogoUrl(logo: string): string {
  const resolved = resolveAgentAssetUrl(logo) ?? logo;
  return applyThemeVariant(resolved);
}

/**
 * 根据 agent 名称获取对应的 logo
 * Get agent logo by agent name
 */
export function getAgentLogo(agent: string | undefined | null): string | null {
  if (!agent || typeof agent !== 'string') return null;
  const key = agent.toLowerCase() as keyof typeof AGENT_LOGO_PATH_MAP;
  const path = AGENT_LOGO_PATH_MAP[key];
  return path ? applyThemeVariant(path) : null;
}

/**
 * Resolve the best available logo for an agent.
 */
export function resolveAgentLogo(opts: {
  icon?: string | null;
  backend?: string | null;
  custom_agent_id?: string | null;
  isExtension?: boolean;
}): string | null {
  const fromIcon = opts.icon ? normalizeLogoUrl(opts.icon) : null;
  if (fromIcon && !fromIcon.includes('/api/assets/')) {
    return fromIcon;
  }

  if (opts.isExtension && opts.custom_agent_id) {
    const adapterId = opts.custom_agent_id.split(':').pop();
    const logo = getAgentLogo(adapterId);
    if (logo) return logo;
  }

  const fromBackend = getAgentLogo(opts.backend);
  if (fromBackend) return fromBackend;

  return fromIcon;
}

export function hasAgentLogo(agent: string | undefined | null): boolean {
  return getAgentLogo(agent) !== null;
}

export const isDefaultModel = (value?: string | null, label?: string | null): boolean => {
  const text = `${value || ''} ${label || ''}`.toLowerCase();
  return text.includes('default') || text.includes('recommended') || text.includes('默认');
};

export const getModelDisplayLabel = ({
  selected_value: _selected_value,
  selectedLabel,
  defaultModelLabel: _defaultModelLabel,
  fallbackLabel,
}: {
  selected_value?: string | null;
  selectedLabel?: string | null;
  defaultModelLabel: string;
  fallbackLabel: string;
}): string => {
  if (!selectedLabel) return fallbackLabel;
  return selectedLabel;
};
