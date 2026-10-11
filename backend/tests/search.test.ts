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

  it('returns true for query matching title case-insensitively', () => {
    expect(matchesSearch(todo, 'plan')).toBe(true);
    expect(matchesSearch(todo, 'PLAN')).toBe(true);
    expect(matchesSearch(todo, 'Plan')).toBe(true);
  });

  it('returns true for query matching description case-insensitively', () => {
    expect(matchesSearch(todo, 'details')).toBe(true);
    expect(matchesSearch(todo, 'DETAILS')).toBe(true);
  });

  it('returns true for partial match in title', () => {
    expect(matchesSearch(todo, 'sprint')).toBe(true);
  });

  it('returns true for partial match in description', () => {
    expect(matchesSearch(todo, 'tail')).toBe(true);
  });

  it('returns false when query matches neither title nor description', () => {
    expect(matchesSearch(todo, 'meeting')).toBe(false);
    expect(matchesSearch(todo, 'xyz')).toBe(false);
  });

  it('handles special characters in query', () => {
    const todoWithSpecial: typeof todo = {
      ...todo,
      title: 'Task (urgent)',
      description: 'Details & notes',
    };
    expect(matchesSearch(todoWithSpecial, '(')).toBe(true);
    expect(matchesSearch(todoWithSpecial, '&')).toBe(true);
    expect(matchesSearch(todoWithSpecial, 'urgent')).toBe(true);
  });

  it('handles query with leading/trailing whitespace', () => {
    expect(matchesSearch(todo, '  plan  ')).toBe(true);
    expect(matchesSearch(todo, '\tplan\n')).toBe(true);
  });

  it('returns false for empty title and description with non-empty query', () => {
    const emptyTodo: typeof todo = {
      ...todo,
      title: '',
      description: '',
    };
    expect(matchesSearch(emptyTodo, 'anything')).toBe(false);
  });
});