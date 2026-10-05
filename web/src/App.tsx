import React, { useEffect, useState } from 'react';
import type { PuzzleSummary, SortKey } from '@shared/protocol';
import { api } from './api';
import { actions, joinRoom, leaveRoom } from './socket';
import { clearToast, getSnapshot, notify, useGame } from './store';
import { remainingQuota } from './game';
import {
  CandyAlert, CandyBadge, CandyButton, CandyCard, CandyCheckbox, CandyEmptyState,
  CandyGameIcon, CandyIconButton, CandyInput, CandyList, CandyListItem,
  CandyModal, CandyNavigation, CandyPanel, CandySelect, CandySpinner,
  CandyTab, CandyTabList, CandyTabs, useCandy, candySound, triggerCandyConfetti,
} from 'candy-ui';
import {
  AskBox, ContentWarning, GuessModal, HostPanel, PlayerList, PuzzleCard,
  QuestionLog, ReconnectBanner, RevealModal, Toast,
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
  { id: 'turtle', name: '小海龟', icon: 'heart' },
  { id: 'smile', name: '活力笑脸', icon: 'user' },
  { id: 'corgi', name: '侦探柯基', icon: 'search' },
  { id: 'anime', name: '炫彩少年', icon: 'star' },
  { id: 'panda', name: '呆萌熊猫', icon: 'heart' },
  { id: 'burger', name: '汉堡超人', icon: 'bowl' },
  { id: 'astronaut', name: '宇航员', icon: 'earth' },
  { id: 'fox', name: '侦探狐狸', icon: 'compass' },
  { id: 'gamer', name: '电竞少女', icon: 'controller' },
  { id: 'ghost', name: '萌趣幽灵', icon: 'user' },
  { id: 'robot', name: '智能机器', icon: 'settings' },
  { id: 'witch', name: '见习魔女', icon: 'light' },
];

function Leaderboard({ name: _name }: { name?: string }) {
  return <CandyEmptyState title="排行榜暂未开放" description="战绩榜单接入后将在这里展示，当前不展示模拟排名。" icon={<CandyGameIcon name="trophy" size={40} />} />;
}

function Rules() {
  return <CandyList aria-label="新手规则">
    {[
      '出题者提供一个不完整的故事（海龟汤）。',
      '你可以通过提问来获取“是 / 否 / 无关”的答案。',
      '根据线索进行推理，猜出故事的完整真相！',
    ].map((rule, index) => <CandyListItem key={rule}
      leading={<CandyBadge variant="blue" size="sm">{index + 1}</CandyBadge>} title={rule} />)}
  </CandyList>;
}

