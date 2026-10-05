'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGame, notify } from '../../../web/src/store';
import { joinRoom, leaveRoom, actions } from '../../../web/src/socket';
import {
  QuestionLog,
  AskBox,
  PlayerList,
  HostPanel,
  GuessModal,
  RevealModal,
  ContentWarning,
} from '../../../web/src/components';
import { remainingQuota } from '../../../web/src/game';
import { GameButton } from '../../../web/src/ui';
import { triggerCandyConfetti, candySound } from 'candy-ui';

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (typeof params.code === 'string' ? params.code : '').toUpperCase();
  const game = useGame();

  const [guessOpen, setGuessOpen] = useState(false);
  const [revealModalOpen, setRevealModalOpen] = useState(false);

  const room = game.room;
  const joined = game.joined;
  const status = game.status;

  const playerKey = typeof window !== 'undefined' ? localStorage.getItem('turtle:playerKey') || '' : '';
  const name = typeof window !== 'undefined' ? localStorage.getItem('turtle:name') || '' : '';

  useEffect(() => {
    if (!code) return;
    if (!name.trim()) {
      const input = prompt('请输入你的侦探昵称:')?.trim();
      if (!input) {
        router.push('/');
        return;
      }
      localStorage.setItem('turtle:name', input);
    }
    const currentKey = localStorage.getItem('turtle:playerKey') || `p-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('turtle:playerKey', currentKey);
    const currentName = localStorage.getItem('turtle:name') || '侦探';

    joinRoom({ code, name: currentName, playerKey: currentKey });
  }, [code, name, playerKey, router]);

  useEffect(() => {
    if (!room) return;
    const hasWin = room.guesses.some(g => g.outcome === '破解成功');
    if (hasWin || (room.phase === 'revealed' && room.reveal?.reason === 'solved')) {
      triggerCandyConfetti();
    }
  }, [room?.phase, room?.guesses.length]);

  const onLeave = () => {
    leaveRoom();
    router.push('/');
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify('邀请链接已复制');
      candySound.play('pop');
    } catch {
      notify('复制失败');
    }
  };

  if (!room) {
    return (
      <main>
        <h2>房间 {code}</h2>
        <p>正在加入房间...</p>
        <GameButton tone="grey" size="sm" onClick={onLeave}>返回首页</GameButton>
      </main>
    );
  }

  const me = room.players.find(p => p.key === playerKey);
  const disabled = !joined || status !== 'connected' || !me;
  const remaining = remainingQuota(room, playerKey);
  const playing = room.phase === 'playing';

  return (
    <main>
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
            disabled={disabled || !playing || !!me?.pending}
            hints={room.hints}
            totalHints={room.hintCount}
            isHost={room.hostKey === playerKey}
            canGuess={!disabled && playing && !me?.pending && (me?.guesses ?? 0) < room.settings.maxGuesses}
            remainingGuesses={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))}
            progress={room.progress}
            onAsk={text => {
              candySound.play('bubble');
              return actions.ask(text).catch(err => notify(err.message));
            }}
            onGuess={() => setGuessOpen(true)}
            onHint={() => actions.hint().catch(err => notify(err.message))}
          />
        </section>

        <aside className="room-sidebar">
          <PlayerList
            room={room}
            selfKey={playerKey}
            disabled={disabled}
            onKick={targetKey => actions.kick(targetKey).catch(err => notify(err.message))}
          />

          <HostPanel
            room={room}
            disabled={disabled || room.hostKey !== playerKey}
            onSettings={settings => actions.settings(settings).catch(err => notify(err.message))}
            onStart={puzzleId => actions.start(puzzleId).catch(err => notify(err.message))}
            onHint={() => actions.hint().catch(err => notify(err.message))}
            onReveal={() => actions.reveal().catch(err => notify(err.message))}
          />
        </aside>
      </div>

      {guessOpen && (
        <GuessModal
          disabled={disabled}
          remaining={Math.max(0, room.settings.maxGuesses - (me?.guesses ?? 0))}
          onClose={() => setGuessOpen(false)}
          onGuess={text => actions.guess(text).catch(err => notify(err.message))}
        />
      )}

      {room.phase === 'revealed' && room.reveal && (
        <RevealModal
          opened={revealModalOpen}
          onClose={() => setRevealModalOpen(false)}
          reveal={room.reveal}
          disabled={disabled}
          onRate={(score, funny) => actions.rate(score, funny).catch(err => notify(err.message))}
        />
      )}
    </main>
  );
}
