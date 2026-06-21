/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAioncoreBaseUrl, isAioncoreAvailable } from '@/common/adapter/aioncoreBridge';
import { getBaseUrl } from '@/common/adapter/httpBridge';
import cerebrasLogo from '@/renderer/assets/logos/ai-major/cerebras.svg';
import claudeLogo from '@/renderer/assets/logos/ai-major/claude.svg';
import codexLogo from '@/renderer/assets/logos/tools/coding/codex.svg';
import deepseekLogo from '@/renderer/assets/logos/ai-major/deepseek.svg';
import geminiLogo from '@/renderer/assets/logos/ai-major/gemini.svg';
import grokLogo from '@/renderer/assets/logos/ai-major/grok.svg';
import groqLogo from '@/renderer/assets/logos/ai-major/groq.svg';
import headmasterLogo from '@/renderer/assets/logos/brand/headmaster.png';
import mistralLogo from '@/renderer/assets/logos/ai-major/mistral.svg';
import openrouterLogo from '@/renderer/assets/logos/ai-major/openrouter.svg';
import perplexityLogo from '@/renderer/assets/logos/ai-major/perplexity.svg';
import { resolveBackendAssetUrl } from '@/renderer/utils/platform';

const LOCAL_LOGO_ASSETS: Record<string, string> = {
  'ai-major/anthropic.svg': claudeLogo,
  'ai-major/claude.svg': claudeLogo,
  'ai-major/gemini.svg': geminiLogo,
  'ai-major/openai.svg': codexLogo,
  'ai-major/deepseek.svg': deepseekLogo,
  'ai-major/mistral.svg': mistralLogo,
  'ai-major/openrouter.svg': openrouterLogo,
  'ai-major/perplexity.svg': perplexityLogo,
  'ai-major/cerebras.svg': cerebrasLogo,
  'ai-major/groq.svg': groqLogo,
  'ai-major/grok.svg': grokLogo,
  'tools/coding/codex.svg': codexLogo,
  'brand/headmaster.png': headmasterLogo,
  'brand/aion.svg': headmasterLogo,
  'brand/hermes.svg': headmasterLogo,
  'brand/app.png': headmasterLogo,
};

function localLogoForApiPath(path: string): string | undefined {
  const normalized = path.replace(/^\/+/, '');
  const logosPrefix = 'api/assets/logos/';
  const relative = normalized.startsWith(logosPrefix) ? normalized.slice(logosPrefix.length) : normalized;
  return LOCAL_LOGO_ASSETS[relative];
}

/**
 * Resolve agent icon URLs emitted by AionCore (`/api/assets/logos/...`).
 * Those assets live on the AionCore sidecar — not the Hermes dashboard port.
 */
export function resolveAgentAssetUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  const bundled = localLogoForApiPath(trimmed);
  if (bundled) return bundled;

  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(trimmed) || /^data:/i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/api/assets/')) {
    const base = isAioncoreAvailable() ? getAioncoreBaseUrl() : getBaseUrl();
    return `${base}${trimmed}`;
  }

  if (trimmed.startsWith('/')) {
    return resolveBackendAssetUrl(trimmed) ?? trimmed;
  }

  return trimmed;
}
