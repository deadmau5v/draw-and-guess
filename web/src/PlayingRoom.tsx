'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  CandyAlert, CandyAvatar, CandyBadge, CandyButton, CandyEmptyState, CandyGameIcon,
  CandyList, CandyListItem, CandyPanel, CandyTextarea,
} from 'candy-ui';
import type { RoomView } from '@shared/protocol';
import { LIMITS } from '@shared/protocol';
import { resolveAvatar } from './avatars';
import { cdnUrl } from './cdn';
import { PlayerList } from './components';
import { DrawingCanvas } from './DrawingCanvas';
import { actions } from './socket';
import { notify } from './store';
import './drawing-room.css';

export function PlayingRoom({ room, selfKey, disabled, onLeave, onInvite, onNext }: {
  room: RoomView; selfKey: string; disabled: boolean; onLeave: () => void; onInvite: () => void | Promise<void>;
  onGuess?: () => void; onNext?: () => void; onReveal?: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const sendingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef('');
  const context = `${room.code}:${room.round}:${selfKey}`;
  contextRef.current = context;
  const host = room.hostKey === selfKey;
  const playing = room.phase === 'playing';
  const drawer = room.drawerKey === selfKey;
  const me = room.players.find(player => player.key === selfKey);
  const canCompose = !disabled && playing && !!me && !drawer;
  const canSend = canCompose && !me?.pending && !sending;
  const guesses = room.guesses;

  useEffect(() => {
    setText('');
    setError('');
  }, [context]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [guesses.length, guesses.at(-1)?.outcome]);

  useEffect(() => {
    if (!canCompose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement;
      const typing = active instanceof HTMLElement && (
        active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable || !!active.closest('[role="dialog"]')
      );
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !typing) {
        event.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
      } else if (event.key === 'Escape' && active === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canCompose]);

  const run = (task: Promise<unknown>) => void task.catch(err => notify(err instanceof Error ? err.message : '操作失败'));
  const submit = () => {
    const value = text.trim();
    if (!canSend || !value || sendingRef.current) return;
    const submittedText = text;
    const submittedContext = context;
    sendingRef.current = true;
    setSending(true);
    setError('');
    inputRef.current?.focus({ preventScroll: true });
    // Keep the original input until acknowledgement: a rejected or disconnected request never loses it.
    void actions.guess(value, room.round).then(() => {
      if (contextRef.current === submittedContext) setText(current => current === submittedText ? '' : current);
    }).catch(err => {
      if (contextRef.current !== submittedContext) return;
      const message = err instanceof Error ? err.message : '猜词发送失败，请重试';
      setError(message);
      notify(message);
    }).finally(() => {
      sendingRef.current = false;
      setSending(false);
    });
  };

  return <div className="pictionary-room" aria-label="你画我猜对局">
    <aside className="pictionary-sidebar">
      <CandyPanel theme="frosted" className="pictionary-room-info" style={{ padding: 12 }}>
        <strong>房间 {room.code}</strong>
        <div className="pictionary-meta">
          <CandyBadge variant="blue">第 {room.round} 轮</CandyBadge>
          <CandyBadge variant={playing ? 'green' : 'yellow'}>{playing ? '进行中' : '本轮结束'}</CandyBadge>
        </div>
        <CandyButton variant="blue" size="xs" fullWidth onClick={() => run(Promise.resolve().then(onInvite))} leftIcon={<CandyGameIcon name="copy" size={16} />}>邀请好友</CandyButton>
        <CandyButton variant="ghost" size="xs" fullWidth onClick={onLeave}>离开房间</CandyButton>
      </CandyPanel>
      <div className="pictionary-players"><PlayerList room={room} selfKey={selfKey} disabled={disabled} compact onKick={key => run(actions.kick(key))} /></div>
    </aside>

    <section className="pictionary-board" aria-label="画板">
      <DrawingCanvas room={room} selfKey={selfKey} disabled={disabled} />
      {room.phase === 'revealed' && room.reveal && <CandyPanel theme="frosted" className="pictionary-reveal" style={{ padding: 12 }}>
        <CandyAlert tone={room.reveal.reason === 'solved' ? 'success' : 'info'} title="本轮答案">
          <strong>{room.reveal.bottom}</strong>
          {room.reveal.winnerName && <p>{room.reveal.winnerName} 猜对了！</p>}
        </CandyAlert>
        {host ? <CandyButton variant="green" disabled={disabled} onClick={() => onNext ? onNext() : run(actions.start())} leftIcon={<CandyGameIcon name="refresh" size={18} />}>下一轮</CandyButton> : <p>等待房主开始下一轮</p>}
      </CandyPanel>}
    </section>

    <CandyPanel theme="frosted" className="pictionary-chat" style={{ padding: 12 }}>
      <h2>猜词记录</h2>
      <div className="pictionary-chat-log" ref={logRef} role="log" aria-label="猜词记录" aria-live="polite">
        {!guesses.length ? <CandyEmptyState title="还没有人猜词" description="看画，把想到的答案发出来。" icon={<CandyGameIcon name="pencil" />} /> : <CandyList variant="plain" size="sm" divided>
          {guesses.map(guess => <CandyListItem key={guess.id}
            leading={<CandyAvatar size="xs" src={cdnUrl(resolveAvatar(guess.avatar ?? room.players.find(player => player.key === guess.playerKey)?.avatar))} alt={guess.playerName} />}
            title={guess.playerName}
            trailing={<div className="pictionary-guess-result"><CandyBadge variant={guess.outcome === '破解成功' ? 'green' : guess.outcome === '判定中' ? 'blue' : 'gray'}>{guess.outcome === '破解成功' ? '猜对了' : guess.outcome === '判定中' ? '发送中' : guess.outcome === '出错' ? '发送失败' : '没猜中'}</CandyBadge>{typeof guess.points === 'number' && guess.points > 0 && <CandyBadge variant="yellow">+{guess.points} 分</CandyBadge>}</div>}>
            <p className="pictionary-guess-text">{guess.text}</p>
          </CandyListItem>)}
        </CandyList>}
      </div>
      <form className="pictionary-composer" aria-label="发送猜词" onSubmit={event => { event.preventDefault(); submit(); }}>
        <p className="pictionary-compose-status" role="status">{!playing ? '本轮已结束' : drawer ? '你是画手，请让其他玩家猜词' : disabled ? '连接中，请稍候' : me?.pending || sending ? '猜词发送中…' : '输入答案，按 Enter 发送'}</p>
        {error && <CandyAlert tone="error" title="发送失败">{error}</CandyAlert>}
        <CandyTextarea ref={inputRef} aria-label="猜词答案" rows={2} maxLength={LIMITS.guessMax} value={text} disabled={!canCompose}
          placeholder={drawer ? '画手不能猜词' : '你猜画的是什么？'} onChange={event => setText(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); submit(); } }} />
        <CandyButton type="submit" variant="green" fullWidth disabled={!canSend || !text.trim()} leftIcon={<CandyGameIcon name="arrow-right" size={18} />}>发送猜词</CandyButton>
      </form>
    </CandyPanel>
  </div>;
}
