// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { AskBox, ContentWarning, QuestionLog, RatingBar } from '../../web/src/components';
import { GameProvider } from '../../web/src/theme';
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

afterEach(cleanup);
describe('房间交互', () => {
  it('重口汤面必须确认后才展开', () => {
    render(<ContentWarning warning id="p1"><p>隐藏汤面</p></ContentWarning>);
    expect(screen.queryByText('隐藏汤面')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '我已了解，继续' }));
    expect(screen.getByText('隐藏汤面')).toBeTruthy();
  });
  it('Enter 提交问题，Shift+Enter 保留输入，pending 禁用', () => {
    const submit = vi.fn();
    const { rerender } = rtlRender(<AskBox remaining={5} disabled={false} onAsk={submit} />, { wrapper: GameProvider });
    const input = screen.getByLabelText('你的问题');
    fireEvent.change(input, { target: { value: '他认识这个人吗？' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(submit).toHaveBeenCalledWith('他认识这个人吗？');
    rerender(<AskBox remaining={0} disabled onAsk={submit} />);
    expect(screen.getByRole('button', { name: '提问 →' }).hasAttribute('disabled')).toBe(true);
  });
  it('问答与猜测按时间穿插并标记判定颜色', () => {
    const room = { log: [{ id: 'q', at: 2, playerName: '小林', text: '问题', verdict: '是' }], guesses: [{ id: 'g', at: 1, playerName: '阿夏', text: '还原', outcome: '接近真相' }] } as RoomView;
    render(<QuestionLog room={room} />);
    expect(screen.getAllByRole('article')[0].textContent).toContain('还原');
    expect(screen.getByText('是').className).toContain('green');
  });
  it('提交评价和好笑选项', () => {
    const rate = vi.fn();
    render(<RatingBar onRate={rate} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: '好笑' }));
    fireEvent.click(screen.getByRole('button', { name: '好汤' }));
    expect(rate).toHaveBeenLastCalledWith(1, true);
  });
  it('QuestionLog 空状态优雅展示且没有 emoji', () => {
    const room = { log: [], guesses: [] } as unknown as RoomView;
    render(<QuestionLog room={room} />);
    expect(screen.getByText('等待第一位侦探提问')).toBeTruthy();
    expect(screen.getByText(/支持是非提问/)).toBeTruthy();
  });
  it('AskBox 显示进度条与线索', () => {
    render(
      <AskBox
        remaining={5}
        disabled={false}
        hints={['关键在于那杯水']}
        totalHints={3}
        progress={{ score: 45, status: '初见端倪' }}
        onAsk={() => {}}
      />
    );
    expect(screen.getByText('初见端倪')).toBeTruthy();
    expect(screen.getByText('45%')).toBeTruthy();
    expect(screen.getByText('线索 1/3')).toBeTruthy();
    expect(screen.getByText('关键在于那杯水')).toBeTruthy();
  });
});
