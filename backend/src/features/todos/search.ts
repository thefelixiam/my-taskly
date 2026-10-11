import type { Todo } from './types.js';

export function matchesSearch(todo: Todo, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    todo.title.toLowerCase().includes(needle) ||
    todo.description.toLowerCase().includes(needle)
  );
}
