/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import i18n from 'i18next';
import { ProcessConfig } from '@process/utils/initStorage';
import {
  DEFAULT_LANGUAGE,
  normalizeLanguageCode,
  mergeWithFallback,
  ensureAndSwitch,
  type LocaleData,
} from '@/common/config/i18n';

import enUS from '@renderer/services/i18n/locales/en-US/index';

const localeData: LocaleData = {
  'en-US': enUS,
};

const fallbackData = localeData[DEFAULT_LANGUAGE] ?? {};

function getLocaleModules(locale: string): Record<string, unknown> {
  const normalized = normalizeLanguageCode(locale);
  const data = localeData[normalized];
  if (!data) return fallbackData;
  if (normalized === DEFAULT_LANGUAGE) return data;
  return mergeWithFallback(fallbackData, data);
}

export const i18nReady = (async (): Promise<void> => {
  await i18n.init({
    resources: {
      [DEFAULT_LANGUAGE]: { translation: getLocaleModules(DEFAULT_LANGUAGE) },
    },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    debug: false,
    interpolation: { escapeValue: false },
  });

  const language = await ProcessConfig.get('language');
  if (language) {
    await ensureAndSwitch(i18n, normalizeLanguageCode(language), getLocaleModules);
  } else {
    await ensureAndSwitch(i18n, DEFAULT_LANGUAGE, getLocaleModules);
  }
})().catch((error) => {
  console.error('[Main Process] Failed to initialize i18n:', error);
});

export async function setInitialLanguage(language: string | undefined): Promise<void> {
  await i18nReady;
  await ensureAndSwitch(i18n, normalizeLanguageCode(language || DEFAULT_LANGUAGE), getLocaleModules);
}

export async function changeLanguage(language: string): Promise<void> {
  await i18nReady;
  await ensureAndSwitch(i18n, normalizeLanguageCode(language), getLocaleModules);
}

export { normalizeLanguageCode };
export default i18n;
