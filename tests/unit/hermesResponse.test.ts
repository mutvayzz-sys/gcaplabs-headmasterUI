import { describe, expect, it } from 'vitest';
import { normalizeHermesList } from '@/common/adapter/hermesResponse';

describe('normalizeHermesList', () => {
  it('returns a direct array unchanged', () => {
    expect(normalizeHermesList<number>([1, 2], 'items')).toEqual([1, 2]);
  });

  it('unwraps a named Hermes response envelope', () => {
    expect(normalizeHermesList<{ id: string }>({ servers: [{ id: 'one' }] }, 'servers')).toEqual([{ id: 'one' }]);
  });

  it('returns an empty list for malformed or missing envelopes', () => {
    expect(normalizeHermesList({ servers: null }, 'servers')).toEqual([]);
    expect(normalizeHermesList(undefined, 'servers')).toEqual([]);
  });
});
