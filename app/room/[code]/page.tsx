'use client';

import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useGameRouter } from '../../gameNavigation';
import { useGame, notify } from '../../../web/src/store';
import { joinRoom, leaveRoom, actions } from '../../../web/src/socket';
import { ReconnectBanner } from '../../../web/src/components';
import { PageContainer, SectionLoading } from '../../../web/src/PageContainer';
import { RoomEntryState } from '../../../web/src/RoomEntryState';
import { copyTextToClipboard } from '../../../web/src/clipboard';
import { getOrCreatePlayerKey } from '../../../web/src/playerKey';
import { triggerCandyConfetti, CandyButton, CandyInput, CandyModal } from 'candy-ui';

const PlayingRoom = lazy(() => import('../../../web/src/PlayingRoom').then(module => ({ default: module.PlayingRoom })));
const WaitingRoom = lazy(() => import('../../../web/src/WaitingRoom').then(module => ({ default: module.WaitingRoom })));
const GuessModal = lazy(() => import('../../../web/src/components').then(module => ({ default: module.GuessModal })));
const RevealModal = lazy(() => import('../../../web/src/components').then(module => ({ default: module.RevealModal })));
const roomCodePattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export default function RoomPage() {
  const params = useParams();
  const router = useGameRouter();
  const code = (typeof params.code === 'string' ? params.code : '').toUpperCase();
  const validCode = roomCodePattern.test(code);
  const game = useGame();
  const room = game.room?.code === code ? game.room : null;
  const [guessOpen, setGuessOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [playerKey, setPlayerKey] = useState('');
  const [name, setName] = useState('');
  const [nameOpen, setNameOpen] = useState(false);
  const autoStarted = useRef<string | null>(null);
  const modeApplied = useRef<string | null>(null);
  useEffect(() => {
    if (!code || !validCode) return;
    const savedName = localStorage.getItem('turtle:name') || '';
    setName(savedName);
    const key = getOrCreatePlayerKey();
    setPlayerKey(key);
    if (!savedName.trim()) { setNameOpen(true); return; }
    joinRoom({ code, name: savedName, playerKey: key });
  }, [code, validCode]);
  useEffect(() => {
    if (!room || room.phase !== 'lobby' || room.hostKey !== playerKey || !game.joined) return;
    if (modeApplied.current !== code && room.round === 0) {
      modeApplied.current = code;
      try {
        const preferredMode = localStorage.getItem('turtle:preferredMode');
        if (preferredMode) {
          localStorage.removeItem('turtle:preferredMode');
          const nextTurnMode = preferredMode === 'turns' ? 'turns' : 'free';
          if (room.settings.turnMode !== nextTurnMode) {
            void actions.settings({ turnMode: nextTurnMode }).catch(() => {});
          }
        }
      } catch {}
    }
    const start = new URLSearchParams(window.location.search).get('start');
    if (!start || autoStarted.current === code) return;
    autoStarted.current = code;
    void actions.start(start === 'random' ? undefined : start).catch(err => notify(err.message));
  }, [code, room?.phase, room?.hostKey, room?.round, room?.settings.turnMode, playerKey, game.joined]);
  useEffect(() => {
    if (room?.phase === 'revealed') {
      setRevealOpen(true);
      if (room.reveal?.reason === 'solved') triggerCandyConfetti();
    }
  }, [room?.phase, room?.round]);
  const onLeave = () => { leaveRoom(); router.push('/'); };
  const copyInvite = async () => {
    notify(await copyTextToClipboard(`${window.location.origin}/room/${code}`) ? '邀请链接已复制' : '复制失败');
  };
  const nameModal = nameOpen && <CandyModal isOpen onClose={onLeave} title="填写侦探昵称">
    <CandyInput aria-label="侦探昵称" placeholder="请输入昵称" value={name} onChange={e => setName(e.target.value)} />
    <div className="actions-row"><CandyButton disabled={!name.trim()} onClick={() => {
      localStorage.setItem('turtle:name', name.trim());
      window.dispatchEvent(new Event('turtle:profile'));
      setNameOpen(false);
      joinRoom({ code, name: name.trim(), playerKey });
    }}>加入房间</CandyButton></div>
  </CandyModal>;
  if (!room) return <PageContainer className="room-entry-main" scroll={false}>
    <RoomEntryState code={code} error={!validCode ? '房间不存在或房间码无效（房间码为 6 位字母数字，不含 0/1/I/O）' : game.joinError} needsName={validCode && nameOpen} onBack={onLeave} />
    {validCode && nameModal}
  </PageContainer>;
  const me = room.players.find(player => player.key === playerKey);
  const disabled = !game.joined || game.status !== 'connected' || !me;
  return <PageContainer className={room.phase === 'lobby' ? 'waiting-main' : 'playing-main'}>
    <ReconnectBanner status={game.status} />
    <Suspense fallback={<SectionLoading label={room.phase === 'lobby' ? '正在准备房间…' : '正在准备对局…'} skeleton />}>
      {room.phase === 'lobby'
        ? <WaitingRoom room={room} selfKey={playerKey} disabled={disabled} onLeave={onLeave} onInvite={copyInvite} onSettings={actions.settings} onStart={actions.start} onKick={key => actions.kick(key).catch(err => notify(err.message))} />
        : <PlayingRoom room={room} selfKey={playerKey} disabled={disabled} onLeave={onLeave} onInvite={copyInvite} onGuess={() => setGuessOpen(true)} onReveal={() => setRevealOpen(true)} />}
    </Suspense>
    <Suspense fallback={null}>
      {guessOpen && <GuessModal disabled={disabled} remaining={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))} surface={room.puzzle?.surface} onClose={() => setGuessOpen(false)} onGuess={text => actions.guess(text).catch(err => notify(err.message))} />}
      {room.phase === 'revealed' && room.reveal && <RevealModal opened={revealOpen} onClose={() => setRevealOpen(false)} reveal={room.reveal} disabled={disabled} onRate={(score, funny) => actions.rate(score, funny).catch(err => notify(err.message))} />}
    </Suspense>
    {nameModal}
  </PageContainer>;
}