export function Home({ name, onName, onCreate, onJoin, busy = false }: {
  name: string;
  onName: (value: string) => void;
  onCreate: (start?: 'random' | 'chosen') => void;
  onJoin: (code: string) => void;
  busy?: boolean;
}) {
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<string | number>('classic');
  const [difficulty, setDifficulty] = useState<string | number>('medium');
  const [selectedAvatar, setSelectedAvatar] = useState(() => readStorage('turtle:avatar') || 'turtle');
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const avatar = AVATAR_PRESETS.find(preset => preset.id === selectedAvatar);
  const randomNames = ['推理小海龟', '迷雾名侦探', '机智小汤圆', '真相追踪者', '清汤名捕', '深海福尔摩斯', '超能大侦探', '逻辑探员'];
  const start = (random = false) => {
    if (busy || !name.trim()) {
      if (!name.trim()) {
        notify('先输入你的昵称');
        document.getElementById('nickname')?.focus();
      }
      return;
    }
    const clean = code.trim().toUpperCase();
    if (clean) {
      if (!roomCodePattern.test(clean)) { notify('请输入 6 位字母或数字房间码'); return; }
      onJoin(clean);
    } else if (random) onCreate('random');
    else onCreate();
  };
  const focusJoin = () => {
    const input = document.getElementById('room-code');
    input?.focus();
    input?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    notify('请在左侧输入 6 位房间号快速加入');
  };

  return <main className="game-main-content">
    <div className="sr-only">汤面 → 提问 → 是/不是/不相关 → 每人8问 → 还原真相</div>
    <CandyPanel theme="frosted">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 24 }}>
        <CandyPanel theme="frosted" ribbon="快速开始" ribbonColor="blue">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {avatar && avatar.id !== 'turtle'
              ? <CandyGameIcon name={avatar.icon} size={100} aria-label={avatar.name} aria-hidden={false} role="img" />
              : <img src="/assets/turtle-hero.png" alt="海龟汤吉祥物" style={{ width: 120, height: 120, objectFit: 'contain' }} />}
            <CandyIconButton aria-label="切换形象" size="sm" variant="blue"
              icon={<CandyGameIcon name="pencil" />} onClick={() => setAvatarModalOpen(true)} />
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="nickname-controls">
              <CandyInput id="nickname" label="你的昵称" aria-label="你的昵称" value={name}
                placeholder="输入昵称" onChange={e => onName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') start(); }} leftIcon={<CandyGameIcon name="user" />} />
              <CandyIconButton aria-label="随机昵称" size="sm" variant="blue"
                icon={<CandyGameIcon name="dice" />} onClick={() => {
                  const next = randomNames[Math.floor(Math.random() * randomNames.length)];
                  onName(next); saveStorage('turtle:name', next);
                }} />
            </div>
            <div>
              <p>游戏模式</p>
              <CandySelect id="game-mode" aria-label="游戏模式" value={mode} onChange={setMode} fullWidth
                options={[{ value: 'classic', label: '经典海龟汤' }, { value: 'free', label: '自由提问模式' }, { value: 'turns', label: '轮流提问模式' }]} />
            </div>
            <div>
              <p>难度选择</p>
              <CandySelect id="difficulty-select" aria-label="难度选择" value={difficulty} onChange={setDifficulty} fullWidth
                options={[{ value: 'all', label: '全部难度' }, { value: 'easy', label: '入门' }, { value: 'medium', label: '中等' }, { value: 'hard', label: '极度烧脑' }]} />
            </div>
            <CandyInput id="room-code" label="房间号" aria-label="房间号" value={code} maxLength={6}
              placeholder="可不填，留空则自动创建" leftIcon={<CandyGameIcon name="door" />}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') start(true); }} />
            <CandyButton variant="yellow" size="lg" fullWidth disabled={busy || !name.trim()}
              aria-label="单人随机一碗" leftIcon={<CandyGameIcon name="play" />} onClick={() => start(true)}>
              快速开始
            </CandyButton>
            <CandyButton variant="blue" size="lg" fullWidth disabled={busy || !name.trim()}
              aria-label="创建房间 →" leftIcon={<CandyGameIcon name="plus" />} onClick={() => start()}>
              创建房间
            </CandyButton>
          </div>
        </CandyPanel>
        <div style={{ display: 'grid', gap: 20 }}>
          <CandyPanel theme="frosted" ribbon="进入游戏" ribbonColor="blue">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
              <CandyCard title="创建房间" description="自定义规则，邀请好友" icon={<CandyGameIcon name="house" size={48} />}
                footer={<CandyButton variant="blue" disabled={busy || !name.trim()} onClick={() => start()}>创建</CandyButton>} />
              <CandyCard title="加入房间" description="输入房间号，快速加入" icon={<CandyGameIcon name="users" size={48} />}
                footer={<CandyButton variant="yellow" onClick={focusJoin}>加入房间</CandyButton>} />
              <CandyCard title="题库挑战" description="海量题目，单人练习" icon={<CandyGameIcon name="book" size={48} />}
                footer={<CandyButton variant="green" onClick={() => { location.hash = '/library'; }}>题库挑战</CandyButton>} />
              <CandyCard title="排行榜" description="看看谁才是推理之王" icon={<CandyGameIcon name="trophy" size={48} />}
                footer={<CandyButton variant="purple" onClick={() => setLeaderboardOpen(true)}>排行榜</CandyButton>} />
            </div>
          </CandyPanel>
          <CandyPanel theme="frosted" ribbon="新手规则" ribbonColor="gold">
            <img src="/assets/turtle-think.png" alt="思考解密小海龟" style={{ width: 84, height: 84, objectFit: 'contain' }} />
            <Rules />
          </CandyPanel>
        </div>
      </div>
    </CandyPanel>
    <CandyModal isOpen={avatarModalOpen} onClose={() => setAvatarModalOpen(false)} title="选择专属形象" titleStyle="ribbon" ribbonColor="blue">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {AVATAR_PRESETS.map(preset => <CandyButton key={preset.id} variant="blue"
          appearance={selectedAvatar === preset.id ? 'solid' : 'soft'} aria-pressed={selectedAvatar === preset.id}
          leftIcon={<CandyGameIcon name={preset.icon} />} onClick={() => {
            setSelectedAvatar(preset.id); saveStorage('turtle:avatar', preset.id); setAvatarModalOpen(false);
          }}>{preset.name}</CandyButton>)}
      </div>
    </CandyModal>
    <CandyModal isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} title="推理排行榜" titleStyle="ribbon" ribbonColor="gold">
      <Leaderboard name={name} />
    </CandyModal>
  </main>;
}

