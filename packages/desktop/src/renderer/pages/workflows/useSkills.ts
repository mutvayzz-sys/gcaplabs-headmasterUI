/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { httpGet } from '@/common/adapter/httpBridge';

export interface SkillItem {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  builtin: boolean;
  category?: string;
}

interface UseSkillsReturn {
  skills: SkillItem[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  filter: string;
  setFilter: (s: string) => void;
}

function normalizeSkill(raw: Record<string, unknown>): SkillItem {
  const name = String(raw.name ?? raw.id ?? '');
  const path = typeof raw.path === 'string' ? raw.path : '';
  return {
    id: String(raw.id ?? name),
    name,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    enabled: raw.enabled !== false,
    builtin: raw.builtin === true || path.includes('hermes-agent') || path.includes('skills'),
    category: typeof raw.category === 'string' ? raw.category : undefined,
  };
}

export function useSkills(): UseSkillsReturn {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await httpGet<Array<Record<string, unknown>>>('/api/skills').invoke();
      setSkills((data ?? []).map(normalizeSkill).filter((skill) => skill.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  return {
    skills,
    loading,
    error,
    refresh: fetchSkills,
    filter,
    setFilter,
  };
}
