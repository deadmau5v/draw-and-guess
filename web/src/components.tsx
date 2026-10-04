import React, { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Badge, Loader, Modal, NumberInput, Paper, Select, Switch, Textarea, TextInput } from '@mantine/core';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { api } from './api';
import { GameButton } from './ui';
import {
  AlertIcon,
  BookIcon,
  CheckCircleIcon,
  CloseIcon,
  CompassIcon,
  CrossCircleIcon,
  CrownIcon,
  DiceIcon,
  EyeIcon,
  FlameIcon,
  HelpCircleIcon,
  LightbulbIcon,
  LoaderIcon,
  MehIcon,
  MessageIcon,
  MinusCircleIcon,
  PlayIcon,
  SendIcon,
  SmileIcon,
  SparkleIcon,
  StarIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  TrophyIcon,
  UsersIcon,
  ZapIcon,
} from './icons/GameIcons';
import type { ProgressView, PuzzleSummary, RevealView, RoomView, Settings, Verdict } from '@shared/protocol';
import { verdictTone } from './game';

export function renderClueContent(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const inner = part.slice(2, -2);
          return (
            <strong key={index} style={{ color: 'var(--accent)', fontWeight: 600 }}>
              {inner}
            </strong>
          );
        }
        return part;
      })}
    </span>
  );
}

