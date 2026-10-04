import type { PuzzleSource, SeedPuzzle } from '../../shared/protocol.js';
export interface RawPuzzle { id?: unknown; title?: unknown; surface?: unknown; bottom?: unknown; hints?: unknown; difficulty?: unknown; tags?: unknown }
export function cleanText(value: unknown): string { return String(value ?? '').replace(/　/g, '').trim(); }
export function normalizePuzzle(raw: RawPuzzle, source: PuzzleSource, index: number): SeedPuzzle {
  const surface = cleanText(raw.surface);
  const bottom = cleanText(raw.bottom);
  const tags = (Array.isArray(raw.tags) ? raw.tags : cleanText(raw.tags).split(/[,，、]/)).map(cleanText).filter(Boolean);
  const difficulty = typeof raw.difficulty === 'number' || typeof raw.difficulty === 'string' ? Number(raw.difficulty) : NaN;
  const original = cleanText(raw.id);
  return { id: `${source.key}-${/^[a-z0-9-]+$/.test(original) ? original : index}`, title: cleanText(raw.title) || Array.from(surface).slice(0, 8).join(''), surface, bottom,
    hints: Array.isArray(raw.hints) ? raw.hints.map(cleanText).filter(Boolean) : [], difficulty: Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5 ? difficulty : null,
    tags, nsfl: /恐怖|食人|吃人|谋杀|血腥|尸体|分尸|肢解|人肉|自杀/.test(tags.join(' ') + bottom), source, alsoIn: [] };
}
