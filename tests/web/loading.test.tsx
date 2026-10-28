// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GameProvider } from '../../web/src/theme';
import { beginLoading, useLoading, withLoading } from '../../web/src/loading';
import { api } from '../../web/src/api';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
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
it('初次渲染不强制遮罩，慢操作不替换背景或禁用全页', () => {
  vi.useFakeTimers();
  const { container } = render(<GameProvider><p>故事</p><input aria-label="昵称" /></GameProvider>);
  const backdrop = container.querySelector('.game-background');
  expect(backdrop).toBeTruthy();
  expect(screen.queryByRole('status', { name: '场景加载' })).toBeNull();
  let finish!: () => void;
  act(() => { finish = beginLoading('正在切换场景…'); vi.advanceTimersByTime(200); });
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole('status', { name: '场景加载' })).toBeTruthy();
  expect(container.querySelector('.game-experience')?.hasAttribute('inert')).toBe(false);
  expect(container.querySelector('.game-background')).toBe(backdrop);
  expect(container.querySelector('.game-loading-overlay')).toBeNull();
  act(finish);
  expect(screen.queryByRole('status', { name: '场景加载' })).toBeNull();
  for (const type of ['contextmenu', 'dragstart', 'selectstart']) {
    expect(screen.getByText('故事').dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))).toBe(false);
    expect(screen.getByLabelText('昵称').dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))).toBe(true);
  }
});
it('真实 API 房间刷新和题库查询不注册全局加载任务', async () => {
  let complete!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { complete = resolve; })));
  const { container } = render(<GameProvider><State /></GameProvider>);
  for (const request of [() => api.rooms(), () => api.puzzles()]) {
    let promise!: Promise<unknown>;
    act(() => { promise = request(); });
    expect(screen.getByTestId('loading').textContent).toBe('ready');
    expect(container.querySelector('.game-loading-overlay')).toBeNull();
    expect(screen.queryByRole('status', { name: '场景加载' })).toBeNull();
    await act(async () => { complete({ ok: true, json: async () => [] }); await promise; });
  }
});
