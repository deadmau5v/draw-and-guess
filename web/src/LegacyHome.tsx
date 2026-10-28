'use client';

import React, { useState } from 'react';
import { CandyBadge, CandyButton, CandyCard, CandyGameIcon, CandyInput, CandyList, CandyListItem, CandyPanel } from 'candy-ui';
import { PageContainer } from './PageContainer';
import HeaderDialogs from './HeaderDialogs';
import { notify } from './store';

const roomCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/** Shared home view for the Next and compatibility SPA entry points. */
export function Home({ name, onName, onCreate, onJoin, onLibrary = () => { location.hash = '/library'; }, busy = false }: {
  name: string;
  onName: (value: string) => void;
  onCreate: (start?: 'random' | 'chosen') => void;
  onJoin: (code: string) => void;
  onLibrary?: () => void;
  busy?: boolean;
}) {
  const [code, setCode] = useState('');
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const join = () => {
    const clean = code.trim().toUpperCase();
    if (!roomCodePattern.test(clean)) { notify('请输入 6 位有效房间码（不含 0、1、I、O）'); return; }
    onJoin(clean);
  };
  return <PageContainer className="home-main">
    <CandyPanel theme="frosted" className="game-board-card" style={{ padding: 28 }}>
      <section className="board-col-left">
        <h1>你画我猜</h1>
        <p>创建房间，邀请好友一起画画猜词。</p>
        <div className="game-form-group">
          <CandyInput id="nickname" label="你的昵称" value={name} maxLength={16} placeholder="输入昵称"
            onChange={event => onName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && name.trim()) onCreate(); }} />
          <CandyButton variant="blue" size="lg" fullWidth disabled={busy || !name.trim()} onClick={() => onCreate()} leftIcon={<CandyGameIcon name="plus" />}>创建房间</CandyButton>
          <CandyInput id="room-code" label="房间码" value={code} maxLength={6} placeholder="输入 6 位房间码"
            onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={event => { if (event.key === 'Enter' && name.trim()) join(); }} />
          <CandyButton variant="yellow" size="lg" fullWidth disabled={busy || !name.trim()} onClick={join} leftIcon={<CandyGameIcon name="door" />}>加入房间</CandyButton>
        </div>
      </section>
      <section className="board-col-right">
        <CandyCard title="三步开玩">
          <CandyList aria-label="玩法指南">
            {['创建或加入房间，邀请好友。', '轮到画手画词，其他玩家看画猜词。', '回合结束结算得分，再开始下一轮。'].map((step, index) => <CandyListItem key={step} leading={<CandyBadge variant="blue">{index + 1}</CandyBadge>} title={step} />)}
          </CandyList>
        </CandyCard>
        <nav className="actions-row" aria-label="更多">
          <CandyButton variant="blue" appearance="outline" onClick={onLibrary} leftIcon={<CandyGameIcon name="book" />}>词库</CandyButton>
          <CandyButton variant="purple" appearance="outline" onClick={() => setLeaderboardOpen(true)} leftIcon={<CandyGameIcon name="trophy" />}>排行榜</CandyButton>
        </nav>
      </section>
    </CandyPanel>
    {leaderboardOpen && <HeaderDialogs kind="leaderboard" onClose={() => setLeaderboardOpen(false)} />}
  </PageContainer>;
}
