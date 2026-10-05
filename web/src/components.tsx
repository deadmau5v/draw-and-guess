import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from './api';
import { GameButton } from './ui';
import type { ProgressView, PuzzleSummary, RevealView, RoomView, Settings, Verdict } from '@shared/protocol';
import { verdictTone } from './game';
import { CandyAvatar } from 'candy-ui';

const AVATAR_CHARACTERS = ['bear', 'cat', 'fox', 'rabbit', 'frog', 'smile', 'crown', 'user'] as const;
export function getPlayerCharacter(key: string, name: string): (typeof AVATAR_CHARACTERS)[number] {
  let hash = 0;
  const str = key + name;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AVATAR_CHARACTERS[hash % AVATAR_CHARACTERS.length];
}

export function renderClueContent(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={index} style={{ color: 'var(--accent, #5eead4)' }}>
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      })}
    </span>
  );
}

export function ContentWarning({ warning, id, children }: { warning: boolean; id: string; children: ReactNode }) {
  const [accepted, setAccepted] = useState<string | null>(null);
  if (warning && accepted !== id) {
    return (
      <div role="alert" className="content-warning">
        <h4>高能内容预警</h4>
        <p>故事可能涉及惊悚、暴力或令人不适的情节。</p>
        <GameButton tone="yellow" size="sm" onClick={() => setAccepted(id)}>我已了解，继续</GameButton>
      </div>
    );
  }
  return <>{children}</>;
}

