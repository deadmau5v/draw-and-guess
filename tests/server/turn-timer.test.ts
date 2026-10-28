import { expect, it } from 'vitest';
import { RoomManager } from '../../server/rooms/roomManager.js';
import type { Ack } from '../../shared/protocol.js';
function value<T>(result: Ack<T>): T { if (!result.ok) throw Error(result.msg); return result.value; }
function setup() {
  let now = 1000;
  const rooms = new RoomManager({ now: () => now });
  const code = value(rooms.createRoom('甲', 'a')).code;
  value(rooms.join(code, '甲', 'a', 'sa'));
  value(rooms.join(code, '乙', 'b', 'sb'));
  return { rooms, code, time: (next: number) => { now = next; }, view: () => value(rooms.toPublicView(code)) };
}
it('默认90秒且允许房主设置15–600秒整数，非法值拒绝', () => {
  const { rooms, code, view } = setup();
  expect(view().settings.turnSeconds).toBe(90);
  for (const turnSeconds of [0, 14, 601, 30.5, NaN]) expect(rooms.updateSettings(code, 'a', { turnSeconds })).toMatchObject({ ok: false, code: 'INVALID' });
  expect(rooms.updateSettings(code, 'b', { turnSeconds: 60 })).toMatchObject({ ok: false, code: 'NOT_HOST' });
  value(rooms.updateSettings(code, 'a', { turnMode: 'turns', turnSeconds: 60 }));
  value(rooms.start(code, 'a', 'p'));
  expect(view()).toMatchObject({ turnKey: 'a', turnDeadline: 61000, turnRemainingMs: null, serverNow: 1000 });
});
it('服务器超时轮转、不扣配额、不连跳，新轮完整90秒', () => {
  const { rooms, code, view, time } = setup();
  value(rooms.updateSettings(code, 'a', { turnMode: 'turns' }));value(rooms.start(code, 'a', 'p'));
  time(90999);expect(rooms.expireTurns()).toEqual([]);
  time(91000);expect(rooms.expireTurns()).toEqual([code]);
  expect(view()).toMatchObject({ turnKey: 'b', turnDeadline: 181000 });
  expect(view().players.map(p => p.asked)).toEqual([0, 0]);
  expect(rooms.expireTurns()).toEqual([]);
  time(900000);expect(rooms.expireTurns()).toEqual([code]);
  expect(view()).toMatchObject({ turnKey: 'a', turnDeadline: 990000 });
});
it('截止时间后的提问拒绝，不依赖后台定时器及时执行', () => {
  const { rooms, code, view, time } = setup();
  value(rooms.updateSettings(code, 'a', { turnMode: 'turns' }));value(rooms.start(code, 'a', 'p'));
  time(91001);expect(rooms.beginAsk(code, 'a', '迟到')).toMatchObject({ ok: false, code: 'NOT_YOUR_TURN' });
  expect(view().turnKey).toBe('b');expect(view().log).toEqual([]);
});
it('提问判题暂停，完成后下一位重置；其他人还原判题暂停并恢复余量', () => {
  const { rooms, code, view, time } = setup();
  value(rooms.updateSettings(code, 'a', { turnMode: 'turns' }));value(rooms.start(code, 'a', 'p'));
  time(31000);const guess = value(rooms.beginGuess(code, 'b', '还原'));
  expect(view()).toMatchObject({ turnDeadline: null, turnRemainingMs: 60000 });
  time(200000);expect(rooms.expireTurns()).toEqual([]);
  value(rooms.applyOutcome(code, guess.id, '还没猜对'));
  expect(view()).toMatchObject({ turnKey: 'a', turnDeadline: 260000, turnRemainingMs: null });
  time(210000);const qa = value(rooms.beginAsk(code, 'a', '问'));
  expect(view()).toMatchObject({ turnDeadline: null, turnRemainingMs: 50000 });
  time(400000);expect(rooms.expireTurns()).toEqual([]);
  value(rooms.applyVerdict(code, qa.id, '出错', 0));
  expect(view()).toMatchObject({ turnKey: 'b', turnDeadline: 490000, turnRemainingMs: null });
  expect(view().players[0].asked).toBe(0);
});
it('多项判题全部完成才恢复，离线跳过、重连恢复，揭晓/自由模式无倒计时', () => {
  const { rooms, code, view, time } = setup();
  value(rooms.start(code, 'a', 'p'));expect(view().turnDeadline).toBeNull();
  value(rooms.reveal(code, 'a'));
  // Settings persist from lobby; new games keep the selected mode.
  const other = setup();value(other.rooms.updateSettings(other.code, 'a', { turnMode: 'turns' }));value(other.rooms.start(other.code, 'a', 'p'));
  const qa = value(other.rooms.beginAsk(other.code, 'a', '问'));
  const guess = value(other.rooms.beginGuess(other.code, 'b', '猜'));
  other.time(200000);value(other.rooms.applyVerdict(other.code, qa.id, '是', 1));
  expect(other.view()).toMatchObject({ turnKey: 'b', turnDeadline: null, turnRemainingMs: 90000 });
  value(other.rooms.applyOutcome(other.code, guess.id, '出错'));
  expect(other.view().turnDeadline).toBe(290000);
  value(other.rooms.disconnect('sb'));expect(other.view()).toMatchObject({ turnKey: 'a', turnDeadline: 290000 });
  value(other.rooms.disconnect('sa'));expect(other.view()).toMatchObject({ turnKey: null, turnDeadline: null });
  other.time(300000);value(other.rooms.join(other.code, '甲', 'a', 'sa2'));expect(other.view().turnDeadline).toBe(390000);
  value(other.rooms.reveal(other.code, 'a'));expect(other.view()).toMatchObject({ turnDeadline: null, turnRemainingMs: null });
  time(100000);expect(rooms.expireTurns()).toEqual([]);
});
