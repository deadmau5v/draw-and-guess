import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CandyAlert, CandyAvatar, CandyBadge, CandyButton, CandyEmptyState, CandyGameIcon, CandyList, CandyListItem, CandySpinner } from 'candy-ui';
import type { LeaderboardEntry, LeaderboardResponse } from '@shared/protocol';
import { api } from './api';
import { cdnUrl } from './cdn';

function statistics(entry: LeaderboardEntry) {
  return `${entry.questions} 个正确回合`;
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setPending(true); setError(null);
    let playerKey: string | undefined;
    try { playerKey = localStorage.getItem('turtle:playerKey') || undefined; } catch {}
    const isLatest = () => active.current === controller && !controller.signal.aborted;
    try {
      const result = await api.leaderboard(playerKey, controller.signal);
      if (isLatest()) setData(result);
    } catch (cause) { if (isLatest()) setError(cause instanceof Error ? cause.message : '排行榜加载失败'); }
    finally { if (isLatest()) setPending(false); }
  }, []);
  useEffect(() => { void load(); return () => { active.current?.abort(); }; }, [load]);
  const entries = data?.entries.slice(0, 3) ?? [];
  return <div className="leaderboard-content">
    {pending && <div className="leaderboard-loading"><CandySpinner label="加载排行榜…" /></div>}
    {error && <CandyAlert tone="error" title="排行榜加载失败" icon={<CandyGameIcon name="cross" />} action={<CandyButton disabled={pending} onClick={() => void load()}>重试</CandyButton>}>{error}</CandyAlert>}
    {data && (entries.length ? <CandyList variant="ranked" size="sm" aria-label="排行榜">
      {entries.map(entry => <CandyListItem key={`${entry.rank}:${entry.name}`} rank={entry.rank}
        leading={<CandyAvatar src={cdnUrl(entry.avatar)} size="sm" alt={`${entry.name}的头像`} />}
        title={<span className="leaderboard-player-name">{entry.name}{entry.rank === data.self?.rank && <CandyBadge variant="blue" size="sm">我</CandyBadge>}</span>}
        description={statistics(entry)} trailing={<CandyBadge variant="yellow" size="sm">{entry.points} 分</CandyBadge>} />)}
    </CandyList> : <CandyEmptyState title="暂无积分记录" description="完成猜词回合后，积分会显示在这里。" icon={<CandyGameIcon name="trophy" size={40} />} />)}
    {data?.self && <section aria-label="我的战绩"><CandyList variant="card" size="sm"><CandyListItem highlight
      leading={<CandyGameIcon name="trophy" size={24} />} title={`我的排名：第 ${data.self.rank} 名`}
      description={statistics(data.self)} trailing={<CandyBadge variant="blue" size="sm">{data.self.points} 分</CandyBadge>} /></CandyList></section>}
    <footer className="leaderboard-rules"><p>积分规则：按房间最大人数（15人）顺位递减，第 1 个猜中 +15 分，第 2 个 +14 分……队友猜对，画手 +5 分。</p></footer>
  </div>;
}
