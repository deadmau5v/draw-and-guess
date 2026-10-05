'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PuzzleSummary, SortKey } from '@shared/protocol';
import { api } from '../../web/src/api';
import { notify } from '../../web/src/store';
import { CandyButton, CandyCheckbox, CandyInput } from 'candy-ui';
import { PuzzleCard } from '../../web/src/components';

export default function LibraryPage() {
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>('new');
  const [q, setQ] = useState('');
  const [excludeNsfl, setExcludeNsfl] = useState(true);
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api.puzzles({ sort, q: q.trim(), excludeNsfl, limit: 60, offset }, controller.signal)
      .then(items => {
        setPuzzles(prev => (offset === 0 ? items : [...prev, ...items]));
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [sort, q, excludeNsfl, offset]);

  const onChoose = async (puzzleId: string) => {
    let name = localStorage.getItem('turtle:name');
    if (!name) {
      name = prompt('请输入你的侦探昵称:');
      if (!name?.trim()) return;
      localStorage.setItem('turtle:name', name.trim());
    }
    let playerKey = localStorage.getItem('turtle:playerKey');
    if (!playerKey) {
      playerKey = `p-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem('turtle:playerKey', playerKey);
    }
    try {
      const res = await api.createRoom({ name: name.trim(), playerKey });
      router.push(`/room/${res.code}?start=${puzzleId}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : '开房失败');
    }
  };

  return (
    <main>
      <div className="library-header">
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>题库大厅</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>精选经典海龟汤题目，在线联机推理解谜</p>
        </div>
        <Link href="/" className="nav-link">返回首页</Link>
      </div>

      <section className="filter-bar">
        <div role="tablist" aria-label="题库排序" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['good', 'mid', 'low', 'hot', 'new'] as const).map(key => {
            const labels: Record<string, string> = { good: '高好评', mid: '中好评', low: '低好评', hot: '最热', new: '最新' };
            const isSelected = sort === key;
            return (
              <CandyButton
                key={key}
                role="tab"
                aria-selected={isSelected}
                variant={isSelected ? 'blue' : 'ghost'}
                appearance={isSelected ? 'solid' : 'soft'}
                size="sm"
                shape="pill"
                onClick={() => {
                  setSort(key);
                  setOffset(0);
                  setPuzzles([]);
                }}
              >
                {labels[key]}
              </CandyButton>
            );
          })}
        </div>

        <div className="search-row" style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginTop: '14px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <label htmlFor="lib-search" style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>搜索题目</label>
            <CandyInput
              id="lib-search"
              placeholder="搜索题目"
              size="md"
              value={q}
              onChange={e => {
                setQ(e.target.value);
                setOffset(0);
              }}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', height: '42px' }}>
            <CandyCheckbox
              checked={excludeNsfl}
              onChange={checked => {
                setExcludeNsfl(checked);
                setOffset(0);
              }}
              label="排除重口"
              color="blue"
            />
          </div>
        </div>
      </section>

      {loading && offset === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>正在加载题库...</p>}

      <section className="puzzles-grid">
        {puzzles.map(puzzle => (
          <PuzzleCard key={puzzle.id} puzzle={puzzle} onChoose={onChoose} />
        ))}
      </section>
    </main>
  );
}
