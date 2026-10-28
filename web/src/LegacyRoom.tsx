import React, { useEffect, useState } from 'react';
import { api } from './api';
import { actions, joinRoom, leaveRoom } from './socket';
import { clearToast, getSnapshot, notify, useGame } from './store';
import { remainingQuota } from './game';
import { usePageLoading } from './loading';
import {
  CandyAlert, CandyBadge, CandyButton, CandyCard, CandyEmptyState,
  CandyGameIcon, CandyIconButton, CandyInput, CandyList, CandyListItem,
  CandyModal, CandyNavigation, CandyPanel, CandySelect,
  useCandy, candySound, triggerCandyConfetti,
} from 'candy-ui';
import {
  AskBox, ContentWarning, GuessModal, HostPanel, PlayerList,
  QuestionLog, ReconnectBanner, RevealModal, Toast,
} from './components';
import { copyTextToClipboard } from './clipboard';
import { PageContainer } from './PageContainer';
import { RoomEntryState } from './RoomEntryState';

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

export function Room({ code, name, playerKey, onName: _onName, onLeave }: {
  code: string; name: string; playerKey: string;
  onName: (value: string) => void; onLeave: () => void;
}) {
  const game = useGame();
  const [guessOpen, setGuessOpen] = useState(false);
  const [revealModalOpen, setRevealModalOpen] = useState(false);
  const { room, joined, status } = game;
  usePageLoading(!room && !game.joinError && !!name.trim(), '正在加入房间...');
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
  if (!room) return <PageContainer className="room-entry-main" scroll={false}>
    <RoomEntryState code={code} error={game.joinError} needsName={!name.trim()} onBack={onLeave} />
  </PageContainer>;

  const me = room.players.find(p => p.key === playerKey);
  const disabled = !joined || status !== 'connected' || !me;
  const remaining = remainingQuota(room, playerKey);
  const playing = room.phase === 'playing';
  const turnName = room.players.find(p => p.key === room.turnKey)?.name ?? '等待在线玩家';
  const notMyTurn = room.settings.turnMode === 'turns' && room.turnKey !== playerKey;
  const copyInvite = async () => {
    const ok = await copyTextToClipboard(location.href);
    if (ok) {
      notify('邀请链接已复制');
      candySound.play('pop');
    } else {
      notify('复制失败');
    }
  };
  return <PageContainer>
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
        <AskBox remaining={remaining} disabled={disabled || !playing || notMyTurn} pending={!!me?.pending}
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
  </PageContainer>;
}

