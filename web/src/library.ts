import type { PuzzleSummary } from '@shared/protocol';

export const LIBRARY_CATEGORIES = [
  { id: 'all', label: '全部', icon: 'grid' },
  { id: 'animal', label: '动物', icon: 'heart' },
  { id: 'food', label: '食物', icon: 'bowl' },
  { id: 'plant', label: '水果植物', icon: 'book' },
  { id: 'object', label: '日常物品', icon: 'compass' },
  { id: 'nature', label: '自然交通', icon: 'earth' },
  { id: 'idiom', label: '成语', icon: 'star' },
] as const;
export type LibraryCategory = typeof LIBRARY_CATEGORIES[number]['id'];
export type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard' | 'unknown';

export function matchesCategory(puzzle: PuzzleSummary, category: LibraryCategory): boolean {
  if (category === 'all') return true;
  const text = `${puzzle.tags.join(' ')} ${puzzle.title}`;
  const patterns = {
    animal: /动物|萌宠|昆虫|鸟类|海洋/,
    food: /食物|美味|甜品|快餐|饮品|早餐|烧烤|小吃/,
    plant: /水果|植物|蔬菜|花朵/,
    object: /物件|小物|文具|工具|运动/,
    nature: /自然|交通|天气/,
    idiom: /成语|四字/,
  };
  return patterns[category].test(text);
}
export function matchesDifficulty(puzzle: PuzzleSummary, filter: DifficultyFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unknown') return puzzle.difficulty === null;
  if (puzzle.difficulty === null) return false;
  return filter === 'easy' ? puzzle.difficulty <= 2 : filter === 'medium' ? puzzle.difficulty === 3 : puzzle.difficulty >= 4;
}
export function difficultyLabel(puzzle: Pick<PuzzleSummary, 'difficulty'>): string {
  if (puzzle.difficulty === null) return '未标注';
  return puzzle.difficulty <= 2 ? '简单' : puzzle.difficulty === 3 ? '中等' : '困难';
}
export function puzzleCover(puzzle: Pick<PuzzleSummary, 'title' | 'surfacePreview'>): string {
  const text = `${puzzle.title} ${puzzle.surfacePreview}`;
  const scene = /成语|四字|寓言/.test(text) ? 'idiom'
    : /水果|食物|甜品|饮品|美味|早餐|小吃/.test(text) ? 'food'
    : /物件|小物|文具|工具|日常/.test(text) ? 'object'
    : /自然|交通|植物|天气|夜空/.test(text) ? 'nature'
    : 'animal';
  return `/assets/puzzle-covers/${scene}.webp`;
}
export function pickRecommendation(puzzles: PuzzleSummary[]): PuzzleSummary | undefined {
  return [...puzzles].sort((a, b) => (b.goodRate ?? -1) - (a.goodRate ?? -1) || b.plays - a.plays)[0];
}
