'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../web/src/api';
import { notify } from '../web/src/store';
import {
  CandyAvatar, CandyBadge, CandyButton, CandyCard, CandyGameIcon,
  CandyIconButton, CandyInput, CandyModal, CandyPanel, CandyRibbon,
  CandySelect, CandyEmptyState,
} from 'candy-ui';

const roomCodePattern = /^[A-Z0-9]{6}$/;
const avatars = ['turtle', 'smile', 'corgi', 'anime', 'panda', 'burger', 'astronaut', 'fox', 'gamer', 'ghost', 'robot', 'witch'];
const avatarNames = ['小海龟', '活力笑脸', '侦探柯基', '炫彩少年', '呆萌熊猫', '汉堡超人', '宇航员', '侦探狐狸', '电竞少女', '萌趣幽灵', '智能机器', '见习魔女'];
const randomNames = ['推理小海龟', '迷雾名侦探', '机智小汤圆', '真相追踪者', '清汤名捕', '深海福尔摩斯'];

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<string | number>('classic');
  const [difficulty, setDifficulty] = useState<string | number>('medium');
  const [busy, setBusy] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('/assets/turtle-hero.png');
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  useEffect(() => {
    try {
      setName(localStorage.getItem('turtle:name') || '');
      const saved = localStorage.getItem('turtle:avatar') || 'turtle';
      const preset = avatars.includes(saved) ? saved : avatars.find(id => saved === `/assets/avatars/player-${id}.png` || saved === `/assets/avatars/${id}.png`);
      setSelectedAvatar(!preset ? '/assets/turtle-hero.png' : `/assets/avatars/player-${preset}.png`);
    } catch {}
  }, []);
  const saveName = (value: string) => {
    setName(value);
    localStorage.setItem('turtle:name', value);
    window.dispatchEvent(new Event('turtle:profile'));
  };
  const create = async (random = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const finalName = name.trim() || '推理小海龟';
      localStorage.setItem('turtle:name', finalName);
      let playerKey = localStorage.getItem('turtle:playerKey');
      if (!playerKey) {
        playerKey = `p-${crypto.randomUUID()}`;
        localStorage.setItem('turtle:playerKey', playerKey);
      }
      const res = await api.createRoom({ name: finalName, playerKey });
      router.push(`/room/${res.code}${random ? '?start=random' : ''}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : '创建房间失败');
    } finally { setBusy(false); }
  };
  const join = () => {
    const clean = code.trim().toUpperCase();
    if (!roomCodePattern.test(clean)) return notify('请输入 6 位有效房间码');
    localStorage.setItem('turtle:name', name.trim() || '推理小海龟');
    router.push(`/room/${clean}`);
  };
  const quickStart = () => code.trim() ? join() : void create(true);
  const focusRoomCode = () => {
    document.getElementById('room-code')?.focus();
    notify('输入 6 位房间号即可加入好友的房间');
  };

  return (
    <main className="game-main-content home-main">
      <div className="sr-only">汤面 → 提问 → 是/不是/不相关 → 每人8问 → 还原真相</div>
      <CandyPanel className="game-board-card" theme="frosted" style={{ padding: '28px' }}>
        <section className="board-col-left">
          <CandyRibbon color="blue" className="home-ribbon">快速开始</CandyRibbon>
          <div className="mascot-avatar-wrap">
            <CandyAvatar src={selectedAvatar} alt="海龟汤吉祥物" size="xl" style={{ width: 184, height: 184 }} onEdit={() => setAvatarOpen(true)} editLabel="切换形象" />
          </div>
          <p className="home-welcome">一碗汤，一个谜。今天你能猜出真相吗？</p>
          <div className="game-form-group">
            <div className="game-form-row">
              <label htmlFor="nickname" className="game-form-label"><CandyGameIcon name="user" size={22} />你的昵称</label>
              <div className="nickname-controls">
                <CandyInput id="nickname" value={name} placeholder="推理小海龟" size="md" style={{ width: '100%' }}
                  onChange={e => saveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void create(); }} />
                <CandyIconButton aria-label="随机昵称" variant="blue" size="sm" icon={<CandyGameIcon name="change" size={20} />}
                  onClick={() => saveName(randomNames[Math.floor(Math.random() * randomNames.length)])} />
              </div>
            </div>
            <div className="game-form-row">
              <label htmlFor="game-mode" className="game-form-label"><CandyGameIcon name="controller" size={22} />游戏模式</label>
              <CandySelect id="game-mode" value={mode} onChange={setMode} fullWidth color="blue" options={[
                { value: 'classic', label: '经典海龟汤' }, { value: 'free', label: '自由提问模式' }, { value: 'turns', label: '轮流提问模式' },
              ]} />
            </div>
            <div className="game-form-row">
              <label htmlFor="difficulty-select" className="game-form-label"><CandyGameIcon name="star" size={22} />难度选择</label>
              <CandySelect id="difficulty-select" value={difficulty} onChange={setDifficulty} fullWidth color="blue" options={[
                { value: 'all', label: '全部难度' }, { value: 'easy', label: '入门' }, { value: 'medium', label: '中等' }, { value: 'hard', label: '极度烧脑' },
              ]} />
            </div>
            <div className="game-form-row">
              <label htmlFor="room-code" className="game-form-label"><CandyGameIcon name="house" size={22} />房间号</label>
              <CandyInput id="room-code" value={code} placeholder="留空则自动创建" maxLength={6} style={{ width: '100%' }}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))} onKeyDown={e => { if (e.key === 'Enter') quickStart(); }} />
            </div>
          </div>
          <div className="game-action-buttons">
            <CandyButton variant="yellow" size="xl" shape="pill" fullWidth loading={busy} onClick={quickStart} aria-label="单人随机一碗" leftIcon={<CandyGameIcon name="play" size={28} />}><span className="home-action-copy"><strong>快速开始</strong><small>随机来一碗，马上开玩</small></span></CandyButton>
            <CandyButton variant="blue" size="xl" shape="pill" fullWidth disabled={busy} onClick={() => void create()} aria-label="创建房间 →" leftIcon={<CandyGameIcon name="plus" size={28} />}><span className="home-action-copy"><strong>创建房间</strong><small>邀请好友一起推理</small></span></CandyButton>
          </div>
        </section>
        <section className="board-col-right">
          <CandyRibbon color="blue" className="home-ribbon">进入游戏</CandyRibbon>
          <div className="feature-grid-2x2">
            {([
              { title: '创建房间', description: '自定义规则，邀请好友', icon: 'house', color: 'blue', action: () => void create(), disabled: busy },
              { title: '加入房间', description: '输入房间号，快速加入', icon: 'users', color: 'yellow', action: focusRoomCode },
              { title: '题库挑战', description: '海量谜题，等你来解', icon: 'book', color: 'green', action: () => router.push('/library') },
              { title: '排行榜', description: '谁才是真正的推理之王', icon: 'trophy', color: 'purple', action: () => setLeaderboardOpen(true) },
            ] as const).map(entry => <CandyButton key={entry.title} variant={entry.color} shape="rounded" appearance="soft" className="home-entry" fullWidth disabled={'disabled' in entry && entry.disabled} onClick={entry.action} aria-label={entry.title}>
              <span className="home-entry-content">
                <span className="home-entry-art"><CandyGameIcon name={entry.icon} size={64} /><CandyGameIcon name="arrow-right" size={24} /></span>
                <strong>{entry.title}</strong><span className="home-entry-description">{entry.description}</span>
              </span>
            </CandyButton>)}
          </div>
          <CandyCard className="home-guide">
            <div className="home-guide-layout">
              <img src="/assets/turtle-think.png" alt="" className="home-guide-mascot" />
              <div><h2>第一次喝汤？</h2><p className="home-guide-subtitle">三步入门，开启你的侦探时刻</p>
                <ol className="home-guide-steps">
                  <li><CandyBadge variant="blue">1</CandyBadge><span><strong>读汤面</strong>，发现故事里的反常之处。</span></li>
                  <li><CandyBadge variant="blue">2</CandyBadge><span><strong>问问题</strong>，收集「是 / 不是 / 不相关」的线索。</span></li>
                  <li><CandyBadge variant="blue">3</CandyBadge><span><strong>猜真相</strong>，串起线索，还原完整故事！</span></li>
                </ol>
              </div>
            </div>
          </CandyCard>
        </section>
      </CandyPanel>
      {avatarOpen && <CandyModal isOpen={avatarOpen} onClose={() => setAvatarOpen(false)} title="选择专属形象" titleStyle="ribbon" ribbonColor="blue">
        <div className="avatar-grid">
          {avatars.map((id, i) => {
            const src = `/assets/avatars/player-${id}.png`;
            return <CandyButton key={id} className="avatar-option" shape="rounded" variant={selectedAvatar === src ? 'blue' : 'ghost'} appearance="soft" aria-pressed={selectedAvatar === src} aria-label={avatarNames[i]}
              onClick={() => { setSelectedAvatar(src); localStorage.setItem('turtle:avatar', src); window.dispatchEvent(new Event('turtle:profile')); setAvatarOpen(false); }}>
              <span className="avatar-choice"><CandyAvatar src={src} size="md" />{avatarNames[i]}</span>
            </CandyButton>;
          })}
        </div>
      </CandyModal>}
      {leaderboardOpen && <CandyModal isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} title="推理排行榜" titleStyle="ribbon" ribbonColor="gold">
        <CandyEmptyState title="排行榜暂未开放" description="战绩榜单接入后将在这里展示，当前不展示模拟排名。" icon={<CandyGameIcon name="trophy" size={40} />} />
      </CandyModal>}
    </main>
  );
}
