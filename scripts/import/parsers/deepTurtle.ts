import { cleanText, type RawPuzzle } from '../normalize.js';
export function parseDeepTurtle(text: string): RawPuzzle[] {
  const trimmed = text.trim();
  const rows: unknown[] = trimmed.startsWith('[') ? JSON.parse(trimmed) : trimmed.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const seen = new Set<string>();
  const result: RawPuzzle[] = [];
  for (const value of rows) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Record<string, unknown>;
    const key = JSON.stringify([cleanText(row.title), cleanText(row.surface)]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ id: row.id, title: row.title, surface: row.surface, bottom: row.truth });
  }
  return result;
}
