import { it, expect } from 'vitest';
import { matchesSearch } from '../src/features/todos/search.ts';
import type { Todo } from '../src/features/todos/types.js';

const baseTodo: Todo = {
  id: 1,
  title: 'Plan the sprint',
  description: 'Details for the upcoming sprint',
  priority: 'high',
  due_date: '2026-10-15',
  completed: false,
  created_at: '2026-10-01T12:00:00.000Z',
  updated_at: '2026-10-01T12:00:00.000Z',
};

it('returns true for empty query', () => {
  expect(matchesSearch(baseTodo, '')).toBe(true);
});

it('returns true for whitespace-only query', () => {
  expect(matchesSearch(baseTodo, '   ')).toBe(true);
  expect(matchesSearch(baseTodo, '\t\n')).toBe(true);
});

it('matches query against title case-insensitively', () => {
  expect(matchesSearch(baseTodo, 'plan')).toBe(true);
  expect(matchesSearch(baseTodo, 'PLAN')).toBe(true);
  expect(matchesSearch(baseTodo, 'Plan')).toBe(true);
  expect(matchesSearch(baseTodo, 'sprint')).toBe(true);
});

it('matches query against description case-insensitively', () => {
  expect(matchesSearch(baseTodo, 'details')).toBe(true);
  expect(matchesSearch(baseTodo, 'DETAILS')).toBe(true);
  expect(matchesSearch(baseTodo, 'upcoming')).toBe(true);
  expect(matchesSearch(baseTodo, 'SPRINT')).toBe(true);
});

it('returns false when query matches neither title nor description', () => {
  expect(matchesSearch(baseTodo, 'meeting')).toBe(false);
  expect(matchesSearch(baseTodo, 'xyz')).toBe(false);
});

it('matches partial words', () => {
  expect(matchesSearch(baseTodo, 'spr')).toBe(true);
  expect(matchesSearch(baseTodo, 'etail')).toBe(true);
});

it('handles special characters in query', () => {
  const todoWithSpecial: Todo = { ...baseTodo, title: 'Task (urgent)', description: 'Fix bug #42' };
  expect(matchesSearch(todoWithSpecial, '(')).toBe(true);
  expect(matchesSearch(todoWithSpecial, '#42')).toBe(true);
  expect(matchesSearch(todoWithSpecial, 'urgent')).toBe(true);
});

it('handles empty description', () => {
  const todoNoDesc: Todo = { ...baseTodo, description: '' };
  expect(matchesSearch(todoNoDesc, 'plan')).toBe(true);
  expect(matchesSearch(todoNoDesc, 'details')).toBe(false);
  expect(matchesSearch(todoNoDesc, '')).toBe(true);
});

it('handles empty title (though schema requires min 1)', () => {
  const todoNoTitle: Todo = { ...baseTodo, title: '' };
  expect(matchesSearch(todoNoTitle, 'details')).toBe(true);
  expect(matchesSearch(todoNoTitle, 'plan')).toBe(false);
});