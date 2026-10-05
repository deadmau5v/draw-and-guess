'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  CandyAlert, CandyAvatar, CandyBadge, CandyButton, CandyCard, CandyEmptyState,
  CandyGameIcon, CandyList, CandyListItem, CandyModal, CandyPanel, CandyProgress,
  CandyRibbon, CandyTextarea,
} from 'candy-ui';
import type { CandyColor } from 'candy-ui';
import type { RoomView } from '@shared/protocol';
import { LIMITS } from '@shared/protocol';
import { ContentWarning, PlayerList, renderClueContent } from './components';
import { remainingQuota, verdictTone } from './game';
import { actions } from './socket';
import { notify } from './store';
import { resolveAvatar } from './avatars';

export function PlayingRoom({ room, selfKey, disabled, onLeave, onInvite, onGuess, onReveal }: {
  room: RoomView; selfKey: string; disabled: boolean; onLeave: () => void;
  onInvite: () => Promise<void>; onGuess: () => void; onReveal: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const questionInput = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'yes' | 'no' | 'hint'>('yes');
  const [confirmReveal, setConfirmReveal] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const me = room.players.find(p => p.key === selfKey);
  const host = room.hostKey === selfKey;
  const playing = room.phase === 'playing';
  const remaining = remainingQuota(room, selfKey);
  const myTurn = room.settings.turnMode !== 'turns' || room.turnKey === selfKey;
  const canCompose = !disabled && playing;
  const canAsk = canCompose && !me?.pending && !sending && myTurn && remaining > 0;
  const canGuess = !disabled && playing && !me?.pending && (me?.guesses ?? 0) < room.settings.maxGuesses;
  const hintsLeft = Math.max(0, room.hintCount - room.hints.length);
  const events = [
    ...room.log.map(q => ({ ...q, result: q.verdict, kind: '提问' })),
    ...room.guesses.map(g => ({ ...g, result: g.outcome, kind: '还原' })),
  ].sort((a, b) => a.at - b.at);
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight; }, [events.length, events.at(-1)?.result]);
  useEffect(() => { setText(''); }, [room.round]);
  const run = (promise: Promise<unknown>) => { void promise.catch(err => notify(err.message)); };
  const submit = () => {
    if (!canAsk || !text.trim()) return;
    const question = text.trim();
    setText('');
    setSending(true);
    questionInput.current?.focus({ preventScroll: true });
    void actions.ask(question).catch(err => { setText(draft => draft || question); notify(err.message); }).finally(() => setSending(false));
  };
  const color = (result: string): CandyColor => {
    const tone = verdictTone(result);
    return tone === 'pending' ? 'blue' : tone === 'darkred' ? 'red' : tone === 'grey' ? 'gray' : tone as CandyColor;
  };
  const yes = room.log.filter(q => q.verdict === '是');
  const no = room.log.filter(q => q.verdict === '不是');
  const clues = tab === 'hint' ? room.hints : (tab === 'yes' ? yes : no).map(q => q.text);
  const progress = room.phase === 'revealed' ? 100 : Math.max(0, Math.min(100, room.progress?.score ?? 0));
  return <CandyPanel className="playing-board" theme="frosted">
    <aside className="playing-left">
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-info">
        <h3 className="playing-side-heading">房间信息</h3>
        <div className="playing-room-meta">
          <CandyAvatar src={resolveAvatar(room.players.find(p => p.key === room.hostKey)?.avatar)} alt="房主头像" size="sm" />
          <div><span>房间号 {room.code}</span><h3>海龟汤推理局</h3><div className="playing-badges"><CandyBadge variant="blue">第 {room.round} 局</CandyBadge><CandyBadge variant={playing ? 'green' : 'yellow'}>{playing ? '推理中' : '已揭晓'}</CandyBadge></div></div>
        </div>
        <div className="playing-room-stats"><span>{room.players.length}/{LIMITS.maxPlayers} 人</span><span>{room.settings.turnMode === 'free' ? '自由提问' : '轮流提问'}</span></div>
        <div className="playing-info-actions"><CandyButton size="xs" appearance="outline" onClick={onInvite} leftIcon={<CandyGameIcon name="copy" size={16} />}>邀请好友</CandyButton><CandyButton variant="ghost" size="xs" onClick={onLeave}>离开房间</CandyButton></div>
      </CandyPanel>
      <div className="playing-players"><PlayerList compact room={room} selfKey={selfKey} disabled={disabled} onKick={key => run(actions.kick(key))} /></div>
      <div className="playing-left-actions">
        <CandyButton variant="purple" size="xs" disabled={disabled || !playing || !host || hintsLeft === 0} onClick={() => run(actions.hint())} leftIcon={<CandyGameIcon name="book" size={20} />}>公开提示 ({hintsLeft})</CandyButton>
        <CandyButton variant="blue" size="sm" disabled={!canGuess} onClick={onGuess} leftIcon={<CandyGameIcon name="book" size={20} />}>提交真相</CandyButton>
        {host && <CandyButton variant="green" size="sm" disabled={disabled || playing} onClick={() => run(actions.start())} leftIcon={<CandyGameIcon name="play" size={20} />}>下一题</CandyButton>}
      </div>
    </aside>
    <section className="playing-center">
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-story">
        <div className="playing-ribbon-slot"><CandyRibbon color="blue" className="playing-ribbon" style={{ '--ribbon-height': 'var(--playing-ribbon-height, 44px)', '--ribbon-text-size': 'var(--playing-ribbon-text-size, 20px)' } as React.CSSProperties}>第 {room.round} 题 · 汤面</CandyRibbon></div>
        {room.puzzle && <ContentWarning warning={room.puzzle.nsfl} id={room.puzzle.id}>
          <div className="playing-story-title"><h2>{room.puzzle.title}</h2><CandyBadge variant="yellow">{room.puzzle.difficulty === null ? '难度未标注' : `难度 ${room.puzzle.difficulty}/5`}</CandyBadge></div>
          <div className="playing-story-scroll"><p className="story-body">{room.puzzle.surface}</p></div>
          <div className="playing-story-prompt"><CandyAlert tone="info">发生了什么？找出反常之处，还原完整真相。</CandyAlert></div>
        </ContentWarning>}
      </CandyPanel>
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-log-panel">
        <h3>推理记录 <span>({events.length})</span></h3>
        <div className="playing-log" ref={logRef} role="log" aria-label="问答与还原记录">
          {events.length === 0 ? <CandyEmptyState title="等待第一位侦探提问" description="从人物、地点或故事里的反常之处开始。" icon={<CandyGameIcon name="user-group" />} /> : <CandyList variant="plain" size="sm" divided>
            {events.map(event => <CandyListItem key={event.id} leading={<CandyAvatar size="xs" src={resolveAvatar(event.avatar ?? room.players.find(p => p.key === event.playerKey)?.avatar)} alt={event.playerName} />} trailing={<CandyBadge variant={color(event.result)}>{event.result}</CandyBadge>} title={<span className="playing-log-name">{event.playerName} <time dateTime={new Date(event.at).toISOString()}>{new Date(event.at).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})} · {event.kind}</time></span>}><p className="playing-question">{event.text}</p></CandyListItem>)}
          </CandyList>}
        </div>
      </CandyPanel>
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-composer">
        <div className="playing-composer-status"><span>{me?.pending ? 'AI 正在判断…' : !playing ? '本题已揭晓' : !myTurn ? `等待 ${room.players.find(p => p.key === room.turnKey)?.name ?? '其他玩家'} 提问` : '提出一个是非问题'}</span><CandyBadge variant="blue">{remaining === Infinity ? '不限次数' : `剩余 ${remaining} 问`}</CandyBadge></div>
        <div className="playing-input-row"><CandyTextarea ref={questionInput} aria-label="你的问题" rows={1} maxLength={LIMITS.questionMax} showCount value={text} disabled={!canCompose} placeholder="输入你的问题，例如：他认识这个人吗？" onChange={e => setText(e.target.value)} onKeyDown={e => {if(e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing){e.preventDefault();submit();}}} /><CandyButton variant="yellow" disabled={!canAsk || !text.trim()} aria-label="提问 →" onClick={submit} leftIcon={<CandyGameIcon name="arrow-right" size={20} />}>提问</CandyButton></div>
      </CandyPanel>
    </section>
    <aside className="playing-right">
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-progress">
        <h3 className="playing-side-heading">游戏进度</h3>
        <div className="playing-progress-label"><strong>{playing ? room.progress?.status ?? '迷雾重重' : '真相揭晓'}</strong><strong>{Math.round(progress)}%</strong></div>
        <CandyProgress value={progress} variant="blue" height={12} aria-label="推理进度" />
        <div className="playing-progress-label"><span>已提问 {room.log.length} 次</span><span>还原 {room.guesses.length} 次</span></div>
        <div className="playing-hint-action"><span>剩余提示 <strong>{hintsLeft}</strong></span><CandyButton variant="purple" size="xs" disabled={disabled || !playing || !host || !hintsLeft} onClick={() => run(actions.hint())}>使用提示</CandyButton></div>
        {!host && <small>提示由房主公开，全员可见</small>}
      </CandyPanel>
      <CandyPanel theme="frosted" style={{ padding: 12 }} className="playing-clues">
        <h3 className="playing-side-heading">我的线索</h3>
        <div className="playing-clue-tabs" role="group" aria-label="线索分类">
          <CandyButton size="xs" variant={tab === 'yes' ? 'blue' : 'ghost'} appearance={tab === 'yes' ? 'solid' : 'outline'} aria-pressed={tab === 'yes'} onClick={() => setTab('yes')}>已确认 ({yes.length})</CandyButton>
          <CandyButton size="xs" variant={tab === 'no' ? 'red' : 'ghost'} appearance={tab === 'no' ? 'solid' : 'outline'} aria-pressed={tab === 'no'} onClick={() => setTab('no')}>已排除 ({no.length})</CandyButton>
          <CandyButton size="xs" variant={tab === 'hint' ? 'purple' : 'ghost'} appearance={tab === 'hint' ? 'solid' : 'outline'} aria-pressed={tab === 'hint'} onClick={() => setTab('hint')}>提示 ({room.hints.length})</CandyButton>
        </div>
        <small>{tab === 'hint' ? '房主已公开的提示' : '问句按 AI 判定归类，结合原问题理解。'}</small>
        <div className="playing-clue-scroll">{clues.length ? <CandyList variant="card" size="sm">{clues.map((clue,i) => <CandyListItem key={`${room.round}-${tab}-${i}`} leading={<CandyBadge variant={tab === 'no' ? 'red' : 'blue'}>{i+1}</CandyBadge>}>{renderClueContent(clue)}</CandyListItem>)}</CandyList> : <p className="playing-side-empty">暂无线索。提问和公开提示后，线索会出现在这里。</p>}</div>
      </CandyPanel>
      <CandyCard className="playing-objective" aria-label="当前目标">
        <div className="playing-objective-content"><img src="/assets/turtle-think.png" alt="海龟侦探" /><div><h3>{playing ? '猜出完整真相' : '本题真相已揭晓'}</h3><p>{playing ? '结合问答与提示，串起人物和事件的因果。' : '查看汤底，复盘你的推理。'}</p></div></div>
        <div className="playing-objective-actions">{!playing ? <CandyButton variant="yellow" size="sm" onClick={onReveal}>查看汤底与评价</CandyButton> : host && <CandyButton variant="ghost" appearance="outline" size="xs" disabled={disabled} onClick={() => setConfirmReveal(true)}>提前揭晓</CandyButton>}</div>
      </CandyCard>
    </aside>
    {confirmReveal && <CandyModal isOpen title="确认提前揭晓汤底？" onClose={() => setConfirmReveal(false)}><p>揭晓后，本题将结束，所有玩家都能看到真相。</p><div className="actions-row"><CandyButton variant="gray" onClick={() => setConfirmReveal(false)}>取消</CandyButton><CandyButton variant="red" disabled={disabled} onClick={() => {setConfirmReveal(false);run(actions.reveal());}}>确认揭晓</CandyButton></div></CandyModal>}
  </CandyPanel>;
}


