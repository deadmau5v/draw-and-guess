import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CandyAlert, CandyAvatar, CandyBadge, CandyButton, CandyEmptyState, CandyGameIcon, CandyList, CandyListItem, CandySpinner } from 'candy-ui';
import type { LeaderboardEntry, LeaderboardResponse } from '@shared/protocol';
import { api } from './api';
import { cdnUrl } from './cdn';

function statistics(entry: LeaderboardEntry) {
  return `提问 ${entry.questions} 次 · 最佳接近度 ${entry.bestProximity} / 100`;
}

export default function Leaderboard() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setError(null);
    let playerKey: string | undefined;
    try { playerKey = localStorage.getItem('turtle:playerKey') || undefined; }
    catch { /* Viewing the public leaderboard must not require local storage or a new identity. */ }
    const isLatest = () => active.current === controller && !controller.signal.aborted;
    try {
      const result = await api.leaderboard(playerKey, controller.signal);
      if (isLatest()) setData(result);
    } catch (cause) {
      if (isLatest()) setError(cause instanceof Error ? cause.message : '排行榜加载失败，请稍后重试');
    } finally {
      if (isLatest()) setPending(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => { active.current?.abort(); };
  }, [load]);
  const topThree = data?.entries.slice(0, 3) ?? [];
  return <div className="leaderboard-content">
    <div className="leaderboard-intro">
      <CandyBadge variant="yellow"><CandyGameIcon name="trophy" size={16} /> TOP 3</CandyBadge>
      <p>永久积分跨房间累计，不随单局结束清零。</p>
    </div>
    {pending && <div className="leaderboard-loading"><CandySpinner label="加载排行榜…" /></div>}
    {error && <CandyAlert tone="error" title="排行榜加载失败" icon={<CandyGameIcon name="cross" />} action={<CandyButton disabled={pending} onClick={() => { void load(); }}>重试</CandyButton>}>{error}</CandyAlert>}
    {data && (topThree.length ? <CandyList variant="ranked" size="sm" aria-label="永久积分排行榜">
      {topThree.map(entry => <CandyListItem key={`${entry.rank}:${entry.name}`} rank={entry.rank}
        leading={<CandyAvatar src={cdnUrl(entry.avatar)} size="sm" alt={`${entry.name}的头像`} />}
        title={<span className="leaderboard-player-name" title={entry.name}>{entry.name}{entry.rank === data.self?.rank && <CandyBadge variant="blue" size="sm">我</CandyBadge>}</span>}
        description={<span className="leaderboard-statistics" title={statistics(entry)}><span>提问 {entry.questions} 次</span><span> · </span><span>最佳接近度 {entry.bestProximity} / 100</span></span>}
        trailing={<CandyBadge variant="yellow" size="sm">{entry.points} 积分</CandyBadge>} />)}
    </CandyList> : <CandyEmptyState title="暂无积分记录" description="完成有效提问后，真实战绩会显示在这里。" icon={<CandyGameIcon name="trophy" size={40} />} />)}
    {data?.self && <section aria-label="我的战绩">
      <CandyList variant="card" size="sm">
        <CandyListItem highlight leading={<CandyGameIcon name="trophy" size={24} />}
          title={`我的排名：第 ${data.self.rank} 名`} description={<span title={statistics(data.self)}>{statistics(data.self)}</span>}
          trailing={<CandyBadge variant="blue" size="sm">{data.self.points} 积分</CandyBadge>} />
      </CandyList>
    </section>}
    <footer className="leaderboard-rules">
      <p>每次提问评估接近度 0–100，换算为 0–10 积分。判题失败或不确定不计分。</p>
      <p>同一题目、同一身份，规范化后相同的问题只奖励一次，防止重复刷分。</p>
    </footer>
  </div>;
}
