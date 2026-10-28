// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CandyProvider } from 'candy-ui';
const fake = vi.hoisted(() => ({ leaderboard: vi.fn() }));
vi.mock('../../web/src/api', () => ({ api: fake }));
vi.mock('../../app/gameNavigation', () => ({ useGameRouter: () => ({ push: vi.fn() }) }));
import HeaderDialogs from '../../web/src/HeaderDialogs';
import HomePage from '../../app/page';
import { GameHeader } from '../../web/src/GameHeader';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const entry = { rank: 1, name: '认真侦探', avatar: '/assets/avatars/cat.webp', points: 73, questions: 12, bestProximity: 98 };
const view = () => render(<CandyProvider><p>原有房间页面</p><HeaderDialogs kind="leaderboard" onClose={() => {}} /></CandyProvider>);
beforeEach(() => { fake.leaderboard.mockReset(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('在已打开的弹窗局部自动加载跨房间永久榜单，无需刷新按钮', async () => {
  const request = deferred<{ entries: typeof entry[]; self: null }>();
  fake.leaderboard.mockReturnValue(request.promise);
  view();
  expect(screen.getByText('原有房间页面')).toBeTruthy();
  expect(within(screen.getByRole('dialog')).getByRole('status').textContent).toContain('加载排行榜');
  expect(screen.queryByRole('button', { name: '刷新' })).toBeNull();
  expect(fake.leaderboard).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
  await act(async () => request.resolve({ entries: [entry], self: null }));
  const list = within(screen.getByRole('list', { name: '永久积分排行榜' }));
  expect(list.getByText('认真侦探')).toBeTruthy();
  expect(list.getByText('73 积分')).toBeTruthy();
  expect(list.getByTitle('提问 12 次 · 最佳接近度 98 / 100')).toBeTruthy();
  expect(screen.getByText(/跨房间累计/)).toBeTruthy();
  expect(screen.queryByText('排行榜暂未开放')).toBeNull();
});

it('仅展示前三名，并在前三名内标记自己，保留独立的个人战绩', async () => {
  const entries = Array.from({ length: 8 }, (_, i) => ({ ...entry, rank: i + 1, name: `侦探${i + 1}` }));
  fake.leaderboard.mockResolvedValue({ entries, self: entries[1] });
  view();
  await screen.findByText('侦探1');
  const list = within(screen.getByRole('list', { name: '永久积分排行榜' }));
  expect(list.getAllByRole('listitem')).toHaveLength(3);
  expect(list.getByText('侦探3')).toBeTruthy();
  expect(screen.queryByText('侦探4')).toBeNull();
  expect(list.getByText('我')).toBeTruthy();
  expect(screen.getByText('我的排名：第 2 名')).toBeTruthy();
  expect(screen.getByRole('dialog').classList.contains('leaderboard-modal')).toBe(true);
  expect(screen.getByRole('button', { name: '关闭' })).toBeTruthy();
});

it('首页卡片使用真实前三名榜单，而不是暂未开放的占位弹窗', async () => {
  fake.leaderboard.mockResolvedValue({ entries: [entry], self: null });
  render(<CandyProvider><HomePage /></CandyProvider>);
  fireEvent.click(screen.getByRole('button', { name: '排行榜' }));
  await screen.findByText('认真侦探');
  expect(fake.leaderboard).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('排行榜暂未开放')).toBeNull();
  expect(screen.getByRole('dialog').classList.contains('leaderboard-modal')).toBe(true);
});

it('右上角昵称和头像仅展示身份，不是额外的排行榜入口', () => {
  render(<CandyProvider><GameHeader pathname="/" onNavigate={() => {}} name="测试玩家" /></CandyProvider>);
  expect(screen.queryByRole('button', { name: /测试玩家/ })).toBeNull();
  const profile = screen.getByLabelText('当前玩家');
  expect(within(profile).getByText('测试玩家')).toBeTruthy();
  fireEvent.click(profile);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(fake.leaderboard).not.toHaveBeenCalled();
  expect(screen.getAllByRole('button', { name: '排行榜' })).toHaveLength(1);
});

it('没有战绩时明确为空，不伪造玩家或为查看榜单创建身份', async () => {
  fake.leaderboard.mockResolvedValue({ entries: [], self: null });
  const write = vi.spyOn(Storage.prototype, 'setItem');
  view();
  await screen.findByText('暂无积分记录');
  expect(screen.queryByRole('list', { name: '永久积分排行榜' })).toBeNull();
  expect(write).not.toHaveBeenCalled();
  expect(localStorage.getItem('turtle:playerKey')).toBeNull();
  expect(screen.getByText(/0–100/).textContent).toContain('0–10');
  expect(screen.getByText(/失败或不确定/)).toBeTruthy();
  expect(screen.getByText(/同一题目、同一身份/).textContent).toContain('规范化后相同');
});

it('加载失败显示可重试错误，重试后显示真实数据', async () => {
  fake.leaderboard.mockRejectedValueOnce(Error('网络暂时不可用')).mockResolvedValue({ entries: [entry], self: null });
  view();
  expect((await screen.findByRole('alert')).textContent).toContain('网络暂时不可用');
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  await screen.findByText('认真侦探');
  expect(fake.leaderboard).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
});

it('重新打开榜单自动获取最新战绩', async () => {
  fake.leaderboard.mockResolvedValueOnce({ entries: [entry], self: null }).mockResolvedValueOnce({ entries: [{ ...entry, points: 81 }], self: null });
  const mounted = view();
  await screen.findByText('73 积分');
  const previous = fake.leaderboard.mock.calls[0][1] as AbortSignal;
  mounted.unmount();
  expect(previous.aborted).toBe(true);
  view();
  await screen.findByText('81 积分');
  expect(fake.leaderboard).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('button', { name: '刷新' })).toBeNull();
});

it('使用已有身份获取自己的名次，即使自己不在前三名也显示统计且不公开身份', async () => {
  localStorage.setItem('turtle:playerKey', 'private-player-key');
  fake.leaderboard.mockResolvedValue({ entries: [entry], self: { ...entry, rank: 123, name: '自己的昵称', points: 16, questions: 5, bestProximity: 70 } });
  view();
  await screen.findByText('我的排名：第 123 名');
  expect(fake.leaderboard).toHaveBeenCalledWith('private-player-key', expect.any(AbortSignal));
  const self = within(screen.getByRole('region', { name: '我的战绩' }));
  expect(self.getByText('16 积分')).toBeTruthy();
  expect(self.getByText('提问 5 次 · 最佳接近度 70 / 100')).toBeTruthy();
  expect(document.body.textContent).not.toContain('private-player-key');
});

it('浏览器禁止读取本地存储时仍可匿名查看榜单', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('禁止访问', 'SecurityError'); });
  fake.leaderboard.mockResolvedValue({ entries: [entry], self: null });
  view();
  await screen.findByText('认真侦探');
  expect(fake.leaderboard).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('关闭榜单取消未完成请求，原房间页面保持挂载，取消不显示错误', async () => {
  const request = deferred<{ entries: typeof entry[]; self: null }>();
  fake.leaderboard.mockReturnValue(request.promise);
  const mounted = view();
  const signal = fake.leaderboard.mock.calls[0][1] as AbortSignal;
  const page = screen.getByText('原有房间页面');
  mounted.rerender(<CandyProvider><p>原有房间页面</p></CandyProvider>);
  expect(signal.aborted).toBe(true);
  expect(screen.getByText('原有房间页面')).toBe(page);
  await act(async () => request.reject(new DOMException('取消请求', 'AbortError')));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
});

it.each(['resolve', 'reject'] as const)('忽略被替换请求的迟到 %s，不覆盖新榜单或提前解除加载状态', async outcome => {
  const old = deferred<{ entries: typeof entry[]; self: null }>();
  const latest = deferred<{ entries: typeof entry[]; self: null }>();
  fake.leaderboard.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  render(<React.StrictMode><CandyProvider><HeaderDialogs kind="leaderboard" onClose={() => {}} /></CandyProvider></React.StrictMode>);
  expect(fake.leaderboard).toHaveBeenCalledTimes(2);
  expect((fake.leaderboard.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
  await act(async () => {
    if (outcome === 'resolve') old.resolve({ entries: [{ ...entry, name: '过期榜单' }], self: null });
    else old.reject(Error('过期请求错误'));
  });
  expect(screen.getByRole('status')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '刷新' })).toBeNull();
  expect(screen.queryByText('过期榜单')).toBeNull();
  expect(screen.queryByText('过期请求错误')).toBeNull();
  await act(async () => latest.resolve({ entries: [entry], self: null }));
  expect(screen.getByText('认真侦探')).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
});
