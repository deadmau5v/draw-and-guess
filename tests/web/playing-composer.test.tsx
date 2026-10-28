// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CandyProvider } from 'candy-ui';
import { DEFAULT_SETTINGS } from '../../shared/protocol';
import type { RoomView } from '../../shared/protocol';
const fake = vi.hoisted(() => ({ ask: vi.fn().mockReturnValue(Promise.resolve({ id: 'q-1' })), hint: vi.fn(), highlight: vi.fn().mockResolvedValue(undefined), removeHighlight: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../web/src/socket', () => ({ actions: fake }));
import { PlayingRoom } from '../../web/src/PlayingRoom';

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const room: RoomView = { code: 'ABC234', phase: 'playing', hostKey: 'me', settings: DEFAULT_SETTINGS, players: [{ key: 'me', name: '我', online: true, isHost: true, asked: 0, guesses: 0, pending: false }], puzzle: null, log: [], guesses: [], highlights: [], hints: [], hintCount: 0, sharedUsed: 0, turnKey: null, turnDeadline: null, turnRemainingMs: null, serverNow: 1000, round: 1, reveal: null };
const view = (state = room) => <CandyProvider><PlayingRoom room={state} selfKey="me" disabled={false} onLeave={() => {}} onInvite={async () => {}} onGuess={() => {}} onReveal={() => {}} /></CandyProvider>;
it('对局汤面接入共享标记，输入区显示提问倒计时', () => {
  const state: RoomView = { ...room, settings: { ...room.settings, turnMode: 'turns' }, turnKey: 'me', turnDeadline: 91000, highlights: [{ id: 'h-1', start: 0, end: 2, playerKey: 'me', playerName: '我' }], puzzle: { id: 'p', title: '题', surface: '一位侦探', difficulty: 1, tags: [], nsfl: false, hintCount: 0, goodRate: null, tier: 'none', funny: 0, ratings: 0, plays: 0, solves: 0, sourceKey: 'test', source: { key: 'test', repo: '', url: '', license: 'MIT' } } };
  const { container } = render(view(state));
  expect(container.querySelector('.shared-story-surface mark')?.textContent).toBe('一位');
  const timer = screen.getByRole('timer', { name: '提问倒计时' });
  expect(timer.textContent).toContain('90 秒');
  expect(container.querySelector('.playing-composer')?.contains(timer)).toBe(true);
});
it('问答记录显示接近程度和实际加分，输入区显示永久积分', () => {
  render(view({ ...room, players: room.players.map(p => ({ ...p, roundPoints: 8, totalPoints: 28 })), log: [{ id: 'q-score', playerKey: 'me', playerName: '我', text: '是为了治好打嗝吗？', at: 1000, verdict: '是', proximity: 75, points: 8 }] }));
  expect(screen.getByRole('log').textContent).toContain('接近程度 75%');
  expect(screen.getByRole('log').textContent).toContain('+8 积分');
  expect(screen.getByText('永久积分 28')).toBeTruthy();
  expect(screen.getByText(/本题 8分 · 永久 28分/)).toBeTruthy();
});
it('等待其他玩家时输入框不被遮挡且可先打字存草稿，按钮提示等待且轮到自己后可直接发送', () => {
  const turns = { ...room, settings: { ...room.settings, turnMode: 'turns' as const }, turnKey: 'me', players: [...room.players, { ...room.players[0], key: 'other', name: '小林', isHost: false }] };
  const { rerender, container } = render(view({ ...turns, turnKey: 'other' }));
  const input = screen.getByLabelText('你的问题') as HTMLTextAreaElement;
  expect(input.disabled).toBe(false);
  expect(input.placeholder).toContain('轮到 小林 提问');
  expect(container.textContent).toContain('等待 小林 提问（可先输入草稿）');
  const button = screen.getByRole('button', { name: '提问 →' });
  expect(button.textContent).toContain('等待 小林');
  expect(button.hasAttribute('disabled')).toBe(true);

  // 玩家在等待他人时自由打字存草稿
  fireEvent.change(input, { target: { value: '我的预存问题' } });
  expect(input.value).toBe('我的预存问题');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(fake.ask).not.toHaveBeenCalled();

  // 轮到自己提问
  rerender(view(turns));
  expect(input.disabled).toBe(false);
  expect(input.value).toBe('我的预存问题');
  expect(button.textContent).toBe('提问');
  expect(button.hasAttribute('disabled')).toBe(false);
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(fake.ask).toHaveBeenCalledWith('我的预存问题');
});
it('点击发送后焦点返回输入框，判定期间可写下一问但不能重复发送', async () => {
  let resolve!: () => void;
  fake.ask.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  const { rerender } = render(view());
  const input = screen.getByLabelText('你的问题') as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: '第一问' } });
  const send = screen.getByRole('button', { name: '提问 →' });
  send.focus(); fireEvent.click(send);
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe('');
  rerender(view({ ...room, players: [{ ...room.players[0], pending: true, asked: 1 }] }));
  expect(input.disabled).toBe(false);
  fireEvent.change(input, { target: { value: '第二问草稿' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(fake.ask).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); });
  rerender(view({ ...room, players: [{ ...room.players[0], asked: 1, pending: false }] }));
  expect(input.value).toBe('第二问草稿');
  expect(send.hasAttribute('disabled')).toBe(false);
});
it('判定失败不覆盖已经写好的下一问，中文输入法回车不发送', async () => {
  let reject!: (error: Error) => void;
  fake.ask.mockReturnValue(new Promise<void>((_, fail) => { reject = fail; }));
  render(view());
  const input = screen.getByLabelText('你的问题') as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: '中文第一问' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(fake.ask).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(document.activeElement).toBe(input);
  fireEvent.change(input, { target: { value: '保留新草稿' } });
  await act(async () => { reject(Error('判定失败')); });
  expect(input.value).toBe('保留新草稿');
});
it('本局操作统一按钮尺寸，推理期间下一题禁用', () => {
  render(view({ ...room, hintCount: 3 }));
  const group = screen.getByRole('group', { name: '本局操作' });
  const hint = screen.getByRole('button', { name: '公开提示 (3)' });
  const guess = screen.getByRole('button', { name: '提交真相' });
  const next = screen.getByRole('button', { name: '下一题' });
  expect(group.contains(hint) && group.contains(guess) && group.contains(next)).toBe(true);
  for (const button of [hint, guess, next]) {
    expect(button.classList.contains('candy-btn-sm')).toBe(true);
  }
  expect(next.classList.contains('playing-next-action')).toBe(true);
  expect(next.hasAttribute('disabled')).toBe(true);
});
it('非房主不显示下一题，也可开启全员共享提示', () => {
  render(view({ ...room, hostKey: 'other', hintCount: 3 }));
  expect(screen.queryByRole('button', { name: '下一题' })).toBeNull();
  expect(screen.getByRole('button', { name: '公开提示 (3)' }).hasAttribute('disabled')).toBe(false);
  expect(screen.getByRole('button', { name: '提交真相' }).hasAttribute('disabled')).toBe(false);
});
it('其他玩家开启提示后自动切换提示标签并弹窗，同一通知不会重复出现', () => {
  const { rerender } = render(view({ ...room, hintCount: 2 }));
  fireEvent.click(screen.getByRole('button', { name: /已排除/ }));
  const opened: RoomView = { ...room, hintCount: 2, hints: ['公开线索'], hintAnnouncement: { id: 'hint-1', round: 1, index: 1, playerKey: 'other', playerName: '小林' } };
  rerender(view(opened));
  expect(screen.getByRole('button', { name: '提示 (1)' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('dialog').textContent).toContain('小林 开启了提示');
  expect(screen.getByRole('dialog').textContent).toContain('公开线索');
  fireEvent.click(screen.getByRole('button', { name: '知道了' }));
  rerender(view({ ...opened, progress: { score: 25, status: '初见端倪' } }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
it.each(['使用提示', '公开提示 (3)'])('%s 成功后切换到提示标签', async (name) => {
  let resolve!: () => void;
  fake.hint.mockReturnValue(new Promise<void>(done => { resolve = done; }));
  const { rerender } = render(view({ ...room, hintCount: 3 }));
  fireEvent.click(screen.getByRole('button', { name: /已排除/ }));
  fireEvent.click(screen.getByRole('button', { name }));
  expect(fake.hint).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: /已排除/ }).getAttribute('aria-pressed')).toBe('true');
  await act(async () => { resolve(); });
  rerender(view({ ...room, hintCount: 3, hints: ['新公开的线索'] }));
  expect(screen.getByRole('button', { name: '提示 (1)' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('新公开的线索')).toBeTruthy();
});
it('使用提示失败时保留当前标签', async () => {
  fake.hint.mockRejectedValue(Error('提示失败'));
  render(view({ ...room, hintCount: 3 }));
  fireEvent.click(screen.getByRole('button', { name: /已排除/ }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '使用提示' })); });
  expect(screen.getByRole('button', { name: /已排除/ }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: '提示 (0)' }).getAttribute('aria-pressed')).toBe('false');
});
it('仅自己的提问显示复制按钮，汤面展示大方向标签', async () => {
  render(view({
    ...room,
    puzzle: {
      id: 'p-supernatural', title: '列车怪谈', surface: '车厢里的人', difficulty: 3,
      tags: ['超自然', '诡异'], nsfl: false, hintCount: 3, goodRate: null, tier: 'none',
      funny: 0, ratings: 0, plays: 0, solves: 0, sourceKey: 'test',
      source: { key: 'test', repo: '', url: '', license: 'MIT' }
    },
    log: [
      { id: 'q-mine', playerKey: 'me', playerName: '我', text: '我的问题？', at: 1000, verdict: '是' },
      { id: 'q-other', playerKey: 'other', playerName: '小林', text: '别人的问题？', at: 1001, verdict: '不是' }
    ]
  }));
  expect(screen.getByText('超自然')).toBeTruthy();
  const copyButtons = screen.getAllByRole('button', { name: '复制问题' });
  expect(copyButtons).toHaveLength(1);
});
it('拦截本局重复提问与连点重发，不重复调用 actions.ask', async () => {
  const stateWithLog: RoomView = {
    ...room,
    log: [{ id: 'q-1', playerKey: 'other', playerName: '小林', text: '他死了吗？', at: 1000, verdict: '是' }],
  };
  render(view(stateWithLog));
  const input = screen.getByLabelText('你的问题') as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: '他死了吗' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(fake.ask).not.toHaveBeenCalled();
  expect(input.value).toBe('他死了吗');

  let resolveAsk!: (val: { id: string }) => void;
  fake.ask.mockImplementationOnce(() => new Promise(r => { resolveAsk = r; }));
  fireEvent.change(input, { target: { value: '全新问题' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(fake.ask).toHaveBeenCalledTimes(1);
  await act(async () => { resolveAsk({ id: 'q-2' }); });
});
