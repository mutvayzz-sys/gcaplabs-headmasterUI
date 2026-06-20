/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ToolsModalContent from '@/renderer/components/settings/SettingsModal/contents/ToolsModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const ToolsSettingsPage: React.FC = () => (
  <SettingsPageWrapper contentClassName='max-w-1100px'>
    <ToolsModalContent />
  </SettingsPageWrapper>
);

export default ToolsSettingsPage;
