/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import WebuiModalContent from '@/renderer/components/settings/SettingsModal/contents/WebuiModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

/**
 * Legacy compatibility page.
 *
 * Channels / messaging platforms are not shipping. Keep this module as a
 * WebUI-only fallback for old imports and deep links while the router redirects
 * `/settings/channels` to `/settings/webui`.
 */
const ChannelsSettingsPage: React.FC<{ withWrapper?: boolean }> = ({ withWrapper = true }) => {
  const content = <WebuiModalContent webuiOnly />;

  if (!withWrapper) return content;

  return <SettingsPageWrapper contentClassName='max-w-1100px'>{content}</SettingsPageWrapper>;
};

export default ChannelsSettingsPage;