import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const localeRoot = path.join(root, 'packages/desktop/src/renderer/services/i18n/locales');
const rendererI18nPath = path.join(root, 'packages/desktop/src/renderer/services/i18n/index.ts');
const configPath = path.join(root, 'packages/desktop/src/common/config/i18n-config.json');

const read = (file: string): string => fs.readFileSync(file, 'utf8');

describe('packaged renderer i18n contract', () => {
  it('statically imports every supported locale so Vite includes it', () => {
    const config = JSON.parse(read(configPath)) as {
      supportedLanguages: Array<{ code: string } | string>;
    };
    const source = read(rendererI18nPath);
    const supported = config.supportedLanguages.map((language) =>
      typeof language === 'string' ? language : language.code
    );

    for (const locale of supported) {
      expect(source).toContain(`./locales/${locale}/index`);
      expect(fs.existsSync(path.join(localeRoot, locale, 'index.ts'))).toBe(true);
    }
  });

  it('keeps every locale index aligned with the English namespace bundle', () => {
    const englishIndex = read(path.join(localeRoot, 'en-US', 'index.ts'));
    const namespaces = [...englishIndex.matchAll(/import\s+\w+\s+from\s+'\.\/([^']+\.json)'/g)].map(
      (match) => match[1]
    );
    const localeDirectories = fs
      .readdirSync(localeRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(namespaces.length).toBeGreaterThan(0);
    for (const locale of localeDirectories) {
      const index = read(path.join(localeRoot, locale, 'index.ts'));
      for (const namespace of namespaces) {
        expect(index).toContain(`'./${namespace}'`);
        expect(fs.existsSync(path.join(localeRoot, locale, namespace))).toBe(true);
      }
    }
  });

  it('packages the New Chat terminology in the English conversation locale', () => {
    const conversation = JSON.parse(read(path.join(localeRoot, 'en-US', 'conversation.json'))) as {
      welcome?: { newConversation?: string };
      history?: { newConversationInProject?: string };
    };

    expect(conversation.welcome?.newConversation).toBe('New Chat');
    expect(conversation.history?.newConversationInProject).toBe('New Chat in this project');
  });
});
