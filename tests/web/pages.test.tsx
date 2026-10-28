// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
const fake = vi.hoisted(() => ({ createRoom: vi.fn().mockResolvedValue({ code: 'ABC234' }), puzzles: vi.fn().mockResolvedValue([]), health: vi.fn().mockResolvedValue({ puzzles: 80, judgeConfigured: true }), joinRoom: vi.fn(), leaveRoom: vi.fn(), start: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../web/src/api', () => ({ api: fake }));
vi.mock('../../web/src/socket', () => ({ joinRoom: fake.joinRoom, leaveRoom: fake.leaveRoom, actions: { start: fake.start } }));
vi.mock('next/navigation', () => ({ useParams: () => ({ code: 'ABC234' }), useRouter: () => ({ push: vi.fn() }) }));
import RoomPage from '../../app/room/[code]/page';
import App, { Home, Library, Room } from '../../web/src/App';
import { GameProvider } from '../../web/src/theme';
import { updateState } from '../../web/src/store';
import type { RoomView } from '@shared/protocol';

beforeAll(() => {
  if (typeof window !== 'undefined') {
    // CandySelect scrolls its active option into view; JSDOM has no layout implementation.
    HTMLElement.prototype.scrollIntoView = vi.fn();
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

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); location.hash = '/'; updateState({ room: null, joined: false, status: 'offline', message: null, joinError: null }); });
it('Next 房间在缺少 randomUUID 的 HTTP 环境仍生成并复用玩家标识', () => {
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
  localStorage.setItem('turtle:name', '小林');
  const first = render(<RoomPage />);
  const key = localStorage.getItem('turtle:playerKey');
  expect(key).toMatch(/^p-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  expect(fake.joinRoom).toHaveBeenCalledWith({ code: 'ABC234', name: '小林', playerKey: key });
  first.unmount();
  render(<RoomPage />);
  expect(localStorage.getItem('turtle:playerKey')).toBe(key);
  expect(fake.joinRoom).toHaveBeenLastCalledWith({ code: 'ABC234', name: '小林', playerKey: key });
});
it('Next 房间加入失败后显示错误并停止加载，仍可返回首页', async () => {
  localStorage.setItem('turtle:name', '小林');
  render(<RoomPage />);
  expect(screen.getByText('正在加入房间...')).toBeTruthy();
  act(() => updateState({ room: null, joined: false, status: 'connected', joinError: '房间不存在' }));
  expect(screen.getByRole('alert').textContent).toBe('房间不存在');
  await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
  expect(fake.leaveRoom).toHaveBeenCalled();
});
it('房间加载使用满高独立卡片，底部保留返回操作且不嵌套面板', () => {
  localStorage.setItem('turtle:name', '小林');
  const { container } = render(<RoomPage />);
  expect(container.querySelector('.room-entry-main .room-entry-panel')).toBeTruthy();
  const status = screen.getByRole('status');
  expect(status.textContent).toContain('正在加入房间...');
  const footer = container.querySelector('.room-entry-footer');
  expect(footer?.contains(screen.getByRole('button', { name: '返回首页' }))).toBe(true);
  expect(container.querySelectorAll('.room-entry-panel .candy-panel')).toHaveLength(0);
});
it('首页说明玩法，保存昵称并创建房间', async () => {
  render(<App />);
  expect(await screen.findByText(/汤面 → 提问 → 是\/不是\/不相关 → 每人8问 → 还原真相/)).toBeTruthy();
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
  fireEvent.click(screen.getByRole('combobox', { name: '题库排序' }));
  fireEvent.click(screen.getByRole('option', { name: '最多挑战' }));
  fireEvent.change(screen.getByLabelText('搜索题目'), { target: { value: '酒保' } });
  await waitFor(() => expect(fake.puzzles).toHaveBeenCalledWith(expect.objectContaining({ sort: 'hot', q: '酒保' }), expect.any(AbortSignal)));
});
it('房间显示汤面、玩家、8问额度与房主面板', () => {
  const room: RoomView = { code: 'ABC234', phase: 'playing', hostKey: 'me', settings: { quotaMode: 'perPlayer', quota: 8, turnMode: 'free', turnSeconds: 90, maxGuesses: 3, excludeNsfl: true }, players: [{ key: 'me', name: '小林', online: true, isHost: true, asked: 0, guesses: 0, pending: false }], puzzle: { id: 'p', title: '谜题', surface: '汤面故事', nsfl: false, tags: [], difficulty: 2, source: { key: 'test', repo: '', url: '', license: 'MIT' }, sourceKey: 'test', hintCount: 0, goodRate: null, tier: 'none', funny: 0, ratings: 0, plays: 0, solves: 0 }, log: [], guesses: [], highlights: [], hints: [], hintCount: 0, sharedUsed: 0, turnKey: null, turnDeadline: null, turnRemainingMs: null, serverNow: 1000, round: 1, reveal: null };
  updateState({ room, joined: true, status: 'connected' });
  render(<Room code="ABC234" name="小林" playerKey="me" onName={() => {}} onLeave={() => {}} />);
  expect(screen.getByText('汤面故事')).toBeTruthy();
  expect(screen.getByText('剩余 8 问')).toBeTruthy();
  expect(screen.getByText('房主控制')).toBeTruthy();
});

