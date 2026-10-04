import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Checkbox, Paper, TextInput } from '@mantine/core';
import {
  ArrowLeftIcon,
  BookIcon,
  BotIcon,
  CompassIcon,
  CopyIcon,
  DiceIcon,
  DoorIcon,
  EyeIcon,
  FlameIcon,
  HashIcon,
  HelpCircleIcon,
  LightbulbIcon,
  LogOutIcon,
  PlayIcon,
  PlusIcon,
  RadioIcon,
  SearchIcon,
  SparkleIcon,
  ThumbsUpIcon,
  TurtleIcon,
  UserIcon,
  UsersIcon,
  ZapIcon,
} from './icons/GameIcons';
import { MascotDetective } from './rive/RiveIcon';
import type { HealthResponse, PuzzleSummary, SortKey, Verdict } from '@shared/protocol';
import { api } from './api';
import { GameButton } from './ui';
import { actions, joinRoom, leaveRoom } from './socket';
import { clearToast, getSnapshot, notify, useGame } from './store';
import { remainingQuota } from './game';
import { GameProvider } from './theme';
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
  try { localStorage.setItem(key, value); } catch { /* 隐私模式保留当前会话。 */ }
}
function newPlayerKey(): string {
  const saved = readStorage('turtle:playerKey');
  if (saved) return saved;
  const key = crypto.randomUUID();
  saveStorage('turtle:playerKey', key);
  return key;
}
const roomCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
function navigate(path: string): void { location.hash = path; }
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试';
}

