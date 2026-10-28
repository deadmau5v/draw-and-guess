'use client';

import { PageContainer } from './PageContainer';
import React, { useEffect, useMemo, useState } from 'react';
import {
  CandyAlert, CandyBadge, CandyButton, CandyCard, CandyCheckbox, CandyDivider,
  CandyEmptyState, CandyGameIcon, CandyIconButton, CandyInput, CandyModal,
  CandyPanel, CandyRadio, CandyRibbon, CandySelect, CandySkeleton,
} from 'candy-ui';
import type { PuzzlePublic, PuzzleSummary, SortKey } from '@shared/protocol';
import { api } from './api';
import { cdnUrl } from './cdn';
import { notify } from './store';
import { ContentWarning } from './components';
import {
  LIBRARY_CATEGORIES, difficultyLabel, matchesCategory, matchesDifficulty,
  pickRecommendation, puzzleCover,
} from './library';
import type { DifficultyFilter, LibraryCategory } from './library';

const SORT_OPTIONS = [
  { value: 'new', label: '最新收录' }, { value: 'hot', label: '最多挑战' },
  { value: 'good', label: '高好评' }, { value: 'mid', label: '中好评' }, { value: 'low', label: '低好评' },
];
const DIFFICULTIES: { value: DifficultyFilter; label: string }[] = [
  { value: 'all', label: '全部难度' }, { value: 'easy', label: '简单 · 1–2 星' },
  { value: 'medium', label: '中等 · 3 星' }, { value: 'hard', label: '困难 · 4–5 星' },
  { value: 'unknown', label: '未标注难度' },
];
const BOOKMARK_KEY = 'turtle:library-bookmarks';
const PAGE_SIZE = 12;

function LibraryPuzzleCard({ puzzle, saved, busy, onChoose, onDetails, onSave }: {
  puzzle: PuzzleSummary; saved: boolean; busy: boolean;
  onChoose: (id: string) => void; onDetails: (id: string) => void; onSave: (id: string) => void;
}) {
  return <CandyCard className="library-puzzle-card">
    <div className="library-card-content">
      <div className="library-cover-slot">
        <img className="library-cover" src={cdnUrl(puzzleCover(puzzle))} alt="" loading="lazy" width={960} height={640} />
        {puzzle.nsfl && <div className="library-cover-badge"><CandyBadge variant="red">重口慎入</CandyBadge></div>}
      </div>
      <div className="library-card-heading">
        <h3>{puzzle.title}</h3>
        <CandyIconButton variant={saved ? 'yellow' : 'ghost'} appearance={saved ? 'solid' : 'soft'} size="xs"
          aria-label={`${saved ? '取消收藏' : '收藏'}：${puzzle.title}`} aria-pressed={saved}
          onClick={() => onSave(puzzle.id)} icon={<CandyGameIcon name="bookmark" size={18} />} />
      </div>
      <div className="library-card-tags">
        <CandyBadge variant={puzzle.difficulty === null ? 'gray' : puzzle.difficulty <= 2 ? 'green' : puzzle.difficulty === 3 ? 'yellow' : 'red'} size="sm">{difficultyLabel(puzzle)}</CandyBadge>
        <CandyBadge variant="blue" size="sm">{puzzle.tags[0] || '情境推理'}</CandyBadge>
      </div>
      <p className="library-card-preview">{puzzle.surfacePreview}</p>
      <div className="library-card-stats"><span><CandyGameIcon name="user-group" size={16} /> {Math.max(puzzle.plays, puzzle.ratings).toLocaleString('zh-CN')} 次挑战</span><span>{puzzle.ratings && (puzzle.goodRate ?? 0) > 0 ? `${Math.round((puzzle.goodRate ?? 0) * 100)}% 好评` : puzzle.ratings ? `${puzzle.ratings} 人已评` : '待评价'}</span></div>
      <div className="library-card-actions">
        <CandyButton variant="yellow" size="xs" fullWidth disabled={busy} onClick={() => onChoose(puzzle.id)} leftIcon={<CandyGameIcon name="play" size={15} />}>开始挑战</CandyButton>
        <CandyButton variant="blue" appearance="outline" size="xs" fullWidth onClick={() => onDetails(puzzle.id)}>查看详情</CandyButton>
      </div>
    </div>
  </CandyCard>;
}

