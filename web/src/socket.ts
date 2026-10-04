import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Ack, ClientToServer, RoomView, ServerToClient, Settings } from '@shared/protocol';
import { getSnapshot, notify, updateState } from './store';

export interface JoinIdentity { code: string; name: string; playerKey: string }
export const socket: Socket<ServerToClient, ClientToServer> = io({ autoConnect: false, reconnection: true, reconnectionDelay: 800, reconnectionDelayMax: 5000, randomizationFactor: 0.3 });
let identity: JoinIdentity | null = null;
let joinVersion = 0;

function rejoin(): void {
  if (!identity) return;
  const version = ++joinVersion;
  updateState({ joined: false, status: 'connecting' });
  socket.emit('room:join', identity, result => {
    if (version !== joinVersion || !identity) return;
    if (result.ok) updateState({ room: result.value, status: 'connected', joined: true });
    else { updateState({ room: null, status: 'connected', joined: false }); notify(result.msg); }
  });
}

socket.on('connect', () => { updateState({ status: 'connected' }); rejoin(); });
socket.on('disconnect', () => { ++joinVersion; updateState({ status: 'offline', joined: false }); });
socket.on('connect_error', () => updateState({ status: 'connecting', joined: false }));
socket.on('room:state', room => { if (identity?.code === room.code) updateState({ room }); });
socket.on('game:revealed', reveal => { const room = getSnapshot().room; if (room && identity?.code === room.code) updateState({ room: { ...room, phase: 'revealed', reveal } }); });
socket.on('toast', toast => notify(toast.msg));
socket.on('room:kicked', () => { identity = null; ++joinVersion; updateState({ room: null, joined: false }); socket.disconnect(); notify('你已被房主移出房间'); if (typeof location !== 'undefined') location.hash = '/'; });

export function joinRoom(next: JoinIdentity): void {
  if (identity?.code === next.code && identity.playerKey === next.playerKey && getSnapshot().joined) return;
  if (identity && identity.code !== next.code && socket.connected) socket.emit('room:leave');
  identity = { ...next };
  ++joinVersion;
  updateState({ room: null, joined: false, status: 'connecting' });
  if (socket.connected) rejoin(); else socket.connect();
}

export function leaveRoom(): void {
  identity = null;
  ++joinVersion;
  if (socket.connected) socket.emit('room:leave');
  socket.disconnect();
  updateState({ room: null, joined: false, status: 'offline' });
}

function request<T>(send: (ack: (result: Ack<T>) => void) => void): Promise<T> {
  if (!socket.connected || !getSnapshot().joined) return Promise.reject(new Error('连接尚未恢复，请稍后再试'));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('请求超时，请等待房间状态更新后重试')), 20000);
    send(result => { window.clearTimeout(timer); if (result.ok) resolve(result.value); else reject(new Error(result.msg)); });
  });
}

export const actions = {
  settings: (partial: Partial<Settings>) => request<undefined>(ack => socket.emit('room:settings', partial, ack)),
  kick: (playerKey: string) => request<undefined>(ack => socket.emit('room:kick', { playerKey }, ack)),
  start: (puzzleId?: string) => request<undefined>(ack => socket.emit('game:start', puzzleId ? { puzzleId } : {}, ack)),
  ask: (text: string) => request<{ id: string }>(ack => socket.emit('q:ask', { text }, ack)),
  guess: (text: string) => request<{ id: string }>(ack => socket.emit('guess:submit', { text }, ack)),
  hint: () => request<undefined>(ack => socket.emit('hint:show', ack)),
  reveal: () => request<undefined>(ack => socket.emit('game:reveal', ack)),
  rate: (score: 1 | 0 | -1, funny: boolean) => request<undefined>(ack => socket.emit('rate', { score, funny }, ack)),
};

if (import.meta.hot) import.meta.hot.dispose(() => socket.disconnect());
