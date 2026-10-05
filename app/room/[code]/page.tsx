'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useGameRouter } from '../../gameNavigation';
import { usePageLoading } from '../../../web/src/loading';
import { useGame, notify } from '../../../web/src/store';
import { joinRoom, leaveRoom, actions } from '../../../web/src/socket';
import { GuessModal, RevealModal, ReconnectBanner } from '../../../web/src/components';
import { PlayingRoom } from '../../../web/src/PlayingRoom';
import { WaitingRoom } from '../../../web/src/WaitingRoom';
import { triggerCandyConfetti, CandyButton, CandyPanel, CandyInput, CandyModal } from 'candy-ui';

export default function RoomPage() {
  const params = useParams();
  const router = useGameRouter();
  const code = (typeof params.code === 'string' ? params.code : '').toUpperCase();
  const game = useGame();
  const room = game.room?.code === code ? game.room : null;
  const [guessOpen, setGuessOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [playerKey, setPlayerKey] = useState('');
  const [name, setName] = useState('');
  const [nameOpen, setNameOpen] = useState(false);
  usePageLoading(!room && !game.joinError && !nameOpen, '正在加入房间...');
  const autoStarted = useRef<string | null>(null);
  useEffect(() => {
    if (!code) return;
    const savedName = localStorage.getItem('turtle:name') || '';
    setName(savedName);
    let key = localStorage.getItem('turtle:playerKey');
    if (!key) { key = `p-${crypto.randomUUID()}`; localStorage.setItem('turtle:playerKey', key); }
    setPlayerKey(key);
    if (!savedName.trim()) { setNameOpen(true); return; }
    joinRoom({ code, name: savedName, playerKey: key });
  }, [code]);
  useEffect(() => {
    if (!room || room.phase !== 'lobby' || room.hostKey !== playerKey || !game.joined) return;
    const start = new URLSearchParams(window.location.search).get('start');
    if (!start || autoStarted.current === code) return;
    autoStarted.current = code;
    void actions.start(start === 'random' ? undefined : start).catch(err => notify(err.message));
  }, [code, room?.phase, room?.hostKey, playerKey, game.joined]);
  useEffect(() => {
    if (room?.phase === 'revealed') {
      setRevealOpen(true);
      if (room.reveal?.reason === 'solved') triggerCandyConfetti();
    }
  }, [room?.phase, room?.round]);
  const onLeave = () => { leaveRoom(); router.push('/'); };
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/room/${code}`);
      notify('邀请链接已复制');
    } catch { notify('复制失败'); }
  };
  const nameModal = nameOpen && <CandyModal isOpen={nameOpen} onClose={onLeave} title="填写侦探昵称">
    <CandyInput aria-label="侦探昵称" placeholder="请输入昵称" value={name} onChange={e => setName(e.target.value)} />
    <div className="actions-row"><CandyButton disabled={!name.trim()} onClick={() => {
      localStorage.setItem('turtle:name', name.trim());
      setNameOpen(false);
      joinRoom({ code, name: name.trim(), playerKey });
    }}>加入房间</CandyButton></div>
  </CandyModal>;
  if (!room) return <main>
    <CandyPanel theme="frosted"><h2>房间 {code}</h2>{game.joinError
      ? <p role="alert">{game.joinError}</p>
      : <p>正在准备房间…</p>}
      <CandyButton variant="ghost" appearance="outline" onClick={onLeave}>返回首页</CandyButton>
    </CandyPanel>{nameModal}
  </main>;
  const me = room.players.find(p => p.key === playerKey);
  const disabled = !game.joined || game.status !== 'connected' || !me;
  if (room.phase === 'lobby') return <main className="waiting-main">
    <ReconnectBanner status={game.status} />
    <WaitingRoom room={room} selfKey={playerKey} disabled={disabled} onLeave={onLeave} onInvite={copyInvite}
      onSettings={actions.settings} onStart={actions.start} onKick={key => actions.kick(key).catch(err => notify(err.message))} />
    {nameModal}
  </main>;
  return <main className="playing-main">
    <ReconnectBanner status={game.status} />
    <PlayingRoom room={room} selfKey={playerKey} disabled={disabled} onLeave={onLeave} onInvite={copyInvite} onGuess={() => setGuessOpen(true)} onReveal={() => setRevealOpen(true)} />
    {guessOpen && <GuessModal disabled={disabled} remaining={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))} onClose={() => setGuessOpen(false)} onGuess={text => actions.guess(text).catch(err => notify(err.message))} />}
    {room.phase === 'revealed' && room.reveal && <RevealModal opened={revealOpen} onClose={() => setRevealOpen(false)} reveal={room.reveal} disabled={disabled} onRate={(score, funny) => actions.rate(score, funny).catch(err => notify(err.message))} />}
    {nameModal}
  </main>;
}
