'use client';

import React, { useEffect, useState } from 'react';
import {
  CandyAlert, CandyBadge, CandyButton, CandyCard, CandyGameIcon,
  CandyInput, CandyList, CandyListItem, CandyPanel,
} from 'candy-ui';
import type { PartyMode, RoomView } from '@shared/protocol';
import { emitFloatingText, playJuiceSound } from './juice';
import { actions } from './socket';
import { notify } from './store';

export const PARTY_MODE_META: Record<PartyMode, { title: string; subtitle: string; badge: string }> = {
  'classic': { title: '经典你画我猜', subtitle: '画手看词作画 · 全员猜词提问 · AI 看画点评', badge: '经典联机' },
  'drawful': { title: '《Drawful》妙笔生谎', subtitle: '画怪异题 · 全员编假题目骗票 (+2分) · 混合盲投', badge: '造假骗票流' },
  'doodle-puzzle': { title: '《猜拆画画》拼图内鬼', subtitle: '四人分块拼图 + 内鬼「坏坏」暗中改画 + 投票抓内鬼', badge: '拼图狼人杀' },
  'pictomania': { title: '《妙笔神猜》全员狂飙', subtitle: '公开 16 个近似干扰词 · 边画边极速抢答', badge: '零等待抢答' },
  'monsdrawsity': { title: '《MonsDRAWsity》怪兽目击', subtitle: '目击者 20 秒瞬时记忆猎奇异兽 + 口述全员画像', badge: '瞬时记忆流' },
  'secret-ink': { title: '隐形墨水模式', subtitle: 'Gartic 变体：落笔 2 秒后自动隐形消失，全凭空间记忆盲画', badge: 'Gartic 盲画' },
  'knock-off': { title: '高仿山寨模式', subtitle: 'Gartic 变体：60s ➔ 30s ➔ 15s ➔ 8s 极限临摹退化', badge: 'Gartic 临摹' },
  'complement': { title: '残缺补全模式', subtitle: 'Gartic 变体：基于画板初始残缺线条脑洞补全整幅作品', badge: 'Gartic 补全' },
  'sandwich': { title: '三明治传声筒', subtitle: 'Gartic 变体：写词 ➔ 连续多帧看画重画畸变 ➔ 最终猜词', badge: 'Gartic 畸变' },
  'animation': { title: '逐帧动画接力', subtitle: 'Gartic 变体：仅看上一帧半透明洋葱皮残影，合成 5fps 动画', badge: 'Gartic 动画' },
};

