// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => {
  const handlers: Record<string, (...args: any[]) => void> = {};
  const client = { connected: false, on: vi.fn((event: string, cb: (...args: any[]) => void) => { handlers[event] = cb; }), connect: vi.fn(), disconnect: vi.fn(), emit: vi.fn() };
  return { client, handlers, io: vi.fn(() => client) };
});
vi.mock('socket.io-client', () => ({ io: fake.io }));
import { joinRoom, leaveRoom, actions } from '../../web/src/socket';
import { getSnapshot } from '../../web/src/store';
beforeEach(() => { fake.client.emit.mockReset(); fake.client.connected = false; leaveRoom(); fake.client.emit.mockReset(); localStorage.clear(); });
it('断线重连后使用同一 code/name/playerKey 重新 join', () => {
  const identity = { code: 'ABC234', name: '小林', playerKey: 'same-key' };
  joinRoom(identity);
  fake.client.connected = true;
  fake.handlers.connect();
  expect(fake.client.emit.mock.calls[0].slice(0, 2)).toEqual(['room:join', identity]);
  fake.client.emit.mock.calls[0][2]({ ok: true, value: { code: 'ABC234' } });
  expect(getSnapshot().status).toBe('connected');
  fake.handlers.disconnect();
  expect(getSnapshot().status).toBe('offline');
  fake.handlers.connect();
  expect(fake.client.emit.mock.calls[1].slice(0, 2)).toEqual(['room:join', identity]);
});
it('未连接时不缓存提问到重连后发送', async () => {
  await expect(actions.ask('问题')).rejects.toThrow('连接');
  expect(fake.client.emit).not.toHaveBeenCalled();
});
it('被踢出后清空自动重连身份', () => {
  joinRoom({ code: 'ABC234', name: '小林', playerKey: 'same-key' });
  fake.handlers['room:kicked']();
  fake.client.connected = true;
  fake.handlers.connect();
  expect(fake.client.emit).not.toHaveBeenCalled();
  expect(getSnapshot().message).toContain('移出');
});
