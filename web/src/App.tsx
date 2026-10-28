import React, { lazy, Suspense, useEffect, useState } from 'react';
import { api } from './api';
import { actions, leaveRoom } from './socket';
import { clearToast, getSnapshot, notify, useGame } from './store';
import { GameHeader } from './GameHeader';
import { AppShell, PageContainer, SectionLoading } from './PageContainer';
import { Toast } from './components';
import { getOrCreatePlayerKey } from './playerKey';

const HomeView = lazy(() => import('./LegacyHome').then(module => ({ default: module.Home })));
const RoomView = lazy(() => import('./LegacyRoom').then(module => ({ default: module.Room })));
const LibraryView = lazy(() => import('./LibraryRoute').then(module => ({ default: module.Library })));
// Public compatibility exports stay lazy too; static re-exports would defeat code splitting.
export function Home(props: React.ComponentProps<typeof import('./LegacyHome').Home>) {
  return <Suspense fallback={null}><HomeView {...props} /></Suspense>;
}
export function Room(props: React.ComponentProps<typeof import('./LegacyRoom').Room>) {
  return <Suspense fallback={null}><RoomView {...props} /></Suspense>;
}
export function Library(props: React.ComponentProps<typeof import('./LibraryRoute').Library>) {
  return <Suspense fallback={null}><LibraryView {...props} /></Suspense>;
}
const roomCodePattern = /^[A-Z0-9]{6}$/;
const readStorage = (key: string) => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };

export default function App() {
  const [route, setRoute] = useState(() => location.hash.slice(1) || '/');
  const [name, setName] = useState(() => readStorage('turtle:name'));
  const [playerKey] = useState(getOrCreatePlayerKey);
  const game = useGame();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const sync = () => setRoute(location.hash.slice(1) || '/');
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const navigate = (hash: string) => { location.hash = hash; };
  const setNickname = (nextName: string) => {
    setName(nextName);
    try { localStorage.setItem('turtle:name', nextName); } catch {}
    window.dispatchEvent(new Event('turtle:profile'));
  };
  const startWhenJoined = (code: string, puzzleId?: string) => {
    const check = setInterval(() => {
      const room = getSnapshot().room;
      if (room?.code === code && room.hostKey === playerKey && room.phase === 'lobby') {
        clearInterval(check); void actions.start(puzzleId).catch(error => notify(error.message));
      }
    }, 100);
    setTimeout(() => clearInterval(check), 15000);
  };
  const create = async (start?: 'random' | 'chosen') => {
    if (start === 'chosen') { navigate('/library'); return; }
    if (!name.trim() || busy) return;
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
  const leave = async () => { try { leaveRoom(); } finally { navigate('/'); } };
  const roomMatch = route.match(/^\/room\/([A-Za-z0-9_-]+)$/);
  const code = roomMatch ? roomMatch[1].toUpperCase() : null;
  return <AppShell header={<GameHeader pathname={route} onNavigate={navigate} name={name} />}
    notifications={<Toast message={game.message} onClose={clearToast} />}>
    <Suspense fallback={<PageContainer><SectionLoading label="正在切换场景…" skeleton /></PageContainer>}>
      {code ? <RoomView key={code} code={code} name={name} playerKey={playerKey} onName={setNickname} onLeave={leave} />
        : route === '/library' ? <LibraryView onChoose={choose} busy={busy} />
        : <HomeView name={name} onName={setNickname} onCreate={start => void create(start)}
          onJoin={nextCode => { if (roomCodePattern.test(nextCode)) navigate(`/room/${nextCode}`); }} busy={busy} />}
    </Suspense>
  </AppShell>;
}
