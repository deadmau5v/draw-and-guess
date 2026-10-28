// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CandyProvider } from 'candy-ui';
import { DEFAULT_SETTINGS } from '../../shared/protocol';
import type { RoomView } from '../../shared/protocol';
import {
  DETECTIVE_QUIPS,
  QUICK_QUESTION_TEMPLATES,
  emitFloatingText,
  playJuiceSound,
  randomPitch,
  subscribeFloatingText,
  triggerHaptic,
  triggerVerdictJuice,
} from '../../web/src/juice';

const fake = vi.hoisted(() => ({
  ask: vi.fn().mockResolvedValue({ id: 'q-1' }),
  hint: vi.fn().mockResolvedValue(undefined),
  highlight: vi.fn().mockResolvedValue(undefined),
  removeHighlight: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../web/src/socket', () => ({ actions: fake }));
import { PlayingRoom } from '../../web/src/PlayingRoom';
import { TurnCountdown } from '../../web/src/TurnCountdown';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseRoom: RoomView = {
  code: 'ABC234',
  phase: 'playing',
  hostKey: 'me',
  settings: DEFAULT_SETTINGS,
  players: [{ key: 'me', name: '我', online: true, isHost: true, asked: 0, guesses: 0, pending: false }],
  puzzle: {
    id: 'p-1',
    title: '深海来信',
    surface: '一名男子在海边收到了一封信。',
    difficulty: 3,
    tags: ['悬疑'],
    nsfl: false,
    hintCount: 2,
    goodRate: null,
    tier: 'none',
    funny: 0,
    ratings: 0,
    plays: 0,
    solves: 0,
    sourceKey: 'test',
    source: { key: 'test', repo: '', url: '', license: 'MIT' },
  },
  log: [],
  guesses: [],
  highlights: [],
  hints: [],
  hintCount: 2,
  sharedUsed: 0,
  turnKey: null,
  turnDeadline: null,
  turnRemainingMs: null,
  serverNow: 1000,
  round: 1,
  reveal: null,
};

const renderRoom = (state = baseRoom) => (
  <CandyProvider>
    <PlayingRoom
      room={state}
      selfKey="me"
      disabled={false}
      onLeave={() => {}}
      onInvite={async () => {}}
      onGuess={() => {}}
      onReveal={() => {}}
    />
  </CandyProvider>
);

describe('Game Feel & Juicy UI 交互体验', () => {
  it('randomPitch 在设定微幅区间内浮动，音效与触觉反馈安全降级', () => {
    for (let i = 0; i < 20; i++) {
      const pitch = randomPitch(0.06);
      expect(pitch).toBeGreaterThanOrEqual(0.94);
      expect(pitch).toBeLessThanOrEqual(1.06);
    }
    expect(() => playJuiceSound('pressDown')).not.toThrow();
    expect(() => playJuiceSound('verdictYes')).not.toThrow();
    expect(() => triggerHaptic([10, 20])).not.toThrow();
  });

  it('判定结果到达时触发对应颜色的浮动飘字反馈', () => {
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
  });

  it('对局支持按 / 快捷聚焦提问框，按 Escape 移出焦点，且支持点击灵感快问填入', () => {
    render(renderRoom());
    const input = screen.getByLabelText('你的问题') as HTMLTextAreaElement;
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.activeElement).not.toBe(input);

    const firstTemplate = QUICK_QUESTION_TEMPLATES[0];
    const quickBtn = screen.getByRole('button', { name: firstTemplate.label });
    fireEvent.click(quickBtn);
    expect(input.value).toBe(firstTemplate.text);
    expect(document.activeElement).toBe(input);
  });

  it('海龟侦探吉祥物支持 Fidget 点击解压互动、展示灵感计数与侦探台词', () => {
    const floating: string[] = [];
    const unsubscribe = subscribeFloatingText(item => floating.push(item.text));
    render(renderRoom());

    const mascot = screen.getByAltText('海龟侦探');
    fireEvent.click(mascot);

    expect(screen.getByText('灵感 ×1')).toBeTruthy();
    expect(screen.getByText(DETECTIVE_QUIPS[0])).toBeTruthy();
    expect(floating).toContain('🐢 +1 推理灵感');
    unsubscribe();
  });

  it('倒计时进入最后 10 秒与 3 秒时切换紧急脉冲样式', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const { rerender, unmount } = render(
      <CandyProvider>
        <TurnCountdown
          room={{
            phase: 'playing',
            settings: { ...DEFAULT_SETTINGS, turnMode: 'turns' },
            turnKey: 'me',
            turnDeadline: 9000,
            turnRemainingMs: null,
            serverNow: 1000,
          }}
          disabled={false}
        />
      </CandyProvider>,
    );

    const timerBadge = screen.getByRole('timer', { name: '提问倒计时' });
    expect(timerBadge.className).toContain('countdown-urgent');

    act(() => {
      rerender(
        <CandyProvider>
          <TurnCountdown
            room={{
              phase: 'playing',
              settings: { ...DEFAULT_SETTINGS, turnMode: 'turns' },
              turnKey: 'me',
              turnDeadline: 3500,
              turnRemainingMs: null,
              serverNow: 1000,
            }}
            disabled={false}
          />
        </CandyProvider>,
      );
    });
    expect(timerBadge.className).toContain('countdown-critical');

    unmount();
    vi.useRealTimers();
  });
});
