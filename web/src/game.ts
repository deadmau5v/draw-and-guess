import type { GuessView, QAView, RoomView } from '@shared/protocol';

export function normalizeText(text: string): string {
  return text.trim().replace(/[？?。.!！]+$/u, '').trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function findDuplicateQuestion(room: RoomView | null | undefined, text: string): QAView | undefined {
  if (!room || room.phase !== 'playing') return undefined;
  const norm = normalizeText(text);
  if (!norm) return undefined;
  return room.log.find(item => item.verdict !== '不确定' && item.verdict !== '出错' && normalizeText(item.text) === norm);
}

export function findDuplicateGuess(room: RoomView | null | undefined, text: string): GuessView | undefined {
  if (!room || room.phase !== 'playing') return undefined;
  const norm = normalizeText(text);
  if (!norm) return undefined;
  return room.guesses.find(item => item.outcome !== '不确定' && item.outcome !== '出错' && normalizeText(item.text) === norm);
}

export function verdictTone(value: string): string {
  const tones: Record<string, string> = { '是': 'green', '不是': 'red', '不相关': 'gray', '不确定': 'yellow', '判定中': 'pending', '出错': 'darkred', '破解成功': 'green', '接近真相': 'yellow', '还没猜对': 'red' };
  return tones[value] ?? 'gray';
}

export function remainingQuota(room: RoomView, key: string): number {
  if (room.settings.quotaMode === 'unlimited') return Infinity;
  const used = room.settings.quotaMode === 'shared' ? room.sharedUsed : room.players.find(p => p.key === key)?.asked ?? 0;
  return Math.max(0, room.settings.quota - used);
}
