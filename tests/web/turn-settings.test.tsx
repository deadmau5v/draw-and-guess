// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CandyProvider } from 'candy-ui';
import { DEFAULT_SETTINGS } from '../../shared/protocol';
import type { RoomView } from '../../shared/protocol';
vi.mock('../../web/src/api', () => ({ api: { puzzles: vi.fn().mockResolvedValue([]) } }));
import { WaitingRoom } from '../../web/src/WaitingRoom';
const room: RoomView = { code: 'ABC234', phase: 'lobby', hostKey: 'a', settings: { ...DEFAULT_SETTINGS, turnMode: 'turns' }, players: [], puzzle: null, log: [], guesses: [], highlights: [], hints: [], hintCount: 0, sharedUsed: 0, turnKey: null, turnDeadline: null, turnRemainingMs: null, serverNow: 1000, round: 0, reveal: null };
const settings = vi.fn().mockResolvedValue(undefined);
const view = (state = room, selfKey = 'a') => <CandyProvider><WaitingRoom room={state} selfKey={selfKey} disabled={false} onLeave={() => {}} onInvite={async () => {}} onSettings={settings} onStart={async () => {}} onKick={() => {}} /></CandyProvider>;
afterEach(() => { cleanup(); vi.clearAllMocks(); settings.mockResolvedValue(undefined); });
it('轮流模式提供默认90秒的可设置输入，合法值保存，越界及失败恢复', async () => {
  await act(async () => render(view()));
  const input = screen.getByLabelText('每轮秒数') as HTMLInputElement;
  expect(input.value).toBe('90');
  await act(async () => { fireEvent.change(input, { target: { value: '120' } });fireEvent.blur(input); });
  expect(settings).toHaveBeenLastCalledWith({ turnSeconds: 120 });
  settings.mockClear();
  await act(async () => { fireEvent.change(input, { target: { value: '14' } });fireEvent.blur(input); });
  expect(settings).not.toHaveBeenCalled();expect(input.value).toBe('90');
  settings.mockRejectedValueOnce(Error('失败'));
  await act(async () => { fireEvent.change(input, { target: { value: '60' } });fireEvent.blur(input); });
  expect(input.value).toBe('90');
});
it('非房主只能查看每轮秒数，自由模式隐藏计时设置', async () => {
  const { rerender } = render(view(room, 'b'));
  expect((screen.getByLabelText('每轮秒数') as HTMLInputElement).disabled).toBe(true);
  await act(async () => rerender(view({ ...room, settings: { ...room.settings, turnMode: 'free' } })));
  expect(screen.queryByLabelText('每轮秒数')).toBeNull();
});
