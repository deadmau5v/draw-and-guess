import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  CandyAlert, CandyAvatar, CandyBadge, CandyButton, CandyCard, CandyEmptyState,
  CandyGameIcon, CandyList, CandyListItem, CandyModal, CandyNotification,
  CandyPanel, CandyProgress, CandyStatusBadge, CandyTextarea,
} from 'candy-ui';
import type { CandyColor } from 'candy-ui';
import type { ProgressView, PuzzleSummary, RevealView, RoomView, Settings, Verdict } from '@shared/protocol';
import { verdictTone } from './game';
import { resolveAvatar } from './avatars';

const AVATAR_CHARACTERS = ['bear', 'cat', 'fox', 'rabbit', 'frog', 'smile', 'crown', 'user'] as const;
export function getPlayerCharacter(key: string, name: string): (typeof AVATAR_CHARACTERS)[number] {
  let hash = 0;
  const str = key + name;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AVATAR_CHARACTERS[hash % AVATAR_CHARACTERS.length];
}

function verdictColor(value: string): CandyColor {
  const tone = verdictTone(value);
  return tone === 'pending' ? 'blue' : tone === 'darkred' ? 'red' : tone === 'grey' ? 'gray' : tone as CandyColor;
}

export function renderClueContent(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span>
      {parts.map((part, index) => part.startsWith('**') && part.endsWith('**')
        ? <strong key={index}>{part.slice(2, -2)}</strong>
        : part)}
    </span>
  );
}

export function ContentWarning({ warning, id, children }: { warning: boolean; id: string; children: ReactNode }) {
  const [accepted, setAccepted] = useState<string | null>(null);
  if (warning && accepted !== id) {
    return (
      <CandyAlert
        role="alert"
        tone="warning"
        title="高能内容预警"
        action={<CandyButton type="button" variant="yellow" size="sm" onClick={() => setAccepted(id)}>我已了解，继续</CandyButton>}
      >
        故事可能涉及惊悚、暴力或令人不适的情节。
      </CandyAlert>
    );
  }
  return <>{children}</>;
}

