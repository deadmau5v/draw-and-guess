// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CandyProvider } from 'candy-ui';
import { DEFAULT_SETTINGS } from '../../shared/protocol';
import type { RoomView } from '../../shared/protocol';
const fake = vi.hoisted(() => ({ ask: vi.fn() }));
vi.mock('../../web/src/socket', () => ({ actions: fake }));
import { PlayingRoom } from '../../web/src/PlayingRoom';

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const room: RoomView = { code: 'ABC234', phase: 'playing', hostKey: 'me', settings: DEFAULT_SETTINGS, players: [{ key: 'me', name: '我', online: true, isHost: true, asked: 0, guesses: 0, pending: false }], puzzle: null, log: [], guesses: [], hints: [], hintCount: 0, sharedUsed: 0, turnKey: null, round: 1, reveal: null };
const view = (state = room) => <CandyProvider><PlayingRoom room={state} selfKey="me" disabled={false} onLeave={() => {}} onInvite={async () => {}} onGuess={() => {}} onReveal={() => {}} /></CandyProvider>;
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
