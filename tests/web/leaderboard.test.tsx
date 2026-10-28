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
const entry = { rank: 1, name: '小林', avatar: '/assets/avatars/cat.webp', points: 730, questions: 12, bestProximity: 98 };
const view = () => render(<CandyProvider><HeaderDialogs kind="leaderboard" onClose={() => {}} /></CandyProvider>);
beforeEach(() => { fake.leaderboard.mockReset(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('榜单呈现积分和正确回合数，不出现旧问题公式或接近度', async () => {
  fake.leaderboard.mockResolvedValue({ entries: [entry], self: null }); view();
  await screen.findByText('小林');
  expect(screen.getByText('730 分')).toBeTruthy();
  expect(screen.getByText('12 个正确回合')).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/提问|接近度|问题|0–10/);
});
it('仅展示前三名，自己另有战绩', async () => {
  const entries = Array.from({ length: 8 }, (_, i) => ({ ...entry, rank: i + 1, name: `玩家${i + 1}` }));
  fake.leaderboard.mockResolvedValue({ entries, self: entries[1] }); view(); await screen.findByText('玩家1');
  expect(within(screen.getByRole('list', { name: '排行榜' })).getAllByRole('listitem')).toHaveLength(3);
  expect(screen.queryByText('玩家4')).toBeNull(); expect(screen.getByText('我的排名：第 2 名')).toBeTruthy();
});
it('首页保留真实榜单入口，头像不重复触发榜单', async () => {
  fake.leaderboard.mockResolvedValue({ entries: [entry], self: null });
  const home = render(<CandyProvider><HomePage /></CandyProvider>);
  fireEvent.click(screen.getByRole('button', { name: '排行榜' })); await screen.findByText('小林'); home.unmount();
  render(<CandyProvider><GameHeader pathname="/" onNavigate={() => {}} name="测试玩家" /></CandyProvider>);
  fireEvent.click(screen.getByLabelText('当前玩家')); expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('button', { name: '系统通知' })).toBeNull();
});
it('空榜单不伪造记录或创建身份', async () => {
  fake.leaderboard.mockResolvedValue({ entries: [], self: null }); const write = vi.spyOn(Storage.prototype, 'setItem'); view();
  await screen.findByText('暂无积分记录'); expect(write).not.toHaveBeenCalled();
});
it('失败可重试并使用已有身份', async () => {
  localStorage.setItem('turtle:playerKey', 'private-key');
  fake.leaderboard.mockRejectedValueOnce(Error('断网')).mockResolvedValue({ entries: [entry], self: { ...entry, rank: 4 } }); view();
  await screen.findByText('断网'); fireEvent.click(screen.getByRole('button', { name: '重试' })); await screen.findByText('小林');
  expect(fake.leaderboard).toHaveBeenCalledWith('private-key', expect.any(AbortSignal)); expect(document.body.textContent).not.toContain('private-key');
});
it('关闭榜单取消请求', async () => {
  let resolve!: (value: unknown) => void; fake.leaderboard.mockReturnValue(new Promise(yes => { resolve = yes; }));
  const mounted = view(); const signal = fake.leaderboard.mock.calls[0][1] as AbortSignal; mounted.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => resolve({ entries: [entry], self: null })); expect(screen.queryByRole('dialog')).toBeNull();
});
