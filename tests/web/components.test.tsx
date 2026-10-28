// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GuessModal, PlayerList, RevealModal } from '../../web/src/components';
import { GameProvider } from '../../web/src/theme';
import { updateState } from '../../web/src/store';
import type { RoomView } from '@shared/protocol';

beforeAll(() => {
  if (!window.matchMedia) Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation(query => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });
  if (!window.ResizeObserver) { class MockResizeObserver { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); } window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver; global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver; }
});
afterEach(() => { cleanup(); updateState({ room: null }); });
const renderWithGame = (ui: React.ReactElement) => render(ui, { wrapper: GameProvider });

describe('简化对局控件', () => {
  it('猜词只提交直接答案，不展示提示、剩余次数或距离反馈', () => {
    const onGuess = vi.fn(); renderWithGame(<GuessModal disabled={false} remaining={8} surface="隐藏的旧故事提示" onClose={() => {}} onGuess={onGuess} />);
    const input = screen.getByRole('textbox', { name: '你的答案' });
    expect(document.body.textContent).not.toMatch(/剩余|问题|提示|接近|还原/);
    expect(document.body.textContent).not.toContain('隐藏的旧故事提示');
    fireEvent.change(input, { target: { value: '苹果' } });
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
    expect(onGuess).toHaveBeenCalledWith('苹果');
  });
  it('玩家列表只呈现轮次和总分，不展示提问数或猜词次数', () => {
    const room = { phase: 'playing', hostKey: 'a', drawerKey: 'a', players: [{ key: 'a', name: '小林', online: true, isHost: true, asked: 5, guesses: 2, roundPoints: 40, totalPoints: 120 }] } as unknown as RoomView;
    renderWithGame(<PlayerList room={room} selfKey="a" disabled={false} onKick={() => {}} />);
    expect(screen.getByText('本轮 40 分 · 总分 120 分')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/提问|猜词次数|互动5/);
  });
  it('答案揭晓显示答案并可关闭', () => {
    const close = vi.fn(); renderWithGame(<RevealModal opened onClose={close} reveal={{ bottom: '苹果', reason: 'solved', hints: [], winnerName: '小林' }} />);
    expect(screen.getByText('苹果')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '返回对局' }));
    expect(close).toHaveBeenCalled();
  });
});
