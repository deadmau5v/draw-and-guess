import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Checkbox, Paper, TextInput } from '@mantine/core';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Compass,
  Copy,
  Dice5,
  DoorOpen,
  Eye,
  Flame,
  Hash,
  HelpCircle,
  Lightbulb,
  LogIn,
  LogOut,
  Play,
  Plus,
  Radio,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  ThumbsUp,
  User,
  Users,
  Zap,
} from 'lucide-react';
import type { HealthResponse, PuzzleSummary, SortKey, Verdict } from '@shared/protocol';
import { api } from './api';
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
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badges">
            <Badge variant="light" color="teal" size="md" leftSection={<Bot size={13} />}>
              JEV 智能裁判驱动
            </Badge>
            <Badge variant="subtle" color="gray" size="md" leftSection={<Users size={13} />}>
              1–8 人实时联机
            </Badge>
            <Badge variant="subtle" color="gray" size="md" leftSection={<Zap size={13} />}>
              免注册即开即玩
            </Badge>
          </div>
          <h1>海龟汤 · 多人情境推理馆</h1>
          <p className="hero-description">
            一碗离奇的谜面，一桌默契的侦探。向 AI 主持人发起是非提问，在限定次数内剥离干扰，拼凑隐藏的真相。
          </p>
          <div className="how-to-box">
            <span className="how-to-label">核心玩法</span>
            <span className="how-to">汤面 → 提问 → 是/不是/不相关 → 每人8问 → 还原真相</span>
          </div>
        </div>
      </section>

      <section className="home-actions">
        <Paper className="home-card" withBorder p="xl" radius="md">
          <div className="section-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="card-icon-wrap">
                <Plus size={20} color="var(--accent)" />
              </div>
              <div>
                <h2>今晚，你叫什么？</h2>
                <span className="eyebrow">入座开席</span>
              </div>
            </div>
          </div>
          <TextInput
            id="nickname"
            label="你的昵称"
            maxLength={16}
            value={name}
            leftSection={<User size={16} />}
            placeholder="取个侦探代号，最多 16 字"
            onChange={e => onName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && name.trim()) onCreate();
            }}
          />
          <div className="start-buttons">
            <Button
              className="primary"
              disabled={busy || !name.trim()}
              leftSection={<Play size={16} />}
              onClick={() => onCreate()}
            >
              创建房间 →
            </Button>
            <Button
              variant="light"
              disabled={busy || !name.trim()}
              leftSection={<Dice5 size={16} />}
              onClick={() => onCreate('random')}
            >
              单人随机一碗
            </Button>
          </div>
          <p className="muted">昵称保存在本机。把房间码分享给朋友，就能一起开席。</p>
        </Paper>

        <Paper className="home-card" withBorder p="xl" radius="md">
          <div className="section-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="card-icon-wrap">
                <LogIn size={20} color="var(--accent)" />
              </div>
              <div>
                <h2>朋友已经开席？</h2>
                <span className="eyebrow">同桌推理</span>
              </div>
            </div>
          </div>
          <div className="inline-input">
            <TextInput
              id="room-code"
              label="房间码"
              className="code-input"
              maxLength={6}
              value={code}
              leftSection={<Hash size={16} />}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              placeholder="输入 6 位房间码 (如 ABC234)"
              onKeyDown={e => {
                if (e.key === 'Enter' && code.trim()) join();
              }}
            />
            <Button
              disabled={busy || !code.trim()}
              leftSection={<DoorOpen size={16} />}
              onClick={join}
            >
              加入房间 ↗
            </Button>
          </div>
          <a href="#/library" className="library-link">
            <BookOpen size={15} /> 翻翻汤单—挑一碗合你口味的故事 ↗
          </a>
        </Paper>
      </section>

      <div className="home-footer">
        <span>{health?.puzzles ?? 1105} 个故事，等你揭开</span>
        <span>仅供学习与私用 · 尊重原作者</span>
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
  const [sort, setSort] = useState<SortKey>('good');
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
            <BookOpen size={20} color="var(--accent)" />
            <span className="eyebrow">全库汤单</span>
          </div>
          <h1>总有一碗，让你意想不到。</h1>
          <p>涵盖千道中国公案、司法卷宗与世界经典奇谈。汤底只在游戏结束后揭晓。</p>
        </div>
        <Button component="a" href="#/" variant="subtle" leftSection={<ArrowLeft size={16} />}>
          返回首页
        </Button>
      </div>

      <Paper className="library-toolbar" withBorder p="md" radius="md">
        <div className="sort-tabs" role="tablist" aria-label="题库排序">
          {([
            { key: 'good', label: '高好评', icon: <ThumbsUp size={13} /> },
            { key: 'mid', label: '中好评', icon: <Sparkles size={13} /> },
            { key: 'low', label: '低好评', icon: null },
            { key: 'hot', label: '最热', icon: <Flame size={13} /> },
            { key: 'new', label: '最新', icon: null },
          ] as const).map(tab => (
            <Button
              key={tab.key}
              role="tab"
              aria-selected={sort === tab.key}
              variant={sort === tab.key ? 'filled' : 'subtle'}
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
            </Button>
          ))}
        </div>
        <div className="library-filters">
          <TextInput
            aria-label="搜索题目"
            placeholder="搜索标题、汤面或标签…"
            leftSection={<Search size={15} />}
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
          <Button onClick={() => setRefresh(value => value + 1)}>重新加载</Button>
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
          <Sparkles size={18} className="spin" color="var(--accent)" />
          正在备汤…
        </div>
      )}

      {!loading && !error && puzzles.length === 0 && (
        <Paper className="empty-state" withBorder p="xl" radius="md">
          <HelpCircle size={36} color="var(--muted)" style={{ margin: '0 auto 12px', opacity: 0.6 }} />
          <h3>这份汤单还没有符合的故事</h3>
          <p>试试其他排序档位、去掉「排除重口」，或换个关键词搜搜看。</p>
        </Paper>
      )}

      {hasMore && !error && (
        <Button
          className="load-more"
          variant="light"
          disabled={loading}
          onClick={() => setOffset(value => value + 60)}
        >
          加载更多故事 ({puzzles.length}/1105)
        </Button>
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
        <Paper withBorder p="xl" radius="md">
          <span className="eyebrow">你的朋友正在等你</span>
          <h1 style={{ margin: '8px 0 20px' }}>加入 {code}</h1>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (draftName.trim()) onName(draftName.trim());
            }}
          >
            <TextInput
              id="invite-name"
              label="你的昵称"
              autoFocus
              maxLength={16}
              value={draftName}
              leftSection={<User size={16} />}
              onChange={e => setDraftName(e.target.value)}
              placeholder="先告诉同桌，你叫什么"
            />
            <Button
              className="primary"
              style={{ marginTop: 14 }}
              disabled={!draftName.trim()}
              type="submit"
            >
              入座 →
            </Button>
          </form>
          <a href="#/" style={{ display: 'inline-block', marginTop: 16 }}>返回首页</a>
        </Paper>
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
            <Button onClick={retryJoin}>重新加入</Button>
            <Button variant="subtle" onClick={onLeave}>返回首页</Button>
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
          <Button variant="subtle" color="gray" leftSection={<LogOut size={16} />} onClick={onLeave}>
            离开房间 ↗
          </Button>
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
                    <Button
                      size="xs"
                      className="reveal-view-btn"
                      leftSection={<Eye size={14} />}
                      onClick={() => setRevealModalOpen(true)}
                    >
                      查看揭晓答案 / 汤底
                    </Button>
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
                  <BookOpen size={36} color="var(--muted)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
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
              <Button
                fullWidth
                variant="light"
                leftSection={<Copy size={15} />}
                onClick={copyInvite}
              >
                复制邀请链接
              </Button>
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
              <Sparkles size={18} />
            </span>
            <div className="brand-title-wrap">
              <span className="brand-title">海龟汤</span>
              <small>TURTLE SOUP CLUB</small>
            </div>
          </a>

          <nav aria-label="主导航">
            <a className={!code && !library ? 'active' : ''} href="#/">
              <Compass size={15} />
              <span>开一桌</span>
            </a>
            <a className={library ? 'active' : ''} href="#/library">
              <BookOpen size={15} />
              <span>逛题库</span>
            </a>
            {game.room && !code && (
              <a href={`#/room/${game.room.code}`}>
                <Radio size={15} />
                <span>回到房间</span>
              </a>
            )}
          </nav>

          <span className="header-note">
            <Bot size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
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
          <span>海龟汤 · TURTLE SOUP CLUB</span>
          <span>故事只是开始，问题才是线索。</span>
        </footer>
      </div>
    </GameProvider>
  );
}
