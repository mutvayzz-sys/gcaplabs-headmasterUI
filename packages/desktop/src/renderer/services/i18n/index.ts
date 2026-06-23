import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { configService } from '@/common/config/configService';
import { ipcBridge } from '@/common';
import i18nConfig from '@/common/config/i18n-config.json';
import {
  DEFAULT_LANGUAGE,
  normalizeLanguageCode,
  mergeWithFallback,
  ensureAndSwitch,
  type LocaleData,
  type SupportedLanguage,
} from '@/common/config/i18n';

import enUS from './locales/en-US/index';
export type { I18nKey, I18nModule } from './i18n-keys';

export { normalizeLanguageCode } from '@/common/config/i18n';
export type { SupportedLanguage } from '@/common/config/i18n';

export const supportedLanguages = i18nConfig.supportedLanguages;

const localeData: LocaleData = {
  'en-US': enUS,
};

const fallbackLocale = localeData[DEFAULT_LANGUAGE] ?? {};

const loadedTranslations = new Map<string, Record<string, unknown>>();
loadedTranslations.set(DEFAULT_LANGUAGE, fallbackLocale as Record<string, unknown>);

function getLocaleModules(locale: string): Record<string, unknown> {
  const normalized = normalizeLanguageCode(locale);
  const modules = localeData[normalized] ?? fallbackLocale;
  if (normalized === DEFAULT_LANGUAGE) return modules;
  return mergeWithFallback(fallbackLocale, modules);
}

function getInitialLanguage(): SupportedLanguage {
  return DEFAULT_LANGUAGE;
}

async function loadLocaleModules(locale: string): Promise<Record<string, unknown>> {
  const normalized = normalizeLanguageCode(locale);
  const cached = loadedTranslations.get(normalized);
  if (cached) return cached;

  const modules = getLocaleModules(normalized);
  loadedTranslations.set(normalized, modules);
  return modules;
}

const initialLanguage = getInitialLanguage();
const initialResources: Record<string, { translation: Record<string, unknown> }> = {
  [DEFAULT_LANGUAGE]: {
    translation: fallbackLocale,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources: initialResources,
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    debug: false,
    interpolation: { escapeValue: false },
  })
  .catch((error: Error) => {
    console.error('Failed to initialize i18n:', error);
  });

async function initLanguage(): Promise<void> {
  try {
    await configService.whenReady();
    const language = DEFAULT_LANGUAGE;
    await ensureAndSwitch(i18n, language, loadLocaleModules);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('i18nextLng', language);
    }
  } catch (error) {
    console.error('Failed to initialize language:', error);
  }
}

i18n.on('languageChanged', async (lang: string) => {
  const normalizedLang = normalizeLanguageCode(lang);
  if (i18n.hasResourceBundle(normalizedLang, 'translation')) return;

  try {
    const translation = await loadLocaleModules(normalizedLang);
    i18n.addResourceBundle(normalizedLang, 'translation', translation, true, true);
  } catch (error) {
    console.error(`Failed to load language ${normalizedLang}:`, error);
  }
});

void initLanguage();

ipcBridge.systemSettings.languageChanged.on(async ({ language }) => {
  const normalized = normalizeLanguageCode(language);
  if (i18n.language === normalized) return;
  await ensureAndSwitch(i18n, normalized, loadLocaleModules);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('i18nextLng', normalized);
  }
});

export async function changeLanguage(lang: string): Promise<void> {
  const normalized = normalizeLanguageCode(lang);
  await ensureAndSwitch(i18n, normalized, loadLocaleModules);
  await configService.set('language', normalized);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('i18nextLng', normalized);
  }
  ipcBridge.systemSettings.changeLanguage.invoke({ language: normalized }).catch(() => {});
}

export function clearTranslationCache(): void {
  loadedTranslations.clear();
}

export function getLoadedLanguages(): string[] {
  return Array.from(loadedTranslations.keys());
}

export default i18n;
