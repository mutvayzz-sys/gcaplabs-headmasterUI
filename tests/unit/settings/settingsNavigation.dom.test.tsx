import React from 'react';
import { describe, expect, it } from 'vitest';
import {
  SETTINGS_LEGACY_REDIRECTS,
  SETTINGS_PRIMARY_ROUTES,
} from '../../../packages/desktop/src/renderer/components/layout/Router';
import {
  BUILTIN_TAB_IDS,
  LEGACY_ANCHOR_REMAP,
} from '../../../packages/desktop/src/renderer/pages/settings/components/SettingsSider';
import { getBuiltinSettingsNavItems } from '../../../packages/desktop/src/renderer/pages/settings/components/SettingsPageWrapper';

const translate = (_key: string, options?: { defaultValue?: string }): string => options?.defaultValue ?? _key;

describe('settings navigation contract', () => {
  it('keeps Headmaster settings surfaces ordered and routes Channels to WebUI compatibility', () => {
    const toolStart = BUILTIN_TAB_IDS.indexOf('tools');

    expect(BUILTIN_TAB_IDS.slice(toolStart, toolStart + 3)).toEqual([
      'tools',
      'skills-hub',
      'integrations',
    ]);
    expect(SETTINGS_PRIMARY_ROUTES).toEqual({
      tools: '/settings/tools',
      skills: '/settings/skills-hub',
      integrations: '/settings/integrations',
      webui: '/settings/webui',
    });
  });

  it('uses clear English fallback labels for Headmaster settings surfaces', () => {
    const items = getBuiltinSettingsNavItems(true, translate);
    const labels = Object.fromEntries(items.map((item) => [item.id, item.label]));

    expect(labels).toMatchObject({
      tools: 'Tools',
      'skills-hub': 'Skills',
      integrations: 'Integrations',
    });
    expect(labels).not.toHaveProperty('channels');
  });

  it('redirects inherited routes and extension anchors to supported destinations', () => {
    expect(SETTINGS_LEGACY_REDIRECTS).toEqual({
      '/settings/capabilities': '/settings/tools',
      '/settings/skills': '/settings/skills-hub',
      '/settings/channels': '/settings/webui',
      '/settings/advanced': '/settings/tools',
    });
    expect(LEGACY_ANCHOR_REMAP).toMatchObject({
      tools: 'tools',
      'skills-hub': 'skills-hub',
      integrations: 'integrations',
      channels: 'webui',
    });
  });
});
