// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CandyProvider } from 'candy-ui';
import { DEFAULT_SETTINGS } from '../../shared/protocol';
import type { PuzzleSummary, RoomView } from '../../shared/protocol';
const fake = vi.hoisted(() => ({ puzzles: vi.fn() }));
vi.mock('../../web/src/api', () => ({ api: fake }));
HTMLElement.prototype.scrollIntoView = vi.fn();
import { WaitingRoom } from '../../web/src/WaitingRoom';
const room: RoomView = { code: 'ABC234', phase: 'lobby', hostKey: 'a', settings: { ...DEFAULT_SETTINGS }, players: [], puzzle: null, log: [], guesses: [], highlights: [], hints: [], hintCount: 0, sharedUsed: 0, turnKey: null, turnDeadline: null, turnRemainingMs: null, serverNow: 1000, round: 0, reveal: null };
const item = (id: string, tags: string[], difficulty: number): PuzzleSummary => ({ id, title: id, tags, difficulty, surfacePreview: '', nsfl: false, hintCount: 0, goodRate: null, tier: 'none', funny: 0, ratings: 0, plays: 0, solves: 0, sourceKey: 'test' });
const settings = vi.fn().mockResolvedValue(undefined), start = vi.fn().mockResolvedValue(undefined);
const view = (selfKey = 'a', state = room) => render(<CandyProvider><WaitingRoom room={state} selfKey={selfKey} disabled={false} onLeave={() => {}} onInvite={async () => {}} onSettings={settings} onStart={start} onKick={() => {}} /></CandyProvider>);
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('房主只可选词组分类和难度，开始时锁定经典模式', async () => {
  fake.puzzles.mockResolvedValue([item('apple', ['水果'], 1), item('cat', ['动物'], 3)]);
  view('a', { ...room, settings: { ...room.settings, partyMode: 'drawful' } });
  await waitFor(() => expect(screen.getByRole('button', { name: '开始游戏' }).hasAttribute('disabled')).toBe(false));
  expect(screen.getAllByRole('combobox')).toHaveLength(2);
  expect(document.body.textContent).not.toMatch(/提问|额度|共绘|派对模式|猜词机会|重口|秒数/);
  fireEvent.click(screen.getByRole('combobox', { name: '词语分类' })); fireEvent.click(screen.getByRole('option', { name: '水果植物' }));
  fireEvent.click(screen.getByRole('combobox', { name: '词语难度' })); fireEvent.click(screen.getByRole('option', { name: '简单' }));
  fireEvent.click(screen.getByRole('button', { name: '开始游戏' }));
  await waitFor(() => expect(start).toHaveBeenCalledWith('apple'));
  expect(settings).toHaveBeenCalledWith({ partyMode: 'classic' });
});
it('非房主只看玩家与邀请并等待开始', () => {
  view('b'); expect(screen.queryByRole('combobox')).toBeNull();
  expect(screen.getByRole('button', { name: '等待房主开局' }).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button', { name: '邀请好友' })).toBeTruthy();
});
it('无匹配词组时不偷偷随机其他分类', async () => {
  fake.puzzles.mockResolvedValue([]); view(); await screen.findByText('这个分类或难度暂无词组，请换一个。');
  expect(screen.getByRole('button', { name: '开始游戏' }).hasAttribute('disabled')).toBe(true);
});