export function Library({ onChoose, busy }: { onChoose: (id: string) => void; busy: boolean }) {
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
      setLoading(true); setError(null);
      api.puzzles({ sort, q: q.trim(), excludeNsfl, limit: 60, offset }, controller.signal)
        .then(items => {
          setPuzzles(prev => offset === 0 ? items : [...prev, ...items]);
          setHasMore(items.length === 60);
        })
        .catch(err => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setError(err instanceof Error ? err.message : '加载失败');
        })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 150);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [sort, q, excludeNsfl, offset, refresh]);

  return <main>
    <div className="library-header">
      <div><h1>题库大厅</h1><p>精选经典海龟汤题目，在线联机推理解谜</p></div>
      <CandyButton variant="ghost" leftIcon={<CandyGameIcon name="arrow-left" />}
        onClick={() => { location.hash = '/'; }}>返回首页</CandyButton>
    </div>
    <CandyPanel theme="frosted">
      <CandyTabs value={sort} onChange={value => { setSort(value as SortKey); setOffset(0); setPuzzles([]); }}>
        <CandyTabList aria-label="题库排序">
          {([['good', '高好评'], ['mid', '中好评'], ['low', '低好评'], ['hot', '最热'], ['new', '最新']] as const)
            .map(([value, label]) => <CandyTab key={value} value={value}>{label}</CandyTab>)}
        </CandyTabList>
      </CandyTabs>
      <div className="search-row">
        <CandyInput id="search-input" label="搜索题目" aria-label="搜索题目" placeholder="搜索题目" value={q}
          leftIcon={<CandyGameIcon name="search" />} onChange={e => { setQ(e.target.value); setOffset(0); }} />
        <CandyCheckbox checked={excludeNsfl} label="排除重口"
          onChange={checked => { setExcludeNsfl(checked); setOffset(0); }} />
      </div>
    </CandyPanel>
    {error && <CandyAlert tone="error" title={error}
      icon={<CandyGameIcon name="info" />}
      action={<CandyButton variant="red" size="sm" onClick={() => setRefresh(v => v + 1)}>重试</CandyButton>} />}
    {loading && offset === 0 && <CandySpinner label="正在备汤..." />}
    <section className="puzzles-grid" aria-busy={busy || loading}>
      {puzzles.map(puzzle => <PuzzleCard key={puzzle.id} puzzle={puzzle} onChoose={id => { if (!busy) onChoose(id); }} />)}
    </section>
    {hasMore && !error && <CandyButton variant="blue" disabled={loading}
      onClick={() => setOffset(v => v + 60)}>加载更多故事</CandyButton>}
  </main>;
}