export function Home({
  name,
  onName,
  onCreate,
  onJoin,
  busy,
}: {
  name: string;
  onName: (name: string) => void;
  onCreate: (start?: string) => void;
  onJoin: (code: string) => void;
  busy: boolean;
}) {
  const [code, setCode] = useState('');
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let active = true;
    api.health().then(value => { if (active) setHealth(value); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const join = () => {
    if (!roomCodePattern.test(code)) {
      notify('请输入有效的 6 位房间码');
      return;
    }
    onJoin(code);
  };

  return (
    <main className="home">
      <div className="gartic-main-card">
        {/* Top 3D Comic Ribbon */}
        <div className="gartic-ribbon-wrap">
          <GameButton tone="blue" size="lg" disabled={busy}
            onClick={() => {
              if (name.trim()) onCreate();
              else {
                notify('先取个侦探代号吧');
                document.getElementById('nickname')?.focus();
              }
            }}
          >
            开始游戏
          </GameButton>
        </div>

        <div className="gartic-home-grid">
          {/* Left Column: Avatar + Nickname + 3D Action Buttons */}
          <div className="gartic-side-col">
            <div className="gartic-avatar-box">
              <MascotDetective size={60} mood="idle" />
              <div className="gartic-avatar-badge" title="侦探代号">
                <SparkleIcon size={14} animate />
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: 280 }}>
              <TextInput
                id="nickname"
                label="你的昵称"
                maxLength={16}
                value={name}
                leftSection={<UserIcon size={18} animate />}
                placeholder="取个侦探代号 (最多16字)"
                size="md"
                styles={{
                  input: { fontWeight: 700, border: '2px solid #cbd5e1', textAlign: 'center' },
                  label: { fontWeight: 800, marginBottom: 6, color: '#334155' },
                }}
                onChange={e => onName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && name.trim()) onCreate();
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 300, justifyContent: 'center' }}>
              <GameButton
                tone="blue" size="md"
                disabled={busy || !name.trim()}
                leftSection={<PlusIcon size={18} animate />}
                onClick={() => onCreate()}
                style={{ flex: 1 }}
              >
                创建房间 →
              </GameButton>
              <GameButton
                tone="yellow" size="md"
                disabled={busy || !name.trim()}
                leftSection={<DiceIcon size={18} animate />}
                onClick={() => onCreate('random')}
                style={{ flex: 1 }}
              >
                单人随机一碗
              </GameButton>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              把房间码发给朋友，同屏即时对局
            </p>
          </div>

          {/* Center Divider: "或" */}
          <div className="gartic-or-divider">
            <div className="gartic-or-line" />
            <div className="gartic-or-badge">或</div>
          </div>

          {/* Right Column: Quick Feature Pills + Join Room */}
          <div className="gartic-side-col">
            <div className="gartic-features-row">
              <div className="gartic-feature-pill">
                <div className="gartic-feature-icon">
                  <BookIcon size={26} animate />
                </div>
                <span>{health ? health.puzzles.toLocaleString() : '—'} 道题库</span>
              </div>
              <div className="gartic-feature-pill">
                <div className="gartic-feature-icon">
                  <BotIcon size={26} animate />
                </div>
                <span>JEV 裁判</span>
              </div>
              <div className="gartic-feature-pill">
                <div className="gartic-feature-icon">
                  <UsersIcon size={26} animate />
                </div>
                <span>多人实时联机</span>
              </div>
            </div>

            <div style={{ width: '100%', maxWidth: 280 }}>
              <TextInput
                id="room-code"
                label="房间码"
                className="code-input"
                maxLength={6}
                value={code}
                leftSection={<HashIcon size={18} />}
                onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                placeholder="例如: ABC234"
                size="md"
                styles={{
                  input: {
                    fontWeight: 800,
                    border: '2px solid #cbd5e1',
                    textAlign: 'center',
                    letterSpacing: 2,
                    fontFamily: 'monospace',
                  },
                  label: { fontWeight: 800, marginBottom: 6, color: '#334155' },
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && code.trim()) join();
                }}
              />
            </div>

            <GameButton
              tone="green" size="md"
              disabled={busy || !code.trim()}
              leftSection={<DoorIcon size={18} animate />}
              onClick={join}
              style={{ width: '100%', maxWidth: 280 }}
            >
              加入房间 ↗
            </GameButton>

            <a
              href="#/library"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#0284c7',
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              <BookIcon size={16} animate /> 翻翻汤单—挑一碗合你口味的故事 ↗
            </a>
          </div>
        </div>

        {/* Bottom Rule Strip (needed for tests) */}
        <div className="how-to-banner">
          汤面 → 提问 → 是/不是/不相关 → 每人8问 → 还原真相
        </div>
      </div>

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      api.puzzles({ sort, q: q.trim(), excludeNsfl, limit: 60, offset }, controller.signal)
        .then(items => {
          if (controller.signal.aborted) return;
          setPuzzles(previous => offset === 0 ? items : [...previous, ...items]);
          setHasMore(items.length === 60);
          setLoading(false);
        })
        .catch(err => {
          if (controller.signal.aborted) return;
          setError(errorMessage(err));
          setLoading(false);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [sort, q, excludeNsfl, offset, refresh]);

  return (
    <main className="library">
      <div className="page-heading">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <BookIcon size={22} animate />
            <span className="eyebrow">全库汤单</span>
          </div>
          <h1>总有一碗，让你意想不到。</h1>
          <p>涵盖千道中国公案、司法卷宗与世界经典奇谈。汤底只在游戏结束后揭晓。</p>
        </div>
        <GameButton component="a" href="#/" tone="grey" leftSection={<ArrowLeftIcon size={18} />}>
          返回首页
        </GameButton>
      </div>

      <Paper className="library-toolbar" withBorder p="md" radius="md">
        <div className="sort-tabs" role="tablist" aria-label="题库排序">
          {([
            { key: 'good', label: '高好评', icon: <ThumbsUpIcon size={15} animate /> },
            { key: 'mid', label: '中好评', icon: <SparkleIcon size={15} animate /> },
            { key: 'low', label: '低好评', icon: null },
            { key: 'hot', label: '最热', icon: <FlameIcon size={15} animate /> },
            { key: 'new', label: '最新', icon: null },
          ] as const).map(tab => (
            <GameButton
              key={tab.key}
              role="tab"
              aria-selected={sort === tab.key}
              variant={sort === tab.key ? 'filled' : 'default'}
              color={sort === tab.key ? 'teal' : 'gray'}
              size="xs"
              leftSection={tab.icon}
              onClick={() => {
                setSort(tab.key);
                setOffset(0);
                setPuzzles([]);
              }}
            >
              {tab.label}
            </GameButton>
          ))}
        </div>
        <div className="library-filters">
          <TextInput
            aria-label="搜索题目"
            placeholder="搜索标题、汤面或标签…"
            leftSection={<SearchIcon size={16} animate />}
            value={q}
            onChange={e => {
              setQ(e.target.value);
              setOffset(0);
              setPuzzles([]);
            }}
          />
          <Checkbox
            label="排除重口"
            checked={excludeNsfl}
            onChange={e => {
              setExcludeNsfl(e.currentTarget.checked);
              setOffset(0);
              setPuzzles([]);
            }}
          />
        </div>
      </Paper>

      {error && (
        <Paper className="empty-state" withBorder p="xl" radius="md" role="alert">
          <p>{error}</p>
          <GameButton tone="blue" onClick={() => setRefresh(value => value + 1)}>重新加载</GameButton>
        </Paper>
      )}

      <div className="puzzle-grid" aria-busy={loading}>
        {puzzles.map(puzzle => (
          <PuzzleCard
            key={puzzle.id}
            puzzle={puzzle}
            onChoose={id => { if (!busy) onChoose(id); }}
          />
        ))}
      </div>

      {loading && (
        <div className="loading-state" role="status">
          <SparkleIcon size={20} animate />
          正在备汤…
        </div>
      )}

      {!loading && !error && puzzles.length === 0 && (
        <Paper className="empty-state" withBorder p="xl" radius="md">
          <HelpCircleIcon size={44} animate style={{ margin: '0 auto 12px' }} />
          <h3>这份汤单还没有符合的故事</h3>
          <p>试试其他排序档位、去掉「排除重口」，或换个关键词搜搜看。</p>
        </Paper>
      )}

      {hasMore && !error && (
        <GameButton
          className="load-more"
          variant="light"
          disabled={loading}
          onClick={() => setOffset(value => value + 60)}
        >
          加载更多故事（已显示 {puzzles.length} 道）
        </GameButton>
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
  onName: (name: string) => void;
  onLeave: () => void;
}) {
  const { room, status, joined } = useGame();
  const [guessOpen, setGuessOpen] = useState(false);
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const [flashVerdict, setFlashVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const lastResolvedQaIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (room?.phase === 'revealed' && room.reveal) {
      setRevealModalOpen(true);
    }
  }, [room?.phase, room?.round]);

  useEffect(() => {
    if (!room) return;
    const resolved = room.log.filter(q => q.verdict !== '判定中');
    if (resolved.length === 0) return;
    const latest = resolved[resolved.length - 1];
    if (latest.id !== lastResolvedQaIdRef.current) {
      lastResolvedQaIdRef.current = latest.id;
      setFlashVerdict(latest.verdict);
      const timer = setTimeout(() => setFlashVerdict(null), 1800);
      return () => clearTimeout(timer);
    }
  }, [room?.log]);

  const closeGuess = useCallback(() => setGuessOpen(false), []);
  const run = (operation: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    operation().catch(err => notify(errorMessage(err))).finally(() => setBusy(false));
  };
  const retryJoin = () => {
    if (name.trim()) joinRoom({ code, name: name.trim(), playerKey });
  };

  if (!name.trim()) {
    return (
      <main className="join-gate">
        <div className="gartic-main-card">
          <div className="gartic-ribbon-wrap">
            <div className="gartic-ribbon">
              加入房间
            </div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span className="eyebrow" style={{ color: '#0284c7', fontWeight: 700 }}>你的朋友正在等你</span>
            <h1 style={{ margin: '8px 0', fontSize: 24, fontWeight: 900, color: '#0f172a' }}>加入 {code}</h1>
          </div>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (draftName.trim()) onName(draftName.trim());
            }}
            style={{ maxWidth: 300, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <TextInput
              id="invite-name"
              label="你的昵称"
              autoFocus
              maxLength={16}
              value={draftName}
              leftSection={<UserIcon size={18} animate />}
              onChange={e => setDraftName(e.target.value)}
              placeholder="先告诉同桌，你叫什么"
              size="md"
              styles={{
                input: { fontWeight: 700, textAlign: 'center', border: '2px solid #cbd5e1' },
                label: { fontWeight: 800, marginBottom: 6, color: '#334155' },
              }}
            />
            <GameButton
              tone="yellow" size="md"
              disabled={!draftName.trim()}
              type="submit"
            >
              入座 →
            </GameButton>
          </form>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <a href="#/" style={{ color: '#64748b', fontSize: 13, fontWeight: 600 }}>返回首页</a>
          </div>
        </div>
      </main>
    );
  }

  if (!room || room.code !== code) {
    return (
      <main className="join-gate">
        <Paper withBorder p="xl" radius="md">
          <ReconnectBanner status={status} />
          <h2 style={{ marginTop: 16 }}>{status === 'connected' ? '暂时无法加入房间' : '正在为你留座…'}</h2>
          <p>房间 {code} · 昵称 {name}</p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <GameButton tone="blue" onClick={retryJoin}>重新加入</GameButton>
            <GameButton tone="grey" onClick={onLeave}>返回首页</GameButton>
          </div>
        </Paper>
      </main>
    );
  }

  const me = room.players.find(p => p.key === playerKey);
  const disabled = busy || !joined || status !== 'connected' || !me;
  const remaining = remainingQuota(room, playerKey);
  const playing = room.phase === 'playing';
  const turnName = room.players.find(p => p.key === room.turnKey)?.name ?? '等待在线玩家';
  const notMyTurn = room.settings.turnMode === 'turns' && room.turnKey !== playerKey;

  const copyInvite = async () => {
    const url = new URL(location.href);
    url.search = '';
    url.hash = `/room/${code}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      notify('邀请链接已复制，快发给朋友入座！');
    } catch {
      notify('无法自动复制，请复制浏览器地址栏链接');
    }
  };

  return (
    <>
      <ReconnectBanner status={status} />
      <main className="room-page">
        <div className="room-heading">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge variant="filled" color="teal" size="sm">
                第 {room.round} 局
              </Badge>
              <Badge variant="light" color={playing ? 'teal' : 'gray'} size="sm">
                {room.phase === 'lobby' ? '等待开局' : playing ? '推理进行中' : '真相已揭晓'}
              </Badge>
            </div>
            <h1>{room.puzzle?.title ?? '好故事，等人齐。'}</h1>
          </div>
          <GameButton tone="grey" size="sm" leftSection={<LogOutIcon size={18} animate />} onClick={onLeave}>
            离开房间 ↗
          </GameButton>
        </div>

        <div className="room-layout">
          {/* Main Stage: Left & Center (70%) */}
          <div className="room-main">
            {/* Story Card */}
            <Paper className="surface-card" withBorder p="lg" radius="md">
              <div className="section-head">
                <span className="eyebrow">本题汤面</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {room.phase === 'revealed' && room.reveal && (
                    <GameButton
                      size="xs"
                      className="reveal-view-btn"
                      leftSection={<EyeIcon size={16} animate />}
                      onClick={() => setRevealModalOpen(true)}
                    >
                      查看揭晓答案 / 汤底
                    </GameButton>
                  )}
                  {room.puzzle?.nsfl && <Badge color="yellow" variant="light">重口</Badge>}
                </div>
              </div>
              {room.puzzle ? (
                <ContentWarning warning={room.puzzle.nsfl} id={room.puzzle.id}>
                  <h2>{room.puzzle.title}</h2>
                  <p className="story">{room.puzzle.surface}</p>
                </ContentWarning>
              ) : (
                <div className="empty-state">
                  <BookIcon size={44} animate style={{ margin: '0 auto 10px', opacity: 0.8 }} />
                  <h3>这碗汤还在准备中</h3>
                  <p>房主可在右侧面板选择开始随机抽题，或前往题库挑选。</p>
                </div>
              )}
            </Paper>

            {/* Question & Guess Log */}
            <QuestionLog room={room} />

            {/* Input Terminal: Fixed to bottom with unified hints & action bar */}
            <div className="terminal-dock">
              <AskBox
                key={`${code}-${room.round}`}
                remaining={remaining}
                disabled={disabled || !playing || !!me?.pending || notMyTurn}
                turn={room.settings.turnMode === 'turns' && playing ? `轮到 ${turnName}${room.turnKey === playerKey ? '（你）' : ''} 提问` : undefined}
                hints={room.hints}
                totalHints={room.hintCount}
                isHost={room.hostKey === playerKey}
                canGuess={!disabled && playing && !me?.pending && (me?.guesses ?? 0) < room.settings.maxGuesses}
                remainingGuesses={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))}
                progress={room.progress}
                flashVerdict={flashVerdict}
                onAsk={text => run(() => actions.ask(text))}
                onGuess={() => setGuessOpen(true)}
                onHint={() => run(() => actions.hint())}
              />
            </div>

          </div>

          {/* Sidebar: Right (30%) */}
          <aside className="room-sidebar">
            {/* Invite Card */}
            <Paper className="invite-card" withBorder p="md" radius="md">
              <span className="eyebrow">本房房间码</span>
              <div className="room-code-wrapper" title="悬停显示完整房间码">
                <span className="room-code-blur">{room.code}</span>
                <span className="room-code-reveal">{room.code}</span>
              </div>
              <GameButton
                fullWidth
                variant="light"
                leftSection={<CopyIcon size={16} />}
                onClick={copyInvite}
              >
                复制邀请链接
              </GameButton>
            </Paper>

            {/* Players List */}
            <PlayerList
              room={room}
              selfKey={playerKey}
              disabled={disabled}
              onKick={targetKey => run(() => actions.kick(targetKey))}
            />

            {/* Host Control Panel */}
            <HostPanel
              room={room}
              disabled={disabled || room.hostKey !== playerKey}
              onSettings={settings => run(() => actions.settings(settings))}
              onStart={puzzleId => run(async () => {
                if (room.phase === 'playing') {
                  await actions.reveal();
                }
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
            onClose={closeGuess}
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
    </>
  );
}

export default function App() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/');
  const [name, setName] = useState(() => readStorage('turtle:name') || new URLSearchParams(location.search).get('name') || '');
  const [playerKey] = useState(newPlayerKey);
  const [busy, setBusy] = useState(false);
  const [pendingStart, setPendingStart] = useState<{ code: string; id?: string } | null>(null);
  const starting = useRef(false);
  const game = useGame();

  const roomMatch = /^\/room\/([A-Z0-9]{6})$/i.exec(route);
  const code = roomMatch?.[1].toUpperCase();
  const library = route.startsWith('/library');

  const setNickname = (value: string) => {
    setName(value.slice(0, 16));
    saveStorage('turtle:name', value.slice(0, 16));
  };

  useEffect(() => {
    const handle = () => setRoute(location.hash.slice(1) || '/');
    window.addEventListener('hashchange', handle);
    const invited = new URLSearchParams(location.search).get('room')?.toUpperCase();
    if (invited && roomCodePattern.test(invited) && (!location.hash || location.hash === '#/')) {
      history.replaceState(null, '', `${location.pathname}#/room/${invited}`);
      setRoute(`/room/${invited}`);
    }
    return () => window.removeEventListener('hashchange', handle);
  }, []);

  useEffect(() => {
    if (code && name.trim()) joinRoom({ code, name: name.trim(), playerKey });
  }, [code, name, playerKey]);

  useEffect(() => {
    if (!pendingStart || starting.current || !game.joined || game.status !== 'connected' || game.room?.code !== pendingStart.code) return;
    if (game.room.phase === 'playing') {
      setPendingStart(null);
      return;
    }
    starting.current = true;
    actions.start(pendingStart.id)
      .catch(err => notify(errorMessage(err)))
      .finally(() => {
        starting.current = false;
        setPendingStart(null);
      });
  }, [pendingStart, game.joined, game.status, game.room]);

  const create = async (start?: string) => {
    if (busy || !name.trim()) {
      if (!name.trim()) notify('先取一个昵称，再入座');
      return;
    }
    setBusy(true);
    try {
      const { code: newCode } = await api.createRoom({ name: name.trim(), playerKey });
      if (start) setPendingStart({ code: newCode, id: start === 'random' ? undefined : start });
      navigate(`/room/${newCode}`);
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    leaveRoom();
    setPendingStart(null);
    navigate('/');
  };

  const choose = (id: string) => {
    const targetRoom = new URLSearchParams(route.split('?')[1] ?? '').get('room');
    const room = getSnapshot().room;
    if (targetRoom && room?.code === targetRoom && room.hostKey === playerKey) {
      setPendingStart({ code: targetRoom, id });
      navigate(`/room/${targetRoom}`);
    } else if (!name.trim()) {
      notify('请先在首页填写昵称，再挑选这道题');
      navigate('/');
    } else {
      void create(id);
    }
  };

  return (
    <GameProvider>
      <div className="app-shell">
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

        <header className="app-header">
          <a className="brand" href="#/" aria-label="海龟汤首页">
            <span className="brand-mark">
              <TurtleIcon size={26} animate />
            </span>
            <div className="brand-title-wrap">
              <span className="brand-title">海龟汤</span>
              <small>TURTLE SOUP CLUB</small>
            </div>
          </a>

          <nav aria-label="主导航">
            <a className={!code && !library ? 'active' : ''} href="#/">
              <CompassIcon size={18} animate />
              <span>开一桌</span>
            </a>
            <a className={library ? 'active' : ''} href="#/library">
              <BookIcon size={18} animate />
              <span>逛题库</span>
            </a>
            {game.room && !code && (
              <a href={`#/room/${game.room.code}`}>
                <RadioIcon size={18} animate />
                <span>回到房间</span>
              </a>
            )}
          </nav>

          <span className="header-note">
            <BotIcon size={16} animate style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            JEV 裁判在线 · 随叫随到
          </span>
        </header>

        <div id="main-content" tabIndex={-1}>
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

        <footer className="site-footer">
          <span>海龟汤 · TURTLE SOUP CLUB · 仅供学习与私用，尊重原作者</span>
          <span>故事只是开始，问题才是线索。</span>
        </footer>
      </div>
    </GameProvider>
  );
}








