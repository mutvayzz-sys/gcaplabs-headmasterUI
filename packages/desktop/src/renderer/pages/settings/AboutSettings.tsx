/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import AboutModalContent from '@/renderer/components/settings/SettingsModal/contents/AboutModalContent';

const AboutSettings: React.FC = () => (
  <SettingsPageWrapper contentClassName='max-w-640px'>
    <AboutModalContent />
  </SettingsPageWrapper>
);

export default AboutSettings;
