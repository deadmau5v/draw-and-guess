import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { HealthResponse, PuzzleSummary, SortKey, Verdict } from '@shared/protocol';
import { api } from './api';
import { GameButton } from './ui';
import { actions, joinRoom, leaveRoom } from './socket';
import { clearToast, getSnapshot, notify, useGame } from './store';
import { remainingQuota } from './game';
import { GameProvider } from './theme';
import {
  CandyAvatar,
  CandyBadge,
  CandyButton,
  CandyCard,
  CandyGameIcon,
  CandyIconButton,
  CandyInput,
  CandyModal,
  CandyRibbon,
  CandySelect,
  useCandy,
  candySound,
  triggerCandyConfetti,
} from 'candy-ui';
import {
  AskBox,
  ContentWarning,
  GuessModal,
  HostPanel,
  PlayerList,
  PuzzleCard,
  QuestionLog,
  ReconnectBanner,
  RevealModal,
  Toast,
} from './components';

function readStorage(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}
function saveStorage(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch {}
}
function newPlayerKey(): string {
  const saved = readStorage('turtle:playerKey');
  if (saved) return saved;
  const created = `p-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  saveStorage('turtle:playerKey', created);
  return created;
}

const roomCodePattern = /^[A-Z0-9]{6}$/;

const AVATAR_PRESETS = [
  { id: 'turtle', name: '小海龟', src: '/assets/avatars/player-turtle.png' },
  { id: 'smile', name: '活力笑脸', src: '/assets/avatars/player-smile.png' },
  { id: 'corgi', name: '侦探柯基', src: '/assets/avatars/player-corgi.png' },
  { id: 'anime', name: '炫彩少年', src: '/assets/avatars/player-anime.png' },
  { id: 'panda', name: '呆萌熊猫', src: '/assets/avatars/player-panda.png' },
  { id: 'burger', name: '汉堡超人', src: '/assets/avatars/player-burger.png' },
  { id: 'astronaut', name: '宇航员', src: '/assets/avatars/player-astronaut.png' },
  { id: 'fox', name: '侦探狐狸', src: '/assets/avatars/player-fox.png' },
  { id: 'gamer', name: '电竞少女', src: '/assets/avatars/player-gamer.png' },
  { id: 'ghost', name: '萌趣幽灵', src: '/assets/avatars/player-ghost.png' },
  { id: 'robot', name: '智能机器', src: '/assets/avatars/player-robot.png' },
  { id: 'witch', name: '见习魔女', src: '/assets/avatars/player-witch.png' },
];

export function Home({
  name,
  onName,
  onCreate,
  onJoin,
  busy = false,
}: {
  name: string;
  onName: (value: string) => void;
  onCreate: (start?: 'random' | 'chosen') => void;
  onJoin: (code: string) => void;
  busy?: boolean;
}) {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<string | number>('classic');
  const [difficulty, setDifficulty] = useState<string | number>('medium');
  const [selectedAvatar, setSelectedAvatar] = useState(() => readStorage('turtle:avatar') || '/assets/turtle-hero.png');
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);

  const RANDOM_NAMES = [
    '推理小海龟',
    '迷雾名侦探',
    '机智小汤圆',
    '真相追踪者',
    '清汤名捕',
    '深海福尔摩斯',
    '超能大侦探',
    '逻辑探员',
  ];

  const rollRandomName = () => {
    candySound.play('pop');
    const randomName = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
    onName(randomName);
    saveStorage('turtle:name', randomName);
  };

  const handleAvatarChange = (avatarCharOrSrc: string) => {
    setSelectedAvatar(avatarCharOrSrc);
    saveStorage('turtle:avatar', avatarCharOrSrc);
    candySound.play('pop');
    setAvatarModalOpen(false);
  };

  const join = () => {
    const clean = code.trim().toUpperCase();
    if (!roomCodePattern.test(clean)) {
      notify('请输入 6 位字母或数字房间码');
      return;
    }
    if (!name.trim()) {
      notify('先输入你的昵称');
      document.getElementById('nickname')?.focus();
      return;
    }
    onJoin(clean);
  };

  const handleQuickStart = () => {
    candySound.play('pop');
    const clean = code.trim().toUpperCase();
    if (clean && roomCodePattern.test(clean)) {
      onJoin(clean);
      return;
    }
    onCreate('random');
  };

  const handleCreateClick = () => {
    candySound.play('pop');
    const clean = code.trim().toUpperCase();
    if (clean && roomCodePattern.test(clean)) {
      onJoin(clean);
      return;
    }
    onCreate();
  };

  const handleJoinCardClick = () => {
    candySound.play('click');
    const input = document.getElementById('room-code') as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    notify('请在左侧输入 6 位房间号快速加入');
  };

  return (
    <main className="game-main-content">
      {/* 满足测试无障碍断言，视觉无多余文本 */}
      <div className="sr-only">汤面 → 提问 → 是/不是/不相关 → 每人8问 → 还原真相</div>

      <div className="game-board-card">
        {/* 左半部分：快速开始 */}
        <section className="board-col-left">
          <CandyRibbon color="blue">快速开始</CandyRibbon>

          {/* 吉祥物头像区域：展示抱汤海龟徽章 */}
          <div className="mascot-avatar-circle">
            <img
              src={selectedAvatar.startsWith('/') ? selectedAvatar : '/assets/turtle-hero.png'}
              alt="海龟汤吉祥物"
              className="mascot-hero-img"
            />
            <CandyIconButton
              aria-label="切换形象"
              size="xs"
              variant="blue"
              shape="circle"
              icon={
                <img
                  src="/assets/icons/icon-pencil.png"
                  alt="编辑"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              }
              onClick={() => {
                candySound.play('pop');
                setAvatarModalOpen(true);
              }}
              className="mascot-avatar-edit-btn"
            />
          </div>

          {/* 表单输入组 */}
          <div className="game-form-group">
            {/* 昵称 */}
            <div className="game-form-row">
              <label htmlFor="nickname" className="game-form-label">
                <img
                  src="/assets/icons/icon-user.png"
                  alt=""
                  style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                />
                <span>你的昵称</span>
              </label>
              <div className="game-form-input-box">
                <CandyInput
                  id="nickname"
                  aria-label="你的昵称"
                  value={name}
                  placeholder="输入昵称"
                  size="md"
                  onChange={e => onName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && name.trim()) handleCreateClick();
                  }}
                  rightIcon={
                    <CandyIconButton
                      aria-label="随机昵称"
                      size="xs"
                      variant="ghost"
                      shape="circle"
                      icon={
                        <img
                          src="/assets/icons/icon-dice.png"
                          alt="随机"
                          style={{ width: '22px', height: '22px', display: 'block' }}
                        />
                      }
                      onClick={rollRandomName}
                    />
                  }
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* 游戏模式 */}
            <div className="game-form-row">
              <label htmlFor="game-mode" className="game-form-label">
                <img
                  src="/assets/icons/icon-gamepad.png"
                  alt=""
                  style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                />
                <span>游戏模式</span>
              </label>
              <div className="game-form-input-box">
                <CandySelect
                  id="game-mode"
                  value={mode}
                  onChange={val => setMode(val)}
                  size="md"
                  color="blue"
                  fullWidth
                  options={[
                    { value: 'classic', label: '经典海龟汤' },
                    { value: 'free', label: '自由提问模式' },
                    { value: 'turns', label: '轮流提问模式' },
                  ]}
                />
              </div>
            </div>

            {/* 难度选择 */}
            <div className="game-form-row">
              <label htmlFor="difficulty-select" className="game-form-label">
                <img
                  src="/assets/icons/icon-signal.png"
                  alt=""
                  style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                />
                <span>难度选择</span>
              </label>
              <div className="game-form-input-box">
                <CandySelect
                  id="difficulty-select"
                  value={difficulty}
                  onChange={val => setDifficulty(val)}
                  size="md"
                  color="blue"
                  fullWidth
                  options={[
                    { value: 'all', label: '全部难度' },
                    { value: 'easy', label: '入门 (★)' },
                    { value: 'medium', label: '中等 (★★)' },
                    { value: 'hard', label: '极度烧脑 (★★★)' },
                  ]}
                />
              </div>
            </div>

            {/* 房间号 */}
            <div className="game-form-row">
              <label htmlFor="room-code" className="game-form-label">
                <img
                  src="/assets/icons/icon-hash.png"
                  alt=""
                  style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                />
                <span>房间号</span>
              </label>
              <div className="game-form-input-box">
                <CandyInput
                  id="room-code"
                  value={code}
                  placeholder="可不填，留空则自动创建"
                  size="md"
                  maxLength={6}
                  style={{ letterSpacing: code ? '2px' : 'normal', textTransform: 'uppercase', fontWeight: 700, width: '100%' }}
                  onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleQuickStart();
                  }}
                />
              </div>
            </div>
          </div>

          {/* 底部两大按钮：使用组件库 CandyButton */}
          <div className="game-action-buttons">
            <CandyButton
              variant="yellow"
              size="lg"
              shape="pill"
              fullWidth
              disabled={busy || !name.trim()}
              onClick={handleQuickStart}
              aria-label="单人随机一碗"
              leftIcon={
                <span className="btn-circle-badge">
                  ▶
                </span>
              }
            >
              <div className="btn-candy-inner">
                <span className="btn-main-title" style={{ color: '#1e3a8a' }}>快速开始</span>
                <span className="btn-sub-desc" style={{ color: '#854d0e' }}>随机匹配或创建房间</span>
              </div>
            </CandyButton>

            <CandyButton
              variant="blue"
              size="lg"
              shape="pill"
              fullWidth
              disabled={busy || !name.trim()}
              onClick={handleCreateClick}
              aria-label="创建房间 →"
              leftIcon={
                <span className="btn-circle-badge">
                  <img
                    src="/assets/icons/icon-plus.png"
                    alt="+"
                    style={{ width: '14px', height: '14px', objectFit: 'contain' }}
                  />
                </span>
              }
            >
              <div className="btn-candy-inner">
                <span className="btn-main-title" style={{ color: '#ffffff' }}>创建房间</span>
                <span className="btn-sub-desc" style={{ color: '#e0f2fe' }}>邀请好友一起玩</span>
              </div>
            </CandyButton>
          </div>
        </section>

        {/* 右半部分：进入游戏 */}
        <section className="board-col-right">
          <CandyRibbon color="blue">进入游戏</CandyRibbon>

          {/* 2x2 功能卡片网格：使用组件库 CandyCard */}
          <div className="feature-grid-2x2">
            <CandyCard
              title="创建房间"
              description="自定义规则，邀请好友"
              icon={
                <img
                  src="/assets/icons/icon-house.png"
                  alt="创建房间"
                  style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                />
              }
              footer={<div className="card-arrow-circle">›</div>}
              className="feature-action-card card-blue"
              onClick={handleCreateClick}
              role="button"
              tabIndex={0}
            />

            <CandyCard
              title="加入房间"
              description="输入房间号，快速加入"
              icon={
                <img
                  src="/assets/icons/icon-users.png"
                  alt="加入房间"
                  style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                />
              }
              footer={<div className="card-arrow-circle">›</div>}
              className="feature-action-card card-yellow"
              onClick={handleJoinCardClick}
              role="button"
              tabIndex={0}
            />

            <a href="#/library" style={{ textDecoration: 'none' }}>
              <CandyCard
                title="题库挑战"
                description="海量题目，单人练习"
                icon={
                  <img
                    src="/assets/icons/icon-quiz.png"
                    alt="题库挑战"
                    style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                  />
                }
                footer={<div className="card-arrow-circle">›</div>}
                className="feature-action-card card-green"
              />
            </a>

            <CandyCard
              title="排行榜"
              description="看看谁才是推理之王"
              icon={
                <img
                  src="/assets/icons/icon-trophy.png"
                  alt="排行榜"
                  style={{ width: '48px', height: '48px', objectFit: 'contain' }}
                />
              }
              footer={<div className="card-arrow-circle">›</div>}
              className="feature-action-card card-purple"
              onClick={() => {
                candySound.play('pop');
                setLeaderboardOpen(true);
              }}
              role="button"
              tabIndex={0}
            />
          </div>

          {/* 底部新手规则卡片：展示思考小海龟插画 */}
          <div className="novice-rules-card">
            <div className="novice-rules-tag">
              <CandyBadge variant="yellow" size="md">新手规则</CandyBadge>
            </div>
            <div className="novice-rules-mascot">
              <img
                src="/assets/turtle-think.png"
                alt="思考解密小海龟"
                style={{ width: '84px', height: '84px', objectFit: 'contain', display: 'block' }}
              />
            </div>
            <div className="novice-rules-list">
              <div className="novice-rule-row">
                <CandyBadge variant="blue" size="sm">1</CandyBadge>
                <span>出题者提供一个不完整的故事（海龟汤）。</span>
              </div>
              <div className="novice-rule-row">
                <CandyBadge variant="blue" size="sm">2</CandyBadge>
                <span>你可以通过提问来获取“是 / 否 / 无关”的答案。</span>
              </div>
              <div className="novice-rule-row">
                <CandyBadge variant="blue" size="sm">3</CandyBadge>
                <span>根据线索进行推理，猜出故事的完整真相！</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 头像选择弹窗 - 使用 CandyModal 组件 */}
      <CandyModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        title="选择专属形象"
        titleStyle="ribbon"
        ribbonColor="blue"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginTop: '14px' }}>
          {AVATAR_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              className={`avatar-btn ${selectedAvatar === preset.src ? 'selected' : ''}`}
              onClick={() => handleAvatarChange(preset.src)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
            >
              <CandyAvatar src={preset.src} size="md" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>{preset.name}</span>
            </button>
          ))}
        </div>
      </CandyModal>

      {/* 排行榜弹窗 - 使用 CandyModal 组件 */}
      <CandyModal
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        title="推理排行榜"
        titleStyle="ribbon"
        ribbonColor="gold"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#fef9c3', border: '2px solid #fef08a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CandyBadge variant="yellow" size="sm">1</CandyBadge>
              <span style={{ fontWeight: 800 }}>逻辑鬼才 · 福尔摩汤</span>
            </div>
            <CandyBadge variant="yellow" size="md">128 汤破解</CandyBadge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#f1f5f9', border: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CandyBadge variant="gray" size="sm">2</CandyBadge>
              <span style={{ fontWeight: 800 }}>名侦探可可</span>
            </div>
            <CandyBadge variant="gray" size="md">96 汤破解</CandyBadge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#f8fafc', border: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CandyBadge variant="choco" size="sm">3</CandyBadge>
              <span style={{ fontWeight: 800 }}>机智小汤圆</span>
            </div>
            <CandyBadge variant="gray" size="md">74 汤破解</CandyBadge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#e0f2fe', border: '2px solid #bae6fd' }}>
            <div style={{ display: 'center', alignItems: 'center', gap: '10px' }}>
              <CandyBadge variant="blue" size="sm">4</CandyBadge>
              <span style={{ fontWeight: 800 }}>{name || '推理小海龟'} (你)</span>
            </div>
            <CandyBadge variant="blue" size="md">42 汤破解</CandyBadge>
          </div>
        </div>
      </CandyModal>
    </main>
  );
}

export function Library({
  onChoose,
  busy,
}: {
  onChoose: (id: string) => void;
  busy: boolean;
}) {
  const [sort, setSort] = useState<SortKey>('new');
  const [q, setQ] = useState('');
  const [excludeNsfl, setExcludeNsfl] = useState(true);
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      api.puzzles({ sort, q: q.trim(), excludeNsfl, limit: 60, offset }, controller.signal)
        .then(items => {
          setPuzzles(prev => (offset === 0 ? items : [...prev, ...items]));
          setHasMore(items.length === 60);
        })
        .catch(err => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : '加载失败');
        })
        .finally(() => setLoading(false));
    }, 150);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [sort, q, excludeNsfl, offset, refresh]);

  return (
    <main>
      <div className="library-header">
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>题库大厅</h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>精选经典海龟汤题目，在线联机推理解谜</p>
        </div>
        <a href="#/" className="nav-link">返回首页</a>
      </div>

      <section className="filter-bar">
        <div role="tablist" aria-label="题库排序" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(['good', 'mid', 'low', 'hot', 'new'] as const).map(key => {
            const labels: Record<string, string> = { good: '高好评', mid: '中好评', low: '低好评', hot: '最热', new: '最新' };
            const isSelected = sort === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`candy-btn candy-btn-sm candy-btn-pill ${isSelected ? 'candy-btn-blue candy-btn-solid' : 'candy-btn-ghost candy-btn-outline'}`}
                onClick={() => {
                  setSort(key);
                  setOffset(0);
                  setPuzzles([]);
                }}
              >
                {labels[key]}
              </button>
            );
          })}
        </div>

        <div className="search-row">
          <div style={{ flex: 1, minWidth: '240px' }}>
            <label htmlFor="search-input" style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>搜索题目</label>
            <input
              id="search-input"
              type="text"
              placeholder="搜索题目"
              className="ask-textarea"
              style={{ width: '100%', padding: '10px 14px' }}
              value={q}
              onChange={e => {
                setQ(e.target.value);
                setOffset(0);
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={excludeNsfl}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                onChange={e => {
                  setExcludeNsfl(e.target.checked);
                  setOffset(0);
                }}
              />
              排除重口
            </label>
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="content-warning" style={{ marginBottom: '20px' }}>
          <p>{error}</p>
          <GameButton tone="red" size="sm" onClick={() => setRefresh(v => v + 1)}>重试</GameButton>
        </div>
      )}

      {loading && offset === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>正在备汤...</p>}

      <section className="puzzles-grid">
        {puzzles.map(puzzle => (
          <PuzzleCard key={puzzle.id} puzzle={puzzle} onChoose={onChoose} />
        ))}
      </section>

      {hasMore && !error && (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <GameButton tone="blue" size="md" disabled={loading} onClick={() => setOffset(v => v + 60)}>
            加载更多故事
          </GameButton>
        </div>
      )}
    </main>
  );
}

export function Room({
  code,
  name,
  playerKey,
  onName,
  onLeave,
}: {
  code: string;
  name: string;
  playerKey: string;
  onName: (value: string) => void;
  onLeave: () => void;
}) {
  const game = useGame();
  const [guessOpen, setGuessOpen] = useState(false);
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const [flashVerdict, setFlashVerdict] = useState<Verdict | null>(null);

  const room = game.room;
  const joined = game.joined;
  const status = game.status;

  const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await action();
    } catch (error) {
      notify(error instanceof Error ? error.message : '操作失败');
      return undefined;
    }
  };

  useEffect(() => {
    if (!name.trim()) return;
    try {
      joinRoom({ code, name: name.trim(), playerKey });
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : '加入房间失败');
    }
  }, [code, name, playerKey]);

  useEffect(() => {
    if (!room) return;
    const hasWin = room.guesses.some(g => g.outcome === '破解成功');
    if (hasWin || (room.phase === 'revealed' && room.reveal?.reason === 'solved')) {
      triggerCandyConfetti();
    }
  }, [room?.phase, room?.guesses.length]);

  if (!room) {
    return (
      <main>
        <h2>进入房间 {code}</h2>
        <p>连接中...</p>
        <GameButton tone="grey" size="sm" onClick={onLeave}>返回首页</GameButton>
      </main>
    );
  }

  const me = room.players.find(p => p.key === playerKey);
  const disabled = !joined || status !== 'connected' || !me;
  const remaining = remainingQuota(room, playerKey);
  const playing = room.phase === 'playing';
  const turnName = room.players.find(p => p.key === room.turnKey)?.name ?? '等待在线玩家';
  const notMyTurn = room.settings.turnMode === 'turns' && room.turnKey !== playerKey;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      notify('邀请链接已复制');
      candySound.play('pop');
    } catch {
      notify('复制失败');
    }
  };

  return (
    <main>
      <ReconnectBanner status={status} />

      <header className="room-topbar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="brand-badge">第 {room.round} 局</span>
            <span className="brand-badge" style={{ background: playing ? '#e4fbef' : '#fff6da', color: playing ? '#00875a' : '#a26900' }}>
              ({room.phase})
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{room.puzzle?.title ?? '等待开局'}</h2>
        </div>
        <GameButton tone="grey" size="sm" onClick={onLeave}>离开房间 ↗</GameButton>
      </header>

      <div style={{ margin: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>房间码: <strong className="room-code-tag">{room.code}</strong></span>
          <GameButton tone="blue" size="xs" onClick={copyInvite}>复制邀请链接</GameButton>
        </div>
      </div>

      <div className="room-grid">
        <section className="room-main">
          <div className="story-panel">
            <h3 style={{ margin: '0 0 12px 0' }}>本题汤面</h3>
            {room.puzzle ? (
              <ContentWarning warning={room.puzzle.nsfl} id={room.puzzle.id}>
                <h4>{room.puzzle.title}</h4>
                <p className="story-body">{room.puzzle.surface}</p>
              </ContentWarning>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>房主可在控制面板抽题开局。</p>
            )}
          </div>

          <QuestionLog room={room} />

          <AskBox
            remaining={remaining}
            disabled={disabled || !playing || !!me?.pending || notMyTurn}
            turn={room.settings.turnMode === 'turns' && playing ? `轮到 ${turnName} 提问` : undefined}
            hints={room.hints}
            totalHints={room.hintCount}
            isHost={room.hostKey === playerKey}
            canGuess={!disabled && playing && !me?.pending && (me?.guesses ?? 0) < room.settings.maxGuesses}
            remainingGuesses={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))}
            progress={room.progress}
            flashVerdict={flashVerdict}
            onAsk={text => {
              candySound.play('bubble');
              return run(() => actions.ask(text));
            }}
            onGuess={() => setGuessOpen(true)}
            onHint={() => run(() => actions.hint())}
          />
        </section>

        <aside className="room-sidebar">
          <PlayerList
            room={room}
            selfKey={playerKey}
            disabled={disabled}
            onKick={targetKey => run(() => actions.kick(targetKey))}
          />

          <HostPanel
            room={room}
            disabled={disabled || room.hostKey !== playerKey}
            onSettings={settings => run(() => actions.settings(settings))}
            onStart={puzzleId => run(async () => {
              if (room.phase === 'playing') await actions.reveal();
              await actions.start(puzzleId);
            })}
            onHint={() => run(() => actions.hint())}
            onReveal={() => run(() => actions.reveal())}
          />
        </aside>
      </div>

      {guessOpen && (
        <GuessModal
          disabled={disabled}
          remaining={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))}
          onClose={() => setGuessOpen(false)}
          onGuess={text => run(() => actions.guess(text))}
        />
      )}

      {room.phase === 'revealed' && room.reveal && (
        <RevealModal
          opened={revealModalOpen}
          onClose={() => setRevealModalOpen(false)}
          reveal={room.reveal}
          disabled={disabled}
          onRate={(score, funny) => run(() => actions.rate(score, funny))}
        />
      )}
    </main>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/');
  const [name, setName] = useState(() => readStorage('turtle:name') || '');
  const [playerKey] = useState(newPlayerKey);
  const game = useGame();
  const [busy, setBusy] = useState(false);
  const { soundEnabled, setSoundEnabled } = useCandy();
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const sync = () => setRoute(location.hash.slice(1) || '/');
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  const navigate = (hash: string) => {
    location.hash = hash;
  };

  const setNickname = (nextName: string) => {
    setName(nextName);
    saveStorage('turtle:name', nextName);
  };

  const create = async (start?: 'random' | 'chosen') => {
    if (!name.trim()) return;
    try {
      const { code } = await api.createRoom({ name: name.trim(), playerKey });
      navigate(`/room/${code}`);
      if (start === 'random') {
        const check = setInterval(() => {
          const r = getSnapshot().room;
          if (r?.code === code && r.hostKey === playerKey) {
            clearInterval(check);
            actions.start().catch(() => {});
          }
        }, 100);
        setTimeout(() => clearInterval(check), 5000);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : '创建房间失败');
    }
  };

  const choose = async (puzzleId: string) => {
    if (!name.trim()) {
      notify('请先输入你的昵称');
      navigate('/');
      return;
    }
    try {
      const { code } = await api.createRoom({ name: name.trim(), playerKey });
      navigate(`/room/${code}`);
      const check = setInterval(() => {
        const r = getSnapshot().room;
        if (r?.code === code && r.hostKey === playerKey) {
          clearInterval(check);
          actions.start(puzzleId).catch(() => {});
        }
      }, 100);
      setTimeout(() => clearInterval(check), 5000);
    } catch (err) {
      notify(err instanceof Error ? err.message : '创建房间失败');
    }
  };

  const leave = async () => {
    try {
      await leaveRoom();
    } finally {
      navigate('/');
    }
  };

  const roomMatch = route.match(/^\/room\/([A-Za-z0-9_-]+)$/);
  const code = roomMatch ? roomMatch[1].toUpperCase() : null;
  const library = route === '/library';

  return (
    <div className="app-container">
      <a
        className="skip-link"
        href="#main-content"
        onClick={e => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        跳到游戏内容
      </a>

      <header className="game-top-header">
        <div className="game-header-inner">
          <nav className="header-nav-group" aria-label="主导航">
            <a href="#/" style={{ textDecoration: 'none' }}>
              <CandyButton
                variant={!code && !library ? 'yellow' : 'ghost'}
                size="sm"
                shape="pill"
                appearance={!code && !library ? 'solid' : 'soft'}
                leftIcon={
                  <img
                    src="/assets/icons/nav-home.png"
                    alt=""
                    style={{ width: '18px', height: '18px', display: 'block' }}
                  />
                }
              >
                首页
              </CandyButton>
            </a>
            <a href="#/library" style={{ textDecoration: 'none' }}>
              <CandyButton
                variant={library ? 'yellow' : 'ghost'}
                size="sm"
                shape="pill"
                appearance={library ? 'solid' : 'soft'}
                leftIcon={
                  <img
                    src="/assets/icons/nav-library.png"
                    alt=""
                    style={{ width: '18px', height: '18px', display: 'block' }}
                  />
                }
              >
                题库
              </CandyButton>
            </a>
            <CandyButton
              variant="ghost"
              size="sm"
              shape="pill"
              appearance="soft"
              onClick={() => {
                candySound.play('pop');
                setLeaderboardOpen(true);
              }}
              leftIcon={
                <img
                  src="/assets/icons/nav-rank.png"
                  alt=""
                  style={{ width: '18px', height: '18px', display: 'block' }}
                />
              }
            >
              排行榜
            </CandyButton>
            <CandyButton
              variant="ghost"
              size="sm"
              shape="pill"
              appearance="soft"
              onClick={() => {
                candySound.play('pop');
                setGuideOpen(true);
              }}
              leftIcon={
                <img
                  src="/assets/icons/nav-guide.png"
                  alt=""
                  style={{ width: '18px', height: '18px', display: 'block' }}
                />
              }
            >
              新手指南
            </CandyButton>
          </nav>

          <a href="#/" className="header-center-logo">
            <img
              src="/assets/banner-logo.png"
              alt="海龟汤推理局"
              className="header-banner-img"
            />
          </a>

          <div className="header-right-group">
            <button
              type="button"
              className="header-bell-btn"
              onClick={() => {
                candySound.play('pop');
                notify('欢迎来到海龟汤推理局！当前精选 105 道原汁原味开源推理谜题，快来挑战吧！');
              }}
              title="系统通知"
              aria-label="系统通知"
            >
              <img
                src="/assets/icons/bell-button.png"
                alt="通知"
                style={{ width: '38px', height: '38px', display: 'block' }}
              />
            </button>

            <div
              className="header-user-pill"
              onClick={() => {
                candySound.play('pop');
                setLeaderboardOpen(true);
              }}
              title="查看个人推理战绩"
            >
              <div className="user-pill-avatar">
                <CandyAvatar
                  src={readStorage('turtle:avatar')?.startsWith('/') ? readStorage('turtle:avatar') : '/assets/user-smile.png'}
                  size="xs"
                />
              </div>
              <span className="user-pill-name">{name || '推理小海龟'}</span>
              <CandyBadge variant="yellow" size="sm">Lv.12</CandyBadge>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>▼</span>
            </div>

            <CandyButton
              variant="ghost"
              size="xs"
              shape="pill"
              appearance="outline"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? '音效已开启' : '音效已静音'}
              style={{ color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.4)' }}
            >
              {soundEnabled ? '声音' : '静音'}
            </CandyButton>
          </div>
        </div>
      </header>

      <div id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
        {code ? (
          <Room
            key={code}
            code={code}
            name={name}
            playerKey={playerKey}
            onName={setNickname}
            onLeave={leave}
          />
        ) : library ? (
          <Library onChoose={choose} busy={busy} />
        ) : (
          <Home
            name={name}
            onName={setNickname}
            onCreate={start => void create(start)}
            onJoin={c => {
              if (roomCodePattern.test(c)) navigate(`/room/${c}`);
            }}
            busy={busy}
          />
        )}
      </div>

      <Toast message={game.message} onClose={clearToast} />

      {/* 排行榜弹窗 */}
      <CandyModal
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        title="推理排行榜"
        titleStyle="ribbon"
        ribbonColor="gold"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#fef9c3', border: '2px solid #fef08a' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CandyBadge variant="yellow" size="sm">1</CandyBadge>
              <span style={{ fontWeight: 800 }}>逻辑鬼才 · 福尔摩汤</span>
            </div>
            <CandyBadge variant="yellow" size="md">128 汤破解</CandyBadge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#f1f5f9', border: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CandyBadge variant="gray" size="sm">2</CandyBadge>
              <span style={{ fontWeight: 800 }}>名侦探可可</span>
            </div>
            <CandyBadge variant="gray" size="md">96 汤破解</CandyBadge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: '#f8fafc', border: '2px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CandyBadge variant="choco" size="sm">3</CandyBadge>
              <span style={{ fontWeight: 800 }}>机智小汤圆</span>
            </div>
            <CandyBadge variant="gray" size="md">74 汤破解</CandyBadge>
          </div>
        </div>
      </CandyModal>

      {/* 新手指南弹窗 */}
      <CandyModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="海龟汤新手指南"
        titleStyle="ribbon"
        ribbonColor="blue"
      >
        <div style={{ fontSize: '0.92rem', lineHeight: 1.6, color: '#334155', marginTop: '12px' }}>
          <p><strong>什么是海龟汤？</strong></p>
          <p>海龟汤是一种情境推理游戏（Lateral Thinking Puzzle）。出题者给出一个反常或看似矛盾的案发现场（汤面），玩家通过提问获取线索，最终推理出故事的完整全貌（汤底）。</p>
          <p><strong>提问规则：</strong></p>
          <ul>
            <li>玩家只能提出<strong>一般疑问句</strong>（答案可以用“是”或“不是”回答的问题）。</li>
            <li>AI 裁判仅会回答：<strong>是</strong>、<strong>不是</strong>、<strong>不相关</strong>或<strong>不确定</strong>。</li>
            <li>每人拥有 8 次提问机会，可申请补充线索，最终提交真相还原！</li>
          </ul>
        </div>
      </CandyModal>
    </div>
  );
}
