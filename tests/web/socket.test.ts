// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => {
  const handlers: Record<string, (...args: any[]) => void> = {};
  const client = { connected: false, on: vi.fn((event: string, cb: (...args: any[]) => void) => { handlers[event] = cb; }), connect: vi.fn(), disconnect: vi.fn(), emit: vi.fn() };
  return { client, handlers, io: vi.fn(() => client) };
});
vi.mock('socket.io-client', () => ({ io: fake.io }));
import { joinRoom, leaveRoom, actions } from '../../web/src/socket';
import { clearToast, getSnapshot } from '../../web/src/store';
beforeEach(() => { fake.client.emit.mockReset(); fake.client.connected = false; leaveRoom(); fake.client.emit.mockReset(); localStorage.clear(); });
afterEach(() => { leaveRoom(); vi.useRealTimers(); });
it('加入无响应时结束加载，显示可返回首页的超时错误', () => {
  vi.useFakeTimers();fake.client.connected = true;
  joinRoom({ code: 'ABC234', name: '小林', playerKey: 'same-key' });
  vi.advanceTimersByTime(15000);
  expect(getSnapshot().joinError).toContain('超时');
});
it('断线重连后使用同一 code/name/playerKey 重新 join', () => {
  const identity = { code: 'ABC234', name: '小林', playerKey: 'same-key' };
  joinRoom(identity);
  fake.client.connected = true;
  fake.handlers.connect();
  expect(fake.client.emit.mock.calls[0].slice(0, 2)).toEqual(['room:join', { ...identity, avatar: '/assets/avatars/player-panda.png' }]);
  fake.client.emit.mock.calls[0][2]({ ok: true, value: { code: 'ABC234' } });
  expect(getSnapshot().status).toBe('connected');
  fake.handlers.disconnect();
  expect(getSnapshot().status).toBe('offline');
  fake.handlers.connect();
  expect(fake.client.emit.mock.calls[1].slice(0, 2)).toEqual(['room:join', { ...identity, avatar: '/assets/avatars/player-panda.png' }]);
});
it('未连接时不缓存提问到重连后发送', async () => {
  await expect(actions.ask('问题')).rejects.toThrow('连接');
  expect(fake.client.emit).not.toHaveBeenCalled();
});
it('加入失败保留页面错误，重试成功清除错误', () => {
  const identity = { code: 'ABC234', name: '小林', playerKey: 'same-key' };
  fake.client.connected = true;
  joinRoom(identity);
  fake.client.emit.mock.calls[0][2]({ ok: false, code: 'NOT_FOUND', msg: '房间不存在' });
  clearToast();
  expect(getSnapshot()).toMatchObject({ room: null, joined: false, status: 'connected', joinError: '房间不存在', message: null });
  joinRoom(identity);
  expect(getSnapshot().joinError).toBeNull();
  fake.client.emit.mock.calls[1][2]({ ok: true, value: { code: 'ABC234' } });
  expect(getSnapshot()).toMatchObject({ joined: true, joinError: null });
});
it('切换房间后忽略旧房间迟到的失败回调', () => {
  fake.client.connected = true;
  joinRoom({ code: 'ABC234', name: '小林', playerKey: 'same-key' });
  const oldAck = fake.client.emit.mock.calls[0][2];
  joinRoom({ code: 'DEF567', name: '小林', playerKey: 'same-key' });
  oldAck({ ok: false, code: 'NOT_FOUND', msg: '房间不存在' });
  expect(getSnapshot().joinError).toBeNull();
});
it('加入时携带所选头像，同一房间换头像后重新同步', () => {
  fake.client.connected = true;
  localStorage.setItem('turtle:avatar', '/assets/avatars/player-anime.png');
  const identity = { code: 'ABC234', name: '小林', playerKey: 'same-key' };
  joinRoom(identity);
  expect(fake.client.emit.mock.calls[0][1].avatar).toBe('/assets/avatars/player-anime.png');
  fake.client.emit.mock.calls[0][2]({ ok: true, value: { code: 'ABC234' } });
  localStorage.setItem('turtle:avatar', '/assets/avatars/player-smile.png');
  joinRoom(identity);
  expect(fake.client.emit.mock.calls[1][1].avatar).toBe('/assets/avatars/player-smile.png');
});
it('被踢出后清空自动重连身份', () => {
  joinRoom({ code: 'ABC234', name: '小林', playerKey: 'same-key' });
  fake.handlers['room:kicked']();
  fake.client.connected = true;
  fake.handlers.connect();
  expect(fake.client.emit).not.toHaveBeenCalled();
  expect(getSnapshot().message).toContain('移出');
});

