'use client';

import React, { useEffect, useState } from 'react';
import type { PuzzleSummary, RoomView, Settings } from '@shared/protocol';
import { LIMITS } from '@shared/protocol';
import { CandyBadge, CandyButton, CandyCard, CandyCheckbox, CandyEmptyState, CandyGameIcon, CandyInput, CandyPanel, CandyRibbon, CandySelect } from 'candy-ui';
import { usePageLoading } from './loading';
import { api } from './api';
import { notify } from './store';
import { PlayerList } from './components';

const themes = [
  { id: 'classic', name: '经典海龟汤', description: '反常故事，烧脑反转', tag: '', art: '/assets/turtle-think.png', color: 'blue' },
  { id: 'funny', name: '欢乐整活', description: '轻松日常，意外反转', tag: '轻松', art: '/assets/avatars/player-smile.png', color: 'yellow' },
  { id: 'mystery', name: '恐怖悬疑', description: '细思极恐，步步追凶', tag: '恐怖', art: '/assets/avatars/player-ghost.png', color: 'purple' },
  { id: 'escape', name: '极限逃生', description: '绝境救援，寻找生机', tag: '救援', art: '/assets/avatars/player-astronaut.png', color: 'blue' },
  { id: 'spy', name: '身份谜局', description: '真假身份，解密真相', tag: '身份置换', art: '/assets/avatars/player-corgi.png', color: 'green' },
  { id: 'warm', name: '暖心反转', description: '深情守护，温柔结局', tag: '温情', art: '/assets/avatars/player-panda.png', color: 'pink' },
] as const;

