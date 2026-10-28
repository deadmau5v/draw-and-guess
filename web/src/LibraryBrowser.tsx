'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CandyAlert, CandyBadge, CandyButton, CandyCard, CandyEmptyState, CandyGameIcon, CandyInput, CandyPanel, CandySkeleton } from 'candy-ui';
import type { PuzzleSummary } from '@shared/protocol';
import { PageContainer } from './PageContainer';
import { api } from './api';
import { cdnUrl } from './cdn';
import { LIBRARY_CATEGORIES, difficultyLabel, matchesCategory, puzzleCover } from './library';
import type { LibraryCategory } from './library';

const PAGE_SIZE = 12;

export function LibraryBrowser({ onChoose, onBack, busy = false }: {
  onChoose: (id: string) => void; onBack: () => void; busy?: boolean;
}) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<LibraryCategory>('all');
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    void (async () => {
      try {
        const items: PuzzleSummary[] = [];
        for (let offset = 0; !controller.signal.aborted; offset += 200) {
          const batch = await api.puzzles({ sort: 'new', excludeNsfl: true, limit: 200, offset }, controller.signal);
          if (controller.signal.aborted) return;
          items.push(...batch);
          if (batch.length < 200) break;
        }
        if (!controller.signal.aborted) setPuzzles(items);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '加载词库失败');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [refresh]);
  const filtered = useMemo(() => puzzles.filter(puzzle => matchesCategory(puzzle, category)
    && `${puzzle.title} ${puzzle.tags.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())), [puzzles, category, q]);
  const reset = () => { setQ(''); setCategory('all'); setVisibleCount(PAGE_SIZE); };
  return <PageContainer className="library-main">
    <CandyPanel theme="frosted" className="library-shell">
      <header className="library-topline">
        <div><h1>词库</h1><p>按分类选择词组，创建房间后开始画画猜词。</p></div>
        <CandyButton variant="ghost" size="sm" onClick={onBack} leftIcon={<CandyGameIcon name="house" />}>返回首页</CandyButton>
      </header>
      <CandyInput aria-label="搜索词组" placeholder="搜索词组或分类" value={q} leftIcon={<CandyGameIcon name="search" />} onChange={event => { setQ(event.target.value); setVisibleCount(PAGE_SIZE); }} />
      <nav className="library-categories" aria-label="词组分类">
        {LIBRARY_CATEGORIES.map(item => <CandyButton key={item.id} size="sm" variant={category === item.id ? 'yellow' : 'blue'} appearance={category === item.id ? 'solid' : 'soft'} aria-pressed={category === item.id} leftIcon={<CandyGameIcon name={item.icon} size={18} />} onClick={() => { setCategory(item.id); setVisibleCount(PAGE_SIZE); }}>{item.label}</CandyButton>)}
      </nav>
      <section aria-label="词组列表" aria-busy={loading || busy}>
        <p role="status">{loading ? '正在加载词库…' : error ? '词库暂时无法加载' : `共 ${filtered.length} 组词`}</p>
        {error ? <CandyAlert tone="error" title="加载失败" action={<CandyButton size="sm" onClick={() => setRefresh(value => value + 1)}>重试</CandyButton>}>{error}</CandyAlert>
          : loading ? <CandySkeleton lines={4} />
          : filtered.length ? <div className="library-card-grid">{filtered.slice(0, visibleCount).map(puzzle => <CandyCard key={puzzle.id} className="library-puzzle-card">
            <div className="library-card-content">
              <img className="library-cover" src={cdnUrl(puzzleCover(puzzle))} alt="" loading="lazy" width={960} height={640} />
              <h2>{puzzle.title}</h2>
              <div className="library-card-tags"><CandyBadge variant="blue">{puzzle.tags[0] || '词组'}</CandyBadge><CandyBadge variant="gray">{difficultyLabel(puzzle)}</CandyBadge></div>
              <CandyButton variant="yellow" size="sm" disabled={busy} onClick={() => onChoose(puzzle.id)}>用这组词开房</CandyButton>
            </div>
          </CandyCard>)}</div>
          : <CandyEmptyState title="未找到词组" description="试试其他分类或关键词。" action={<CandyButton onClick={reset}>重置筛选</CandyButton>} />}
        {!loading && !error && visibleCount < filtered.length && <div className="library-load-more"><CandyButton variant="blue" appearance="outline" onClick={() => setVisibleCount(value => value + PAGE_SIZE)}>加载更多词组</CandyButton></div>}
      </section>
    </CandyPanel>
  </PageContainer>;
}
