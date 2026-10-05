// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GameProvider } from '../../web/src/theme';
import { beginLoading, useLoading, withLoading } from '../../web/src/loading';

afterEach(() => { cleanup(); vi.useRealTimers(); });
function State() { const state = useLoading(); return <p data-testid="loading">{state.active ? state.label : 'ready'}</p>; }
it('重叠加载只有全部结束后才关闭，重复结束安全', () => {
  render(<State />);
  let first!: () => void, second!: () => void;
  act(() => { first = beginLoading('题库'); second = beginLoading('房间'); });
  expect(screen.getByTestId('loading').textContent).toBe('房间');
  act(() => { second(); second(); });
  expect(screen.getByTestId('loading').textContent).toBe('题库');
  act(first);
  expect(screen.getByTestId('loading').textContent).toBe('ready');
});
it('请求失败也释放加载状态', async () => {
  render(<State />);
  await act(async () => { await expect(withLoading('加载', async () => { throw Error('失败'); })).rejects.toThrow('失败'); });
  expect(screen.getByTestId('loading').textContent).toBe('ready');
});
it('遮罩阻挡内容并在加载结束后移除，编辑区仍能使用浏览器编辑操作', () => {
  vi.useFakeTimers();
  const { container } = render(<GameProvider><p>故事</p><input aria-label="昵称" /></GameProvider>);
  expect(screen.getByRole('status', { name: '场景加载' })).toBeTruthy();
  expect(container.querySelector('.game-experience')?.hasAttribute('inert')).toBe(true);
  act(() => vi.advanceTimersByTime(250));
  act(() => vi.advanceTimersByTime(350));
  act(() => vi.advanceTimersByTime(220));
  expect(screen.queryByRole('status', { name: '场景加载' })).toBeNull();
  expect(container.querySelector('.game-experience')?.hasAttribute('inert')).toBe(false);
  for (const type of ['contextmenu', 'dragstart', 'selectstart']) {
    expect(screen.getByText('故事').dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))).toBe(false);
    expect(screen.getByLabelText('昵称').dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))).toBe(true);
  }
});