export function PartyModeDeck({
  room,
  selfKey,
  disabled,
}: {
  room: RoomView;
  selfKey: string;
  disabled: boolean;
}) {
  const [bluffText, setBluffText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now);

  const party = room.party;
  const mode: PartyMode = party?.mode ?? room.settings.partyMode ?? 'classic';
  const playing = room.phase === 'playing';
  const meta = PARTY_MODE_META[mode] ?? PARTY_MODE_META.classic;

  useEffect(() => {
    if (mode !== 'monsdrawsity' || !party?.memoryDeadline || !playing) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [mode, party?.memoryDeadline, playing]);

  if (mode === 'classic' && !party) return null;

  const submitBluff = async () => {
    const clean = bluffText.trim();
    if (!clean || disabled || !playing || submitting) return;
    setSubmitting(true);
    try {
      await actions.bluff(clean);
      setBluffText('');
      playJuiceSound('verdictYes');
      emitFloatingText({ text: '🎭 假题目已潜伏！', color: 'purple' });
    } catch (err) {
      notify(err instanceof Error ? err.message : '提交假答案失败');
    } finally {
      setSubmitting(false);
    }
  };

  const castVote = async (targetId: string, label: string) => {
    if (disabled || !playing) return;
    try {
      await actions.vote(targetId);
      playJuiceSound('highlight');
      emitFloatingText({ text: `🗳️ 已投给：${label}`, color: 'yellow' });
    } catch (err) {
      notify(err instanceof Error ? err.message : '投票失败');
    }
  };

  const quickGuessWord = async (word: string) => {
    if (disabled || !playing) return;
    try {
      await actions.guess(word);
      playJuiceSound('pressUp');
      emitFloatingText({ text: `⚡ 抢答：${word}`, color: 'blue' });
    } catch (err) {
      notify(err instanceof Error ? err.message : '抢答提交失败');
    }
  };

  const witnessSecondsLeft = party?.memoryDeadline
    ? Math.max(0, Math.ceil((party.memoryDeadline - now) / 1000))
    : 0;

  return (
    <CandyPanel theme="frosted" style={{ padding: 12 }} className="party-mode-deck" aria-label="进阶派对玩法控制台">
      <div className="party-mode-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <CandyBadge variant="purple"><CandyGameIcon name="star" size={14} /> {meta.badge}</CandyBadge>
          <strong>{meta.title}</strong>
        </div>
        <small>{party?.stageDescription ?? meta.subtitle}</small>
      </div>

      {mode === 'drawful' && (
        <div className="party-mode-body">
          {playing && (
            <div className="drawful-bluff-row">
              <CandyInput
                aria-label="编写假题目骗票"
                placeholder="编一个看上去很像这幅画的假题目（骗到1票得2分）…"
                value={bluffText}
                maxLength={40}
                disabled={disabled}
                onChange={e => setBluffText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void submitBluff(); }}
              />
              <CandyButton
                type="button"
                variant="purple"
                size="sm"
                disabled={disabled || !bluffText.trim() || submitting}
                onClick={() => void submitBluff()}
              >
                提交假题
              </CandyButton>
            </div>
          )}
          {(party?.drawfulChoices?.length ?? 0) > 0 && (
            <div className="drawful-choices-grid" role="group" aria-label="妙笔生谎投票选项">
              {party!.drawfulChoices!.map(choice => (
                <CandyButton
                  key={choice.id}
                  type="button"
                  size="xs"
                  variant={choice.isTruth ? 'green' : 'blue'}
                  appearance="soft"
                  disabled={disabled || !playing}
                  onClick={() => void castVote(choice.id, choice.text)}
                >
                  <span>「{choice.text}」</span>
                  {choice.votes.length > 0 && <CandyBadge variant="yellow" size="sm">{choice.votes.length} 票</CandyBadge>}
                  {choice.authorName && <CandyBadge variant={choice.isTruth ? 'green' : 'purple'} size="sm">{choice.authorName}</CandyBadge>}
                </CandyButton>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'doodle-puzzle' && (
        <div className="party-mode-body">
          <div className="doodle-quadrants-bar">
            {(party?.quadrantOwners ?? []).map(q => (
              <CandyBadge key={q.quadrant} variant={q.playerKey === selfKey ? 'yellow' : 'blue'} size="sm">
                区域 #{q.quadrant + 1}：{q.playerName}
              </CandyBadge>
            ))}
          </div>
          <div className="doodle-vote-row" role="group" aria-label="指认内鬼坏坏">
            <span>🕵️ 抓内鬼投票：</span>
            {room.players.map(pl => (
              <CandyButton
                key={pl.key}
                type="button"
                size="xs"
                variant="red"
                appearance="outline"
                disabled={disabled || !playing}
                onClick={() => void castVote(pl.key, pl.name)}
              >
                指认 {pl.name}
              </CandyButton>
            ))}
          </div>
          {(party?.accusedVotes?.length ?? 0) > 0 && (
            <small>
              当前指认：{party!.accusedVotes!.map(v => `${v.voterName}➔${v.suspectName}`).join('，')}
              {party?.saboteurName ? ` · 真实内鬼：${party.saboteurName}` : ''}
            </small>
          )}
        </div>
      )}

      {mode === 'pictomania' && (
        <div className="party-mode-body">
          <p style={{ margin: '4px 0', fontSize: 12 }}>⚡ 公开近似题库（点击词条直接极速抢答，越早猜中得分越高）：</p>
          <div className="pictomania-word-grid" role="group" aria-label="妙笔神猜公开近似词库">
            {(party?.candidateWords ?? []).map(w => (
              <CandyButton
                key={w}
                type="button"
                size="xs"
                variant="blue"
                appearance="outline"
                disabled={disabled || !playing}
                onClick={() => void quickGuessWord(w)}
              >
                {w}
              </CandyButton>
            ))}
          </div>
          {(party?.solvedRankings?.length ?? 0) > 0 && (
            <div className="pictomania-rankings">
              {party!.solvedRankings!.map((r, idx) => (
                <CandyBadge key={r.playerName} variant="yellow" size="sm">
                  第 {idx + 1} 名：{r.playerName} (+{r.points}分)
                </CandyBadge>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'monsdrawsity' && (
        <div className="party-mode-body">
          <CandyAlert tone={witnessSecondsLeft > 0 ? 'warning' : 'info'} title={`目击者：${party?.witnessName ?? '房主'}`}>
            {witnessSecondsLeft > 0
              ? `👁️ 瞬时目击记忆倒计时：剩余 ${witnessSecondsLeft} 秒！请目击者记住异兽特征并口述给全体画师！`
              : '🎨 记忆时间结束！请全体画像师根据目击者口述作画，并评选最还原画师！'}
          </CandyAlert>
          <div className="doodle-vote-row" role="group" aria-label="评选最佳灵魂画师">
            <span>🏆 评选最还原画像师：</span>
            {room.players.map(pl => (
              <CandyButton
                key={pl.key}
                type="button"
                size="xs"
                variant="yellow"
                appearance="soft"
                disabled={disabled || !playing}
                onClick={() => void castVote(pl.key, pl.name)}
              >
                投给 {pl.name}
              </CandyButton>
            ))}
            {party?.bestArtistWinner && <CandyBadge variant="green">当前最高票：{party.bestArtistWinner}</CandyBadge>}
          </div>
        </div>
      )}
    </CandyPanel>
  );
}
