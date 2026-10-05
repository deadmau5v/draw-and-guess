import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../web/src/api';
afterEach(() => vi.unstubAllGlobals());
it('题库请求序列化过滤分页并使用公开 API', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
  vi.stubGlobal('fetch', fetch);
  await api.puzzles({ sort: 'good', q: '酒保', excludeNsfl: true, limit: 60, offset: 0 });
  const url = new URL(fetch.mock.calls[0][0], 'http://localhost');
  expect(url.pathname).toBe('/api/puzzles');
  expect(Object.fromEntries(url.searchParams)).toEqual({ sort: 'good', q: '酒保', nsfl: '0', limit: '60', offset: '0' });
});
it('HTTP 错误显示中文服务端消息', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ msg: '题目不存在' }) }));
  await expect(api.puzzle('missing')).rejects.toThrow('题目不存在');
});
it('创建房间发送昵称、匿名 playerKey 与头像', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 'ABC234' }) });
  vi.stubGlobal('fetch', fetch);
  expect(await api.createRoom({ name: '小林', playerKey: 'key' })).toEqual({ code: 'ABC234' });
  expect(fetch.mock.calls[0][0]).toBe('/api/rooms');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ name: '小林', playerKey: 'key', avatar: '/assets/avatars/player-panda.png' });
});
it('请求健康状态并编码题目 ID', async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetch);
  await api.health();
  await api.puzzle('a/b');
  expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/health', '/api/puzzles/a%2Fb']);
});
