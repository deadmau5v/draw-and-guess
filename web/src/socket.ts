import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  Ack, ClientToServer, JoinRoomRequest, ServerToClient, Settings,
  HighlightRequest, RemoveHighlightRequest, StrokeInput, CanvasStroke,
  AiCanvasGuess, DrawerSecretView, DeviceInfo,
} from '@shared/protocol';
import { readPlayerAvatar } from './avatars';
import { detectClientDevice } from './device';
import { normalizeText } from './game';
import { withLoading } from './loading';
import { getSnapshot, notify, updateState } from './store';

export type JoinIdentity = JoinRoomRequest;
export const socket: Socket<ServerToClient, ClientToServer> = io({
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 600,
  reconnectionDelayMax: 4000,
  randomizationFactor: 0.25,
});
let identity: JoinIdentity | null = null;
let joinVersion = 0;
let joinTimer: ReturnType<typeof setTimeout> | null = null;
const clearJoinTimer = () => { if (joinTimer) clearTimeout(joinTimer); joinTimer = null; };
const inflightSubmits = new Map<string, Promise<{ id: string }>>();

function rejoin(): void {
  if (!identity) return;
  const version = ++joinVersion;
  clearJoinTimer();
  updateState({ joined: false, status: 'connecting', joinError: null });
  joinTimer = setTimeout(() => {
    if (version !== joinVersion || !identity) return;
    joinTimer = null;
    updateState({ joined: false, joinError: '加入房间超时，请返回首页后重试' });
  }, 15000);
  socket.emit('room:join', identity, result => {
    if (version !== joinVersion || !identity) return;
    clearJoinTimer();
    if (result.ok) updateState({ room: result.value, status: 'connected', joined: true, joinError: null });
    else { updateState({ room: null, status: 'connected', joined: false, joinError: result.msg }); notify(result.msg); }
  });
}

socket.on('connect', () => { updateState({ status: 'connected' }); rejoin(); });
socket.on('disconnect', () => { clearJoinTimer(); ++joinVersion; updateState({ status: 'offline', joined: false, joinError: '连接已断开，正在重连…' }); });
socket.on('connect_error', () => updateState({ status: 'connecting', joined: false, joinError: '连接失败，请检查网络后重试' }));
socket.on('room:state', room => { if (identity?.code === room.code) updateState({ room }); });
socket.on('game:revealed', reveal => { const room = getSnapshot().room; if (room && identity?.code === room.code) updateState({ room: { ...room, phase: 'revealed', reveal } }); });
socket.on('toast', toast => notify(toast.msg));
socket.on('room:kicked', () => { identity = null; ++joinVersion; updateState({ room: null, joined: false }); socket.disconnect(); notify('你已被房主移出房间'); if (typeof location !== 'undefined') location.hash = '/'; });

export function joinRoom(next: JoinIdentity): void {
  const avatar = next.avatar ?? readPlayerAvatar();
  const device = next.device ?? detectClientDevice();
  if (identity?.code === next.code && identity.playerKey === next.playerKey && identity.avatar === avatar && getSnapshot().joined) return;
  if (identity && identity.code !== next.code && socket.connected) socket.emit('room:leave');
  identity = { ...next, avatar, ...(device ? { device } : {}) };
  clearJoinTimer();
  ++joinVersion;
  updateState({ room: null, joined: false, status: 'connecting', joinError: null });
  if (socket.connected) rejoin(); else socket.connect();
}

export function updateDeviceModality(device: DeviceInfo): void {
  if (!identity || !socket.connected) return;
  if (identity.device?.kind === device.kind && identity.device?.label === device.label) return;
  identity = { ...identity, device };
  socket.emit('room:join', identity, result => {
    if (result.ok) updateState({ room: result.value });
  });
}

export function leaveRoom(): void {
  clearJoinTimer();
  identity = null;
  ++joinVersion;
  inflightSubmits.clear();
  if (socket.connected) socket.emit('room:leave');
  socket.disconnect();
  updateState({ room: null, joined: false, status: 'offline', joinError: null });
}

