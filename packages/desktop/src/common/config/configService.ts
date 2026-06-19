import type { ConfigKey, ConfigKeyMap } from './configKeys';
import { ConfigStorage } from './storage';

type Subscriber = (value: unknown) => void;

const CONFIG_KEYS: ConfigKey[] = [
  'google.config',
  'codex.config',
  'acp.config',
  'acp.promptTimeout',
  'acp.agentIdleTimeout',
  'acp.cachedInitializeResult',
  'acp.cached_config_options',
  'acp.cachedModes',
  'mcp.config',
  'language',
  'theme',
  'colorScheme',
  'ui.zoomFactor',
  'ui.fontSize.chat',
  'ui.fontSize.markdown',
  'ui.fontSize.code',
  'window.bounds',
  'webui.desktop.enabled',
  'webui.desktop.allowRemote',
  'webui.desktop.port',
  'customCss',
  'css.themes',
  'css.activeThemeId',
  'theme.activeId',
  'theme.userThemes',
  'aionrs.config',
  'aionrs.defaultModel',
  'tools.imageGenerationModel',
  'tools.speechToText',
  'workspace.pasteConfirm',
  'upload.saveToWorkspace',
  'guid.lastSelectedAgent',
  'system.closeToTray',
  'system.notificationEnabled',
  'system.cronNotificationEnabled',
  'system.keepAwake',
  'system.autoPreviewOfficeFiles',
  'assistant.telegram.defaultModel',
  'assistant.telegram.agent',
  'assistant.lark.defaultModel',
  'assistant.lark.agent',
  'assistant.dingtalk.defaultModel',
  'assistant.dingtalk.agent',
  'assistant.weixin.defaultModel',
  'assistant.weixin.agent',
  'assistant.wecom.defaultModel',
  'assistant.wecom.agent',
  'skillsMarket.enabled',
  'migration.providersMigrated_v1',
  'migration.assistantsMigrated_v1',
  'memory.openconchoUrl',
  'memory.honchoUrl',
];

const LocalConfigStorage = ConfigStorage as unknown as {
  get<K extends ConfigKey>(key: K): Promise<ConfigKeyMap[K] | undefined>;
  set<K extends ConfigKey>(key: K, value: ConfigKeyMap[K]): Promise<unknown>;
  remove(key: ConfigKey): Promise<void>;
};

class ConfigServiceImpl {
  private cache = new Map<string, unknown>();
  private subscribers = new Map<string, Set<Subscriber>>();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // Idempotent: concurrent callers share the same in-flight promise, and a
  // resolved init returns immediately. Modules that need persisted settings on
  // module load (theme/colorScheme/language) await whenReady() before reading.
  initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.cache.clear();
      const values = await Promise.all(
        CONFIG_KEYS.map(async (key) => [key, await LocalConfigStorage.get(key)] as const)
      );
      for (const [key, value] of values) {
        if (value !== undefined) {
          this.cache.set(key, value);
        }
      }
      // One-time theme migration: only when new keys are absent (idempotent).
      if (!this.cache.has('theme.activeId')) {
        const { migrateThemeConfig } = await import('@/common/theme/migrateThemeConfig');
        const migrated = migrateThemeConfig({
          theme: this.cache.get('theme') as string | undefined,
          'css.activeThemeId': this.cache.get('css.activeThemeId') as string | undefined,
          'css.themes': this.cache.get('css.themes') as never,
          customCss: this.cache.get('customCss') as string | undefined,
        });
        this.cache.set('theme.activeId', migrated['theme.activeId']);
        this.cache.set('theme.userThemes', migrated['theme.userThemes']);
        // Persist asynchronously; ignore failure (will re-run next launch).
        void Promise.all(
          Object.entries(migrated).map(([key, value]) =>
            LocalConfigStorage.set(key as ConfigKey, value as ConfigKeyMap[ConfigKey])
          )
        ).catch(() => {});
      }
      this.initialized = true;
    })();
    this.initPromise.catch(() => {
      // Allow a future caller to retry after a transient failure
      this.initPromise = null;
    });
    return this.initPromise;
  }

  whenReady(): Promise<void> {
    return this.initialize();
  }

  get<K extends ConfigKey>(key: K): ConfigKeyMap[K] | undefined {
    return this.cache.get(key) as ConfigKeyMap[K] | undefined;
  }

  async set<K extends ConfigKey>(key: K, value: ConfigKeyMap[K]): Promise<void> {
    this.cache.set(key, value);
    this.notify(key, value);
    await LocalConfigStorage.set(key, value);
  }

  setLocal<K extends ConfigKey>(key: K, value: ConfigKeyMap[K]): void {
    this.cache.set(key, value);
    this.notify(key, value);
  }

  async remove(key: ConfigKey): Promise<void> {
    this.cache.delete(key);
    this.notify(key, undefined);
    await LocalConfigStorage.remove(key);
  }

  async setBatch(entries: Partial<{ [K in ConfigKey]: ConfigKeyMap[K] }>): Promise<void> {
    for (const [key, value] of Object.entries(entries)) {
      this.cache.set(key, value);
      this.notify(key as ConfigKey, value);
    }
    await Promise.all(
      Object.entries(entries).map(([key, value]) =>
        LocalConfigStorage.set(key as ConfigKey, value as ConfigKeyMap[ConfigKey])
      )
    );
  }

  subscribe(key: ConfigKey, callback: Subscriber): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  reset(): void {
    this.cache.clear();
    this.subscribers.clear();
    this.initialized = false;
    this.initPromise = null;
  }

  private notify(key: ConfigKey, value: unknown): void {
    const subs = this.subscribers.get(key);
    if (subs) {
      for (const cb of subs) {
        cb(value);
      }
    }
  }
}

export const configService = new ConfigServiceImpl();
