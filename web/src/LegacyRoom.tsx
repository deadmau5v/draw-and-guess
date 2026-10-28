import React, { useEffect, useState } from 'react';
import { CandyButton, CandyInput, CandyModal } from 'candy-ui';
import { actions, joinRoom } from './socket';
import { notify, useGame } from './store';
import { PageContainer } from './PageContainer';
import { RoomEntryState } from './RoomEntryState';
import { WaitingRoom } from './WaitingRoom';
import { PlayingRoom } from './PlayingRoom';
import { GuessModal, ReconnectBanner, RevealModal } from './components';
import { copyTextToClipboard } from './clipboard';

/** Compatibility route: uses the same lobby and game views as Next. */
export function Room({ code, name, playerKey, onName, onLeave }: {
  code: string; name: string; playerKey: string;
  onName: (value: string) => void; onLeave: () => void;
}) {
  const game = useGame();
  const room = game.room?.code === code ? game.room : null;
  const [draftName, setDraftName] = useState(name);
  const [guessOpen, setGuessOpen] = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  useEffect(() => {
    if (name.trim()) joinRoom({ code, name: name.trim(), playerKey });
  }, [code, name, playerKey]);
  useEffect(() => { if (room?.phase === 'revealed') setRevealOpen(true); }, [room?.phase, room?.round]);
  const report = (error: unknown) => notify(error instanceof Error ? error.message : '操作失败');
  if (!room) return <PageContainer className="room-entry-main" scroll={false}>
    <RoomEntryState code={code} error={game.joinError} needsName={!name.trim()} onBack={onLeave} />
    {!name.trim() && <CandyModal isOpen title="填写昵称" onClose={onLeave}>
      <CandyInput label="你的昵称" value={draftName} maxLength={16} onChange={event => setDraftName(event.target.value)} />
      <CandyButton disabled={!draftName.trim()} onClick={() => onName(draftName.trim())}>加入房间</CandyButton>
    </CandyModal>}
  </PageContainer>;
  const me = room.players.find(player => player.key === playerKey);
  const disabled = !game.joined || game.status !== 'connected' || !me;
  const invite = async () => notify(await copyTextToClipboard(location.href) ? '邀请链接已复制' : '复制失败');
  return <PageContainer className={room.phase === 'lobby' ? 'waiting-main' : 'playing-main'}>
    <ReconnectBanner status={game.status} />
    {room.phase === 'lobby'
      ? <WaitingRoom room={room} selfKey={playerKey} disabled={disabled} onLeave={onLeave} onInvite={invite}
        onSettings={actions.settings} onStart={actions.start} onKick={key => actions.kick(key).catch(report)} />
      : <PlayingRoom room={room} selfKey={playerKey} disabled={disabled} onLeave={onLeave} onInvite={invite} onGuess={() => setGuessOpen(true)} onReveal={() => setRevealOpen(true)} />}
    {guessOpen && <GuessModal disabled={disabled} onClose={() => setGuessOpen(false)} onGuess={text => actions.guess(text).catch(report)} />}
    {room.phase === 'revealed' && room.reveal && <RevealModal opened={revealOpen} onClose={() => setRevealOpen(false)} reveal={room.reveal} disabled={disabled} onRate={(score, funny) => actions.rate(score, funny).catch(report)} />}
  </PageContainer>;
}