export function Room({ code, name, playerKey, onName: _onName, onLeave }: {
  code: string; name: string; playerKey: string;
  onName: (value: string) => void; onLeave: () => void;
}) {
  const game = useGame();
  const [guessOpen, setGuessOpen] = useState(false);
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const { room, joined, status } = game;
  const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    try { return await action(); }
    catch (error) { notify(error instanceof Error ? error.message : '操作失败'); return undefined; }
  };
  useEffect(() => {
    if (!name.trim()) return;
    try { joinRoom({ code, name: name.trim(), playerKey }); }
    catch (error) { notify(error instanceof Error ? error.message : '加入房间失败'); }
  }, [code, name, playerKey]);
  useEffect(() => {
    if (!room) return;
    if (room.guesses.some(g => g.outcome === '破解成功') || (room.phase === 'revealed' && room.reveal?.reason === 'solved')) triggerCandyConfetti();
  }, [room?.phase, room?.guesses.length]);
  if (!room) return <main><CandyPanel theme="frosted">
    <h2>进入房间 {code}</h2><CandySpinner label="连接中..." />
    <CandyButton variant="gray" size="sm" onClick={onLeave}>返回首页</CandyButton>
  </CandyPanel></main>;

  const me = room.players.find(p => p.key === playerKey);
  const disabled = !joined || status !== 'connected' || !me;
  const remaining = remainingQuota(room, playerKey);
  const playing = room.phase === 'playing';
  const turnName = room.players.find(p => p.key === room.turnKey)?.name ?? '等待在线玩家';
  const notMyTurn = room.settings.turnMode === 'turns' && room.turnKey !== playerKey;
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(location.href); notify('邀请链接已复制'); candySound.play('pop'); }
    catch { notify('复制失败'); }
  };
  return <main>
    <ReconnectBanner status={status} />
    <header className="room-topbar">
      <div>
        <CandyBadge variant="blue">第 {room.round} 局</CandyBadge>
        <CandyBadge variant={playing ? 'green' : 'yellow'}>({room.phase})</CandyBadge>
        <h2>{room.puzzle?.title ?? '等待开局'}</h2>
      </div>
      <CandyButton variant="gray" size="sm" aria-label="离开房间 ↗" leftIcon={<CandyGameIcon name="door" />} onClick={onLeave}>离开房间</CandyButton>
    </header>
    <div style={{ margin: '14px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span>房间码: <CandyBadge variant="blue">{room.code}</CandyBadge></span>
      <CandyButton variant="blue" size="xs" leftIcon={<CandyGameIcon name="copy" />} onClick={copyInvite}>复制邀请链接</CandyButton>
      {room.phase === 'revealed' && room.reveal && <CandyButton variant="yellow" onClick={() => setRevealModalOpen(true)}>查看汤底</CandyButton>}
    </div>
    <div className="room-grid">
      <section className="room-main">
        <CandyPanel theme="frosted" ribbon="本题汤面" ribbonColor="blue">
          {room.puzzle ? <ContentWarning warning={room.puzzle.nsfl} id={room.puzzle.id}>
            <h4>{room.puzzle.title}</h4><p className="story-body">{room.puzzle.surface}</p>
          </ContentWarning> : <p>房主可在控制面板抽题开局。</p>}
        </CandyPanel>
        <QuestionLog room={room} />
        <AskBox remaining={remaining} disabled={disabled || !playing || !!me?.pending || notMyTurn}
          turn={room.settings.turnMode === 'turns' && playing ? `轮到 ${turnName} 提问` : undefined}
          hints={room.hints} totalHints={room.hintCount} isHost={room.hostKey === playerKey}
          canGuess={!disabled && playing && !me?.pending && (me?.guesses ?? 0) < room.settings.maxGuesses}
          remainingGuesses={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))} progress={room.progress}
          flashVerdict={null} onAsk={text => { candySound.play('bubble'); return run(() => actions.ask(text)); }}
          onGuess={() => setGuessOpen(true)} onHint={() => run(() => actions.hint())} />
      </section>
      <aside className="room-sidebar">
        <PlayerList room={room} selfKey={playerKey} disabled={disabled} onKick={targetKey => run(() => actions.kick(targetKey))} />
        <HostPanel room={room} disabled={disabled || room.hostKey !== playerKey}
          onSettings={settings => run(() => actions.settings(settings))}
          onStart={puzzleId => run(async () => { if (room.phase === 'playing') await actions.reveal(); await actions.start(puzzleId); })}
          onHint={() => run(() => actions.hint())} onReveal={() => run(() => actions.reveal())} />
      </aside>
    </div>
    {guessOpen && <GuessModal disabled={disabled} remaining={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))}
      onClose={() => setGuessOpen(false)} onGuess={text => run(() => actions.guess(text))} />}
    {room.phase === 'revealed' && room.reveal && <RevealModal opened={revealModalOpen} onClose={() => setRevealModalOpen(false)}
      reveal={room.reveal} disabled={disabled} onRate={(score, funny) => run(() => actions.rate(score, funny))} />}
  </main>;
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
  const navigate = (hash: string) => { location.hash = hash; };
  const setNickname = (nextName: string) => { setName(nextName); saveStorage('turtle:name', nextName); };
  const startWhenJoined = (code: string, puzzleId?: string) => {
    const check = setInterval(() => {
      const room = getSnapshot().room;
      if (room?.code === code && room.hostKey === playerKey) {
        clearInterval(check); actions.start(puzzleId).catch(() => {});
      }
    }, 100);
    setTimeout(() => clearInterval(check), 5000);
  };
  const create = async (start?: 'random' | 'chosen') => {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const { code } = await api.createRoom({ name: name.trim(), playerKey });
      navigate(`/room/${code}`);
      if (start === 'random') startWhenJoined(code);
    } catch (error) { notify(error instanceof Error ? error.message : '创建房间失败'); }
    finally { setBusy(false); }
  };
  const choose = async (puzzleId: string) => {
    if (!name.trim()) { notify('请先输入你的昵称'); navigate('/'); return; }
    if (busy) return;
    setBusy(true);
    try {
      const { code } = await api.createRoom({ name: name.trim(), playerKey });
      navigate(`/room/${code}`); startWhenJoined(code, puzzleId);
    } catch (error) { notify(error instanceof Error ? error.message : '创建房间失败'); }
    finally { setBusy(false); }
  };
  const leave = async () => { try { await leaveRoom(); } finally { navigate('/'); } };
  const roomMatch = route.match(/^\/room\/([A-Za-z0-9_-]+)$/);
  const code = roomMatch ? roomMatch[1].toUpperCase() : null;
  const library = route === '/library';
  return <div className="app-container">
    <a className="skip-link" href="#main-content" onClick={e => {
      e.preventDefault(); document.getElementById('main-content')?.focus();
    }}>跳到游戏内容</a>
    <header className="game-top-header">
      <div className="game-header-inner">
        <CandyNavigation aria-label="主导航" value={library ? 'library' : code ? 'room' : 'home'}
          items={[
            { value: 'home', label: '首页', href: '#/', icon: <CandyGameIcon name="house" /> },
            { value: 'library', label: '题库', href: '#/library', icon: <CandyGameIcon name="book" /> },
            { value: 'rank', label: '排行榜', icon: <CandyGameIcon name="trophy" /> },
            { value: 'guide', label: '新手指南', icon: <CandyGameIcon name="compass" /> },
          ]} onChange={value => {
            if (value === 'rank') setLeaderboardOpen(true);
            else if (value === 'guide') setGuideOpen(true);
          }} />
        <a href="#/" className="header-center-logo">
          <img src="/assets/banner-logo.png" alt="海龟汤推理局" className="header-banner-img" />
        </a>
        <div className="header-right-group">
          <CandyIconButton aria-label="系统通知" title="系统通知" variant="yellow"
            icon={<CandyGameIcon name="notification" />} onClick={() => notify('欢迎来到海龟汤推理局！当前精选 105 道原汁原味开源推理谜题，快来挑战吧！')} />
          <CandyButton variant="blue" appearance="soft" title="查看个人推理战绩"
            leftIcon={<CandyGameIcon name="user" />} onClick={() => setLeaderboardOpen(true)}>
            {name || '推理小海龟'}
          </CandyButton>
          <CandyButton variant="ghost" size="xs" appearance="outline"
            title={soundEnabled ? '音效已开启' : '音效已静音'} aria-pressed={soundEnabled}
            leftIcon={<CandyGameIcon name={soundEnabled ? 'volume' : 'cross'} />}
            onClick={() => setSoundEnabled(!soundEnabled)}>{soundEnabled ? '声音' : '静音'}</CandyButton>
        </div>
      </div>
    </header>
    <div id="main-content" tabIndex={-1} style={{ outline: 'none' }}>
      {code ? <Room key={code} code={code} name={name} playerKey={playerKey} onName={setNickname} onLeave={leave} />
        : library ? <Library onChoose={choose} busy={busy} />
        : <Home name={name} onName={setNickname} onCreate={start => void create(start)}
          onJoin={nextCode => { if (roomCodePattern.test(nextCode)) navigate(`/room/${nextCode}`); }} busy={busy} />}
    </div>
    <Toast message={game.message} onClose={clearToast} />
    <CandyModal isOpen={leaderboardOpen} onClose={() => setLeaderboardOpen(false)} title="推理排行榜" titleStyle="ribbon" ribbonColor="gold">
      <Leaderboard />
    </CandyModal>
    <CandyModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} title="海龟汤新手指南" titleStyle="ribbon" ribbonColor="blue">
      <p><strong>什么是海龟汤？</strong></p>
      <p>海龟汤是一种情境推理游戏（Lateral Thinking Puzzle）。出题者给出一个反常或看似矛盾的案发现场（汤面），玩家通过提问获取线索，最终推理出故事的完整全貌（汤底）。</p>
      <CandyList aria-label="提问规则">
        <CandyListItem title="玩家只能提出一般疑问句（答案可以用“是”或“不是”回答的问题）。" />
        <CandyListItem title="AI 裁判仅会回答：是、不是、不相关或不确定。" />
        <CandyListItem title="每人拥有 8 次提问机会，可申请补充线索，最终提交真相还原！" />
      </CandyList>
    </CandyModal>
  </div>;
}
