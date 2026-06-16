/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import MemoryModalContent from '@/renderer/components/settings/SettingsModal/contents/MemoryModalContent';
import SettingsPageWrapper from './components/SettingsPageWrapper';

const MemorySettings: React.FC = () => {
  return (
    <SettingsPageWrapper>
      <MemoryModalContent />
    </SettingsPageWrapper>
  );
};

export default MemorySettings;
