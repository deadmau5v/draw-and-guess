import type { RawPuzzle } from '../normalize.js';
export function parseZeroTangJson(text: string): RawPuzzle[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error('zerotang JSON 必须是数组');
  return parsed.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object').map(row => ({ id: row.id, title: row.title, surface: row.story, bottom: row.answer, hints: row.hints }));
}
