'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGame, notify } from '../../../web/src/store';
import { joinRoom, leaveRoom, actions } from '../../../web/src/socket';
import { QuestionLog, AskBox, PlayerList, HostPanel, GuessModal, RevealModal, ContentWarning, ReconnectBanner } from '../../../web/src/components';
import { remainingQuota } from '../../../web/src/game';
import { triggerCandyConfetti, CandyButton, CandyPanel, CandyBadge, CandyGameIcon, CandyInput, CandyModal, CandySpinner } from 'candy-ui';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (typeof params.code === 'string' ? params.code : '').toUpperCase();
  const game = useGame();
  const room = game.room?.code === code ? game.room : null;
  const [guessOpen, setGuessOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [playerKey, setPlayerKey] = useState('');
  const [name, setName] = useState('');
  const [nameOpen, setNameOpen] = useState(false);
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
    <CandyPanel theme="frosted"><h2>房间 {code}</h2><div className="loading-state" role="status"><CandySpinner />正在加入房间...</div>
      <CandyButton variant="ghost" appearance="outline" onClick={onLeave}>返回首页</CandyButton>
    </CandyPanel>{nameModal}
  </main>;
  const me = room.players.find(p => p.key === playerKey);
  const disabled = !game.joined || game.status !== 'connected' || !me;
  const playing = room.phase === 'playing';
  return <main>
    <ReconnectBanner status={game.status} />
    <CandyPanel theme="frosted" className="room-topbar">
      <div><div className="actions-row"><CandyBadge variant="blue">第 {room.round} 局</CandyBadge><CandyBadge variant={playing ? 'green' : 'yellow'}>{{ lobby: '等待开局', playing: '推理中', revealed: '已揭晓' }[room.phase]}</CandyBadge></div><h2>{room.puzzle?.title ?? '等待开局'}</h2></div>
      <CandyButton variant="ghost" appearance="outline" rightIcon={<CandyGameIcon name="arrow-right" size={20} />} onClick={onLeave}>离开房间</CandyButton>
    </CandyPanel>
    <div className="actions-row room-invite"><span>房间码：</span><CandyBadge variant="blue">{room.code}</CandyBadge><CandyButton variant="blue" size="xs" leftIcon={<CandyGameIcon name="copy" size={18} />} onClick={copyInvite}>复制邀请链接</CandyButton></div>
    <div className="room-grid">
      <section className="room-main">
        <CandyPanel theme="frosted"><h3>本题汤面</h3>{room.puzzle ? <ContentWarning warning={room.puzzle.nsfl} id={room.puzzle.id}><h4>{room.puzzle.title}</h4><p className="story-body">{room.puzzle.surface}</p></ContentWarning> : <p>房主可在控制面板抽题开局。</p>}</CandyPanel>
        <QuestionLog room={room} />
        <AskBox remaining={remainingQuota(room, playerKey)} disabled={disabled || !playing || !!me?.pending} hints={room.hints} totalHints={room.hintCount} isHost={room.hostKey === playerKey}
          canGuess={!disabled && playing && !me?.pending && (me?.guesses ?? 0) < room.settings.maxGuesses} remainingGuesses={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))} progress={room.progress}
          onAsk={text => actions.ask(text).catch(err => notify(err.message))} onGuess={() => setGuessOpen(true)} onHint={() => actions.hint().catch(err => notify(err.message))} />
        {room.phase === 'revealed' && <CandyButton variant="yellow" onClick={() => setRevealOpen(true)} leftIcon={<CandyGameIcon name="book" size={22} />}>查看汤底与评价</CandyButton>}
      </section>
      <aside className="room-sidebar">
        <PlayerList room={room} selfKey={playerKey} disabled={disabled} onKick={key => actions.kick(key).catch(err => notify(err.message))} />
        <HostPanel room={room} disabled={disabled || room.hostKey !== playerKey} onSettings={settings => actions.settings(settings).catch(err => notify(err.message))} onStart={id => actions.start(id).catch(err => notify(err.message))} onHint={() => actions.hint().catch(err => notify(err.message))} onReveal={() => actions.reveal().catch(err => notify(err.message))} />
      </aside>
    </div>
    {guessOpen && <GuessModal disabled={disabled} remaining={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))} onClose={() => setGuessOpen(false)} onGuess={text => actions.guess(text).catch(err => notify(err.message))} />}
    {room.phase === 'revealed' && room.reveal && <RevealModal opened={revealOpen} onClose={() => setRevealOpen(false)} reveal={room.reveal} disabled={disabled} onRate={(score, funny) => actions.rate(score, funny).catch(err => notify(err.message))} />}
    {nameModal}
  </main>;
}
