import { describe, expect, it } from 'vitest';
import { ABOUT_LINKS } from '@/renderer/components/settings/SettingsModal/contents/AboutModalContent';

describe('About links', () => {
  it('uses the published Headmaster documentation and changelog routes', () => {
    expect(ABOUT_LINKS).toEqual({
      documentation: 'https://gcaplabs.com/docs/headmaster',
      changelog: 'https://gcaplabs.com/changelog',
      website: 'https://gcaplabs.com',
    });
  });
});