export function WaitingRoom({ room, selfKey, disabled, onLeave, onInvite, onSettings, onStart, onKick }: {
  room: RoomView;
  selfKey: string;
  disabled: boolean;
  onLeave: () => void;
  onInvite: () => Promise<void>;
  onSettings: (settings: Partial<Settings>) => Promise<unknown>;
  onStart: (id?: string) => Promise<unknown>;
  onKick: (key: string) => void;
}) {
  const host = room.hostKey === selfKey;
  const hostName = room.players.find(player => player.key === room.hostKey)?.name || '房主';
  const [themeId, setThemeId] = useState<string>('classic');
  const [difficulty, setDifficulty] = useState<string | number>('all');
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | number>('random');
  const [pending, setPending] = useState(false);
  usePageLoading(loading, '正在加载主题题目…');
  const [quota, setQuota] = useState(String(room.settings.quota));
  const [maxGuesses, setMaxGuesses] = useState(String(room.settings.maxGuesses));
  const theme = themes.find(item => item.id === themeId) || themes[0];
  const controlsDisabled = disabled || !host || pending;
  useEffect(() => { setQuota(String(room.settings.quota)); setMaxGuesses(String(room.settings.maxGuesses)); }, [room.settings.quota, room.settings.maxGuesses]);
  useEffect(() => {
    if (!host) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setSelectedId('random');
    api.puzzles({ tag: theme.tag || undefined, excludeNsfl: room.settings.excludeNsfl, limit: 200, sort: 'new' }, controller.signal)
      .then(items => { if (!controller.signal.aborted) setPuzzles(items); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '题目加载失败'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [theme.tag, room.settings.excludeNsfl, host]);
  const candidates = puzzles.filter(puzzle => difficulty === 'all' || puzzle.difficulty === Number(difficulty));
  const selected = candidates.find(puzzle => puzzle.id === selectedId);
  const update = async (settings: Partial<Settings>) => {
    if (controlsDisabled) return;
    setPending(true);
    try { await onSettings(settings); }
    catch (err) { notify(err instanceof Error ? err.message : '设置保存失败'); setQuota(String(room.settings.quota)); setMaxGuesses(String(room.settings.maxGuesses)); }
    finally { setPending(false); }
  };
  const start = async () => {
    if (controlsDisabled || loading || error || !candidates.length) return;
    setPending(true);
    try {
      const id = selected?.id || (theme.tag || difficulty !== 'all' ? candidates[Math.floor(Math.random() * candidates.length)].id : undefined);
      await onStart(id);
    } catch (err) { notify(err instanceof Error ? err.message : '开局失败'); }
    finally { setPending(false); }
  };

  return <CandyPanel theme="frosted" className="waiting-board" style={{ padding: '24px' }}>
    <section className="waiting-settings">
      <CandyRibbon color="blue" className="home-ribbon">房间设置</CandyRibbon>
      <div className="waiting-room-heading"><span>{hostName}的房间</span><CandyButton variant="ghost" size="xs" onClick={onLeave} leftIcon={<CandyGameIcon name="arrow-right" size={16} />}>离开房间</CandyButton></div>
      <div className="waiting-form">
        <div className="waiting-form-row"><label htmlFor="waiting-code"><CandyGameIcon name="house" size={22} />房间号码</label><CandyInput id="waiting-code" value={room.code} readOnly /></div>
        <div className="waiting-form-row"><label htmlFor="waiting-turns"><CandyGameIcon name="controller" size={22} />提问模式</label><CandySelect id="waiting-turns" fullWidth disabled={controlsDisabled} value={room.settings.turnMode} options={[{ value: 'free', label: '自由提问' }, { value: 'turns', label: '轮流提问' }]} onChange={value => void update({ turnMode: value as Settings['turnMode'] })} /></div>
        <div className="waiting-form-row"><label htmlFor="waiting-quota-mode"><CandyGameIcon name="users" size={22} />额度模式</label><CandySelect id="waiting-quota-mode" fullWidth disabled={controlsDisabled} value={room.settings.quotaMode} options={[{ value: 'perPlayer', label: '每人独立额度' }, { value: 'shared', label: '全员共享额度' }, { value: 'unlimited', label: '不限提问次数' }]} onChange={value => void update({ quotaMode: value as Settings['quotaMode'] })} /></div>
        <div className="waiting-form-row"><label htmlFor="waiting-quota"><CandyGameIcon name="book" size={22} />提问次数</label><CandyInput id="waiting-quota" type="number" min={1} max={50} value={quota} disabled={controlsDisabled || room.settings.quotaMode === 'unlimited'} onChange={event => setQuota(event.target.value)} onBlur={() => { const value = Number(quota); if (!Number.isInteger(value) || value < 1 || value > 50) { setQuota(String(room.settings.quota)); notify('提问次数需为 1–50'); } else if (value !== room.settings.quota) void update({ quota: value }); }} /></div>
        <div className="waiting-form-row"><label htmlFor="waiting-guesses"><CandyGameIcon name="star" size={22} />还原次数</label><CandyInput id="waiting-guesses" type="number" min={1} max={10} value={maxGuesses} disabled={controlsDisabled} onChange={event => setMaxGuesses(event.target.value)} onBlur={() => { const value = Number(maxGuesses); if (!Number.isInteger(value) || value < 1 || value > 10) { setMaxGuesses(String(room.settings.maxGuesses)); notify('还原次数需为 1–10'); } else if (value !== room.settings.maxGuesses) void update({ maxGuesses: value }); }} /></div>
        <CandyCheckbox color="blue" disabled={controlsDisabled} checked={room.settings.excludeNsfl} label="排除重口题目" onChange={checked => void update({ excludeNsfl: checked })} />
      </div>
      <div className="waiting-player-list"><PlayerList room={room} selfKey={selfKey} disabled={disabled || pending} onKick={onKick} /></div>
    </section>
    <section className="waiting-selection">
      <CandyRibbon color="blue" className="home-ribbon">{host ? '选择题目主题' : '等待房主选题'}</CandyRibbon>
      <div className="waiting-theme-grid">{themes.map(item => <CandyButton key={item.id} variant={item.color} appearance="soft" shape="rounded" className="waiting-theme" disabled={controlsDisabled} aria-pressed={host && themeId === item.id} onClick={() => { setThemeId(item.id); setSelectedId('random'); }}>
        <span className="waiting-theme-content"><span className="waiting-theme-art"><img src={item.art} alt="" />{host && themeId === item.id && <CandyBadge variant="blue"><CandyGameIcon name="check" size={16} /></CandyBadge>}</span><strong>{item.name}</strong><small>{item.description}</small></span>
      </CandyButton>)}</div>
      <div className="waiting-puzzle-controls">
        <CandySelect aria-label="题目难度" fullWidth value={difficulty} disabled={controlsDisabled} options={[{ value: 'all', label: '全部难度' }, { value: '1', label: '入门' }, { value: '2', label: '中等' }, { value: '3', label: '烧脑' }]} onChange={value => { setDifficulty(value); setSelectedId('random'); }} />
        <CandySelect aria-label="待开局题目" fullWidth value={selectedId} disabled={controlsDisabled || loading || !!error} options={[{ value: 'random', label: '随机抽一道题' }, ...candidates.map(puzzle => ({ value: puzzle.id, label: puzzle.title }))]} onChange={setSelectedId} />
      </div>
      <CandyCard className="waiting-preview">
        <div className="waiting-preview-layout">
          <div className="waiting-preview-info"><strong>房间预览 · {host ? selected?.title || theme.name : '等待房主开始游戏'}</strong><span>{host ? selected ? '题目已选好，开局后一起阅读汤面。' : `随机抽题 · 当前可选 ${candidates.length} 道` : '开局后，所有玩家会同步看到汤面。'}</span><div className="waiting-preview-badges"><CandyBadge variant="blue">{room.players.length}/{LIMITS.maxPlayers} 人</CandyBadge><CandyBadge variant="green">{room.settings.turnMode === 'free' ? '自由提问' : '轮流提问'}</CandyBadge></div></div>
          <div className="waiting-invite-code"><span>房间邀请码</span><strong>{room.code}</strong><CandyButton variant="ghost" size="xs" leftIcon={<CandyGameIcon name="copy" size={16} />} onClick={() => void onInvite()}>复制邀请链接</CandyButton></div>
        </div>
      </CandyCard>
      {host && !loading && (error ? <CandyEmptyState title="题目加载失败" description={error} /> : !candidates.length ? <p role="status" className="waiting-load-state">这个主题或难度暂无可用题目，试试其他选择。</p> : null)}
      <div className="waiting-actions"><CandyButton variant="yellow" size="lg" fullWidth disabled={controlsDisabled || loading || !!error || !candidates.length} loading={pending && host} leftIcon={<CandyGameIcon name="play" size={24} />} onClick={() => void start()}>{host ? '开始游戏' : '等待房主开局'}</CandyButton><CandyButton variant="blue" size="lg" fullWidth leftIcon={<CandyGameIcon name="copy" size={24} />} onClick={() => void onInvite()}>邀请好友</CandyButton></div>
    </section>
  </CandyPanel>;
}