export function AskBox({
  remaining, disabled, pending = false, turn, hints, totalHints, isHost, canGuess,
  remainingGuesses, progress, flashVerdict, onAsk, onGuess, onHint,
}: {
  remaining: number;
  disabled: boolean;
  pending?: boolean;
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
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const submit = () => {
    if (disabled || pending || remaining <= 0 || !text.trim()) return;
    onAsk(text.trim());
    setText('');
    questionInput.current?.focus({ preventScroll: true });
  };

  return (
    <CandyPanel theme="frosted">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <strong>提问</strong>
          {flashVerdict && <CandyBadge variant={verdictColor(flashVerdict)}>判定：{flashVerdict}</CandyBadge>}
          {totalHints !== undefined && totalHints > 0 && (
            <CandyBadge variant="blue">线索 {hints?.length ?? 0}/{totalHints}</CandyBadge>
          )}
          <CandyBadge variant="gray">{remaining === Infinity ? '不限次数' : `剩余 ${remaining} 问`}</CandyBadge>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onGuess && (
            <CandyButton type="button" variant="yellow" size="sm" disabled={!canGuess} onClick={onGuess}>
              还原真相 {remainingGuesses !== undefined ? `(${remainingGuesses}次)` : ''}
            </CandyButton>
          )}
          {isHost && onHint && totalHints !== undefined && (hints?.length ?? 0) < totalHints && (
            <CandyButton type="button" variant="blue" size="sm" disabled={disabled} onClick={onHint}>
              公开提示 ({(hints?.length ?? 0) + 1}/{totalHints})
            </CandyButton>
          )}
        </div>
      </div>
      {progress && (
        <div style={{ marginBlock: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{progress.status}</span>
            <span>{Math.round(progress.score)}%</span>
          </div>
          <CandyProgress value={Math.min(100, Math.max(0, progress.score))} variant="blue" height={8} aria-label="推理进度" />
        </div>
      )}
      {hints && hints.length > 0 && (
        <CandyList variant="plain" size="sm" divided style={{ marginBlock: 12 }}>
          {hints.map((hint, i) => (
            <CandyListItem key={i} leading={<CandyBadge variant="blue">线索 {i + 1}</CandyBadge>}>
              {renderClueContent(hint)}
            </CandyListItem>
          ))}
        </CandyList>
      )}
      {turn && <CandyAlert tone="info" style={{ marginBlock: 8 }}>{turn}</CandyAlert>}
      <CandyTextarea
        ref={questionInput}
        aria-label="你的问题"
        maxLength={120}
        rows={2}
        value={text}
        showCount
        disabled={disabled}
        placeholder="向 AI 提问是非题（例如：他认识这个人吗？死因与水有关吗？）"
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <CandyButton
          type="button"
          variant="blue"
          size="sm"
          aria-label="提问 →"
          rightIcon={<CandyGameIcon name="arrow-right" size={16} />}
          disabled={disabled || pending || remaining <= 0 || !text.trim()}
          onClick={submit}
        >
          提问
        </CandyButton>
      </div>
    </CandyPanel>
  );
}

export function QuestionLog({ room }: { room: RoomView }) {
  const end = useRef<HTMLDivElement>(null);
  const events = [
    ...room.log.map(q => ({ ...q, result: q.verdict, kind: '提问' })),
    ...room.guesses.map(g => ({ ...g, result: g.outcome, kind: '还原真相' })),
  ].sort((a, b) => a.at - b.at);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest' });
  }, [events.length]);

  return (
    <CandyPanel theme="frosted">
      <h3>推理记录 ({events.length} 条)</h3>
      <div role="log" aria-label="问答与还原记录" style={{ maxHeight: 480, overflowY: 'auto' }}>
        {events.length === 0 && (
          <CandyEmptyState
            title="等待第一位侦探提问"
            description="支持是非提问。可从人物关系、关键道具、地点或反常现象切入。"
            icon={<CandyGameIcon name="user-group" />}
          />
        )}
        {events.length > 0 && (
          <CandyList variant="card" size="sm">
            {events.map(event => (
              <CandyListItem key={event.id}>
                <CandyCard role="article" style={{ width: '100%' }}
                  title={(
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <CandyAvatar src={resolveAvatar(event.avatar ?? room.players.find(p => p.key === event.playerKey)?.avatar)} alt={event.playerName} size="xs" />
                      <strong>{event.playerName}</strong>
                      <span> · {event.kind}</span>
                    </span>
                  )}
                  footer={<CandyBadge variant={verdictColor(event.result)}>{event.result}</CandyBadge>}
                >
                  <time dateTime={new Date(event.at).toISOString()}>
                    {new Date(event.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </time>
                  <p>{event.text}</p>
                </CandyCard>
              </CandyListItem>
            ))}
          </CandyList>
        )}
        <div ref={end} />
      </div>
    </CandyPanel>
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
    <div role="group" aria-label="故事评价" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {([
        { score: 1, label: '好汤', variant: 'green' },
        { score: 0, label: '一般', variant: 'yellow' },
        { score: -1, label: '不喜欢', variant: 'pink' },
      ] as const).map(({ score, label, variant }) => (
        <CandyButton key={score} type="button" variant={rated === score ? variant : 'ghost'}
          appearance={rated === score ? 'solid' : 'outline'} size="xs" shape="pill"
          aria-pressed={rated === score} disabled={disabled} onClick={() => click(score)}>
          {label}
        </CandyButton>
      ))}
      <CandyButton type="button" variant={funny ? 'yellow' : 'ghost'}
        appearance={funny ? 'solid' : 'outline'} size="xs" shape="pill"
        aria-pressed={funny} disabled={disabled} onClick={toggleFunny}>
        好笑
      </CandyButton>
    </div>
  );
}

export function RevealModal({ opened, onClose, reveal, disabled, onRate }: {
  opened: boolean;
  onClose: () => void;
  reveal: RevealView;
  disabled: boolean;
  onRate: (score: 1 | 0 | -1, funny: boolean) => void;
}) {
  if (!opened) return null;
  return (
    <CandyModal isOpen={opened} onClose={onClose} showCloseButton={false}
      title={reveal.reason === 'exhausted' ? '游戏结束 · 真相揭晓' : '恭喜破案！真相揭晓'} theme="frosted">
      <CandyAlert tone={reveal.reason === 'exhausted' ? 'info' : 'success'}>{reveal.bottom}</CandyAlert>
      <div style={{ marginBlock: 14 }}>
        <p>为本题打分：</p>
        <RatingBar onRate={onRate} disabled={disabled} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <CandyButton type="button" variant="blue" size="sm" onClick={onClose}>关闭</CandyButton>
      </div>
    </CandyModal>
  );
}

export function RevealPanel({ reveal, disabled, onRate }: { reveal: RevealView; disabled: boolean; onRate: (score: 1 | 0 | -1, funny: boolean) => void }) {
  return (
    <CandyPanel theme="frosted" style={{ marginTop: 20 }}>
      <h3>真相大白</h3>
      <CandyAlert tone="success">{reveal.bottom}</CandyAlert>
      <div style={{ marginTop: 14 }}><RatingBar onRate={onRate} disabled={disabled} /></div>
    </CandyPanel>
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
    <CandyModal isOpen onClose={onClose} title="还原真相" showCloseButton={false} theme="frosted">
      <p>剩余 {remaining} 次还原机会</p>
      <CandyTextarea aria-label="你的故事还原" maxLength={500} rows={5} value={text}
        placeholder="写出你推测出的完整故事真相（因果、关键人物、凶器或隐藏事实）…"
        onChange={e => setText(e.target.value)} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <CandyButton type="button" variant="gray" appearance="outline" size="sm" onClick={onClose}>取消</CandyButton>
        <CandyButton type="button" variant="yellow" size="sm" disabled={disabled || remaining <= 0 || !text.trim()} onClick={submit}>
          提交还原
        </CandyButton>
      </div>
    </CandyModal>
  );
}

export function PuzzleCard({ puzzle, onChoose }: { puzzle: PuzzleSummary; onChoose: (id: string) => void }) {
  return (
    <CandyCard title={puzzle.title} description={puzzle.surfacePreview}
      footer={(
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <CandyBadge variant="blue">难度: {puzzle.difficulty}/5</CandyBadge>
          <CandyButton type="button" variant="green" size="sm" aria-label="▷ 用这题开房 ↗"
            leftIcon={<CandyGameIcon name="play" size={16} />}
            rightIcon={<CandyGameIcon name="arrow-right" size={16} />}
            onClick={() => onChoose(puzzle.id)}>用这题开房</CandyButton>
        </div>
      )} />
  );
}

export function PlayerList({ room, selfKey, disabled, onKick, compact = false }: {
  room: RoomView;
  selfKey: string;
  disabled: boolean;
  onKick: (key: string) => void;
  compact?: boolean;
}) {
  const host = room.hostKey === selfKey;
  return (
    <CandyPanel theme="frosted" style={compact ? { padding: 12, fontSize: 12 } : undefined}>
      <h4 style={compact ? { fontSize: 14, margin: '0 0 10px' } : undefined}>同桌玩家 ({room.players.length}/8)</h4>
      <CandyList variant="plain" divided size="sm">
        {room.players.map(player => (
          <CandyListItem key={player.key} highlight={player.key === selfKey}
            leading={<CandyAvatar src={resolveAvatar(player.avatar)} alt={player.name} size="xs" status={player.online ? 'online' : 'offline'} />}
            title={(
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <strong style={compact ? { fontSize: 13 } : undefined}>{player.name}</strong>
                {player.isHost && <CandyStatusBadge status="host" label="[房主]" size="sm" />}
                {player.key === selfKey && <CandyBadge variant="gray" size="sm">(你)</CandyBadge>}
              </span>
            )}
            description={player.online ? `${player.asked}问 ${player.guesses}还原` : '离线'}
            trailing={host && player.key !== selfKey ? (
              <CandyButton type="button" variant="red" size="xs" disabled={disabled} onClick={() => onKick(player.key)}>移出</CandyButton>
            ) : undefined} />
        ))}
      </CandyList>
    </CandyPanel>
  );
}

export function HostPanel({ room, disabled, onSettings: _onSettings, onStart, onHint, onReveal }: {
  room: RoomView;
  disabled: boolean;
  onSettings: (settings: Partial<Settings>) => void;
  onStart: (id?: string) => void;
  onHint: () => void;
  onReveal: () => void;
}) {
  const [revealOpen, setRevealOpen] = useState(false);
  return (
    <CandyPanel theme="frosted">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h4>房主控制</h4>
        <CandyBadge variant="blue">({room.phase})</CandyBadge>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CandyButton type="button" variant="green" size="md" fullWidth disabled={disabled} onClick={() => onStart()}>
          随机抽题 · 立即开局
        </CandyButton>
        {room.phase === 'playing' && (
          <>
            <CandyButton type="button" variant="blue" size="sm" fullWidth
              disabled={disabled || room.hints.length >= room.hintCount} onClick={onHint}>
              公开提示 ({room.hints.length}/{room.hintCount})
            </CandyButton>
            <CandyButton type="button" variant="red" size="sm" fullWidth disabled={disabled} onClick={() => setRevealOpen(true)}>
              提前揭晓汤底
            </CandyButton>
          </>
        )}
      </div>
      {revealOpen && (
        <CandyModal isOpen onClose={() => setRevealOpen(false)} title="确认提前揭晓汤底？"
          showCloseButton={false} closeOnOverlayClick={false} theme="frosted">
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <CandyButton type="button" variant="gray" appearance="outline" size="sm" onClick={() => setRevealOpen(false)}>取消</CandyButton>
            <CandyButton type="button" variant="red" size="sm" onClick={() => { setRevealOpen(false); onReveal(); }}>确认揭晓</CandyButton>
          </div>
        </CandyModal>
      )}
    </CandyPanel>
  );
}

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  return message ? (
    <CandyNotification role="alert" title={message} onClose={onClose} closeLabel="关闭通知"
      style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1100, maxWidth: 'calc(100vw - 32px)' }} />
  ) : null;
}

export function ReconnectBanner({ status }: { status: 'offline' | 'connecting' | 'connected' }) {
  if (status === 'connected') return null;
  return (
    <CandyAlert role="status" tone={status === 'connecting' ? 'info' : 'error'} style={{ marginBottom: 16 }}>
      {status === 'connecting' ? '正在连接游戏服务器…' : '网络连接已中断，正在重连…'}
    </CandyAlert>
  );
}

