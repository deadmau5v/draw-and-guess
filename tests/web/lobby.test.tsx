// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../../web/src/api';
import { GameProvider } from '../../web/src/theme';
import RoomLobbyModal from '../../web/src/RoomLobbyModal';
import { AppShell, PageContainer } from '../../web/src/PageContainer';

const room = { code: 'ABC234', hostName: '小林', players: 1, maxPlayers: 8, phase: 'lobby' as const };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function renderLobby(onClose = vi.fn(), onJoin = vi.fn()) {
  return render(<GameProvider><AppShell header={<header>统一 Header</header>}>
    <PageContainer><p>原始首页内容</p></PageContainer>
    <RoomLobbyModal onClose={onClose} onJoin={onJoin} />
  </AppShell></GameProvider>);
}
it('初次加载和刷新只显示弹窗内部 spinner，保留背景和页面容器', async () => {
  let resolve!: (value: typeof room[]) => void;
  const rooms = vi.spyOn(api, 'rooms').mockImplementation(() => new Promise(done => { resolve = done; }));
  const { container } = renderLobby();
  const background = container.querySelector('.game-background');
  const main = container.querySelector('main');
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('正在加载房间…')).toBeTruthy();
  expect(screen.queryByRole('status', { name: '场景加载' })).toBeNull();
  await act(async () => resolve([room]));
  expect(within(dialog).getByText('小林 · ABC234')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button', { name: '刷新' }));
  expect(rooms).toHaveBeenCalledTimes(2);
  expect(within(dialog).getByText('正在加载房间…')).toBeTruthy();
  expect(container.querySelector('.game-background')).toBe(background);
  expect(container.querySelector('main')).toBe(main);
  expect(screen.queryByRole('status', { name: '场景加载' })).toBeNull();
  expect(container.querySelector('.game-loading-overlay')).toBeNull();
  expect(within(dialog).getByRole('button', { name: '刷新' }).hasAttribute('disabled')).toBe(true);
  await act(async () => resolve([]));
  expect(within(dialog).getByText('暂无在线房间')).toBeTruthy();
});
it('加载失败在弹窗内重试，成功后按真实房间码加入', async () => {
  const rooms = vi.spyOn(api, 'rooms').mockRejectedValueOnce(Error('网络中断')).mockResolvedValueOnce([room]);
  const join = vi.fn();
  renderLobby(vi.fn(), join);
  expect(await screen.findByText('网络中断')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  fireEvent.click(await screen.findByRole('button', { name: '加入' }));
  expect(join).toHaveBeenCalledWith('ABC234');
  expect(rooms).toHaveBeenCalledTimes(2);
});
it('关闭弹窗卸载会取消房间请求，避免迟到响应回写', () => {
  let signal!: AbortSignal;
  vi.spyOn(api, 'rooms').mockImplementation(next => { signal = next!; return new Promise(() => {}); });
  const { unmount } = renderLobby();
  expect(signal.aborted).toBe(false);
  unmount();
  expect(signal.aborted).toBe(true);
});
