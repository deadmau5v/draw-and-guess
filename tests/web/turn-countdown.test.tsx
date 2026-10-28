// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CandyProvider } from 'candy-ui';
import { DEFAULT_SETTINGS } from '../../shared/protocol';
import type { RoomView } from '../../shared/protocol';
import { TurnCountdown } from '../../web/src/TurnCountdown';
const room: Pick<RoomView, 'phase' | 'settings' | 'turnKey' | 'turnDeadline' | 'turnRemainingMs' | 'serverNow'> = { phase: 'playing', settings: { ...DEFAULT_SETTINGS, turnMode: 'turns' }, turnKey: 'a', turnDeadline: 91000, turnRemainingMs: null, serverNow: 1000 };
const view = (state = room, disabled = false) => <CandyProvider><TurnCountdown room={state} disabled={disabled} /></CandyProvider>;
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('倒计时按服务端时间校正设备偏差，秒数更新并在10秒内突出显示', () => {
  vi.useFakeTimers();vi.setSystemTime(1000000);
  render(view());
  const timer = screen.getByRole('timer', { name: '提问倒计时' });
  expect(timer.textContent).toContain('90 秒');
  act(() => vi.advanceTimersByTime(80000));
  expect(timer.textContent).toContain('10 秒');
  expect(timer.classList.contains('candy-badge-red')).toBe(true);
  act(() => vi.advanceTimersByTime(10000));
  expect(timer.textContent).toContain('时间到');
});
it('暂停时冻结余量，新轮重置，断线不显示误导性计时，卸载清理计时器', () => {
  vi.useFakeTimers();vi.setSystemTime(1000000);
  const { rerender, unmount } = render(view());
  act(() => vi.advanceTimersByTime(30000));
  rerender(view({ ...room, serverNow: 31000, turnDeadline: null, turnRemainingMs: 60000 }));
  expect(screen.getByRole('timer').textContent).toContain('判题暂停 · 60 秒');
  act(() => vi.advanceTimersByTime(120000));
  expect(screen.getByRole('timer').textContent).toContain('判题暂停 · 60 秒');
  rerender(view({ ...room, serverNow: 151000, turnDeadline: 241000, turnKey: 'b' }));
  expect(screen.getByRole('timer').textContent).toContain('90 秒');
  rerender(view(room, true));expect(screen.getByRole('timer').textContent).toContain('重连后同步');
  unmount();expect(vi.getTimerCount()).toBe(0);
});
it('自由模式、揭晓和无人有提问额度时不显示倒计时', () => {
  const { rerender } = render(view({ ...room, settings: { ...DEFAULT_SETTINGS, turnMode: 'free' } }));
  expect(screen.queryByRole('timer')).toBeNull();
  rerender(view({ ...room, phase: 'revealed' }));expect(screen.queryByRole('timer')).toBeNull();
  rerender(view({ ...room, turnKey: null, turnDeadline: null }));expect(screen.queryByRole('timer')).toBeNull();
});
