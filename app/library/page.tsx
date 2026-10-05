'use client';

import React, { useEffect, useState } from 'react';
import { useGameRouter } from '../gameNavigation';
import type { PuzzleSummary, SortKey } from '@shared/protocol';
import { api } from '../../web/src/api';
import { notify } from '../../web/src/store';
import { CandyButton, CandyCheckbox, CandyInput, CandyPanel, CandyModal, CandyEmptyState, CandyGameIcon } from 'candy-ui';
import { usePageLoading } from '../../web/src/loading';
import { PuzzleCard } from '../../web/src/components';

export default function LibraryPage() {
  const router = useGameRouter();
  const [sort, setSort] = useState<SortKey>('new');
  const [q, setQ] = useState('');
  const [excludeNsfl, setExcludeNsfl] = useState(true);
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [pendingPuzzle, setPendingPuzzle] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  usePageLoading(loading || busy, '正在加载题库…');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.puzzles({ sort, q: q.trim(), excludeNsfl, limit: 60, offset }, controller.signal)
      .then(items => {
        if (controller.signal.aborted) return;
        setPuzzles(prev => offset === 0 ? items : [...prev, ...items]);
        setHasMore(items.length === 60);
      })
      .catch(err => { if (!controller.signal.aborted) notify(err.message || '加载题库失败'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [sort, q, excludeNsfl, offset]);
  const create = async (puzzleId: string, playerName: string) => {
    if (busy || !playerName.trim()) return;
    setBusy(true);
    try {
      localStorage.setItem('turtle:name', playerName.trim());
      let playerKey = localStorage.getItem('turtle:playerKey');
      if (!playerKey) {
        playerKey = `p-${crypto.randomUUID()}`;
        localStorage.setItem('turtle:playerKey', playerKey);
      }
      const res = await api.createRoom({ name: playerName.trim(), playerKey });
      router.push(`/room/${res.code}?start=${encodeURIComponent(puzzleId)}`);
    } catch (err) { notify(err instanceof Error ? err.message : '开房失败'); }
    finally { setBusy(false); }
  };
  const onChoose = (id: string) => {
    const saved = localStorage.getItem('turtle:name') || '';
    if (saved.trim()) void create(id, saved);
    else setPendingPuzzle(id);
  };
  return <main>
    <CandyPanel theme="frosted" className="library-header">
      <div><h1>题库大厅</h1><p>精选经典海龟汤题目，在线联机推理解谜</p></div>
      <CandyButton variant="blue" leftIcon={<CandyGameIcon name="house" size={22} />} onClick={() => router.push('/')}>返回首页</CandyButton>
    </CandyPanel>
    <CandyPanel theme="frosted" className="filter-bar">
      <div role="tablist" aria-label="题库排序" className="actions-row">
        {(['good', 'mid', 'low', 'hot', 'new'] as const).map(key => <CandyButton key={key} role="tab" aria-selected={sort === key} variant={sort === key ? 'blue' : 'ghost'} appearance={sort === key ? 'solid' : 'soft'} size="sm" shape="pill" onClick={() => { setSort(key); setOffset(0); }}>
          {{ good: '高好评', mid: '中好评', low: '低好评', hot: '最热', new: '最新' }[key]}
        </CandyButton>)}
      </div>
      <div className="search-row">
        <CandyInput id="lib-search" aria-label="搜索题目" placeholder="搜索题目" value={q} leftIcon={<CandyGameIcon name="search" size={22} />} onChange={e => { setQ(e.target.value); setOffset(0); }} />
        <CandyCheckbox checked={excludeNsfl} label="排除重口" color="blue" onChange={checked => { setExcludeNsfl(checked); setOffset(0); }} />
      </div>
    </CandyPanel>
    {!loading && puzzles.length === 0 && <CandyEmptyState title="未找到题目" description="试试其他关键词或调整筛选条件。" icon={<CandyGameIcon name="search" size={40} />} />}
    <section className="puzzles-grid">{puzzles.map(puzzle => <PuzzleCard key={puzzle.id} puzzle={puzzle} onChoose={onChoose} />)}</section>
    {hasMore && <CandyButton className="load-more" variant="blue" loading={loading} onClick={() => setOffset(prev => prev + 60)}>加载更多</CandyButton>}
    {pendingPuzzle !== null && <CandyModal isOpen={pendingPuzzle !== null} onClose={() => setPendingPuzzle(null)} title="填写侦探昵称">
      <CandyInput aria-label="侦探昵称" placeholder="请输入昵称" value={name} onChange={e => setName(e.target.value)} />
      <div className="actions-row"><CandyButton disabled={!name.trim()} loading={busy} onClick={() => { if (pendingPuzzle) void create(pendingPuzzle, name); }}>开始挑战</CandyButton></div>
    </CandyModal>}
  </main>;
}

