'use client';

import React, { useEffect, useState } from 'react';
import type { PuzzleSummary, RoomView, Settings } from '@shared/protocol';
import { CandyAlert, CandyBadge, CandyButton, CandyPanel, CandySelect } from 'candy-ui';
import { api } from './api';
import { notify } from './store';
import { PlayerList } from './components';
import { LIBRARY_CATEGORIES, matchesCategory, matchesDifficulty } from './library';
import type { DifficultyFilter, LibraryCategory } from './library';

export function WaitingRoom({ room, selfKey, disabled, onLeave, onInvite, onSettings, onStart, onKick }: {
  room: RoomView; selfKey: string; disabled: boolean;
  onLeave: () => void; onInvite: () => Promise<void>;
  onSettings: (settings: Partial<Settings>) => Promise<unknown>;
  onStart: (id?: string) => Promise<unknown>; onKick: (key: string) => void;
}) {
  const host = room.hostKey === selfKey;
  const [category, setCategory] = useState<LibraryCategory>('all');
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all');
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (!host) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    void (async () => {
      try {
        const items: PuzzleSummary[] = [];
        for (let offset = 0; !controller.signal.aborted; offset += 200) {
          const batch = await api.puzzles({ excludeNsfl: true, limit: 200, offset, sort: 'new' }, controller.signal);
          if (controller.signal.aborted) return;
          items.push(...batch);
          if (batch.length < 200) break;
        }
        if (!controller.signal.aborted) setPuzzles(items);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '加载词库失败'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [host, refresh]);
  const candidates = puzzles.filter(puzzle => matchesCategory(puzzle, category) && matchesDifficulty(puzzle, difficulty));
  const start = async () => {
    if (disabled || !host || pending || loading || error || !candidates.length) return;
    setPending(true);
    try {
      if (room.settings.partyMode !== 'classic') await onSettings({ partyMode: 'classic' });
      const id = candidates[Math.floor(Math.random() * candidates.length)].id;
      await onStart(id);
    } catch (cause) { notify(cause instanceof Error ? cause.message : '开局失败'); }
    finally { setPending(false); }
  };
  return <CandyPanel theme="frosted" className="waiting-board" style={{ padding: 24 }}>
    <section className="waiting-settings">
      <div className="waiting-room-heading"><h1>房间 <CandyBadge variant="blue">{room.code}</CandyBadge></h1><CandyButton variant="ghost" size="sm" onClick={onLeave}>离开房间</CandyButton></div>
      <PlayerList room={room} selfKey={selfKey} disabled={disabled || pending} onKick={onKick} />
    </section>
    <section className="waiting-selection">
      <h2>准备开玩</h2>
      <p>一人画画，其他玩家看画猜词。回合结束后轮换画手。</p>
      {host ? <div className="waiting-form">
        <CandySelect aria-label="词语分类" fullWidth disabled={disabled || pending} value={category} options={LIBRARY_CATEGORIES.map(item => ({ value: item.id, label: item.label }))} onChange={value => setCategory(value as LibraryCategory)} />
        <CandySelect aria-label="词语难度" fullWidth disabled={disabled || pending} value={difficulty} options={[{ value: 'all', label: '全部难度' }, { value: 'easy', label: '简单' }, { value: 'medium', label: '中等' }, { value: 'hard', label: '困难' }]} onChange={value => setDifficulty(value as DifficultyFilter)} />
        {loading ? <p role="status">正在加载词库…</p> : error ? <CandyAlert tone="error" action={<CandyButton size="sm" onClick={() => setRefresh(value => value + 1)}>重试</CandyButton>}>{error}</CandyAlert> : !candidates.length ? <p role="status">这个分类或难度暂无词组，请换一个。</p> : null}
      </div> : <p>等待房主开始游戏。</p>}
      <div className="waiting-actions">
        <CandyButton variant="yellow" size="lg" fullWidth disabled={disabled || !host || pending || loading || !!error || !candidates.length} loading={pending} onClick={() => void start()}>{host ? '开始游戏' : '等待房主开局'}</CandyButton>
        <CandyButton variant="blue" size="lg" fullWidth onClick={() => void onInvite()}>邀请好友</CandyButton>
      </div>
    </section>
  </CandyPanel>;
}
