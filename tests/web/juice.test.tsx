// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandyProvider } from 'candy-ui';
import { DEFAULT_SETTINGS } from '../../shared/protocol';
import type { RoomView } from '../../shared/protocol';
import { playJuiceSound, randomPitch, subscribeFloatingText, triggerHaptic, triggerVerdictJuice } from '../../web/src/juice';

const fake = vi.hoisted(() => ({
  guess: vi.fn().mockResolvedValue({ id: 'g-1' }),
  drawerWord: vi.fn().mockResolvedValue({ word: '西瓜', category: '食物', hints: [] }),
}));
vi.mock('../../web/src/socket', () => ({ actions: fake }));
import { PlayingRoom } from '../../web/src/PlayingRoom';
import { TurnCountdown } from '../../web/src/TurnCountdown';

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });
const baseRoom: RoomView = {
  code: 'ABC234', phase: 'playing', hostKey: 'me', drawerKey: 'other', settings: DEFAULT_SETTINGS,
  players: [{ key: 'me', name: '我', online: true, isHost: true, asked: 0, guesses: 0, pending: false }],
  puzzle: null, log: [], guesses: [], highlights: [], hints: [], hintCount: 0, sharedUsed: 0,
  turnKey: null, turnDeadline: null, turnRemainingMs: null, serverNow: 1000, round: 1, reveal: null,
};
const renderRoom = (state = baseRoom) => <CandyProvider><PlayingRoom room={state} selfKey="me" disabled={false} onLeave={() => {}} onInvite={async () => {}} /></CandyProvider>;

describe('交互反馈与键盘可访问性', () => {
  it('randomPitch 在微幅区间内浮动，音效与触觉反馈安全降级', () => {
    for (let i = 0; i < 20; i++) {
      expect(randomPitch(0.06)).toBeGreaterThanOrEqual(0.94);
      expect(randomPitch(0.06)).toBeLessThanOrEqual(1.06);
    }
    expect(() => playJuiceSound('pressDown')).not.toThrow();
    expect(() => playJuiceSound('verdictYes')).not.toThrow();
    expect(() => triggerHaptic([10, 20])).not.toThrow();
  });

  it('反馈工具发送对应颜色事件，取消订阅后不再接收', () => {
    const received: Array<{ text: string; color?: string }> = [];
    const unsubscribe = subscribeFloatingText(detail => received.push(detail));
    triggerVerdictJuice('是', 6);
    triggerVerdictJuice('不是');
    triggerVerdictJuice('接近真相');
    expect(received).toEqual([
      { text: '是！+6 积分', color: 'green' },
      { text: '✗ 已排除可能', color: 'red' },
      { text: '🔥 非常接近真相！', color: 'purple' },
    ]);
    unsubscribe();
    triggerVerdictJuice('不是');
    expect(received).toHaveLength(3);
  });

  it('按 / 聚焦猜词框，按 Escape 移出焦点，不渲染额外快问和吉祥物按钮', () => {
    const { container } = render(renderRoom());
    const input = screen.getByLabelText('猜词答案');
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.activeElement).not.toBe(input);
    expect(screen.queryByRole('group', { name: '快捷提问灵感' })).toBeNull();
    expect(container.querySelector('.mascot-fidget-trigger')).toBeNull();
  });

  it('输入时 / 不劫持焦点，画手不能通过快捷键激活猜词框', async () => {
    const { rerender } = render(renderRoom());
    const input = screen.getByLabelText('猜词答案');
    input.focus();
    const slash = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    fireEvent(input, slash);
    expect(slash.defaultPrevented).toBe(false);
    input.blur();
    await act(async () => { rerender(renderRoom({ ...baseRoom, drawerKey: 'me' })); });
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).not.toBe(input);
  });

  it('独立倒计时组件保留紧急状态与临界状态覆盖', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const timerRoom = {
      phase: 'playing' as const, settings: { ...DEFAULT_SETTINGS, turnMode: 'turns' as const },
      turnKey: 'me', turnDeadline: 9000, turnRemainingMs: null, serverNow: 1000,
    };
    const { rerender, unmount } = render(<CandyProvider><TurnCountdown room={timerRoom} disabled={false} /></CandyProvider>);
    const timerBadge = screen.getByRole('timer', { name: '提问倒计时' });
    expect(timerBadge.className).toContain('countdown-urgent');
    act(() => { rerender(<CandyProvider><TurnCountdown room={{ ...timerRoom, turnDeadline: 3500 }} disabled={false} /></CandyProvider>); });
    expect(timerBadge.className).toContain('countdown-critical');
    unmount();
  });
});
