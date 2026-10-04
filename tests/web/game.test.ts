import { describe, expect, it } from 'vitest';
import { verdictTone, remainingQuota } from '../../web/src/game';
import type { RoomView } from '@shared/protocol';

describe('判定标签与提问额度', () => {
  it('按规格映射六种判定颜色', () => {
    expect(['是','不是','不相关','不确定','判定中','出错'].map(v => verdictTone(v))).toEqual(['green','red','gray','yellow','pending','darkred']);
  });
  it('按个人、共享和无限模式计算额度且不出现负数', () => {
    const room = { settings: { quotaMode: 'perPlayer', quota: 8 }, sharedUsed: 6, players: [{ key: 'me', asked: 3 }] } as RoomView;
    expect(remainingQuota(room, 'me')).toBe(5);
    room.settings.quotaMode = 'shared';
    expect(remainingQuota(room, 'me')).toBe(2);
    room.sharedUsed = 10;
    expect(remainingQuota(room, 'me')).toBe(0);
    room.settings.quotaMode = 'unlimited';
    expect(remainingQuota(room, 'me')).toBe(Infinity);
  });
});
