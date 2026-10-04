import type { SeedPuzzle } from '../../shared/protocol.js';
export function normalizeText(text: string): string { return text.replace(/[\p{P}\p{S}\s]/gu, '').toLowerCase(); }
function bigrams(text: string): Set<string> {
  const chars = Array.from(normalizeText(text));
  return new Set(chars.slice(0, -1).map((char, i) => char + chars[i + 1]));
}
function similarity(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection++;
  return a.size + b.size - intersection ? intersection / (a.size + b.size - intersection) : 0;
}
export function bigramJaccard(a: string, b: string): number { return similarity(bigrams(a), bigrams(b)); }
const licenses: Record<string, number> = { MIT: 3, 'GPL-3.0': 2, 'AGPL-3.0': 1 };
// 经典题补充规则：标题与核心因果同时匹配，不降低全库相似度阈值。
function classicKey(p: SeedPuzzle): string | null {
  const title = normalizeText(p.title), bottom = normalizeText(p.bottom);
  if (['酒吧的枪', '酒保的枪'].includes(title) && /酒保/.test(bottom) && /打嗝/.test(bottom) && /吓/.test(bottom)) return 'bar-hiccups';
  if (title === '半根火柴' && /热气球/.test(bottom) && /抽/.test(bottom) && /火柴/.test(bottom) && /跳|坠|离开吊篮/.test(bottom)) return 'short-match';
  return null;
}
export function dedupePuzzles(puzzles: readonly SeedPuzzle[]): SeedPuzzle[] {
  const prepared = puzzles.map(p => ({title: normalizeText(p.title), surface: bigrams(p.surface), bottom: bigrams(p.bottom), classic: classicKey(p)}));
  const parents = puzzles.map((_, i) => i);
  const root = (i: number): number => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
  for (let i = 0; i < puzzles.length; i++) for (let j = 0; j < i; j++) {
    const a = prepared[i], b = prepared[j];
    if ((a.classic !== null && a.classic === b.classic) || similarity(a.surface, b.surface) >= 0.6 || (a.title === b.title && similarity(a.bottom, b.bottom) >= 0.5)) parents[root(i)] = root(j);
  }
  const groups = new Map<number, SeedPuzzle[]>();
  puzzles.forEach((p, i) => { const key = root(i); const group = groups.get(key) ?? []; group.push(p); groups.set(key, group); });
  return Array.from(groups.values(), group => {
    const sorted = [...group].sort((a, b) => Number(b.hints.length > 0) - Number(a.hints.length > 0) || (licenses[b.source.license] ?? 0) - (licenses[a.source.license] ?? 0) || b.bottom.length - a.bottom.length);
    const winner = sorted[0];
    const sources = new Set(group.flatMap(p => [p.source.key, ...p.alsoIn]));
    sources.delete(winner.source.key);
    return {...winner, alsoIn: [...sources].sort()};
  });
}
