import React, { useEffect, useRef, useState } from 'react';
import { CandyAlert, CandyAvatar, CandyBadge, CandyButton, CandyGameIcon, CandyInput, CandyList, CandyListItem, CandyModal, CandyNotification, CandyPanel, CandyStatusBadge } from 'candy-ui';
import type { RevealView, RoomView } from '@shared/protocol';
import { LIMITS } from '@shared/protocol';
import { findDuplicateGuess } from './game';
import { resolveAvatar } from './avatars';
import { cdnUrl } from './cdn';
import { getSnapshot, notify } from './store';

export function RevealModal({ opened, onClose, reveal }: {
  opened: boolean; onClose: () => void; reveal: RevealView;
  disabled?: boolean; onRate?: (score: 1 | 0 | -1, funny: boolean) => void;
}) {
  if (!opened) return null;
  return <CandyModal isOpen onClose={onClose} title={reveal.reason === 'solved' ? '猜对了！' : '回合结束'} theme="frosted">
    <CandyAlert tone={reveal.reason === 'solved' ? 'success' : 'info'} title="答案">
      <p style={{ whiteSpace: 'pre-wrap' }}>{reveal.bottom}</p>
    </CandyAlert>
    <div className="actions-row"><CandyButton variant="blue" onClick={onClose}>返回对局</CandyButton></div>
  </CandyModal>;
}

export function GuessModal({ disabled, onClose, onGuess }: {
  disabled: boolean; remaining?: number; surface?: string;
  onClose: () => void; onGuess: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const submitting = useRef(false);
  const submit = () => {
    const value = text.trim();
    if (disabled || !value || submitting.current) return;
    if (findDuplicateGuess(getSnapshot().room, value)) { notify('这个答案已经提交过，换一个试试。'); return; }
    submitting.current = true;
    onGuess(value); onClose();
  };
  return <CandyModal isOpen onClose={onClose} title="猜词" theme="frosted">
    <CandyInput aria-label="你的答案" maxLength={LIMITS.guessMax} value={text} placeholder="输入你猜到的词"
      disabled={disabled} onChange={event => setText(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
      }} />
    <div className="actions-row">
      <CandyButton variant="gray" appearance="outline" onClick={onClose}>取消</CandyButton>
      <CandyButton variant="yellow" disabled={disabled || !text.trim()} onClick={submit}>提交答案</CandyButton>
    </div>
  </CandyModal>;
}

export function PlayerList({ room, selfKey, disabled, onKick, compact = false }: {
  room: RoomView; selfKey: string; disabled: boolean; onKick: (key: string) => void; compact?: boolean;
}) {
  const host = room.hostKey === selfKey;
  return <CandyPanel theme="frosted" style={compact ? { padding: 12, fontSize: 12 } : undefined}>
    <h2 style={compact ? { fontSize: 14 } : undefined}>玩家 ({room.players.length}/{LIMITS.maxPlayers})</h2>
    <CandyList variant="plain" divided size="sm">
      {room.players.map(player => <CandyListItem key={player.key} highlight={player.key === selfKey}
        leading={<CandyAvatar src={cdnUrl(resolveAvatar(player.avatar))} alt={player.name} size="xs" status={player.online ? 'online' : 'offline'} />}
        title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <strong>{player.name}</strong>
          {player.isHost && <CandyStatusBadge status="host" label="房主" size="sm" />}
          {room.phase === 'playing' && room.drawerKey === player.key && <CandyBadge variant="yellow" size="sm">画手</CandyBadge>}
          {player.key === selfKey && <CandyBadge variant="gray" size="sm">你</CandyBadge>}
          {!player.online && <CandyBadge variant="gray" size="sm">离线</CandyBadge>}
          {player.device && <CandyBadge variant="blue" size="sm" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}><CandyGameIcon name={player.device.kind === 'stylus' ? 'pencil' : 'controller'} size={12} /> {player.device.label.replace(/\s*\([^)]*\)/g, '')}</CandyBadge>}
        </span>}
        description={`本轮 ${player.roundPoints ?? 0} 分 · 总分 ${player.totalPoints ?? 0} 分`}
        trailing={host && player.key !== selfKey ? <CandyButton variant="red" size="xs" disabled={disabled} onClick={() => onKick(player.key)}>移出</CandyButton> : undefined} />)}
    </CandyList>
  </CandyPanel>;
}

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  return message ? <CandyNotification role="alert" title={message} onClose={onClose} closeLabel="关闭通知"
    style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, maxWidth: 'calc(100vw - 32px)' }} /> : null;
}

export function ReconnectBanner({ status }: { status: 'offline' | 'connecting' | 'connected' }) {
  if (status === 'connected') return null;
  return <CandyAlert role="status" tone={status === 'connecting' ? 'info' : 'error'} style={{ marginBottom: 16 }}>
    {status === 'connecting' ? '正在连接游戏服务器…' : '网络连接已中断，正在重连…'}
  </CandyAlert>;
}
