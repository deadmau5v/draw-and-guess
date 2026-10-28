'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandyAlert, CandyAvatar, CandyBadge, CandyButton, CandyCard, CandyEmptyState, CandyGameIcon,
  CandyList, CandyListItem, CandyModal, CandyPanel, CandyProgress, CandyRibbon, CandyTextarea,
  triggerCandyConfetti,
} from 'candy-ui';
import type { RoomView } from '@shared/protocol';
import { LIMITS } from '@shared/protocol';
import { resolveAvatar } from './avatars';
import { cdnUrl } from './cdn';
import { copyTextToClipboard } from './clipboard';
import { ContentWarning, PlayerList, renderClueContent } from './components';
import { findDuplicateQuestion, normalizeText, remainingQuota, verdictTone } from './game';
import { HintNotice } from './HintNotice';
import { DETECTIVE_QUIPS, QUICK_QUESTION_TEMPLATES, celebrateSolved, emitFloatingText, playJuiceSound, triggerVerdictJuice } from './juice';
import { DrawingCanvas } from './DrawingCanvas';
import { PartyModeDeck } from './PartyModeDeck';
import { SharedStory } from './SharedStory';
import { actions } from './socket';
import { getSnapshot, notify } from './store';
import { TurnCountdown } from './TurnCountdown';
import { PARTY_MODE_INFO } from '@shared/protocol';
import type { CandyColor } from 'candy-ui';

type ClueTab = 'yes' | 'no' | 'hint';
function color(verdict: string): CandyColor {
  const tone = verdictTone(verdict);
  return tone === 'pending' ? 'blue' : tone === 'darkred' ? 'red' : tone === 'grey' ? 'gray' : tone as CandyColor;
}

const DIRECTION_TAGS = ['本格', '变格', '超自然', '微恐', '恐怖', '灵异', '怪谈', '悬疑', '搞笑', '欢乐', '日常', '温情', '治愈', '科幻', '历史', '脑洞', '猎奇', '硬核', '黑暗', '致郁', '童话'];