export function LibraryBrowser({ onChoose, onBack, busy = false }: {
  onChoose: (id: string) => void; onBack: () => void; busy?: boolean;
}) {
  const [sort, setSort] = useState<SortKey>('new');
  const [q, setQ] = useState('');
  const [excludeNsfl, setExcludeNsfl] = useState(true);
  const [category, setCategory] = useState<LibraryCategory>('all');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PuzzlePublic | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(BOOKMARK_KEY) || '[]');
      if (Array.isArray(value)) setSaved(value.filter((id): id is string => typeof id === 'string'));
    } catch { /* Corrupt or unavailable browser storage must not block the library. */ }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const items: PuzzleSummary[] = [];
          // Fetch all public summaries before local filters, so difficulty counts aren't page-limited.
          for (let offset = 0; !controller.signal.aborted; offset += 200) {
            const batch = await api.puzzles({ sort, q: q.trim(), excludeNsfl, limit: 200, offset }, controller.signal);
            if (controller.signal.aborted) return;
            items.push(...batch);
            if (batch.length < 200) break;
          }
          if (!controller.signal.aborted) setPuzzles(items);
        } catch (err) {
          if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '加载题库失败');
        } finally { if (!controller.signal.aborted) setLoading(false); }
      })();
    }, 150);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [sort, q, excludeNsfl, refresh]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [sort, q, excludeNsfl, category, difficulty, savedOnly]);
  useEffect(() => {
    let cancelled = false;
    setDetail(null); setDetailError(null);
    if (detailId) void api.puzzle(detailId).then(value => { if (!cancelled) setDetail(value); })
      .catch(err => { if (!cancelled) setDetailError(err instanceof Error ? err.message : '加载详情失败'); });
    return () => { cancelled = true; };
  }, [detailId]);

  const filtered = useMemo(() => puzzles.filter(puzzle => matchesCategory(puzzle, category)
    && matchesDifficulty(puzzle, difficulty) && (!savedOnly || saved.includes(puzzle.id))), [puzzles, category, difficulty, savedOnly, saved]);
  const recommended = pickRecommendation(filtered);
  const toggleSave = (id: string) => {
    const next = saved.includes(id) ? saved.filter(item => item !== id) : [...saved, id];
    setSaved(next);
    try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next)); }
    catch { notify('浏览器未允许保存收藏，本次页面内仍可使用。'); }
  };
  const reset = () => { setQ(''); setSort('new'); setExcludeNsfl(true); setCategory('all'); setDifficulty('all'); setSavedOnly(false); };

  return <PageContainer className="library-main" scroll={false}>
    <div className="library-ribbon-slot"><CandyRibbon color="blue">题库挑战</CandyRibbon></div>
    <CandyPanel theme="frosted" className="library-shell">
      <header className="library-topline">
        <div><p className="library-eyebrow">TURTLE SOUP · 每个故事，都藏着另一种可能</p><h1 className="sr-only">题库挑战</h1></div>
        <CandyButton variant="ghost" size="xs" onClick={onBack} leftIcon={<CandyGameIcon name="house" size={18} />}>返回首页</CandyButton>
      </header>
      <div className="library-layout">
        <aside className="library-filters" aria-label="筛选条件">
          <CandyPanel theme="frosted">
            <h2 className="library-section-title"><CandyGameIcon name="search" size={24} /> 筛选条件</h2>
            <CandyDivider />
            <fieldset className="library-filter-group"><legend><CandyGameIcon name="star" size={20} /> 难度等级</legend>
              {DIFFICULTIES.map(item => <CandyRadio key={item.value} name="library-difficulty" value={item.value} checked={difficulty === item.value} color="blue" size="sm" onChange={() => setDifficulty(item.value)} label={item.label} />)}
            </fieldset>
            <CandyDivider />
            <fieldset className="library-filter-group"><legend><CandyGameIcon name="bookmark" size={20} /> 我的题单</legend>
              <CandyCheckbox size="sm" checked={savedOnly} onChange={setSavedOnly} label="只看已收藏" color="blue" />
              <small>收藏保存在当前浏览器</small>
            </fieldset>
            <CandyDivider />
            <fieldset className="library-filter-group"><legend><CandyGameIcon name="settings" size={20} /> 内容偏好</legend>
              <CandyCheckbox size="sm" checked={excludeNsfl} onChange={setExcludeNsfl} label="排除重口" color="blue" />
              <small>部分题目包含恐怖、暴力或敏感情节</small>
            </fieldset>
            <CandyButton className="library-reset" variant="gray" appearance="outline" size="sm" onClick={reset} leftIcon={<CandyGameIcon name="refresh" size={18} />}>重置筛选</CandyButton>
          </CandyPanel>
          <div className="library-filter-tip"><img src={cdnUrl('/assets/turtle-think.png')} alt="" width={64} height={64} /><p>别急着相信第一眼。<br />从反常之处开始提问。</p></div>
        </aside>
        <section className="library-results" aria-label="题库列表" aria-busy={loading || busy}>
          <div className="library-toolbar">
            <CandyInput aria-label="搜索题目" placeholder="搜索题目名称、关键词或汤面内容…" value={q} leftIcon={<CandyGameIcon name="search" size={22} />} onChange={e => setQ(e.target.value)} />
            <div className="library-sort"><span>排序方式</span><CandySelect size="sm" aria-label="题库排序" options={SORT_OPTIONS} value={sort} onChange={value => setSort(value as SortKey)} /></div>
          </div>
          <div className="library-categories" role="group" aria-label="题目分类">
            {LIBRARY_CATEGORIES.map(item => <CandyButton key={item.id} size="xs" fullWidth variant={category === item.id ? 'yellow' : 'blue'} appearance={category === item.id ? 'solid' : 'soft'} aria-pressed={category === item.id} leftIcon={<CandyGameIcon name={item.icon} size={16} />} onClick={() => setCategory(item.id)}>{item.label}</CandyButton>)}
          </div>
          <div className="library-results-meta" role="status"><span>{loading ? '正在寻找好故事…' : error ? '题库暂时无法加载' : `找到 ${filtered.length} 道题目`}</span><span>只展示汤面，不剧透真相</span></div>
          <div className="library-results-scroll">
          {error ? <CandyAlert tone="error" title="加载失败" action={<CandyButton size="xs" onClick={() => setRefresh(value => value + 1)}>重试</CandyButton>}>{error}</CandyAlert>
            : loading ? <div className="library-card-grid">{Array.from({ length: 6 }, (_, i) => <CandyCard key={i}><CandySkeleton height={148} /><div className="library-skeleton-copy"><CandySkeleton lines={3} /></div></CandyCard>)}</div>
            : filtered.length ? <div className="library-card-grid">{filtered.slice(0, visibleCount).map(puzzle => <LibraryPuzzleCard key={puzzle.id} puzzle={puzzle} saved={saved.includes(puzzle.id)} busy={busy} onChoose={onChoose} onDetails={setDetailId} onSave={toggleSave} />)}</div>
            : <CandyEmptyState title="未找到题目" description="试试其他关键词、分类或难度；也可以重置筛选。" icon={<CandyGameIcon name="search" size={40} />} action={<CandyButton size="sm" onClick={reset}>重置筛选</CandyButton>} />}
          {!loading && !error && visibleCount < filtered.length && <div className="library-load-more"><CandyButton variant="blue" appearance="outline" size="sm" onClick={() => setVisibleCount(value => value + PAGE_SIZE)}>加载更多故事（还有 {Math.max(0, filtered.length - visibleCount)} 道）</CandyButton></div>}
          </div>
        </section>
        <aside className="library-recommendation" aria-label="推荐题目">
          <CandyPanel theme="frosted">
            <h2 className="library-section-title"><CandyGameIcon name="star" size={24} /> 今日探索</h2>
            {loading ? <CandySkeleton height={240} /> : !error && recommended ? <>
              <img className="library-recommendation-cover" src={cdnUrl(puzzleCover(recommended))} alt="" width={960} height={640} />
              <div className="library-recommendation-heading"><CandyBadge variant="yellow" size="sm">{recommended.ratings ? '玩家好评优先' : recommended.plays ? '热门挑战' : '不妨从这题开始'}</CandyBadge><h3>{recommended.title}</h3></div>
              <div className="library-card-tags"><CandyBadge variant="purple">{difficultyLabel(recommended)}</CandyBadge><span>{recommended.plays.toLocaleString('zh-CN')} 次挑战</span></div>
              <p className="library-recommendation-story">{recommended.surfacePreview}</p>
              <div className="library-recommendation-actions"><CandyButton variant="yellow" size="sm" disabled={busy} onClick={() => onChoose(recommended.id)} leftIcon={<CandyGameIcon name="play" size={22} />}>立即挑战</CandyButton><CandyButton variant="gray" appearance="outline" size="sm" onClick={() => setDetailId(recommended.id)}>查看详情</CandyButton></div>
            </> : <p className="library-recommendation-story">调整筛选，发现下一碗好汤。</p>}
          </CandyPanel>
          <CandyPanel theme="frosted" className="library-howto"><h3>一碗汤，怎么玩？</h3><p><strong>读汤面</strong> · 寻找不合理的细节</p><p><strong>问是非</strong> · 和朋友拼出线索</p><p><strong>还原真相</strong> · 揭开故事的另一面</p></CandyPanel>
        </aside>
      </div>
    </CandyPanel>
    {detailId && <CandyModal isOpen title={detail?.title || '题目详情'} onClose={() => setDetailId(null)}>
      {detailError ? <CandyAlert tone="error">{detailError}</CandyAlert> : !detail ? <CandySkeleton lines={4} /> : <ContentWarning warning={detail.nsfl} id={detail.id}>
        <img className="library-detail-cover" src={cdnUrl(puzzleCover({ title: detail.title, surfacePreview: detail.surface.slice(0, 60) }))} alt="" width={960} height={640} />
        <div className="library-detail-meta">
          <CandyBadge variant={detail.difficulty === null ? 'gray' : detail.difficulty <= 2 ? 'green' : detail.difficulty === 3 ? 'yellow' : 'red'}>{difficultyLabel(detail)}</CandyBadge>
          <CandyBadge variant="blue">{detail.tags[0] || '情境推理'}</CandyBadge>
          <span>{detail.hintCount} 条提示 · 开局后由房主公开</span>
        </div>
        <p className="story-body">{detail.surface}</p>
        <p className="library-detail-note">这里只展示汤面，真相将在游戏结束后揭晓。</p>
        <div className="library-detail-actions"><CandyButton variant="yellow" size="sm" disabled={busy} onClick={() => onChoose(detail.id)} leftIcon={<CandyGameIcon name="play" size={18} />}>用这题开房</CandyButton><CandyButton variant="gray" appearance="outline" size="sm" onClick={() => setDetailId(null)}>返回题库</CandyButton></div>
      </ContentWarning>}
    </CandyModal>}
  </PageContainer>;
}
