'use client';

import React, { useEffect, useState } from 'react';
import { useGameRouter } from './gameNavigation';
import { api } from '../web/src/api';
import { notify } from '../web/src/store';
import { extraAvatars } from '../web/src/avatars';
import type { RoomLobbySummary } from '../shared/protocol';
import {
  CandyAvatar, CandyBadge, CandyButton, CandyCard, CandyGameIcon,
  CandyIconButton, CandyInput, CandyModal, CandyPanel, CandyRibbon,
  CandySelect, CandyEmptyState, CandyPagination, CandyList, CandyListItem,
} from 'candy-ui';

const roomCodePattern = /^[A-Z0-9]{6}$/;
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
  const [lobbyRooms, setLobbyRooms] = useState<RoomLobbySummary[]>([]);
  const [lobbyLoading, setLobbyLoading] = useState(false);
  const [lobbyError, setLobbyError] = useState('');
  const [lobbyPage, setLobbyPage] = useState(1);
  const loadLobby = async () => {
    setLobbyLoading(true);
    setLobbyError('');
    try { setLobbyRooms(await api.rooms()); setLobbyPage(1); }
    catch (error) { setLobbyError(error instanceof Error ? error.message : '房间加载失败'); }
    finally { setLobbyLoading(false); }
  };
  useEffect(() => {
    try {
      setName(localStorage.getItem('turtle:name') || '');
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
  const join = (roomCode = code) => {
    const clean = roomCode.trim().toUpperCase();
    if (!roomCodePattern.test(clean)) {
      document.getElementById('room-code')?.focus();
      return notify('请输入 6 位有效房间码');
    }
    localStorage.setItem('turtle:name', name.trim() || '推理小海龟');
    router.push(`/room/${clean}`);
  };

  return (
    <main className="game-main-content home-main">
      <div className="sr-only">汤面 → 提问 → 是/不是/不相关 → 每人8问 → 还原真相</div>
      <CandyPanel className="game-board-card" theme="frosted" style={{ padding: '28px' }}>
        <section className="board-col-left">
          <CandyRibbon color="blue" className="home-ribbon">快速开始</CandyRibbon>
          <div className="mascot-avatar-wrap">
            <CandyAvatar src={selectedAvatar} alt="玩家形象" size="xl" style={{ width: 184, height: 184 }} onEdit={() => setAvatarOpen(true)} editLabel="切换形象" />
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
              <CandyInput id="room-code" value={code} placeholder="输入 6 位房间号" maxLength={6} style={{ width: '100%' }}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))} onKeyDown={e => { if (e.key === 'Enter') join(); }} />
            </div>
          </div>
          <div className="game-action-buttons">
            <CandyButton variant="yellow" size="xl" shape="pill" fullWidth disabled={busy} onClick={() => join()} aria-label="加入游戏" leftIcon={<CandyGameIcon name="play" size={28} />}><span className="home-action-copy"><strong>加入游戏</strong><small>输入房间号，和好友一起玩</small></span></CandyButton>
            <CandyButton variant="blue" size="xl" shape="pill" fullWidth disabled={busy} onClick={() => void create()} aria-label="创建房间 →" leftIcon={<CandyGameIcon name="plus" size={28} />}><span className="home-action-copy"><strong>创建房间</strong><small>邀请好友一起推理</small></span></CandyButton>
          </div>
        </section>
        <section className="board-col-right">
          <CandyRibbon color="blue" className="home-ribbon">进入游戏</CandyRibbon>
          <div className="feature-grid-2x2">
            {([
              { title: '创建房间', description: '自定义规则，邀请好友', art: 'create-room', color: 'blue', action: () => void create(), disabled: busy },
              { title: '房间大厅', description: '发现在线房间，一键加入', art: 'join-room', color: 'yellow', action: () => { setLobbyOpen(true); void loadLobby(); } },
              { title: '题库挑战', description: '海量谜题，等你来解', art: 'puzzle-library', color: 'green', action: () => router.push('/library') },
              { title: '排行榜', description: '谁才是真正的推理之王', art: 'leaderboard', color: 'purple', action: () => setLeaderboardOpen(true) },
            ] as const).map(entry => <CandyButton key={entry.title} variant={entry.color} shape="rounded" appearance="soft" className="home-entry" fullWidth disabled={'disabled' in entry && entry.disabled} onClick={entry.action} aria-label={entry.title}>
              <span className="home-entry-content">
                <span className="home-entry-art"><img src={`/assets/home/${entry.art}.png`} alt="" className="home-entry-image" /><CandyGameIcon name="arrow-right" size={28} /></span>
                <strong>{entry.title}</strong><span className="home-entry-description">{entry.description}</span>
              </span>
            </CandyButton>)}
          </div>
          <CandyCard className="home-guide" title={<span className="home-guide-title">新手规则<span>三步入门，一起找出真相</span></span>}>
            <div className="home-guide-layout">
              <img src="/assets/turtle-think.png" alt="" className="home-guide-mascot" />
              <ol className="home-guide-steps">
                <li><CandyBadge variant="blue">1</CandyBadge><span><strong>阅读汤面</strong>，发现故事里的反常之处。</span></li>
                <li><CandyBadge variant="blue">2</CandyBadge><span><strong>提出问题</strong>，收集「是 / 不是 / 不相关」的线索。</span></li>
                <li><CandyBadge variant="blue">3</CandyBadge><span><strong>还原真相</strong>，串起线索，猜出完整故事！</span></li>
              </ol>
            </div>
          </CandyCard>
        </section>
      </CandyPanel>
      {lobbyOpen && <CandyModal isOpen={lobbyOpen} onClose={() => setLobbyOpen(false)} title="房间大厅" titleStyle="ribbon" ribbonColor="blue">
        <div className="lobby-toolbar"><span>选择一个在线房间，加入推理</span><CandyButton size="sm" variant="blue" loading={lobbyLoading} onClick={() => void loadLobby()} leftIcon={<CandyGameIcon name="change" size={18} />}>刷新</CandyButton></div>
        {lobbyLoading ? <CandyEmptyState title="正在寻找房间…" /> : lobbyError ? <CandyEmptyState title="房间加载失败" description={lobbyError} /> : !lobbyRooms.length ? <CandyEmptyState title="暂时没有可加入的房间" description="可以创建房间邀请好友，或输入好友的房间号加入。" icon={<CandyGameIcon name="users" size={40} />} /> : <>
          <CandyList>
            {lobbyRooms.slice((lobbyPage - 1) * 6, lobbyPage * 6).map(room => <CandyListItem key={room.code} title={`${room.hostName}的房间 · ${room.code}`} description={`${room.players}/${room.maxPlayers} 人 · ${room.phase === 'lobby' ? '等待开局' : '推理中'}`} trailing={<CandyButton size="sm" variant="yellow" aria-label={`加入房间 ${room.code}`} onClick={() => join(room.code)}>加入</CandyButton>} />)}
          </CandyList>
          {lobbyRooms.length > 6 && <div className="avatar-pagination"><CandyPagination page={lobbyPage} totalPages={Math.ceil(lobbyRooms.length / 6)} onPageChange={setLobbyPage} size="sm" /></div>}
        </>}
      </CandyModal>}
      {avatarOpen && <CandyModal isOpen={avatarOpen} onClose={() => setAvatarOpen(false)} title="选择专属形象" titleStyle="ribbon" ribbonColor="blue">
        <div className="avatar-categories" aria-label="头像分类">
          {['常用形象', '职业幻想', '萌趣潮玩'].map(category => <CandyButton key={category} size="sm" shape="rounded" variant={avatarCategory === category ? 'blue' : 'cream'} aria-pressed={avatarCategory === category} onClick={() => { setAvatarCategory(category); setAvatarPage(1); }}>{category}</CandyButton>)}
        </div>
        <div className="avatar-grid">
          {categoryAvatars.slice((avatarPage - 1) * 6, avatarPage * 6).map(({ id, name: avatarName, src }) => {
            return <CandyButton key={id} className="avatar-option" shape="rounded" variant={selectedAvatar === src ? 'blue' : 'ghost'} appearance="soft" aria-pressed={selectedAvatar === src} aria-label={avatarName}
              onClick={() => { setSelectedAvatar(src); localStorage.setItem('turtle:avatar', src); window.dispatchEvent(new Event('turtle:profile')); setAvatarOpen(false); }}>
              <span className="avatar-choice"><CandyAvatar src={src} size="md" />{avatarName}</span>
            </CandyButton>;
          })}
        </div>
        <div className="avatar-pagination"><CandyPagination page={avatarPage} totalPages={Math.ceil(categoryAvatars.length / 6)} onPageChange={setAvatarPage} size="sm" /></div>
      </CandyModal>}
      {leaderboardOpen && <CandyModal isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} title="推理排行榜" titleStyle="ribbon" ribbonColor="gold">
        <CandyEmptyState title="排行榜暂未开放" description="战绩榜单接入后将在这里展示，当前不展示模拟排名。" icon={<CandyGameIcon name="trophy" size={40} />} />
      </CandyModal>}
    </main>
  );
}

