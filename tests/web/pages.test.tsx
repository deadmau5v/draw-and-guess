// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
const fake = vi.hoisted(() => ({ createRoom: vi.fn().mockResolvedValue({ code: 'ABC234' }), puzzles: vi.fn().mockResolvedValue([]), health: vi.fn().mockResolvedValue({ puzzles: 80, judgeConfigured: true }), joinRoom: vi.fn(), leaveRoom: vi.fn(), start: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../web/src/api', () => ({ api: fake }));
vi.mock('../../web/src/socket', () => ({ joinRoom: fake.joinRoom, leaveRoom: fake.leaveRoom, actions: { start: fake.start } }));
import App, { Home, Library, Room } from '../../web/src/App';
import { GameProvider } from '../../web/src/theme';
import { updateState } from '../../web/src/store';
import type { RoomView } from '@shared/protocol';

beforeAll(() => {
  if (typeof window !== 'undefined') {
    if (!window.matchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    }
    if (!window.ResizeObserver) {
      class MockResizeObserver {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
      window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
      global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    }
  }
});

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: GameProvider });

afterEach(() => { cleanup(); vi.clearAllMocks(); localStorage.clear(); location.hash = '/'; updateState({ room: null, joined: false, status: 'offline', message: null }); });
it('首页说明玩法，保存昵称并创建房间', async () => {
  render(<App />);
  expect(screen.getByText(/汤面 → 提问 → 是\/不是\/不相关 → 每人8问 → 还原真相/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('你的昵称'), { target: { value: '小林' } });
  fireEvent.click(screen.getByRole('button', { name: '创建房间 →' }));
  await waitFor(() => expect(fake.createRoom).toHaveBeenCalledWith({ name: '小林', playerKey: expect.any(String) }));
  expect(localStorage.getItem('turtle:name')).toBe('小林');
  await waitFor(() => expect(location.hash).toBe('#/room/ABC234'));
});
it('跳过导航只移动焦点，不改变当前游戏路由', async () => {
  location.hash = '/room/ABC234';
  render(<App />);
  fireEvent.click(screen.getByRole('link', { name: '跳到游戏内容' }));
  await waitFor(() => expect(document.activeElement?.id).toBe('main-content'));
  expect(location.hash).toBe('#/room/ABC234');
});
it('单人随机一碗发送自动开局意图', async () => {
  const create = vi.fn();
  render(<Home name="小林" onName={() => {}} onCreate={create} onJoin={() => {}} busy={false} />);
  fireEvent.click(screen.getByRole('button', { name: '单人随机一碗' }));
  expect(create).toHaveBeenCalledWith('random');
});
it('题库默认排除重口并支持切换高评与搜索', async () => {
  render(<Library onChoose={() => {}} busy={false} />);
  await waitFor(() => expect(fake.puzzles).toHaveBeenCalledWith(expect.objectContaining({ excludeNsfl: true, sort: 'new' }), expect.any(AbortSignal)));
  fireEvent.click(screen.getByRole('tab', { name: '最热' }));
  fireEvent.change(screen.getByLabelText('搜索题目'), { target: { value: '酒保' } });
  await waitFor(() => expect(fake.puzzles).toHaveBeenCalledWith(expect.objectContaining({ sort: 'hot', q: '酒保' }), expect.any(AbortSignal)));
});
it('房间显示汤面、玩家、8问额度与房主面板', () => {
  const room = { code: 'ABC234', phase: 'playing', hostKey: 'me', settings: { quotaMode: 'perPlayer', quota: 8, turnMode: 'free', maxGuesses: 3, excludeNsfl: true }, players: [{ key: 'me', name: '小林', online: true, isHost: true, asked: 0, guesses: 0, pending: false }], puzzle: { id: 'p', title: '谜题', surface: '汤面故事', nsfl: false, tags: [], difficulty: 2, source: { key: 'test', repo: '', url: '', license: 'MIT' }, sourceKey: 'test', hintCount: 0, goodRate: null, tier: 'none', funny: 0, ratings: 0, plays: 0, solves: 0 }, log: [], guesses: [], hints: [], hintCount: 0, sharedUsed: 0, turnKey: null, round: 1, reveal: null } as RoomView;
  updateState({ room, joined: true, status: 'connected' });
  render(<Room code="ABC234" name="小林" playerKey="me" onName={() => {}} onLeave={() => {}} />);
  expect(screen.getByText('汤面故事')).toBeTruthy();
  expect(screen.getByText('剩余 8 问')).toBeTruthy();
  expect(screen.getByText('房主控制')).toBeTruthy();
});

