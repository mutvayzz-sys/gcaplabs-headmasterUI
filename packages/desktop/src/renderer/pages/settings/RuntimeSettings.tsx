/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Avatar, Badge, Card, Empty, List, Skeleton, Space, Tag, Tooltip, Typography } from '@arco-design/web-react';
import { Check, Close, Link, Loading, Refresh, Thunderbolt } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import { getBackendBase, getBackendAuthHeaders } from '@/common/adapter/backendUrl';
import { runtimeApi as runtimeBridge, type IRuntimeStatus, type IRuntimeStatusEntry } from '@/common/adapter/ipcBridge';
import { isElectronDesktop } from '@/renderer/utils/platform';

const { Text, Title } = Typography;

/**
 * Each row in the comparison view.
 * - `kept` items are Headmaster settings the user already has and we keep as-is.
 * - `porting` items are Runtime surfaces we are folding in, with live status pulled
 *   from the running Runtime.
 */
type Readiness = 'ready' | 'partial' | 'unavailable' | 'unknown';

type PortRow = {
  id: string;
  title: string;
  subtitle: string;
  endpoint: string; // Hermes route we probe to confirm availability
  readiness: Readiness;
  detail?: string;
};

type KeepRow = {
  id: string;
  title: string;
  subtitle: string;
  /** Where the user finds this today in the existing settings UI */
  path: string;
  /** Optional secondary action for the row, e.g. "Open in web UI" */
  openInWebHref?: string;
};

const buildDefaultPorting = (t: Translator): PortRow[] => [
  {
    id: 'runtime.status',
    title: t('settings.runtime.row.runtimeStatusTitle', { defaultValue: 'Runtime status' }),
    subtitle: t('settings.runtime.row.runtimeStatusSubtitle', {
      defaultValue: 'Runtime health and version surfaced in the app shell.',
    }),
    endpoint: '/api/status',
    readiness: 'unknown',
  },
  {
    id: 'runtime.sessions',
    title: t('settings.runtime.row.sessionsTitle', { defaultValue: 'Session history' }),
    subtitle: t('settings.runtime.row.sessionsSubtitle', {
      defaultValue: 'Live conversation log from the Runtime store.',
    }),
    endpoint: '/api/sessions',
    readiness: 'unknown',
  },
  {
    id: 'runtime.models',
    title: t('settings.runtime.row.modelsTitle', { defaultValue: 'Model catalog' }),
    subtitle: t('settings.runtime.row.modelsSubtitle', {
      defaultValue: 'Configured providers, fallback chains, and recommended defaults.',
    }),
    endpoint: '/api/model/options',
    readiness: 'unknown',
  },
  {
    id: 'runtime.skills',
    title: t('settings.runtime.row.skillsTitle', { defaultValue: 'Skills' }),
    subtitle: t('settings.runtime.row.skillsSubtitle', {
      defaultValue: 'Runtime skills available across all profiles.',
    }),
    endpoint: '/api/skills',
    readiness: 'unknown',
  },
  {
    id: 'runtime.mcp',
    title: t('settings.runtime.row.mcpTitle', { defaultValue: 'MCP servers' }),
    subtitle: t('settings.runtime.row.mcpSubtitle', {
      defaultValue: 'Live MCP catalog from the running runtime.',
    }),
    endpoint: '/api/mcp/servers',
    readiness: 'unknown',
  },
  {
    id: 'runtime.cron',
    title: t('settings.runtime.row.cronTitle', { defaultValue: 'Scheduled jobs' }),
    subtitle: t('settings.runtime.row.cronSubtitle', {
      defaultValue: 'Cron jobs owned by the active profile, with last-run status.',
    }),
    endpoint: '/api/cron/jobs',
    readiness: 'unknown',
  },
  {
    id: 'runtime.providers',
    title: t('settings.runtime.row.providersTitle', { defaultValue: 'Connected providers' }),
    subtitle: t('settings.runtime.row.providersSubtitle', {
      defaultValue: 'OAuth-linked model providers, ready for in-app sign-in flows.',
    }),
    endpoint: '/api/providers/oauth',
    readiness: 'unknown',
  },
  {
    id: 'runtime.platforms',
    title: t('settings.runtime.row.platformsTitle', { defaultValue: 'Messaging platforms' }),
    subtitle: t('settings.runtime.row.platformsSubtitle', {
      defaultValue: 'Telegram, Discord, Signal and other platform integrations.',
    }),
    endpoint: '/api/messaging/platforms',
    readiness: 'unknown',
  },
];