export function AskBox({
  remaining,
  disabled,
  turn,
  hints,
  totalHints,
  isHost,
  canGuess,
  remainingGuesses,
  progress,
  flashVerdict,
  onAsk,
  onGuess,
  onHint,
}: {
  remaining: number;
  disabled: boolean;
  turn?: string;
  hints?: string[];
  totalHints?: number;
  isHost?: boolean;
  canGuess?: boolean;
  remainingGuesses?: number;
  progress?: ProgressView | null;
  flashVerdict?: Verdict | null;
  onAsk: (text: string) => void;
  onGuess?: () => void;
  onHint?: () => void;
}) {
  const [text, setText] = useState('');
  const submit = () => {
    if (disabled || remaining <= 0 || !text.trim()) return;
    onAsk(text.trim());
    setText('');
  };

  return (
    <div className="ask-box">
      <div className="ask-box-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <strong>提问</strong>
          {flashVerdict && <span className="flash-verdict">判定：{flashVerdict}</span>}
          {totalHints !== undefined && totalHints > 0 && (
            <span className="clue-count-badge">线索 {hints?.length ?? 0}/{totalHints}</span>
          )}
          <span>{remaining === Infinity ? '不限次数' : `剩余 ${remaining} 问`}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onGuess && (
            <GameButton tone="yellow" size="sm" disabled={!canGuess} onClick={onGuess}>
              还原真相 {remainingGuesses !== undefined ? `(${remainingGuesses}次)` : ''}
            </GameButton>
          )}
          {isHost && onHint && totalHints !== undefined && (hints?.length ?? 0) < totalHints && (
            <GameButton tone="blue" size="sm" disabled={disabled} onClick={onHint}>
              公开提示 ({((hints?.length ?? 0) + 1)}/{totalHints})
            </GameButton>
          )}
        </div>
      </div>

      {progress && (
        <div className="progress-wrap">
          <div className="progress-header">
            <span>{progress.status}</span>
            <span>{Math.round(progress.score)}%</span>
          </div>
          <div style={{ height: 8, background: '#cbdde9', borderRadius: 9999, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.max(0, progress.score))}%`,
                height: '100%',
                background: '#0068f0',
                borderRadius: 9999,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {hints && hints.length > 0 && (
        <div className="clues-box">
          {hints.map((hint, i) => (
            <div key={i} className="clue-item">
              <span className="clue-badge">线索 {i + 1}</span>
              <div>{renderClueContent(hint)}</div>
            </div>
          ))}
        </div>
      )}

      {turn && <p style={{ margin: '4px 0', color: '#0068f0', fontWeight: 600 }}>{turn}</p>}

      <textarea
        aria-label="你的问题"
        className="ask-textarea"
        maxLength={120}
        rows={2}
        value={text}
        disabled={disabled || remaining <= 0}
        placeholder="向 AI 提问是非题（例如：他认识这个人吗？死因与水有关吗？）"
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="input-footer">
        <small style={{ color: 'var(--text-muted)' }}>{text.length}/120</small>
        <GameButton
          tone="blue"
          size="sm"
          disabled={disabled || remaining <= 0 || !text.trim()}
          onClick={submit}
        >
          提问 →
        </GameButton>
      </div>
    </div>
  );
}

export function QuestionLog({ room }: { room: RoomView }) {
  const end = useRef<HTMLDivElement>(null);
  const events = [
    ...room.log.map(q => ({ ...q, result: q.verdict, kind: '提问' })),
    ...room.guesses.map(g => ({ ...g, result: g.outcome, kind: '还原真相' }))
  ].sort((a, b) => a.at - b.at);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' });
  }, [events.length]);

  return (
    <div className="log-box">
      <h3>推理记录 ({events.length} 条)</h3>
      <div className="log-list" role="log" aria-label="问答与还原记录">
        {events.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 12px', color: 'var(--text-muted)' }}>
            <h4>等待第一位侦探提问</h4>
            <p>支持是非提问。可从人物关系、关键道具、地点或反常现象切入。</p>
          </div>
        )}
        {events.map(event => (
          <article key={event.id} className="log-entry">
            <div className="log-entry-header">
              <div className="log-entry-user">
                <CandyAvatar character={getPlayerCharacter(event.id, event.playerName)} size="xs" />
                <strong>{event.playerName}</strong>
                <span> · {event.kind}</span>
              </div>
              <time dateTime={new Date(event.at).toISOString()}>
                {new Date(event.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </time>
            </div>
            <p className="log-entry-text">{event.text}</p>
            <span className={`verdict ${verdictTone(event.result)}`}>
              {event.result}
            </span>
          </article>
        ))}
        <div ref={end} />
      </div>
    </div>
  );
}

export function RatingBar({ onRate, disabled }: { onRate: (score: 1 | 0 | -1, funny: boolean) => void; disabled: boolean }) {
  const [rated, setRated] = useState<number | null>(null);
  const [funny, setFunny] = useState(false);
  const click = (score: 1 | 0 | -1) => {
    if (disabled || rated !== null) return;
    setRated(score);
    onRate(score, funny);
  };
  const toggleFunny = () => {
    if (disabled) return;
    const next = !funny;
    setFunny(next);
    if (rated !== null) onRate(rated as 1 | 0 | -1, next);
  };
  return (
    <div role="group" aria-label="故事评价" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <button
        type="button"
        className={`candy-btn candy-btn-xs candy-btn-pill ${rated === 1 ? 'candy-btn-green candy-btn-solid' : 'candy-btn-ghost candy-btn-outline'}`}
        aria-pressed={rated === 1}
        disabled={disabled}
        onClick={() => click(1)}
      >
        好汤
      </button>
      <button
        type="button"
        className={`candy-btn candy-btn-xs candy-btn-pill ${rated === 0 ? 'candy-btn-yellow candy-btn-solid' : 'candy-btn-ghost candy-btn-outline'}`}
        aria-pressed={rated === 0}
        disabled={disabled}
        onClick={() => click(0)}
      >
        一般
      </button>
      <button
        type="button"
        className={`candy-btn candy-btn-xs candy-btn-pill ${rated === -1 ? 'candy-btn-pink candy-btn-solid' : 'candy-btn-ghost candy-btn-outline'}`}
        aria-pressed={rated === -1}
        disabled={disabled}
        onClick={() => click(-1)}
      >
        不喜欢
      </button>
      <button
        type="button"
        className={`candy-btn candy-btn-xs candy-btn-pill ${funny ? 'candy-btn-yellow candy-btn-solid' : 'candy-btn-ghost candy-btn-outline'}`}
        aria-pressed={funny}
        disabled={disabled}
        onClick={toggleFunny}
      >
        好笑
      </button>
    </div>
  );
}

export function RevealModal({
  opened,
  onClose,
  reveal,
  disabled,
  onRate,
}: {
  opened: boolean;
  onClose: () => void;
  reveal: RevealView;
  disabled: boolean;
  onRate: (score: 1 | 0 | -1, funny: boolean) => void;
}) {
  if (!opened) return null;
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(16, 35, 75, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(3px)',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className="modal-dialog">
        <h3 style={{ margin: '0 0 12px 0', fontSize: '1.35rem', fontWeight: 700, color: reveal.reason === 'exhausted' ? '#df1645' : '#194a2b' }}>
          {reveal.reason === 'exhausted' ? '游戏结束 · 真相揭晓' : '恭喜破案！真相揭晓'}
        </h3>
        <div style={{ background: '#f8fafc', border: '1.5px solid #cbdde9', borderRadius: '14px', padding: '16px', margin: '14px 0', fontSize: '1rem', lineHeight: '1.7' }}>
          {reveal.bottom}
        </div>
        <div style={{ margin: '14px 0' }}>
          <small style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>为本题打分：</small>
          <RatingBar onRate={onRate} disabled={disabled} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
          <GameButton tone="blue" size="sm" onClick={onClose}>关闭</GameButton>
        </div>
      </div>
    </div>
  );
}

export function RevealPanel({ reveal, disabled, onRate }: { reveal: RevealView; disabled: boolean; onRate: (score: 1 | 0 | -1, funny: boolean) => void }) {
  return (
    <div className="story-panel" style={{ marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 12px 0', color: '#194a2b' }}>真相大白</h3>
      <div className="story-body" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
        {reveal.bottom}
      </div>
      <div style={{ marginTop: '14px' }}>
        <RatingBar onRate={onRate} disabled={disabled} />
      </div>
    </div>
  );
}

export function GuessModal({ disabled, remaining, onClose, onGuess }: { disabled: boolean; remaining: number; onClose: () => void; onGuess: (text: string) => void }) {
  const [text, setText] = useState('');
  const submit = () => {
    if (disabled || remaining <= 0 || !text.trim()) return;
    onGuess(text.trim());
    onClose();
  };
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(16, 35, 75, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(2px)',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" className="modal-dialog">
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 700 }}>还原真相</h3>
        <p style={{ margin: '0 0 14px 0', color: 'var(--text-muted)' }}>剩余 {remaining} 次还原机会</p>
        <textarea
          aria-label="你的故事还原"
          className="ask-textarea"
          maxLength={500}
          rows={5}
          value={text}
          placeholder="写出你推测出的完整故事真相（因果、关键人物、凶器或隐藏事实）…"
          onChange={e => setText(e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
          <GameButton tone="grey" size="sm" onClick={onClose}>取消</GameButton>
          <GameButton tone="yellow" size="sm" disabled={disabled || remaining <= 0 || !text.trim()} onClick={submit}>
            提交还原
          </GameButton>
        </div>
      </div>
    </div>
  );
}

export function PuzzleCard({ puzzle, onChoose }: { puzzle: PuzzleSummary; onChoose: (id: string) => void }) {
  return (
    <div className="puzzle-card">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
          <h4 style={{ margin: 0 }}>{puzzle.title}</h4>
          <span className="brand-badge">难度: {puzzle.difficulty}/5</span>
        </div>
        <p className="puzzle-preview">{puzzle.surfacePreview}</p>
      </div>
      <div className="puzzle-meta">
        <small style={{ color: 'var(--text-muted)' }}>难度: {puzzle.difficulty}/5</small>
        <GameButton tone="green" size="sm" onClick={() => onChoose(puzzle.id)}>▷ 用这题开房 ↗</GameButton>
      </div>
    </div>
  );
}

export function PlayerList({
  room,
  selfKey,
  disabled,
  onKick,
}: {
  room: RoomView;
  selfKey: string;
  disabled: boolean;
  onKick: (key: string) => void;
}) {
  const host = room.hostKey === selfKey;
  return (
    <div className="player-list">
      <h4>同桌玩家 ({room.players.length}/8)</h4>
      <ul>
        {room.players.map(player => (
          <li key={player.key} className="player-item">
            <div className="player-item-main">
              <CandyAvatar character={getPlayerCharacter(player.key, player.name)} size="xs" />
              <div>
                <span style={{ fontWeight: 600 }}>{player.name}</span>
                {player.isHost && <span style={{ color: '#0068f0', fontWeight: 600 }}> [房主]</span>}
                {player.key === selfKey && <span style={{ color: 'var(--text-muted)' }}> (你)</span>}
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {player.online ? `${player.asked}问 ${player.guesses}还原` : '离线'}
                </div>
              </div>
            </div>
            {host && player.key !== selfKey && (
              <GameButton tone="red" size="compact-xs" disabled={disabled} onClick={() => onKick(player.key)}>
                移出
              </GameButton>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HostPanel({
  room,
  disabled,
  onSettings,
  onStart,
  onHint,
  onReveal,
}: {
  room: RoomView;
  disabled: boolean;
  onSettings: (settings: Partial<Settings>) => void;
  onStart: (id?: string) => void;
  onHint: () => void;
  onReveal: () => void;
}) {
  const [revealOpen, setRevealOpen] = useState(false);

  return (
    <div className="host-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4>房主控制</h4>
        <span className="brand-badge">({room.phase})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <GameButton tone="green" size="md" fullWidth disabled={disabled} onClick={() => onStart()}>
          随机抽题 · 立即开局
        </GameButton>
        {room.phase === 'playing' && (
          <>
            <GameButton
              tone="blue"
              size="sm"
              fullWidth
              disabled={disabled || room.hints.length >= room.hintCount}
              onClick={onHint}
            >
              公开提示 ({room.hints.length}/{room.hintCount})
            </GameButton>
            <GameButton
              tone="red"
              size="sm"
              fullWidth
              disabled={disabled}
              onClick={() => setRevealOpen(true)}
            >
              提前揭晓汤底
            </GameButton>
          </>
        )}
      </div>

      {revealOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(16, 35, 75, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div role="dialog" aria-modal="true" className="modal-dialog">
            <p style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600 }}>确认提前揭晓汤底？</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <GameButton tone="grey" size="sm" onClick={() => setRevealOpen(false)}>取消</GameButton>
              <GameButton tone="red" size="sm" onClick={() => { setRevealOpen(false); onReveal(); }}>确认揭晓</GameButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  return message ? (
    <div role="alert" className="toast">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="关闭通知">×</button>
    </div>
  ) : null;
}

export function ReconnectBanner({ status }: { status: 'offline' | 'connecting' | 'connected' }) {
  if (status === 'connected') return null;
  return (
    <div
      role="status"
      style={{
        background: status === 'connecting' ? '#eaf2ff' : '#ffebee',
        color: status === 'connecting' ? '#0068f0' : '#c62828',
        border: `1.5px solid ${status === 'connecting' ? '#0068f0' : '#ef5350'}`,
        borderRadius: '12px',
        padding: '10px 16px',
        marginBottom: '16px',
        fontWeight: 600,
        textAlign: 'center',
      }}
    >
      {status === 'connecting' ? '正在连接游戏服务器…' : '网络连接已中断，正在重连…'}
    </div>
  );
}