export function CluesCard({
  hints,
  totalHints,
  isHost,
  disabled,
  onHint,
}: {
  hints: string[];
  totalHints: number;
  isHost: boolean;
  disabled: boolean;
  onHint?: () => void;
}) {
  if (totalHints === 0 && hints.length === 0) return null;

  return (
    <Paper className="hints-card" withBorder p="md" radius="md">
      <div className="section-head" style={{ marginBottom: hints.length > 0 ? 12 : 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="card-icon-wrap" style={{ width: 28, height: 28, background: 'rgba(94, 234, 212, 0.12)', display: 'grid', placeItems: 'center', borderRadius: 8 }}>
            <LightbulbIcon size={18} animate />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14 }}>公开线索 / 提示</h3>
            <span className="eyebrow" style={{ fontSize: 11, color: 'var(--accent)' }}>
              已公开 {hints.length} / {totalHints} 条
            </span>
          </div>
        </div>

        {/* 提示按钮直接整合在提示卡片右上角！ */}
        {isHost && onHint && hints.length < totalHints && (
          <GameButton
            size="xs"
            variant="filled"
            color="teal"
            disabled={disabled}
            leftSection={<LightbulbIcon size={15} animate />}
            onClick={onHint}
          >
            公开下一条提示 ({hints.length + 1}/{totalHints})
          </GameButton>
        )}
        {hints.length >= totalHints && totalHints > 0 && (
          <Badge variant="subtle" color="teal" size="sm">已全部公开</Badge>
        )}
      </div>

      {hints.length === 0 ? (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
          {isHost ? '本题包含线索。推理陷入僵局时，点击右上角按钮向全员公开提示。' : '当前暂未公开线索，房主可在必要时揭示关键提示。'}
        </p>
      ) : (
        <div className="clues-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {hints.map((hint, i) => (
            <div key={i} className="clue-item">
              <Badge color="teal" variant="light" size="sm" style={{ flexShrink: 0, marginTop: 2 }}>
                线索 {String(i + 1).padStart(2, '0')}
              </Badge>
              <div className="clue-text">
                {renderClueContent(hint)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Paper>
  );
}

export function ContentWarning({ warning, id, children }: { warning: boolean; id: string; children: ReactNode }) {
  const [accepted, setAccepted] = useState<string | null>(null);
  if (warning && accepted !== id) {
    return (
      <Alert color="yellow" icon={<AlertIcon size={20} animate />} title="高能内容预警">
        <p style={{ margin: '6px 0 12px' }}>故事可能涉及惊悚、暴力、反常或令人不适的情节，请根据个人承受能力选择阅读。</p>
        <GameButton color="yellow" variant="light" size="xs" onClick={() => setAccepted(id)}>我已了解，继续</GameButton>
      </Alert>
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
  const submit = () => { if (disabled || remaining <= 0 || !text.trim()) return; onAsk(text.trim()); setText(''); };
  const flashClass = flashVerdict === '是'
    ? 'flash-green'
    : flashVerdict === '不是'
    ? 'flash-red'
    : flashVerdict === '不相关'
    ? 'flash-gray'
    : flashVerdict === '不确定'
    ? 'flash-yellow'
    : '';

  return (
    <Paper className={`ask-box ${flashClass}`} withBorder p="md" radius="md">
      <div className="section-head" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageIcon size={18} animate />
            <h3 style={{ margin: 0, fontSize: 15 }}>提问</h3>
          </div>
          {flashVerdict && (
            <Badge
              color={flashVerdict === '是' ? 'teal' : flashVerdict === '不是' ? 'red' : flashVerdict === '不确定' ? 'yellow' : 'gray'}
              variant="filled"
              size="sm"
              leftSection={getVerdictIcon(flashVerdict)}
            >
              判定：{flashVerdict}
            </Badge>
          )}
          {totalHints !== undefined && totalHints > 0 && (
            <Badge variant="light" color="teal" size="sm" leftSection={<LightbulbIcon size={14} animate />}>
              线索 {hints?.length ?? 0}/{totalHints}
            </Badge>
          )}
          {isHost && onHint && totalHints !== undefined && (hints?.length ?? 0) < totalHints && (
            <GameButton
              size="compact-xs"
              variant="filled"
              color="teal"
              disabled={disabled}
              leftSection={<LightbulbIcon size={13} animate />}
              onClick={onHint}
            >
              公开下一条提示 ({((hints?.length ?? 0) + 1)}/{totalHints})
            </GameButton>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <Badge variant="light" color="teal" leftSection={<ZapIcon size={15} animate />}>
            {remaining === Infinity ? '不限次数' : `剩余 ${remaining} 问`}
          </Badge>
          {onGuess && (
            <GameButton
              size="xs"
              variant="light"
              color="yellow"
              disabled={!canGuess}
              leftSection={<LightbulbIcon size={15} animate />}
              onClick={onGuess}
            >
              还原真相 {remainingGuesses !== undefined ? `(${remainingGuesses}次)` : ''}
            </GameButton>
          )}
        </div>
      </div>

      {progress && (
        <div className="terminal-progress-wrap" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 4, color: 'var(--muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CompassIcon size={16} animate />
              <span>推理进度：<b style={{ color: 'var(--text)' }}>{progress.status}</b></span>
            </span>
            <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--accent)', fontWeight: 600 }}>
              {Math.round(progress.score)}%
            </span>
          </div>
          <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progress.score))}%`,
                background: 'linear-gradient(90deg, #14b8a6, #5eead4)',
                borderRadius: 2,
                transition: 'width 0.4s ease-out',
              }}
            />
          </div>
        </div>
      )}

      {hints && hints.length > 0 && (
        <div className="terminal-hints-box" style={{ marginBottom: 10 }}>
          <div className="clues-list" style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto' }}>
            {hints.map((hint, i) => (
              <div key={i} className="clue-item" style={{ padding: '6px 10px', fontSize: 13 }}>
                <Badge color="teal" variant="light" size="xs" style={{ flexShrink: 0, marginTop: 1 }}>
                  线索 {i + 1}
                </Badge>
                <div className="clue-text" style={{ fontSize: 13, lineHeight: 1.5 }}>
                  {renderClueContent(hint)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {turn && <p className="turn-note" style={{ margin: '0 0 8px' }}>{turn}</p>}

      <Textarea
        aria-label="你的问题"
        maxLength={120}
        minRows={2}
        maxRows={4}
        autosize
        value={text}
        disabled={disabled || remaining <= 0}
        placeholder="向 AI 提问是非题（例如：他认识那个人吗？水是用来喝的吗？）"
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="input-footer">
        <small>{text.length}/120 · Shift+Enter 换行</small>
        <GameButton
          disabled={disabled || remaining <= 0 || !text.trim()}
          leftSection={<SendIcon size={16} animate />}
          onClick={submit}
        >
          提问 →
        </GameButton>
      </div>
    </Paper>
  );
}

function getVerdictIcon(result: string) {
  if (result === '判定中') return <LoaderIcon size={14} animate />;
  if (result === '是') return <CheckCircleIcon size={16} animate />;
  if (result === '不是') return <CrossCircleIcon size={16} animate />;
  if (result === '不相关') return <MinusCircleIcon size={16} animate />;
  if (result === '不确定') return <HelpCircleIcon size={16} animate />;
  if (result === '破解成功') return <TrophyIcon size={16} animate />;
  if (result === '接近真相') return <FlameIcon size={16} animate />;
  return <HelpCircleIcon size={16} animate />;
}

export function QuestionLog({ room }: { room: RoomView }) {
  const end = useRef<HTMLDivElement>(null);
  const events = [...room.log.map(q => ({ ...q, result: q.verdict, kind: '提问' })), ...room.guesses.map(g => ({ ...g, result: g.outcome, kind: '还原真相' }))].sort((a, b) => a.at - b.at);
  useEffect(() => { end.current?.scrollIntoView?.({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' }); }, [events.length, events.filter(e => e.result === '判定中').length]);
  const colors: Record<string, string> = { green: 'teal', red: 'red', gray: 'gray', yellow: 'yellow', pending: 'blue', darkred: 'red' };
  return (
    <Paper className="log-card" withBorder p="md" radius="md">
      <div className="section-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageIcon size={18} animate />
          <h3 style={{ margin: 0, fontSize: 15 }}>推理记录</h3>
        </div>
        <Badge variant="light" color="gray">{events.length} 条</Badge>
      </div>
      <div className="log-scroll" role="log" aria-label="问答与还原记录" aria-live="polite">
        {events.length === 0 && (
          <div className="log-empty-state">
            <MessageIcon size={36} animate style={{ margin: '0 auto 8px', opacity: 0.9 }} />
            <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>等待第一位侦探提问</h4>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              支持是非提问。可从人物关系、关键道具、地点或反常现象切入。
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {events.map(event => (
            <motion.article
              key={`${event.kind}-${event.id}`}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`log-entry ${event.kind === '还原真相' ? 'guess-entry' : ''}`}
            >
              <div className="log-meta">
                <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {event.kind === '还原真相' ? <LightbulbIcon size={15} animate /> : <MessageIcon size={15} animate />}
                  {event.playerName}
                </strong>
                <span>{event.kind}</span>
                <time dateTime={new Date(event.at).toISOString()}>
                  {new Date(event.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
              <p>{event.text}</p>
              <Badge
                className={`verdict ${verdictTone(event.result)}`}
                classNames={{ label: verdictTone(event.result) }}
                color={colors[verdictTone(event.result)]}
                variant="light"
                leftSection={getVerdictIcon(event.result)}
              >
                {event.result}
              </Badge>
            </motion.article>
          ))}
        </AnimatePresence>
        <div ref={end} />
      </div>
    </Paper>
  );
}

export function RatingBar({ onRate, disabled }: { onRate: (score: 1 | 0 | -1, funny: boolean) => void; disabled: boolean }) {
  const [score, setScore] = useState<1 | 0 | -1 | null>(null);
  const [funny, setFunny] = useState(false);
  return (
    <div className="rating-bar">
      <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 10px', fontSize: 14 }}>
        <SparkleIcon size={16} animate /> 评价这道题
      </p>
      <div className="rating-options">
        <GameButton
          disabled={disabled}
          variant={score === 1 ? 'filled' : 'light'}
          color="teal"
          size="sm"
          aria-pressed={score === 1}
          leftSection={<ThumbsUpIcon size={16} animate />}
          onClick={() => { setScore(1); onRate(1, funny); }}
        >
          好汤
        </GameButton>
        <GameButton
          disabled={disabled}
          variant={score === 0 ? 'filled' : 'light'}
          color="gray"
          size="sm"
          aria-pressed={score === 0}
          leftSection={<MehIcon size={16} animate />}
          onClick={() => { setScore(0); onRate(0, funny); }}
        >
          一般
        </GameButton>
        <GameButton
          disabled={disabled}
          variant={score === -1 ? 'filled' : 'light'}
          color="red"
          size="sm"
          aria-pressed={score === -1}
          leftSection={<ThumbsDownIcon size={16} animate />}
          onClick={() => { setScore(-1); onRate(-1, funny); }}
        >
          不喜欢
        </GameButton>
        <GameButton
          disabled={disabled}
          variant={funny ? 'filled' : 'light'}
          color="yellow"
          size="sm"
          aria-pressed={funny}
          leftSection={<SmileIcon size={16} animate />}
          onClick={() => { const next = !funny; setFunny(next); if (score !== null) onRate(score, next); }}
        >
          好笑
        </GameButton>
      </div>
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
  const reason = reveal.winnerName
    ? `${reveal.winnerName} 破解了真相！`
    : reveal.reason === 'exhausted'
    ? '提问与还原次数已用尽，真相揭晓'
    : '房主揭晓了真相';

  useEffect(() => {
    if (opened) {
      try {
        confetti({
          particleCount: 75,
          spread: 65,
          origin: { y: 0.65 },
          colors: ['#5eead4', '#38bdf8', '#f59e0b', '#ec4899', '#a855f7'],
        });
        const timer = setTimeout(() => {
          confetti({
            particleCount: 40,
            angle: 60,
            spread: 50,
            origin: { x: 0.15, y: 0.7 },
            colors: ['#5eead4', '#f59e0b'],
          });
          confetti({
            particleCount: 40,
            angle: 120,
            spread: 50,
            origin: { x: 0.85, y: 0.7 },
            colors: ['#5eead4', '#38bdf8'],
          });
        }, 260);
        return () => clearTimeout(timer);
      } catch {}
    }
  }, [opened]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700 }}>
          <TrophyIcon size={22} animate />
          <span>真相大白 · 答案揭晓</span>
        </div>
      }
    >
      <Alert color="teal" icon={<SparkleIcon size={20} animate />} title={reason}>
        <p style={{ margin: 0, fontSize: 13 }}>游戏已结束，以下是完整汤底与全部关键事实。</p>
      </Alert>

      <div style={{ margin: '16px 0', padding: 16, borderRadius: 8, background: 'rgba(94, 234, 212, 0.05)', border: '1px solid rgba(94, 234, 212, 0.2)' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--accent)', fontWeight: 600 }}>【完整汤底】</h4>
        <p className="story" style={{ margin: 0, fontSize: 15, lineHeight: 1.85, color: 'var(--text)' }}>
          {reveal.bottom}
        </p>
      </div>

      {reveal.hints.length > 0 && (
        <div style={{ margin: '14px 0' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--muted)' }}>
            补充案件事实 ({reveal.hints.length} 条)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
            {reveal.hints.map((hint, index) => (
              <div key={index} className="clue-item" style={{ padding: '6px 10px', fontSize: 13 }}>
                <Badge color="teal" variant="light" size="xs">事实 {index + 1}</Badge>
                <div className="clue-text" style={{ fontSize: 13 }}>{renderClueContent(hint)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RatingBar onRate={onRate} disabled={disabled} />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <GameButton variant="default" onClick={onClose}>
          关闭查看对局现场
        </GameButton>
      </div>
    </Modal>
  );
}

export function RevealPanel({ reveal, disabled, onRate }: { reveal: RevealView; disabled: boolean; onRate: (score: 1 | 0 | -1, funny: boolean) => void }) {
  const reason = reveal.winnerName ? `${reveal.winnerName} 破解了真相！` : reveal.reason === 'exhausted' ? '提问与还原次数已用尽，真相揭晓' : '房主揭晓了真相';
  return (
    <Paper className="reveal-panel" withBorder p="lg" radius="md">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Badge variant="filled" color="teal" leftSection={<TrophyIcon size={16} animate />}>真相大白</Badge>
        <Badge variant="light" color="gray">汤底已公开</Badge>
      </div>
      <h2 style={{ marginTop: 14, fontSize: 20 }}>{reason}</h2>
      <p className="story" style={{ marginTop: 12 }}>{reveal.bottom}</p>
      {reveal.hints.length > 0 && (
        <details style={{ margin: '14px 0' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 500 }}>
            查看完整补充事实 ({reveal.hints.length} 条)
          </summary>
          <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {reveal.hints.map((hint, index) => (
              <p key={index} style={{ margin: 0, fontSize: 14 }}>
                <b>{index + 1}.</b> {renderClueContent(hint)}
              </p>
            ))}
          </div>
        </details>
      )}
      <RatingBar onRate={onRate} disabled={disabled} />
    </Paper>
  );
}

export function GuessModal({ disabled, remaining, onClose, onGuess }: { disabled: boolean; remaining: number; onClose: () => void; onGuess: (text: string) => void }) {
  const [text, setText] = useState('');
  const submit = () => { if (!disabled && remaining > 0 && text.trim()) { onGuess(text.trim()); onClose(); } };
  return (
    <Modal
      opened
      onClose={onClose}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 17 }}>
          <LightbulbIcon size={20} animate />
          <span>还原真相</span>
          <Badge size="xs" variant="light" color="teal">剩余 {remaining} 次机会</Badge>
        </div>
      }
      size="lg"
      trapFocus
      returnFocus
    >
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--muted)' }}>
        说清核心事件、关键原因和因果链。AI 裁判将根据汤底对你的还原进行严谨评估。
      </p>
      <Textarea
        data-autofocus
        aria-label="你的真相还原"
        maxLength={400}
        minRows={5}
        value={text}
        disabled={disabled || remaining <= 0}
        onChange={e => setText(e.target.value)}
        placeholder="我认为事情是这样的……"
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="input-footer" style={{ marginTop: 12 }}>
        <small>{text.length}/400 · Shift+Enter 换行</small>
        <GameButton
          disabled={disabled || remaining <= 0 || !text.trim()}
          leftSection={<SendIcon size={16} animate />}
          onClick={submit}
        >
          提交还原
        </GameButton>
      </div>
    </Modal>
  );
}

export function PuzzleCard({ puzzle, onChoose }: { puzzle: PuzzleSummary; onChoose: (id: string) => void }) {
  return (
    <Paper component="article" className="puzzle-card" withBorder p="md" radius="md">
      <div className="section-head" style={{ marginBottom: 10 }}>
        <Badge variant="subtle" color="teal" size="sm" leftSection={<StarIcon size={14} animate />}>
          {puzzle.difficulty ? `难度 ${puzzle.difficulty}/5` : '难度待评'}
        </Badge>
        {puzzle.nsfl && <Badge color="yellow" variant="light" size="sm" leftSection={<AlertIcon size={14} animate />}>重口</Badge>}
      </div>
      <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{puzzle.title}</h3>
      <p className="preview" style={{ fontSize: 13, margin: '0 0 12px', minHeight: 52 }}>
        {puzzle.nsfl ? '进入房间确认内容提醒后查看汤面。' : puzzle.surfacePreview.slice(0, 60)}
      </p>
      <div className="puzzle-stats" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--muted)', margin: 'auto 0 12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ThumbsUpIcon size={14} animate /> {puzzle.goodRate === null ? '暂无' : `${Math.round(puzzle.goodRate * 100)}%`}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <SmileIcon size={14} animate /> {puzzle.funny}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <UsersIcon size={14} animate /> {puzzle.plays} 人次
        </span>
      </div>
      <GameButton variant="light" size="xs" leftSection={<PlayIcon size={14} animate />} onClick={() => onChoose(puzzle.id)}>
        用这题开房 ↗
      </GameButton>
    </Paper>
  );
}

const avatarColors = ['#f7b731', '#20bf6b', '#eb3b5a', '#3867d6', '#8854d0', '#2d98da', '#fa8231', '#0fb9b1'];

export function PlayerList({ room, selfKey, disabled, onKick }: { room: RoomView; selfKey: string; disabled: boolean; onKick: (key: string) => void }) {
  const host = room.hostKey === selfKey;
  return (
    <Paper withBorder p="md" radius="md">
      <div className="section-head" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UsersIcon size={18} animate />
          <h3 style={{ margin: 0, fontSize: 15 }}>同桌玩家</h3>
        </div>
        <Badge variant="light" color="gray">{room.players.length}/8</Badge>
      </div>
      <ul className="players">
        {room.players.map((player, idx) => (
          <li key={player.key}>
            <div
              className="player-avatar-circle"
              style={{
                background: avatarColors[idx % avatarColors.length],
                color: '#ffffff',
                border: '2px solid rgba(0, 0, 0, 0.15)',
              }}
            >
              {player.name.slice(0, 1).toUpperCase()}
            </div>
            <span aria-label={player.online ? '在线' : '离线'} className={`online-dot ${player.online ? 'online' : ''}`} />
            <div className="player-info">
              <strong>
                {player.name} {player.isHost && <CrownIcon size={16} animate style={{ display: 'inline', verticalAlign: 'text-bottom' }} />}
                {player.key === selfKey && <small style={{ color: '#0284c7' }}> (你)</small>}
              </strong>
              <small>{player.online ? `${player.asked} 问 · ${player.guesses} 次还原${player.pending ? ' · 判定中' : ''}` : '暂时离线'}</small>
            </div>
            {host && player.key !== selfKey && (
              <GameButton size="compact-xs" variant="subtle" color="red" disabled={disabled} aria-label={`移出 ${player.name}`} onClick={() => onKick(player.key)}>
                移出
              </GameButton>
            )}
          </li>
        ))}
      </ul>
    </Paper>
  );
}

export function HostPanel({ room, disabled, onSettings, onStart, onHint, onReveal }: { room: RoomView; disabled: boolean; onSettings: (settings: Partial<Settings>) => void; onStart: (id?: string) => void; onHint: () => void; onReveal: () => void }) {
  const [selectedPuzzle, setSelectedPuzzle] = useState<string | null>(null);
  const [puzzleOptions, setPuzzleOptions] = useState<{ value: string; label: string }[]>([]);
  const [revealOpen, setRevealOpen] = useState(false);

  useEffect(() => {
    let active = true;
    api.puzzles({ limit: 100, sort: 'hot' })
      .then(items => {
        if (active) {
          setPuzzleOptions(items.map(p => ({
            value: p.id,
            label: `${p.title}${p.difficulty ? ` (${p.difficulty}★)` : ''}${p.nsfl ? ' [重口]' : ''}`,
          })));
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <Paper className="host-panel" withBorder p="md" radius="md">
      <div className="section-head" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CrownIcon size={18} animate />
          <h3 style={{ margin: 0, fontSize: 15 }}>房主控制</h3>
        </div>
        <Badge variant="subtle" color={room.phase === 'playing' ? 'teal' : 'gray'}>
          {room.phase === 'lobby' ? '等待开局' : room.phase === 'playing' ? '进行中' : '已揭晓'}
        </Badge>
      </div>
      {room.phase === 'lobby' && (
        <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Select
            label="提问额度"
            disabled={disabled}
            value={room.settings.quotaMode}
            data={[
              { value: 'perPlayer', label: '每人独立额度' },
              { value: 'shared', label: '全房共享额度' },
              { value: 'unlimited', label: '无限提问' },
            ]}
            onChange={value => { if (value) onSettings({ quotaMode: value as Settings['quotaMode'] }); }}
          />
          {room.settings.quotaMode !== 'unlimited' && (
            <NumberInput
              label="额度（1–50）"
              disabled={disabled}
              min={1}
              max={50}
              allowDecimal={false}
              value={room.settings.quota}
              onChange={value => { if (typeof value === 'number' && value >= 1 && value <= 50) onSettings({ quota: value }); }}
            />
          )}
          <Select
            label="提问顺序"
            disabled={disabled}
            value={room.settings.turnMode}
            data={[
              { value: 'free', label: '自由提问' },
              { value: 'turns', label: '轮流提问' },
            ]}
            onChange={value => { if (value) onSettings({ turnMode: value as Settings['turnMode'] }); }}
          />
          <NumberInput
            label="每人还原次数"
            disabled={disabled}
            min={1}
            max={10}
            allowDecimal={false}
            value={room.settings.maxGuesses}
            onChange={value => { if (typeof value === 'number' && value >= 1 && value <= 10) onSettings({ maxGuesses: value }); }}
          />
        </fieldset>
      )}
      <div className="host-actions" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Select
          label={room.phase === 'playing' ? '更换题目' : room.phase === 'revealed' ? '挑选下一题' : '挑选本局题目'}
          placeholder="搜索或选择想玩的题目..."
          searchable
          clearable
          disabled={disabled}
          value={selectedPuzzle}
          data={puzzleOptions}
          onChange={setSelectedPuzzle}
          leftSection={<BookIcon size={16} animate />}
        />

        {selectedPuzzle && (
          <GameButton
            fullWidth
            disabled={disabled}
            color="teal"
            leftSection={<PlayIcon size={16} animate />}
            onClick={() => {
              const pid = selectedPuzzle;
              setSelectedPuzzle(null);
              onStart(pid);
            }}
          >
            {room.phase === 'playing' ? '换为此题并开局' : '开始所选题目'}
          </GameButton>
        )}

        <GameButton
          fullWidth
          tone="yellow"
          disabled={disabled}
          leftSection={<DiceIcon size={16} animate />}
          onClick={() => {
            setSelectedPuzzle(null);
            onStart();
          }}
        >
          {room.phase === 'playing' ? '随机换一题' : room.phase === 'revealed' ? '再随机一题' : '随机抽题 · 立即开局'}
        </GameButton>

        {room.phase === 'playing' && (
          <>
            <GameButton
              fullWidth
              tone="blue" disabled={disabled || room.hints.length >= room.hintCount}
              leftSection={<LightbulbIcon size={16} animate />}
              onClick={onHint}
            >
              公开下一条提示 ({room.hints.length}/{room.hintCount})
            </GameButton>
            <GameButton
              fullWidth
              color="red"
              variant="light"
              disabled={disabled}
              leftSection={<EyeIcon size={16} animate />}
              onClick={() => setRevealOpen(true)}
            >
              提前揭晓汤底
            </GameButton>
          </>
        )}

        <a
          href={`#/library?room=${room.code}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: 13,
            color: 'var(--muted)',
            marginTop: 2,
          }}
        >
          <BookIcon size={15} animate /> 去题库大厅挑选 1,105 题 ↗
        </a>
      </div>

      <Modal opened={revealOpen} onClose={() => setRevealOpen(false)} title="确认揭晓汤底？">
        <p>揭晓后将向所有玩家公开汤底和补充事实，本轮游戏结束。</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <GameButton variant="default" onClick={() => setRevealOpen(false)}>取消</GameButton>
          <GameButton color="red" onClick={() => { setRevealOpen(false); onReveal(); }}>确认揭晓</GameButton>
        </div>
      </Modal>
    </Paper>
  );
}

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => { if (!message) return; const timer = window.setTimeout(onClose, 5000); return () => window.clearTimeout(timer); }, [message, onClose]);
  return message ? <Alert className="toast" role="alert" color="teal" withCloseButton closeButtonLabel="关闭提示" onClose={onClose}>{message}</Alert> : null;
}

export function ReconnectBanner({ status }: { status: 'offline' | 'connecting' | 'connected' }) {
  return status !== 'connected' ? <Alert className="reconnect-banner" color="yellow" role="status" icon={<Loader size={16} color="yellow" />}>重连中 · 身份与提问记录会自动恢复</Alert> : null;
}


