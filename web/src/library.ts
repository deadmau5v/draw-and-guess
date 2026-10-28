import type { PuzzleSummary } from '@shared/protocol';

export const LIBRARY_CATEGORIES = [
  { id: 'all', label: '全部', icon: 'grid' },
  { id: 'classic', label: '经典', icon: 'star' },
  { id: 'fun', label: '欢乐', icon: 'gamepad' },
  { id: 'horror', label: '悬疑', icon: 'search' },
  { id: 'school', label: '校园', icon: 'book' },
  { id: 'twist', label: '反转', icon: 'refresh' },
  { id: 'warm', label: '温情', icon: 'heart' },
] as const;
export type LibraryCategory = typeof LIBRARY_CATEGORIES[number]['id'];
export type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard' | 'unknown';

export function matchesCategory(puzzle: PuzzleSummary, category: LibraryCategory): boolean {
  if (category === 'all') return true;
  const tags = puzzle.tags.join(' ');
  const patterns = {
    classic: /经典/, fun: /轻松|欢乐|日常|童真/,
    horror: /恐怖|惊悚|灵异|怪谈|微恐|悬疑|细思极恐|神秘/,
    school: /校园|学校/, twist: /反转|误解|误会|误认/,
    warm: /温情|守护|父爱|保护/,
  };
  return patterns[category].test(tags);
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
const FALLBACK_COVERS = ['night', 'window', 'stairs', 'cozy', 'library', 'bar', 'sea', 'train', 'car', 'music'] as const;

export function puzzleCover(puzzle: Pick<PuzzleSummary, 'title' | 'surfacePreview'>): string {
  // Deliberately use public story text only, never tags that might encode the solution.
  const text = `${puzzle.title} ${puzzle.surfacePreview}`;
  const scene = /灯塔|守塔/.test(text) ? 'lighthouse'
    : /高跟鞋|礼服|裙|口红|化妆|镜子/.test(text) ? 'heels'
    : /香水|气味|香味|医院|药|手术|诊所|病房/.test(text) ? 'perfume'
    : /八音盒|音乐盒|钢琴|演奏|歌声|音乐|乐曲|演唱会|掌声|剧院/.test(text) ? 'music'
    : /冰淇淋|冰淇凌|甜点|巧克力|糖果|雪糕/.test(text) ? 'icecream'
    : /图书馆|借书|书店|小说|日记|信件|情书|报纸|遗书/.test(text) ? 'library'
    : /天窗|作家|写作|窗户|窗外|阳台|窗帘|画/.test(text) ? 'window'
    : /五步上车|停车场|楼梯|电梯|走廊|地下室|台阶|楼道|公寓/.test(text) ? 'stairs'
    : /酒保|酒吧|餐厅|咖啡|喝水|汤|饭店|厨师|酒|茶/.test(text) ? 'bar'
    : /火车|列车|车站|铁轨|飞机|地铁|航班|车厢|乘客/.test(text) ? 'train'
    : /汽车|驾车|车内|出租车|轿车|司机|卡车|公交|高速/.test(text) ? 'car'
    : /学校|教室|同学|老师|校园|考试|宿舍|学生/.test(text) ? 'school'
    : /狗|猫|宠物|动物|鸟|马|猴子|鱼/.test(text) ? 'pet'
    : /海|岛|船|沙滩|水手|游泳|潜水|河|湖|沙漠/.test(text) ? 'sea'
    : /生日|蛋糕|礼物|派对|婚礼|圣诞|聚会|红包/.test(text) ? 'cozy'
    : (() => {
      let hash = 0;
      for (let i = 0; i < text.length; i++) hash = ((hash * 31) + text.charCodeAt(i)) >>> 0;
      return FALLBACK_COVERS[hash % FALLBACK_COVERS.length];
    })();
  return `/assets/puzzle-covers/${scene}.webp`;
}
export function pickRecommendation(puzzles: PuzzleSummary[]): PuzzleSummary | undefined {
  return [...puzzles].sort((a, b) => (b.goodRate ?? -1) - (a.goodRate ?? -1) || b.plays - a.plays)[0];
}
