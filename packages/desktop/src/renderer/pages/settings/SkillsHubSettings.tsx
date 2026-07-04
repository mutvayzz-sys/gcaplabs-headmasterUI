import { httpPut, httpRequest } from '@/common/adapter/httpBridge';
import { isRemoteContainerMode } from '@/common/adapter/backendUrl';
import { normalizeHermesList } from '@/common/adapter/hermesResponse';
import { Message, Switch } from '@arco-design/web-react';
import { Info, Puzzle, Search, Refresh } from '@icon-park/react';
import { Clock, Code, Globe, GraduationCap, PuzzlePiece, Terminal, Wrench } from '@phosphor-icons/react';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import SettingsPageWrapper from './components/SettingsPageWrapper';

// Skill 信息类型 / Skill info type
interface SkillInfo {
  name: string;
  description: string;
  location: string;
  /**
   * Relative location under the builtin-skills corpus (e.g.
   * `auto-inject/cron/SKILL.md`). Present only for `source=builtin`; the
   * export-to-external-source flow still uses absolute `location` paths.
   */
  relative_location?: string;
  is_custom: boolean;
  source?: 'builtin' | 'custom' | 'extension';
  category?: string;
  enabled?: boolean;
}

// Normalize skill name for data-testid usage
const normalizeTestId = (name: string): string => {
  return name.replace(/[:/\s<>"'|?*]/g, '-');
};

function mapSkillRecord(skill: {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  enabled?: unknown;
  location?: unknown;
  is_custom?: unknown;
  source?: unknown;
}): SkillInfo | null {
  const source: SkillInfo['source'] =
    skill.source === 'extension' || skill.source === 'custom' || skill.source === 'builtin'
      ? skill.source
      : skill.is_custom
        ? 'custom'
        : 'builtin';
  const name = typeof skill.name === 'string' ? skill.name : '';
  if (!name) return null;
  return {
    name,
    description: typeof skill.description === 'string' ? skill.description : '',
    category: typeof skill.category === 'string' ? skill.category : undefined,
    enabled: skill.enabled !== false,
    location: typeof skill.location === 'string' ? skill.location : '',
    is_custom: Boolean(skill.is_custom),
    source,
  };
}

async function fetchAvailableSkills(): Promise<SkillInfo[]> {
  if (isRemoteContainerMode()) return [];
  const raw = await httpRequest<unknown>('GET', '/api/skills');
  return normalizeHermesList<{
    name?: unknown;
    description?: unknown;
    category?: unknown;
    enabled?: unknown;
    location?: unknown;
    is_custom?: unknown;
    source?: unknown;
  }>(raw, 'skills')
    .map((skill) => mapSkillRecord(skill))
    .filter((skill): skill is SkillInfo => skill !== null);
}

function skillCategory(skill: SkillInfo): string {
  const cat = skill.category?.trim();
  if (cat) return cat.toLowerCase();
  const rel = skill.relative_location?.split('/')[0]?.toLowerCase();
  if (rel) return rel;
  const name = skill.name.toLowerCase();
  if (name.includes('cron') || name.includes('schedule')) return 'automation';
  if (name.includes('web') || name.includes('browser')) return 'web';
  if (name.includes('code') || name.includes('git')) return 'coding';
  return 'general';
}

function SkillIcon({ category, name }: { category: string; name: string }) {
  const props = { size: 20, weight: 'duotone' as const, className: 'text-t-primary' };
  switch (category) {
    case 'coding':
    case 'code':
      return <Code {...props} />;
    case 'automation':
    case 'cron':
      return <Clock {...props} />;
    case 'web':
      return <Globe {...props} />;
    case 'terminal':
    case 'cli':
      return <Terminal {...props} />;
    case 'tools':
      return <Wrench {...props} />;
    case 'extension':
      return <PuzzlePiece {...props} />;
    default:
      return name.toLowerCase().includes('skill') ? <GraduationCap {...props} /> : <GraduationCap {...props} />;
  }
}

interface SkillsHubSettingsProps {
  /** When false, renders without SettingsPageWrapper — useful for embedding in a tab */
  withWrapper?: boolean;
}

const SkillsHubSettings: React.FC<SkillsHubSettingsProps> = ({ withWrapper = true }) => {
  const { t } = useTranslation();
  const remoteModeUnavailable = isRemoteContainerMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightName = searchParams.get('highlight');
  const [highlightedSkill, setHighlightedSkill] = useState<string | null>(null);
  const skillRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [loading, setLoading] = useState(false);
  const [availableSkills, setAvailableSkills] = useState<SkillInfo[]>([]);
  const [search_query, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const mySkills = useMemo(() => availableSkills.filter((s) => s.source !== 'extension'), [availableSkills]);
  const extensionSkills = useMemo(() => availableSkills.filter((s) => s.source === 'extension'), [availableSkills]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    mySkills.forEach((s) => set.add(skillCategory(s)));
    return ['all', ...Array.from(set).sort()];
  }, [mySkills]);

  const filteredSkills = useMemo(() => {
    const lowerQuery = search_query.trim().toLowerCase();
    return mySkills.filter((s) => {
      if (activeCategory !== 'all' && skillCategory(s) !== activeCategory) return false;
      if (!lowerQuery) return true;
      return (
        s.name.toLowerCase().includes(lowerQuery) ||
        (s.description && s.description.toLowerCase().includes(lowerQuery)) ||
        skillCategory(s).includes(lowerQuery)
      );
    });
  }, [mySkills, search_query, activeCategory]);

  const toggleSkill = useCallback(async (name: string, enabled: boolean) => {
    if (remoteModeUnavailable) {
      Message.info(
        t('settings.skillsHub.remoteModeUnavailable', {
          defaultValue:
            'Skills are managed by the cloud workspace in this mode. Local skill toggles are available when using a local runtime.',
        })
      );
      return;
    }
    try {
      await httpPut<{ ok: boolean }, { name: string; enabled: boolean }>('/api/skills/toggle').invoke({
        name,
        enabled,
      });
      setAvailableSkills((prev) => prev.map((s) => (s.name === name ? { ...s, enabled } : s)));
    } catch (error) {
      Message.error(String(error));
    }
  }, [remoteModeUnavailable, t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    if (remoteModeUnavailable) {
      setAvailableSkills([]);
      setLoading(false);
      return;
    }
    try {
      const skills = await fetchAvailableSkills();
      setAvailableSkills(skills);
    } catch (error) {
      console.error('Failed to fetch skills:', error);
      Message.error(t('settings.skillsHub.fetchError', { defaultValue: 'Failed to fetch skills' }));
    } finally {
      setLoading(false);
    }
  }, [remoteModeUnavailable, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Scroll to and highlight a skill when navigated with ?highlight=skillName
  useEffect(() => {
    if (!highlightName || loading) return;
    const el = skillRefs.current[highlightName];
    if (el) {
      // Small delay to ensure layout is settled
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedSkill(highlightName);
        // Clear highlight after animation
        const timer = setTimeout(() => setHighlightedSkill(null), 2000);
        // Clean up the search param so refreshing won't re-highlight
        setSearchParams({}, { replace: true });
        return () => clearTimeout(timer);
      });
    }
  }, [highlightName, loading, availableSkills, setSearchParams]);

  const mainContent = (
    <div className='flex flex-col h-full w-full'>
      <div className='space-y-16px pb-24px'>
        {/* ======== 我的技能 / My Skills ======== */}
        <div
          data-testid='my-skills-section'
          className='px-[16px] md:px-[32px] py-32px bg-base rd-16px md:rd-24px shadow-sm border border-b-base relative overflow-hidden transition-all'
        >
          {/* Toolbar for My Skills */}
          <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-16px mb-24px relative z-10'>
            <div className='flex items-center gap-10px shrink-0'>
              <span className='text-16px md:text-18px text-t-primary font-bold tracking-tight'>
                {t('settings.skillsHub.mySkillsTitle', { defaultValue: 'My Skills' })}
              </span>
              <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 text-12px px-10px py-2px rd-[100px] font-medium ml-4px'>
                {mySkills.length}
              </span>
              <button
                data-testid='btn-refresh-my-skills'
                className='outline-none border-none bg-transparent cursor-pointer p-6px text-t-tertiary hover:text-primary-6 transition-colors rd-full hover:bg-fill-2 ml-4px'
                onClick={async () => {
                  await fetchData();
                  if (!remoteModeUnavailable) {
                    Message.success(t('common.refreshSuccess', { defaultValue: 'Refreshed' }));
                  }
                }}
                disabled={remoteModeUnavailable}
                title={t('common.refresh', { defaultValue: 'Refresh' })}
              >
                <Refresh theme='outline' size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className='flex items-center gap-12px w-full lg:w-auto shrink-0'>
              <div className='relative group shrink-0 w-full sm:w-[200px] lg:w-[240px]'>
                <div className='absolute left-12px top-1/2 -translate-y-1/2 text-t-tertiary group-focus-within:text-primary-6 flex pointer-events-none transition-colors'>
                  <Search size={15} />
                </div>
                <input
                  data-testid='input-search-my-skills'
                  type='text'
                  className='w-full bg-fill-1 hover:bg-fill-2 border border-border-1 focus:border-primary-5 focus:bg-base outline-none rd-8px py-6px pl-36px pr-12px text-13px text-t-primary placeholder:text-t-tertiary transition-all shadow-sm box-border m-0'
                  placeholder={t('settings.skillsHub.searchPlaceholder', { defaultValue: 'Search skills...' })}
                  value={search_query}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className='flex flex-wrap gap-8px mb-16px relative z-10'>
            {categories.map((cat) => (
              <button
                key={cat}
                type='button'
                onClick={() => setActiveCategory(cat)}
                className={`px-10px py-4px rd-100px text-12px font-medium border transition-colors ${
                  activeCategory === cat
                    ? 'bg-[rgba(var(--primary-6),0.12)] border-primary-5 text-primary-6'
                    : 'bg-fill-1 border-border-2 text-t-secondary hover:text-t-primary'
                }`}
              >
                {cat === 'all' ? t('common.all', { defaultValue: 'All' }) : cat}
              </button>
            ))}
          </div>

          {remoteModeUnavailable ? (
            <div className='text-center text-t-secondary text-13px py-40px bg-fill-1 rd-12px border border-b-base border-dashed relative z-10'>
              {t('settings.skillsHub.remoteModeUnavailable', {
                defaultValue:
                  'Skills are managed by the cloud workspace in this mode. Local skill controls are available when using a local runtime.',
              })}
            </div>
          ) : mySkills.length > 0 ? (
            <div className='w-full flex flex-col gap-6px relative z-10'>
              {filteredSkills.map((skill) => (
                <div
                  key={skill.name}
                  data-testid={`my-skill-card-${normalizeTestId(skill.name)}`}
                  ref={(el) => {
                    skillRefs.current[skill.name] = el;
                  }}
                  className={`group flex flex-col sm:flex-row gap-16px p-16px bg-base border hover:border-border-1 hover:bg-fill-1 hover:shadow-sm rd-12px transition-all duration-200 items-center ${highlightedSkill === skill.name ? 'border-primary-5 bg-primary-1' : 'border-transparent'}`}
                >
                  <div className='shrink-0 flex items-start sm:mt-2px'>
                    <div className='w-40px h-40px rd-10px bg-fill-2 border border-border-2 flex items-center justify-center shadow-sm'>
                      <SkillIcon category={skillCategory(skill)} name={skill.name} />
                    </div>
                  </div>

                  <div className='flex-1 min-w-0 flex flex-col justify-center gap-6px'>
                    <div className='flex items-center gap-10px flex-wrap'>
                      <h3 className='text-14px font-semibold text-t-primary/90 truncate m-0'>{skill.name}</h3>
                      <span className='bg-slate-500/10 text-slate-300 text-11px px-6px py-1px rd-4px font-medium capitalize'>
                        {skillCategory(skill)}
                      </span>
                      {skill.source === 'custom' ? (
                        <span className='bg-[rgba(var(--orange-6),0.08)] text-orange-6 border border-[rgba(var(--orange-6),0.2)] text-11px px-6px py-1px rd-4px font-medium'>
                          {t('settings.skillsHub.custom', { defaultValue: 'Custom' })}
                        </span>
                      ) : (
                        <span className='bg-[rgba(var(--blue-6),0.08)] text-blue-6 border border-[rgba(var(--blue-6),0.2)] text-11px px-6px py-1px rd-4px font-medium'>
                          {t('settings.skillsHub.builtin', { defaultValue: 'Built-in' })}
                        </span>
                      )}
                    </div>
                    {skill.description && (
                      <p
                        className='text-13px text-t-secondary leading-relaxed line-clamp-2 m-0'
                        title={skill.description}
                      >
                        {skill.description}
                      </p>
                    )}
                  </div>

                  <div className='shrink-0 flex items-center' onClick={(e) => e.stopPropagation()}>
                    <Switch
                      size='small'
                      checked={skill.enabled !== false}
                      disabled={remoteModeUnavailable}
                      onChange={(checked) => void toggleSkill(skill.name, checked)}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center text-t-secondary text-13px py-40px bg-fill-1 rd-12px border border-b-base border-dashed relative z-10'>
              {loading
                ? t('common.loading', { defaultValue: 'Please wait...' })
                : t('settings.skillsHub.noSkills', {
                    defaultValue: 'No skills found. Import some to get started.',
                  })}
            </div>
          )}
        </div>

        {/* ======== Extension Skills ======== */}
        {extensionSkills.length > 0 && (
          <div
            data-testid='extension-skills-section'
            className='px-[16px] md:px-[32px] py-32px bg-base rd-16px md:rd-24px shadow-sm border border-b-base relative overflow-hidden transition-all'
          >
            <div className='flex items-center gap-10px mb-24px'>
              <Puzzle theme='filled' size={20} fill='var(--color-primary-6)' />
              <span className='text-16px md:text-18px text-t-primary font-bold tracking-tight'>
                {t('settings.extensionSkills', { defaultValue: 'Extension Skills' })}
              </span>
              <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 text-12px px-10px py-2px rd-[100px] font-medium ml-4px'>
                {extensionSkills.length}
              </span>
            </div>
            <div className='w-full flex flex-col gap-6px'>
              {extensionSkills.map((skill) => (
                <div
                  key={skill.name}
                  ref={(el) => {
                    skillRefs.current[skill.name] = el;
                  }}
                  className={`flex flex-col sm:flex-row gap-16px p-16px bg-base border hover:border-border-1 hover:bg-fill-1 rd-12px transition-all duration-200 ${highlightedSkill === skill.name ? 'border-primary-5 bg-primary-1' : 'border-transparent'}`}
                >
                  <div className='shrink-0 flex items-start sm:mt-2px'>
                    <div className='w-40px h-40px rd-10px bg-[rgba(var(--primary-6),0.08)] flex items-center justify-center shadow-sm'>
                      <Puzzle theme='filled' size={20} fill='rgb(var(--primary-6))' />
                    </div>
                  </div>
                  <div className='flex-1 min-w-0 flex flex-col justify-center gap-4px'>
                    <div className='flex items-center gap-10px'>
                      <h3 className='text-14px font-semibold text-t-primary/90 truncate m-0'>{skill.name}</h3>
                      <span className='bg-[rgba(var(--primary-6),0.08)] text-primary-6 border border-[rgba(var(--primary-6),0.2)] text-10px px-6px py-1px rd-4px font-medium uppercase'>
                        {t('settings.extensionSkillsBadge', { defaultValue: 'Extension' })}
                      </span>
                    </div>
                    {skill.description && (
                      <p className='text-13px text-t-secondary leading-relaxed line-clamp-2 m-0'>{skill.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======== Usage Tip ======== */}
        <div className='px-16px md:px-[24px] py-20px bg-base border border-b-base shadow-sm rd-16px flex items-start gap-12px text-t-secondary'>
          <Info size={18} className='text-primary-6 mt-2px shrink-0' />
          <div className='flex flex-col gap-4px'>
            <span className='font-bold text-t-primary text-14px'>
              {t('settings.skillsHub.tipTitle', { defaultValue: 'Usage Tip:' })}
            </span>
            <span className='text-13px leading-relaxed'>{t('settings.skillsHub.tipContent')}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return withWrapper ? <SettingsPageWrapper>{mainContent}</SettingsPageWrapper> : mainContent;
};

export default SkillsHubSettings;