export function PlayingRoom({ room, selfKey, disabled, onLeave, onInvite, onGuess, onNext, onReveal }: {
  room: RoomView; selfKey: string; disabled: boolean; onLeave: () => void; onInvite: () => void | Promise<void>;
  onGuess: () => void; onNext?: () => void; onReveal: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState<ClueTab>('yes');
  const [confirmReveal, setConfirmReveal] = useState(false);
  const [mascotPokes, setMascotPokes] = useState(0);
  const [mascotBouncing, setMascotBouncing] = useState(false);
  const sendingRef = useRef(false);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const host = room.hostKey === selfKey;
  const playing = room.phase === 'playing';
  const me = room.players.find(player => player.key === selfKey);
  const remaining = remainingQuota(room, selfKey);
  const myTurn = room.settings.turnMode !== 'turns' || room.turnKey === selfKey;
  const canCompose = !disabled && playing && remaining > 0;
  const canAsk = canCompose && myTurn && !me?.pending && !sending;
  const waitingForTurn = canCompose && room.settings.turnMode === 'turns' && room.turnKey !== selfKey;
  const turnName = room.players.find(player => player.key === room.turnKey)?.name || '当前玩家';
  const hintsLeft = Math.max(0, room.hintCount - room.hints.length);
  const yes = room.log.filter(item => item.verdict === '是');
  const no = room.log.filter(item => item.verdict === '不是');
  const events = useMemo(() => [
    ...room.log.map(item => ({ ...item, kind: '提问' as const, result: item.verdict })),
    ...room.guesses.map(item => ({ ...item, kind: '还原' as const, result: item.outcome })),
  ].sort((a, b) => a.at - b.at), [room.log, room.guesses]);

  // Track initial event outcomes so only newly resolved verdicts trigger sound/floating juice.
  const seenOutcomesRef = useRef<Map<string, string> | null>(null);
  const prevPhaseRef = useRef(room.phase);
  if (seenOutcomesRef.current === null) {
    seenOutcomesRef.current = new Map(events.map(e => [e.id, e.result]));
  }

  useEffect(() => {
    const map = seenOutcomesRef.current!;
    for (const event of events) {
      const prev = map.get(event.id);
      if (prev !== event.result && event.result !== '判定中') {
        triggerVerdictJuice(event.result, 'points' in event ? event.points : undefined);
      }
      map.set(event.id, event.result);
    }
  }, [events]);

  useEffect(() => {
    if (prevPhaseRef.current === 'playing' && room.phase === 'revealed' && room.reveal?.reason === 'solved') {
      celebrateSolved();
    }
    prevPhaseRef.current = room.phase;
  }, [room.phase, room.reveal?.reason]);

  // Warm-state keyboard shortcut: press '/' to focus question composer, 'Escape' to blur.
  useEffect(() => {
    if (!canCompose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const active = document.activeElement;
        const isTyping = active instanceof HTMLElement && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable ||
          !!active.closest('[role="dialog"]')
        );
        if (!isTyping && questionInput.current) {
          event.preventDefault();
          questionInput.current.focus();
          playJuiceSound('pressUp');
        }
      } else if (event.key === 'Escape' && document.activeElement === questionInput.current) {
        questionInput.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canCompose]);

  const progress = !playing ? 100 : room.progress?.score ?? 0;
  const clues = tab === 'yes'
    ? yes.map(item => item.text)
    : tab === 'no'
      ? no.map(item => item.text)
      : room.hints;
  const directionTags = useMemo(() => {
    const tags = room.puzzle?.tags ?? [];
    const matched = tags.filter(t => DIRECTION_TAGS.some(d => t.includes(d)));
    return (matched.length ? matched : tags).slice(0, 3);
  }, [room.puzzle?.tags]);
  const run = (task: Promise<unknown>) => void task.catch(err => notify(err instanceof Error ? err.message : '操作失败'));
  const useHint = () => void actions.hint().then(() => setTab('hint')).catch(err => notify(err instanceof Error ? err.message : '操作失败'));
  const submit = () => {
    const value = text.trim();
    if (!canAsk || !value || sendingRef.current) return;
    const duplicate = findDuplicateQuestion(room, value);
    if (duplicate) {
      notify(duplicate.verdict === '判定中' ? '该问题正在判定中，请勿重复发送' : `该问题本局已提问过（判定：${duplicate.verdict}），请勿重复发送`);
      return;
    }
    sendingRef.current = true;
    setText('');
    setSending(true);
    questionInput.current?.focus({ preventScroll: true });
    void actions.ask(value).catch(err => {
      const latestRoom = getSnapshot().room;
      const alreadyInLog = latestRoom?.code === room.code && latestRoom.log.some(item => item.playerKey === selfKey && normalizeText(item.text) === normalizeText(value));
      if (!alreadyInLog) setText(current => current || value);
      notify(err instanceof Error ? err.message : '操作失败');
    }).finally(() => {
      sendingRef.current = false;
      setSending(false);
    });
  };
  const applyTemplate = (templateText: string) => {
    if (!canCompose) return;
    setText(templateText);
    questionInput.current?.focus();
    emitFloatingText({ text: '已填入灵感提问', color: 'blue' });
  };
  const pokeDetective = (event: React.MouseEvent<HTMLElement>) => {
    const nextCount = mascotPokes + 1;
    setMascotPokes(nextCount);
    setMascotBouncing(true);
    window.setTimeout(() => setMascotBouncing(false), 360);
    playJuiceSound('mascotPoke');
    const quip = DETECTIVE_QUIPS[(nextCount - 1) % DETECTIVE_QUIPS.length];
    emitFloatingText({
      text: nextCount % 5 === 0 ? `🎉 灵感暴击 ×${nextCount}` : `🐢 +1 推理灵感`,
      x: event.clientX || undefined,
      y: event.clientY || undefined,
      color: nextCount % 5 === 0 ? 'yellow' : 'green',
    });
    if (nextCount % 5 === 0) {
      try {
        triggerCandyConfetti({ particleCount: 28, spread: 60, origin: { x: 0.82, y: 0.75 }, playSound: false });
      } catch {}
      notify(`海龟侦探：${quip}`);
    }
  };
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events.length]);

  const quipText = mascotPokes > 0
    ? DETECTIVE_QUIPS[(mascotPokes - 1) % DETECTIVE_QUIPS.length]
    : playing
      ? '结合问答与提示，串起人物和事件的因果。（点我攒灵感）'
      : '查看汤底，复盘你的推理。';

  return <CandyPanel theme="frosted" className="playing-board" style={{ padding: 20 }}>
    <aside className="playing-left">
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-info playing-room-card">
        <div className="playing-room-top">
          <span>房间码 <strong>{room.code}</strong></span>
          <CandyButton variant="ghost" size="xs" onClick={onLeave}>离开房间</CandyButton>
        </div>
        <div className="playing-badges">
          <CandyBadge variant="blue">第 {room.round} 局</CandyBadge>
          <CandyBadge variant="purple">{PARTY_MODE_INFO.find(m => m.id === (room.party?.mode ?? room.settings.partyMode ?? 'classic'))?.name ?? '经典你画我猜'}</CandyBadge>
          <CandyBadge variant={playing ? 'green' : 'yellow'}>{playing ? '推理中' : '已揭晓'}</CandyBadge>
          <CandyBadge variant="blue">{room.settings.turnMode === 'turns' ? '轮流提问' : '自由提问'}</CandyBadge>
          <CandyBadge variant="green">{room.settings.quotaMode === 'shared' ? '共享额度' : room.settings.quotaMode === 'unlimited' ? '无限额度' : '独立额度'}</CandyBadge>
        </div>
        <CandyButton variant="blue" size="xs" fullWidth onClick={onInvite} leftIcon={<CandyGameIcon name="copy" size={16} />}>邀请好友</CandyButton>
      </CandyPanel>
      <div className="playing-players"><PlayerList room={room} selfKey={selfKey} disabled={disabled} compact onKick={key => run(actions.kick(key))} /></div>
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-actions playing-left-actions" role="group" aria-label="本局操作">
        <CandyButton variant="purple" size="sm" fullWidth disabled={disabled || !playing || !hintsLeft} onClick={useHint} leftIcon={<CandyGameIcon name="notification" size={18} />}>公开提示 ({hintsLeft})</CandyButton>
        <CandyButton variant="yellow" size="sm" fullWidth disabled={disabled || !playing} onClick={onGuess} leftIcon={<CandyGameIcon name="star" size={18} />}>提交真相</CandyButton>
        {host && <CandyButton variant="blue" size="sm" fullWidth className="playing-next-action" disabled={disabled || playing} onClick={() => onNext ? onNext() : run(actions.start())} leftIcon={<CandyGameIcon name="refresh" size={18} />}>下一题</CandyButton>}
      </CandyPanel>
    </aside>
    <section className="playing-center">
      <CandyPanel theme="frosted" className="playing-story">
        <div className="playing-ribbon-slot">
          <CandyRibbon color="blue" className="playing-ribbon" style={{ '--ribbon-height': 'var(--playing-ribbon-height, 40px)', '--ribbon-text-size': 'var(--playing-ribbon-text-size, 18px)' } as React.CSSProperties}>第 {room.round} 题 · 汤面</CandyRibbon>
        </div>
        <DrawingCanvas room={room} selfKey={selfKey} disabled={disabled} />
        <PartyModeDeck room={room} selfKey={selfKey} disabled={disabled} />
        {room.puzzle && <ContentWarning warning={room.puzzle.nsfl} id={room.puzzle.id}>
          <div className="playing-story-head playing-story-title">
            <h2>{room.puzzle.title}</h2>
            <div className="playing-story-badges">
              {directionTags.map(tag => <CandyBadge key={tag} variant="purple">{tag}</CandyBadge>)}
              <CandyBadge variant="yellow">{room.puzzle.difficulty === null ? '难度未标注' : `难度 ${room.puzzle.difficulty}/5`}</CandyBadge>
            </div>
          </div>
          <div className="playing-story-scroll">
            <SharedStory surface={room.puzzle.surface} highlights={room.highlights ?? []} round={room.round} disabled={disabled} />
            {room.reveal && <div className="playing-story-reveal">
              <CandyAlert tone={room.reveal.reason === 'solved' ? 'success' : 'info'} title={room.reveal.reason === 'solved' ? `真相汤底（破案者：${room.reveal.winnerName || '侦探'}）` : '真相汤底'}>{room.reveal.bottom}</CandyAlert>
            </div>}
          </div>
          {!room.reveal && <div className="playing-story-prompt">
            <CandyBadge variant="blue" size="sm">推理提示</CandyBadge>
            <span>找出故事中的反常之处提问；鼠标选中汤面文字可共享高亮线索，点击高亮可取消。</span>
          </div>}
        </ContentWarning>}
      </CandyPanel>
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-log-panel">
        <h3>推理记录 <span>({events.length})</span></h3>
        <div className="playing-log" ref={logRef} role="log" aria-label="问答与还原记录">
          {events.length === 0 ? <CandyEmptyState title={playing ? '等待第一位侦探提问' : '本局已揭晓'} description={playing ? '从人物、地点或故事里的反常之处开始。' : '上方已展示完整真相汤底，可点击右下角为本题打分或开始下一题。'} icon={<CandyGameIcon name={playing ? 'user-group' : 'book'} />} /> : <CandyList variant="plain" size="sm" divided>
            {events.map(event => <CandyListItem key={event.id} className="playing-log-item" leading={<CandyAvatar size="xs" src={resolveAvatar(event.avatar ?? room.players.find(p => p.key === event.playerKey)?.avatar)} alt={event.playerName} />} trailing={<div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CandyBadge className={`verdict-stamp verdict-stamp-${color(event.result)}`} variant={color(event.result)}>{event.result}</CandyBadge>{event.playerKey === selfKey && <CandyButton type="button" variant="ghost" size="xs" aria-label="复制问题" title="复制你的问题" onClick={async () => { const copied = await copyTextToClipboard(event.text); if (copied) { emitFloatingText({ text: '已复制问题', color: 'blue' }); notify('已复制问题内容'); } else notify('复制失败，请手动选择'); }}>复制</CandyButton>}</div>} title={<span className="playing-log-name">{event.playerName} <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})} · {event.kind}</time></span>}><p className="playing-question">{event.text}</p>{event.kind === '提问' && <div className="playing-question-score">{'proximity' in event && typeof event.proximity === 'number' && <CandyBadge variant="purple">接近程度 {event.proximity}%</CandyBadge>}{'points' in event && typeof event.points === 'number' ? <CandyBadge variant={event.points ? 'yellow' : 'gray'}>+{event.points} 积分</CandyBadge> : event.result === '判定中' ? <small>接近程度评估中…</small> : <small>接近程度未评估 · 不加分</small>}</div>}</CandyListItem>)}
          </CandyList>}
        </div>
      </CandyPanel>
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-composer">
        <div className="playing-composer-status"><span>{me?.pending ? 'AI 正在判断…' : !playing ? '本题已揭晓' : waitingForTurn ? `等待 ${turnName} 提问（可先输入草稿）` : '提出一个是非问题'}</span><div className="playing-composer-badges"><TurnCountdown room={room} disabled={disabled} /><CandyBadge variant="yellow">永久积分 {me?.totalPoints ?? 0}</CandyBadge><CandyBadge variant="blue">{remaining === Infinity ? '不限次数' : `剩余 ${remaining} 问`}</CandyBadge></div></div>
        {canCompose && <div className="playing-quick-prompts" role="group" aria-label="快捷提问灵感">
          <span className="playing-quick-label">灵感快问：</span>
          {QUICK_QUESTION_TEMPLATES.map(item => (
            <CandyButton key={item.label} type="button" size="xs" variant="ghost" appearance="outline"
              onClick={() => applyTemplate(item.text)} title={`填入：${item.text}`}>
              {item.label}
            </CandyButton>
          ))}
        </div>}
        <div className="playing-input-row">
          <div className="playing-input-field">
            <CandyTextarea ref={questionInput} aria-label="你的问题" rows={1} maxLength={LIMITS.questionMax} showCount value={text} disabled={!canCompose} placeholder={waitingForTurn ? `轮到 ${turnName} 提问，可先输入你的问题草稿…` : "输入你的问题（按 / 快捷聚焦），例如：他认识这个人吗？"} onChange={e => setText(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing){e.preventDefault();submit();}}} />
          </div>
          <CandyButton variant={waitingForTurn ? 'gray' : 'yellow'} disabled={!canAsk || !text.trim()} aria-label="提问 →" onClick={submit} leftIcon={<CandyGameIcon name={waitingForTurn ? 'user-group' : 'arrow-right'} size={20} />}>{waitingForTurn ? `等待 ${turnName}` : '提问'}</CandyButton>
        </div>
      </CandyPanel>
    </section>
    <aside className="playing-right">
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-progress">
        <h3 className="playing-side-heading">游戏进度</h3>
        <div className="playing-progress-label"><strong>{playing ? room.progress?.status ?? '迷雾重重' : '真相揭晓'}</strong><strong>{Math.round(progress)}%</strong></div>
        <CandyProgress value={progress} variant="blue" height={12} aria-label="推理进度" />
        <div className="playing-progress-label"><span>已提问 {room.log.length} 次</span><span>还原 {room.guesses.length} 次</span></div>
        <div className="playing-hint-action"><span>剩余提示 <strong>{hintsLeft}</strong></span><CandyButton variant="purple" size="xs" disabled={disabled || !playing || !hintsLeft} onClick={useHint}>使用提示</CandyButton></div>
        <small>任意玩家可开启提示，全员同步查看</small>
      </CandyPanel>
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-clues">
        <h3 className="playing-side-heading">我的线索</h3>
        <div className="playing-clue-tabs" role="group" aria-label="线索分类">
          <CandyButton size="xs" variant={tab === 'yes' ? 'blue' : 'ghost'} appearance={tab === 'yes' ? 'solid' : 'outline'} aria-pressed={tab === 'yes'} onClick={() => setTab('yes')}>已确认 ({yes.length})</CandyButton>
          <CandyButton size="xs" variant={tab === 'no' ? 'red' : 'ghost'} appearance={tab === 'no' ? 'solid' : 'outline'} aria-pressed={tab === 'no'} onClick={() => setTab('no')}>已排除 ({no.length})</CandyButton>
          <CandyButton size="xs" variant={tab === 'hint' ? 'purple' : 'ghost'} appearance={tab === 'hint' ? 'solid' : 'outline'} aria-pressed={tab === 'hint'} onClick={() => setTab('hint')}>提示 ({room.hints.length})</CandyButton>
        </div>
        <small>{tab === 'hint' ? '玩家已公开的提示' : '问句按 AI 判定归类，结合原问题理解。'}</small>
        <div className="playing-clue-scroll">{clues.length ? <CandyList variant="card" size="sm">{clues.map((clue,i) => <CandyListItem key={`${room.round}-${tab}-${i}`} leading={<CandyBadge variant={tab === 'no' ? 'red' : 'blue'}>{i+1}</CandyBadge>}>{renderClueContent(clue)}</CandyListItem>)}</CandyList> : <p className="playing-side-empty">暂无线索。提问和公开提示后，线索会出现在这里。</p>}</div>
      </CandyPanel>
      <CandyCard className="playing-objective" aria-label="当前目标">
        <div className="playing-objective-content">
          <img
            src={cdnUrl('/assets/turtle-think.png')}
            alt="海龟侦探"
            title="点我收集推理灵感"
            className={`mascot-fidget-trigger${mascotBouncing ? ' mascot-squish-active' : ''}`}
            onClick={pokeDetective}
          />
          <div>
            <h3>{playing ? '猜出完整真相' : '本题真相已揭晓'}{mascotPokes > 0 && <CandyBadge variant="green" size="sm" style={{ marginLeft: 6 }}>灵感 ×{mascotPokes}</CandyBadge>}</h3>
            <p>{quipText}</p>
          </div>
        </div>
        <div className="playing-objective-actions">{!playing ? <CandyButton variant="yellow" size="sm" onClick={onReveal}>查看汤底与评价</CandyButton> : host && <CandyButton variant="ghost" appearance="outline" size="xs" disabled={disabled} onClick={() => setConfirmReveal(true)}>提前揭晓</CandyButton>}</div>
      </CandyCard>
    </aside>
    <HintNotice room={room} onOpened={() => setTab('hint')} />
    {confirmReveal && <CandyModal isOpen title="确认提前揭晓汤底？" onClose={() => setConfirmReveal(false)}><p>揭晓后，本题将结束，所有玩家都能看到真相。</p><div className="actions-row"><CandyButton variant="gray" onClick={() => setConfirmReveal(false)}>取消</CandyButton><CandyButton variant="red" disabled={disabled} onClick={() => {setConfirmReveal(false);run(actions.reveal());}}>确认揭晓</CandyButton></div></CandyModal>}
  </CandyPanel>;
}
