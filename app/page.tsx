'use client';

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useGameRouter } from './gameNavigation';
import { api } from '../web/src/api';
import { notify } from '../web/src/store';
import { getOrCreatePlayerKey } from '../web/src/playerKey';
import { extraAvatars } from '../web/src/avatars';
import { cdnUrl } from '../web/src/cdn';
import { PageContainer, SectionLoading } from '../web/src/PageContainer';
import HeaderDialogs from '../web/src/HeaderDialogs';
import { DETECTIVE_QUIPS, emitFloatingText, playJuiceSound } from '../web/src/juice';
import {
  CandyAvatar, CandyBadge, CandyButton, CandyCard, CandyGameIcon,
  CandyIconButton, CandyInput, CandyModal, CandyPanel, CandyRibbon,
  CandySelect, CandyPagination, CandyList, CandyListItem,
  triggerCandyConfetti,
} from 'candy-ui';

const RoomLobbyModal = lazy(() => import('../web/src/RoomLobbyModal'));

const roomCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const avatars = ['smile', 'corgi', 'anime', 'panda', 'burger', 'astronaut', 'fox', 'gamer', 'ghost', 'robot', 'witch'];
const avatarNames = ['活力笑脸', '侦探柯基', '炫彩少年', '呆萌熊猫', '汉堡超人', '宇航员', '侦探狐狸', '电竞少女', '萌趣幽灵', '智能机器', '见习魔女'];
const randomNames = ['推理小海龟', '迷雾名侦探', '机智小汤圆', '真相追踪者', '清汤名捕', '深海福尔摩斯'];
const avatarOptions = [
  ...avatars.map((id, i) => ({ id, name: avatarNames[i], src: `/assets/avatars/player-${id}.png`, category: '常用形象' })),
  ...extraAvatars,
];