function request<T>(send: (ack: (result: Ack<T>) => void) => void, onTimeoutFallback?: () => T | undefined): Promise<T> {
  if (!socket.connected || !getSnapshot().joined) return Promise.reject(new Error('连接尚未恢复，请稍后再试'));
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const recovered = onTimeoutFallback?.();
      if (recovered !== undefined) {
        resolve(recovered);
        return;
      }
      reject(new Error('请求超时，请等待房间状态更新后重试'));
    }, 20000);
    send(result => { window.clearTimeout(timer); if (result.ok) resolve(result.value); else reject(new Error(result.msg)); });
  });
}

function submitDedup(kind: 'q:ask' | 'guess:submit', text: string): Promise<{ id: string }> {
  const norm = normalizeText(text);
  const key = `${kind}:${norm}`;
  const existing = inflightSubmits.get(key);
  if (existing) return existing;
  const task = request<{ id: string }>(
    ack => socket.emit(kind, { text }, ack),
    () => {
      const room = getSnapshot().room;
      const selfKey = identity?.playerKey;
      if (!room || !selfKey) return undefined;
      if (kind === 'q:ask') {
        const matched = [...room.log].reverse().find(item => item.playerKey === selfKey && normalizeText(item.text) === norm);
        return matched ? { id: matched.id } : undefined;
      }
      const matched = [...room.guesses].reverse().find(item => item.playerKey === selfKey && normalizeText(item.text) === norm);
      return matched ? { id: matched.id } : undefined;
    },
  ).finally(() => {
    inflightSubmits.delete(key);
  });
  inflightSubmits.set(key, task);
  return task;
}

export const actions = {
  settings: (partial: Partial<Settings>) => request<undefined>(ack => socket.emit('room:settings', partial, ack)),
  kick: (playerKey: string) => request<undefined>(ack => socket.emit('room:kick', { playerKey }, ack)),
  start: (puzzleId?: string) => withLoading('正在准备题目…', () => request<undefined>(ack => socket.emit('game:start', puzzleId ? { puzzleId } : {}, ack))),
  ask: (text: string) => submitDedup('q:ask', text),
  guess: (text: string) => submitDedup('guess:submit', text),
  hint: () => request<undefined>(ack => socket.emit('hint:show', ack)),
  highlight: (range: HighlightRequest) => request<undefined>(ack => socket.emit('surface:highlight', range, ack)),
  removeHighlight: (highlight: RemoveHighlightRequest) => request<undefined>(ack => socket.emit('surface:unhighlight', highlight, ack)),
  stroke: (input: StrokeInput) => request<CanvasStroke>(ack => socket.emit('canvas:stroke', input, ack)),
  undoStroke: (round?: number) => request<undefined>(ack => socket.emit('canvas:undo', round ? { round } : {}, ack)),
  clearCanvas: (round?: number) => request<undefined>(ack => socket.emit('canvas:clear', round ? { round } : {}, ack)),
  nextFrame: (round?: number) => request<undefined>(ack => socket.emit('canvas:next-frame', round ? { round } : {}, ack)),
  aiGuess: (snapshotDataUrl?: string) => request<AiCanvasGuess>(ack => socket.emit('canvas:ai-guess', snapshotDataUrl ? { snapshotDataUrl } : {}, ack)),
  drawerWord: () => request<DrawerSecretView>(ack => socket.emit('drawer:word', ack)),
  bluff: (text: string) => request<undefined>(ack => socket.emit('party:bluff', { text }, ack)),
  vote: (targetId: string) => request<undefined>(ack => socket.emit('party:vote', { targetId }, ack)),
  reveal: () => request<undefined>(ack => socket.emit('game:reveal', ack)),
  rate: (score: 1 | 0 | -1, funny: boolean) => request<undefined>(ack => socket.emit('rate', { score, funny }, ack)),
};

if (import.meta.hot) import.meta.hot.dispose(() => socket.disconnect());