const buildDefaultKept = (t: Translator): KeepRow[] => [
  {
    id: 'keep.agents',
    title: t('settings.runtime.keep.agentsTitle', { defaultValue: 'Agent defaults' }),
    subtitle: t('settings.runtime.keep.agentsSubtitle', {
      defaultValue: 'Default backend, mode, model, and tool policy for new sessions.',
    }),
    path: '/settings/agent',
  },
  {
    id: 'keep.providers',
    title: t('settings.runtime.keep.providersTitle', { defaultValue: 'Model providers' }),
    subtitle: t('settings.runtime.keep.providersSubtitle', {
      defaultValue: 'API keys, custom base URLs, and probe results for each model provider.',
    }),
    path: '/settings/model',
  },
  {
    id: 'keep.skills',
    title: t('settings.runtime.keep.skillsTitle', { defaultValue: 'Capabilities' }),
    subtitle: t('settings.runtime.keep.skillsSubtitle', {
      defaultValue: 'Skill hub and tool registry used by the desktop client.',
    }),
    path: '/settings/capabilities',
  },
  {
    id: 'keep.appearance',
    title: t('settings.runtime.keep.appearanceTitle', { defaultValue: 'Appearance' }),
    subtitle: t('settings.runtime.keep.appearanceSubtitle', {
      defaultValue: 'Theme, accent color, and font sizing for the desktop client.',
    }),
    path: '/settings/appearance',
  },
  {
    id: 'keep.assistants',
    title: t('settings.runtime.keep.assistantsTitle', { defaultValue: 'Assistants' }),
    subtitle: t('settings.runtime.keep.assistantsSubtitle', {
      defaultValue: 'Per-assistant prompts, modes, and default models.',
    }),
    path: '/settings/assistants',
  },
  {
    id: 'keep.webui',
    title: t('settings.runtime.keep.webuiTitle', { defaultValue: 'Web UI' }),
    subtitle: t('settings.runtime.keep.webuiSubtitle', {
      defaultValue: 'Optional in-app web UI for the Runtime dashboard.',
    }),
    path: '/settings/webui',
  },
  {
    id: 'keep.system',
    title: t('settings.runtime.keep.systemTitle', { defaultValue: 'System preferences' }),
    subtitle: t('settings.runtime.keep.systemSubtitle', {
      defaultValue: 'Language, notifications, launch behaviour, and telemetry.',
    }),
    path: '/settings/system',
  },
];

type Translator = (k: string, opts?: Record<string, unknown>) => string;

const readinessTag = (r: Readiness, t: Translator) => {
  switch (r) {
    case 'ready':
      return (
        <Tag color='green' size='small'>
          {t('settings.runtime.status.ready', { defaultValue: 'Live' })}
        </Tag>
      );
    case 'partial':
      return (
        <Tag color='orange' size='small'>
          {t('settings.runtime.status.partial', { defaultValue: 'Partial' })}
        </Tag>
      );
    case 'unavailable':
      return (
        <Tag color='red' size='small'>
          {t('settings.runtime.status.unavailable', { defaultValue: 'Unavailable' })}
        </Tag>
      );
    default:
      return (
        <Tag color='gray' size='small'>
          {t('settings.runtime.status.checking', { defaultValue: 'Checking…' })}
        </Tag>
      );
  }
};

const RuntimeSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [porting, setPorting] = useState<PortRow[]>(() => buildDefaultPorting(t));
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const keep = useMemo(() => buildDefaultKept(t), [t]);

  const probe = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Preferred path: one IPC call to main, which already holds the session
    // token and avoids 8 separate CORS-token round-trips. Falls back to
    // in-renderer probing when the bridge is unavailable (e.g. browser mode).
    let snapshot: IRuntimeStatus | null = null;
    if (isElectronDesktop()) {
      try {
        snapshot = await runtimeBridge.getStatus.invoke();
      } catch (err) {
        // fall through to renderer-side probe
        console.warn('[Runtime] bridge.getStatus failed, falling back to renderer probe', err);
      }
    }

    if (snapshot) {
      setPorting((prev) => {
        const byId = new Map(snapshot.porting.map((entry: IRuntimeStatusEntry) => [entry.id, entry]));
        return prev.map((row) => {
          const found = byId.get(row.id);
          return found ? { ...row, readiness: found.readiness, detail: found.detail } : row;
        });
      });
      setLastChecked(snapshot.generatedAt);
      setLoading(false);
      return;
    }

    // Renderer-side fallback: probe each Hermes endpoint directly with the
    // session token from `window.__hermesSessionToken`. Used in WebUI browser
    // mode and as a safety net if the bridge call above fails.
    const base = getBackendBase();
    const headers = getBackendAuthHeaders();

    const probes = await Promise.all(
      porting.map(async (row) => {
        try {
          const res = await fetch(`${base}${row.endpoint}`, { method: 'GET', headers });
          if (res.status === 404) {
            return { id: row.id, readiness: 'unavailable' as Readiness, detail: 'Not exposed by this runtime build' };
          }
          if (!res.ok) {
            return { id: row.id, readiness: 'unavailable' as Readiness, detail: `HTTP ${res.status}` };
          }
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('application/json')) {
            return { id: row.id, readiness: 'partial' as Readiness, detail: `Unexpected content-type: ${ct}` };
          }
          const data = await res.json();
          const items = Array.isArray(data?.sessions)
            ? data.sessions.length
            : Array.isArray(data?.jobs)
            ? data.jobs.length
            : Array.isArray(data?.servers)
            ? data.servers.length
            : Array.isArray(data?.providers)
            ? data.providers.length
            : Array.isArray(data?.options)
            ? data.options.length
            : Array.isArray(data?.platforms)
            ? data.platforms.length
            : Array.isArray(data?.skills)
            ? data.skills.length
            : Array.isArray(data?.items)
            ? data.items.length
            : null;
          const detail = items === null ? 'OK' : `${items} record${items === 1 ? '' : 's'}`;
          return { id: row.id, readiness: 'ready' as Readiness, detail };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return { id: row.id, readiness: 'unavailable' as Readiness, detail: msg };
        }
      })
    );

    setPorting((prev) =>
      prev.map((row) => {
        const found = probes.find((p) => p.id === row.id);
        return found
          ? { ...row, readiness: found.readiness, detail: found.detail }
          : row;
      })
    );
    setLastChecked(Date.now());
    setLoading(false);
  }, [porting]);

  useEffect(() => {
    // Initial probe on mount; intentionally silent if it fails.
    void probe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastCheckedLabel = useMemo(() => {
    if (!lastChecked) return null;
    return new Date(lastChecked).toLocaleTimeString();
  }, [lastChecked]);

  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <div className='flex flex-col gap-16px pb-24px'>
        <header className='flex items-center justify-between gap-12px flex-wrap'>
          <div>
            <Title heading={4} style={{ margin: 0 }}>
              {t('settings.runtime.title', { defaultValue: 'Runtime' })}
            </Title>
            <Text type='secondary'>
              {t('settings.runtime.subtitle', {
                defaultValue:
                  'A side-by-side view of the settings we keep today and the Runtime surfaces we are bringing in.',
              })}
            </Text>
          </div>
          <Space>
            {lastCheckedLabel ? (
              <Text type='secondary' style={{ fontSize: 12 }}>
                {t('settings.runtime.lastChecked', { defaultValue: 'Last checked' })}: {lastCheckedLabel}
              </Text>
            ) : null}
            <Tooltip content={t('settings.runtime.refresh', { defaultValue: 'Re-check now' })}>
              <span>
                <Badge count={loading ? 1 : 0} dot={loading}>
                  <button
                    type='button'
                    onClick={() => void probe()}
                    disabled={loading}
                    className='px-10px py-6px rd-8px flex items-center gap-6px text-13px text-t-primary hover:bg-fill-2 transition-colors'
                    style={{ border: '1px solid var(--color-border-2, #e5e6eb)', background: 'transparent' }}
                  >
                    <Refresh theme='outline' size='14' />
                    {t('settings.runtime.refresh', { defaultValue: 'Re-check now' })}
                  </button>
                </Badge>
              </span>
            </Tooltip>
          </Space>
        </header>

        {error ? (
          <Card bordered>
            <Text type='error'>{error}</Text>
          </Card>
        ) : null}

        <div className='grid gap-16px' style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))' }}>
          <Card
            title={
              <Space>
                <Avatar size={20} style={{ background: 'var(--color-primary-light-3, #e8f3ff)' }}>
                  <Check theme='outline' size='12' />
                </Avatar>
                {t('settings.runtime.keptHeading', { defaultValue: 'Kept in Headmaster' })}
              </Space>
            }
            bordered
          >
            <List
              dataSource={keep}
              render={(item) => (
                <List.Item
                  key={item.id}
                  actionLayout='vertical'
                  extra={
                    <button
                      type='button'
                      onClick={() => navigate(item.path)}
                      className='px-10px py-4px rd-6px text-12px text-t-primary hover:bg-fill-2 transition-colors'
                      style={{ border: '1px solid var(--color-border-2, #e5e6eb)', background: 'transparent' }}
                    >
                      {t('settings.runtime.open', { defaultValue: 'Open' })}
                    </button>
                  }
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar size={28} style={{ background: 'var(--color-fill-2, #f5f6f7)' }}>
                        <Link theme='outline' size='14' />
                      </Avatar>
                    }
                    title={item.title}
                    description={item.subtitle}
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card
            title={
              <Space>
                <Avatar size={20} style={{ background: 'var(--color-primary-light-3, #e8f3ff)' }}>
                  <Thunderbolt theme='outline' size='12' />
                </Avatar>
                {t('settings.runtime.portingHeading', { defaultValue: 'Porting from Runtime' })}
              </Space>
            }
            bordered
          >
            {loading && porting.every((row) => row.readiness === 'unknown') ? (
              <div className='flex flex-col gap-12px py-8px'>
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} animation={false} text={{ rows: 2, width: ['40%', '80%'] }} />
                ))}
              </div>
            ) : porting.length === 0 ? (
              <Empty description={t('settings.runtime.empty', { defaultValue: 'No runtime surfaces found' })} />
            ) : (
              <List
                dataSource={porting}
                render={(item) => (
                  <List.Item
                    key={item.id}
                    extra={
                      <div className='flex flex-col items-end gap-4px'>
                        {readinessTag(item.readiness, t)}
                        {item.detail ? (
                          <Text type='secondary' style={{ fontSize: 11 }}>
                            {item.detail}
                          </Text>
                        ) : null}
                      </div>
                    }
                  >
                    <List.Item.Meta
                      avatar={
                        <Avatar
                          size={28}
                          style={{
                            background:
                              item.readiness === 'ready'
                                ? 'var(--color-success-light-3, #e8ffea)'
                                : item.readiness === 'partial'
                                ? 'var(--color-warning-light-3, #fff3e8)'
                                : item.readiness === 'unavailable'
                                ? 'var(--color-danger-light-3, #ffece8)'
                                : 'var(--color-fill-2, #f5f6f7)',
                          }}
                        >
                          {item.readiness === 'ready' ? (
                            <Check theme='outline' size='14' />
                          ) : item.readiness === 'unavailable' ? (
                            <Close theme='outline' size='14' />
                          ) : (
                            <Loading theme='outline' size='14' />
                          )}
                        </Avatar>
                      }
                      title={
                        <Space>
                          <span>{item.title}</span>
                          <Text type='secondary' style={{ fontSize: 11 }}>
                            {item.endpoint}
                          </Text>
                        </Space>
                      }
                      description={item.subtitle}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </div>

        <Card bordered>
          <Space direction='vertical' size={4}>
            <Text bold style={{ color: 'var(--color-text-1, #1d2129)' }}>
              {t('settings.runtime.footerTitle', { defaultValue: 'How this is wired' })}
            </Text>
            <Text type='secondary'>
              {t('settings.runtime.footerBody', {
                defaultValue:
                  'Readiness is checked live against the running Runtime. Endpoints marked Live are returning data; Unavailable means the runtime did not respond; Partial means the endpoint exists but returned an unexpected payload. The Kept column links back to the existing settings tabs in this app.',
              })}
            </Text>
          </Space>
        </Card>
      </div>
    </SettingsPageWrapper>
  );
};

export default RuntimeSettings;