export default function HomePage() {
  const router = useGameRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<string | number>('classic');
  const [difficulty, setDifficulty] = useState<string | number>('medium');
  const [busy, setBusy] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState('/assets/avatars/player-panda.png');
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarCategory, setAvatarCategory] = useState('常用形象');
  const [avatarPage, setAvatarPage] = useState(1);
  const categoryAvatars = avatarOptions.filter(option => option.category === avatarCategory);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [mascotPokes, setMascotPokes] = useState(0);
  const [mascotBouncing, setMascotBouncing] = useState(false);
  useEffect(() => {
    try {
      setName(localStorage.getItem('turtle:name') || '');
      const savedMode = localStorage.getItem('turtle:preferredMode');
      if (savedMode && ['classic', 'free', 'turns'].includes(savedMode)) setMode(savedMode);
      const savedDiff = localStorage.getItem('turtle:preferredDifficulty');
      if (savedDiff && ['all', 'easy', 'medium', 'hard'].includes(savedDiff)) setDifficulty(savedDiff);
      const saved = localStorage.getItem('turtle:avatar') || 'turtle';
      const preset = avatarOptions.find(option => saved === option.id || saved === option.src || saved === `/assets/avatars/${option.id}.png`);
      const avatar = preset?.src || '/assets/avatars/player-panda.png';
      setSelectedAvatar(avatar);
      if (!preset) {
        localStorage.setItem('turtle:avatar', avatar);
        window.dispatchEvent(new Event('turtle:profile'));
      }
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
      localStorage.setItem('turtle:preferredMode', String(mode));
      localStorage.setItem('turtle:preferredDifficulty', String(difficulty));
      const playerKey = getOrCreatePlayerKey();
      const res = await api.createRoom({ name: finalName, playerKey });
      router.push(`/room/${res.code}${random ? '?start=random' : ''}`);
    } catch (err) {
      notify(err instanceof Error ? err.message : '创建房间失败');
    } finally { setBusy(false); }
  };
  const join = (roomCode = code) => {
    const clean = roomCode.trim().toUpperCase();
    if (!roomCodePattern.test(clean)) {
      document.getElementById('room-code')?.focus();
      return notify('请输入 6 位有效房间码（不含 0、1、I、O）');
    }
    localStorage.setItem('turtle:name', name.trim() || '推理小海龟');
    router.push(`/room/${clean}`);
  };

  return (
    <PageContainer className="home-main">
      <div className="sr-only">汤面 → 提问 → 是/不是/不相关 → 每人8问 → 还原真相</div>
      <CandyPanel className="game-board-card" theme="frosted" style={{ padding: '28px' }}>
        <section className="board-col-left">
          <CandyRibbon color="blue" className="home-ribbon">快速开始</CandyRibbon>
          <div className="mascot-avatar-wrap">
            <CandyAvatar src={cdnUrl(selectedAvatar)} alt="玩家形象" size="xl" style={{ width: 184, height: 184 }} onEdit={() => setAvatarOpen(true)} editLabel="切换形象" />
          </div>
          <p className="home-welcome">{mascotPokes > 0 ? DETECTIVE_QUIPS[(mascotPokes - 1) % DETECTIVE_QUIPS.length] : '一笔一画皆脑洞，JEV 多模态实时鉴画 + 10 大派对模式等你开局！'}</p>
          <div className="game-form-group">
            <div className="game-form-row">
              <label htmlFor="nickname" className="game-form-label"><CandyGameIcon name="user" size={22} />你的昵称</label>
              <div className="nickname-controls">
                <CandyInput id="nickname" value={name} placeholder="灵魂画手小海龟" size="md" style={{ width: '100%' }}
                  onChange={e => saveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void create(); }} />
                <CandyIconButton aria-label="随机昵称" variant="blue" size="sm" icon={<CandyGameIcon name="change" size={20} />}
                  onClick={event => {
                    const next = randomNames[Math.floor(Math.random() * randomNames.length)];
                    saveName(next);
                    playJuiceSound('mascotPoke');
                    emitFloatingText({ text: `🎲 ${next}`, x: event.clientX || undefined, y: event.clientY || undefined, color: 'blue' });
                  }} />
              </div>
            </div>
            <div className="game-form-row">
              <label htmlFor="game-mode" className="game-form-label"><CandyGameIcon name="controller" size={22} />游戏模式</label>
              <CandySelect id="game-mode" value={mode} onChange={val => { setMode(val); try { localStorage.setItem('turtle:preferredMode', String(val)); } catch {} }} fullWidth color="blue" options={[
                { value: 'classic', label: '经典你画我猜 + JEV 鉴画' }, { value: 'free', label: '自由共绘抢答模式' }, { value: 'turns', label: '轮流画手接力模式' },
              ]} />
            </div>
            <div className="game-form-row">
              <label htmlFor="difficulty-select" className="game-form-label"><CandyGameIcon name="star" size={22} />难度选择</label>
              <CandySelect id="difficulty-select" value={difficulty} onChange={val => { setDifficulty(val); try { localStorage.setItem('turtle:preferredDifficulty', String(val)); } catch {} }} fullWidth color="blue" options={[
                { value: 'all', label: '全部难度' }, { value: 'easy', label: '入门 · 1–2 星' }, { value: 'medium', label: '中等 · 3 星' }, { value: 'hard', label: '烧脑 · 4–5 星' },
              ]} />
            </div>
            <div className="game-form-row">
              <label htmlFor="room-code" className="game-form-label"><CandyGameIcon name="door" size={22} />房间号</label>
              <CandyInput id="room-code" value={code} placeholder="选填：输入 6 位房间码加入" maxLength={6} style={{ width: '100%' }}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={e => { if (e.key === 'Enter') join(); }} />
            </div>
          </div>
          <div className="game-action-buttons">
            <CandyButton variant="yellow" size="xl" shape="pill" fullWidth disabled={busy} onClick={() => join()} aria-label="加入游戏" leftIcon={<CandyGameIcon name="play" size={28} />}><span className="home-action-copy"><strong>加入游戏</strong><small>凭 6 位房间号加入好友</small></span></CandyButton>
            <CandyButton variant="blue" size="xl" shape="pill" fullWidth disabled={busy} onClick={() => void create()} aria-label="创建房间 →" leftIcon={<CandyGameIcon name="plus" size={28} />}><span className="home-action-copy"><strong>创建房间</strong><small>按所选模式与难度开房</small></span></CandyButton>
          </div>
        </section>
        <section className="board-col-right">
          <CandyRibbon color="blue" className="home-ribbon">玩法大厅</CandyRibbon>
          <div className="feature-grid-2x2">
            {([
              { title: '随机开局', description: '随机抽题，立即开局', art: 'create-room', color: 'blue', action: () => void create(true), disabled: busy },
              { title: '房间大厅', description: '发现在线房间，一键加入', art: 'join-room', color: 'yellow', action: () => setLobbyOpen(true) },
              { title: '题库挑战', description: '海量谜题，等你来解', art: 'puzzle-library', color: 'green', action: () => router.push('/library') },
              { title: '排行榜', description: '谁才是真正的推理之王', art: 'leaderboard', color: 'purple', action: () => setLeaderboardOpen(true) },
            ] as const).map(entry => <CandyButton key={entry.title} variant={entry.color} shape="rounded" appearance="soft" className="home-entry" fullWidth disabled={'disabled' in entry && entry.disabled} onClick={entry.action} aria-label={entry.title}>
              <span className="home-entry-content">
                <span className="home-entry-art"><img src={cdnUrl(`/assets/home/${entry.art}.png`)} alt="" className="home-entry-image" /><CandyGameIcon name="arrow-right" size={28} /></span>
                <strong>{entry.title}</strong><span className="home-entry-description">{entry.description}</span>
              </span>
            </CandyButton>)}
          </div>
          <CandyCard className="home-guide" title={<span className="home-guide-title">新手指南<span>三步入门，一起找出真相</span></span>}>
            <div className="home-guide-layout">
              <img
                src={cdnUrl('/assets/turtle-think.png')}
                alt=""
                title="戳一戳海龟侦探"
                className={`home-guide-mascot mascot-fidget-trigger${mascotBouncing ? ' mascot-squish-active' : ''}`}
                onClick={event => {
                  const next = mascotPokes + 1;
                  setMascotPokes(next);
                  setMascotBouncing(true);
                  window.setTimeout(() => setMascotBouncing(false), 360);
                  playJuiceSound('mascotPoke');
                  emitFloatingText({
                    text: next % 5 === 0 ? `🎉 侦探觉悟 ×${next}` : '🐢 推了推眼镜',
                    x: event.clientX || undefined,
                    y: event.clientY || undefined,
                    color: next % 5 === 0 ? 'yellow' : 'green',
                  });
                  if (next % 5 === 0) {
                    try { triggerCandyConfetti({ particleCount: 26, spread: 60, playSound: false }); } catch {}
                  }
                }}
              />
              <ol className="home-guide-steps">
                <li><CandyBadge variant="blue">1</CandyBadge><span><strong>压感速写</strong>：使用压感画笔、油漆桶与几何工具作画，支持显示队友设备（iPad Pencil / 桌面 / 手机）。</span></li>
                <li><CandyBadge variant="blue">2</CandyBadge><span><strong>10大派对模式</strong>：涵盖经典猜词、妙笔生谎 Drawful、猜拆画画抓内鬼、妙笔神猜、怪兽目击与传声筒5变体。</span></li>
                <li><CandyBadge variant="blue">3</CandyBadge><span><strong>JEV 多模态裁判</strong>：AI 既能直接看画点评传神度，也能智能判定同义词与谐音答案！</span></li>
              </ol>
            </div>
          </CandyCard>
        </section>
      </CandyPanel>
      {lobbyOpen && <Suspense fallback={<CandyModal isOpen onClose={() => setLobbyOpen(false)} title="房间大厅" titleStyle="ribbon" ribbonColor="blue"><SectionLoading label="正在寻找房间…" skeleton /></CandyModal>}>
        <RoomLobbyModal onClose={() => setLobbyOpen(false)} onJoin={join} onCreate={() => { setLobbyOpen(false); void create(); }} />
      </Suspense>}
      {avatarOpen && <CandyModal isOpen={avatarOpen} onClose={() => setAvatarOpen(false)} title="选择专属形象" titleStyle="ribbon" ribbonColor="blue">
        <div className="avatar-categories" aria-label="头像分类">
          {['常用形象', '职业幻想', '萌趣潮玩'].map(category => <CandyButton key={category} size="sm" shape="rounded" variant={avatarCategory === category ? 'blue' : 'gray'} appearance={avatarCategory === category ? 'solid' : 'outline'} aria-pressed={avatarCategory === category} onClick={() => { setAvatarCategory(category); setAvatarPage(1); }}>{category}</CandyButton>)}
        </div>
        <div className="avatar-grid">
          {categoryAvatars.slice((avatarPage - 1) * 6, avatarPage * 6).map(({ id, name: avatarName, src }) => {
            return <CandyButton key={id} className="avatar-option" shape="rounded" variant={selectedAvatar === src ? 'blue' : 'gray'} appearance={selectedAvatar === src ? 'soft' : 'outline'} aria-pressed={selectedAvatar === src} aria-label={avatarName}
              onClick={() => { setSelectedAvatar(src); localStorage.setItem('turtle:avatar', src); window.dispatchEvent(new Event('turtle:profile')); setAvatarOpen(false); }}>
              <span className="avatar-choice"><CandyAvatar src={cdnUrl(src)} size="md" />{avatarName}</span>
            </CandyButton>;
          })}
        </div>
        <div className="avatar-pagination"><CandyPagination page={avatarPage} totalPages={Math.ceil(categoryAvatars.length / 6)} onPageChange={setAvatarPage} size="sm" /></div>
      </CandyModal>}
      {leaderboardOpen && <HeaderDialogs kind="leaderboard" onClose={() => setLeaderboardOpen(false)} />}
    </PageContainer>
  );
}

