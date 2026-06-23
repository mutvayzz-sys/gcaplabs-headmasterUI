/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import workAlongSvg from '@/renderer/assets/icons/work-along.svg';

/**
 * Map custom avatar identifiers to their resolved image URLs.
 */
export const CUSTOM_AVATAR_IMAGE_MAP: Record<string, string> = {
  'work-along.svg': workAlongSvg,
  'cowork.svg': workAlongSvg,
  '\u{1F6E0}\u{FE0F}': workAlongSvg,
};
