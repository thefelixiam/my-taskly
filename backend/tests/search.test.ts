import { describe, it, expect } from 'vitest';
import { matchesSearch } from '../src/features/todos/search.ts';
import { todo } from './fixture.ts';

describe('matchesSearch', () => {
  it('returns true for empty query', () => {
    expect(matchesSearch(todo, '')).toBe(true);
  });

  it('returns true for whitespace-only query', () => {
    expect(matchesSearch(todo, '   ')).toBe(true);
  });

  it('returns true for query with leading/trailing whitespace', () => {
    expect(matchesSearch(todo, '  plan  ')).toBe(true);
  });

  it('matches title case-insensitively', () => {
    expect(matchesSearch(todo, 'PLAN')).toBe(true);
    expect(matchesSearch(todo, 'plan')).toBe(true);
    expect(matchesSearch(todo, 'Plan')).toBe(true);
  });

  it('matches description case-insensitively', () => {
    expect(matchesSearch(todo, 'DETAILS')).toBe(true);
    expect(matchesSearch(todo, 'details')).toBe(true);
  });

  it('returns false when query matches neither title nor description', () => {
    expect(matchesSearch(todo, 'meeting')).toBe(false);
    expect(matchesSearch(todo, 'xyz')).toBe(false);
  });

  it('matches partial strings in title', () => {
    expect(matchesSearch(todo, 'sprint')).toBe(true);
    expect(matchesSearch(todo, 'the sp')).toBe(true);
  });

  it('matches partial strings in description', () => {
    expect(matchesSearch(todo, 'tail')).toBe(true);
    expect(matchesSearch(todo, 'Det')).toBe(true);
  });
});