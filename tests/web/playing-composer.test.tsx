// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CandyProvider } from 'candy-ui';
import { DEFAULT_SETTINGS } from '../../shared/protocol';
import type { CanvasStroke, RoomView, StrokeInput } from '../../shared/protocol';
const fake = vi.hoisted(() => ({
  guess: vi.fn(), ask: vi.fn(), hint: vi.fn(), drawerWord: vi.fn(), stroke: vi.fn(),
  clearCanvas: vi.fn(), undoStroke: vi.fn(), start: vi.fn(), kick: vi.fn(),
}));
vi.mock('../../web/src/socket', () => ({ actions: fake, updateDeviceModality: vi.fn() }));
import { PlayingRoom } from '../../web/src/PlayingRoom';
import { DrawingCanvas } from '../../web/src/DrawingCanvas';

beforeEach(() => {
  fake.guess.mockResolvedValue({ id: 'g-1' });
  fake.drawerWord.mockResolvedValue({ word: '西瓜', category: '食物', hints: ['绝不能显示的提示'], roleHint: '绝不能显示的角色描述' });
  fake.stroke.mockResolvedValue(undefined);
  fake.clearCanvas.mockResolvedValue(undefined);
  fake.undoStroke.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const room: RoomView = {
  code: 'ABC234', phase: 'playing', hostKey: 'me', drawerKey: 'other', settings: DEFAULT_SETTINGS,
  players: [
    { key: 'me', name: '我', online: true, isHost: true, asked: 0, guesses: 0, pending: false, device: { kind: 'desktop', os: 'macOS', browser: 'Chrome', label: 'macOS · Chrome' } },
    { key: 'other', name: '小林', online: true, isHost: false, asked: 0, guesses: 0, pending: false },
  ],
  puzzle: null, log: [], guesses: [], highlights: [], hints: [], hintCount: 0, sharedUsed: 0,
  turnKey: null, turnDeadline: null, turnRemainingMs: null, serverNow: 1000, round: 1, reveal: null,
};
const view = (state = room, disabled = false, onNext = vi.fn()) => <CandyProvider><PlayingRoom room={state} selfKey="me" disabled={disabled} onLeave={() => {}} onInvite={async () => {}} onNext={onNext} /></CandyProvider>;
const input = () => screen.getByLabelText('猜词答案') as HTMLTextAreaElement;

it('Enter 直接发送猜词，不使用旧提问接口，成功后清空并保留焦点', async () => {
  render(view());
  fireEvent.change(input(), { target: { value: '  西瓜  ' } });
  await act(async () => { fireEvent.keyDown(input(), { key: 'Enter' }); });
  expect(fake.guess).toHaveBeenCalledWith('西瓜', 1);
  expect(fake.ask).not.toHaveBeenCalled();
  expect(input().value).toBe('');
  expect(document.activeElement).toBe(input());
});

it('发送期间可写草稿，阻止重复提交；成功回执不覆盖新草稿', async () => {
  let resolve!: () => void;
  fake.guess.mockReturnValueOnce(new Promise<void>(done => { resolve = done; }));
  const { rerender } = render(view());
  fireEvent.change(input(), { target: { value: '苹果' } });
  fireEvent.click(screen.getByRole('button', { name: '发送猜词' }));
  expect(document.activeElement).toBe(input());
  expect(input().value).toBe('苹果');
  fireEvent.change(input(), { target: { value: '西瓜' } });
  fireEvent.keyDown(input(), { key: 'Enter' });
  expect(fake.guess).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); });
  expect(input().value).toBe('西瓜');
  rerender(view({ ...room, players: room.players.map(player => ({ ...player, pending: player.key === 'me' })) }));
  fireEvent.keyDown(input(), { key: 'Enter' });
  expect(fake.guess).toHaveBeenCalledTimes(1);
  expect(input().disabled).toBe(false);
});

it('发送失败保留原始文本并显示错误，可以重试', async () => {
  fake.guess.mockRejectedValueOnce(Error('网络已断开'));
  render(view());
  fireEvent.change(input(), { target: { value: '西瓜' } });
  await act(async () => { fireEvent.keyDown(input(), { key: 'Enter' }); });
  expect(input().value).toBe('西瓜');
  expect(screen.getByText('网络已断开')).toBeTruthy();
  expect(screen.getByRole('button', { name: '发送猜词' }).hasAttribute('disabled')).toBe(false);
  await act(async () => { fireEvent.keyDown(input(), { key: 'Enter' }); });
  expect(fake.guess).toHaveBeenCalledTimes(2);
});

it('失败回执不覆盖新草稿；中文输入法和 Shift+Enter 不发送', async () => {
  let reject!: (error: Error) => void;
  fake.guess.mockReturnValueOnce(new Promise<void>((_, fail) => { reject = fail; }));
  render(view());
  fireEvent.change(input(), { target: { value: '苹果' } });
  fireEvent.keyDown(input(), { key: 'Enter', isComposing: true });
  fireEvent.keyDown(input(), { key: 'Enter', shiftKey: true });
  expect(fake.guess).not.toHaveBeenCalled();
  fireEvent.keyDown(input(), { key: 'Enter' });
  fireEvent.change(input(), { target: { value: '保留新草稿' } });
  await act(async () => { reject(Error('发送失败')); });
  expect(input().value).toBe('保留新草稿');
});

it('断线、揭晓、画手和旁观者不能发送猜词', async () => {
  const { rerender } = render(view(room, true));
  fireEvent.change(input(), { target: { value: '苹果' } });
  fireEvent.keyDown(input(), { key: 'Enter' });
  expect(input().disabled).toBe(true);
  rerender(view({ ...room, phase: 'revealed' }));
  fireEvent.keyDown(input(), { key: 'Enter' });
  expect(input().disabled).toBe(true);
  await act(async () => { rerender(view({ ...room, drawerKey: 'me' })); });
  fireEvent.keyDown(input(), { key: 'Enter' });
  expect(input().disabled).toBe(true);
  rerender(view({ ...room, players: room.players.filter(player => player.key !== 'me') }));
  fireEvent.keyDown(input(), { key: 'Enter' });
  expect(input().disabled).toBe(true);
  expect(fake.guess).not.toHaveBeenCalled();
});

it('旧轮次失败不会恢复文本或错误到新轮次', async () => {
  let reject!: (error: Error) => void;
  fake.guess.mockReturnValueOnce(new Promise<void>((_, fail) => { reject = fail; }));
  const { rerender } = render(view());
  fireEvent.change(input(), { target: { value: '苹果' } });
  fireEvent.keyDown(input(), { key: 'Enter' });
  rerender(view({ ...room, round: 2 }));
  expect(input().value).toBe('');
  await act(async () => { reject(Error('旧轮次错误')); });
  expect(input().value).toBe('');
  expect(screen.queryByText('旧轮次错误')).toBeNull();
});

it('只显示猜词记录和设备标签，不渲染题面、线索、提问和进度', () => {
  const { container } = render(view({
    ...room, hints: ['不应展示的线索'], log: [{ id: 'q', playerKey: 'other', playerName: '小林', text: '不应展示的提问', at: 1, verdict: '是' }],
    guesses: [
      { id: 'g', playerKey: 'other', playerName: '小林', text: '苹果', at: 2, outcome: '还没猜对' },
      { id: 'g-win', playerKey: 'me', playerName: '我', text: '西瓜', at: 3, outcome: '破解成功', points: 12 },
    ],
  }));
  expect(screen.getByRole('log').textContent).toContain('苹果');
  expect(screen.getByRole('log').textContent).toContain('猜对了');
  expect(screen.getByRole('log').textContent).toContain('+12 分');
  expect(screen.getByText('macOS · Chrome')).toBeTruthy();
  expect(container.textContent).not.toMatch(/不应展示|提问|提示|JEV|AI|海龟汤|线索板|推理进度/);
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('form', { name: '发送猜词' }).contains(input())).toBe(true);
});

it('揭晓答案在画板下方展示；只有房主能开始下一轮，不堆叠弹窗', () => {
  const revealed: RoomView = { ...room, phase: 'revealed', reveal: { bottom: '西瓜', hints: ['不应显示'], winnerName: '我', reason: 'solved' } };
  const onNext = vi.fn();
  const { rerender } = render(view(revealed, false, onNext));
  expect(screen.getByText('西瓜')).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '下一轮' }));
  expect(onNext).toHaveBeenCalledTimes(1);
  rerender(view({ ...revealed, hostKey: 'other' }));
  expect(screen.queryByRole('button', { name: '下一轮' })).toBeNull();
  expect(screen.getByText('等待房主开始下一轮')).toBeTruthy();
});

it('旁观者仅看到公开类别和字数，从不请求私密题词', () => {
  render(view({ ...room, wordCategory: '食物', wordLength: 2 }));
  expect(screen.getByText('食物 · 2 字')).toBeTruthy();
  expect(fake.drawerWord).not.toHaveBeenCalled();
  expect(screen.queryByText(/题词：/)).toBeNull();
  expect(screen.queryByRole('toolbar')).toBeNull();
  expect(screen.getByLabelText('同步绘画画布').getAttribute('width')).toBe('800');
  expect(screen.getByLabelText('同步绘画画布').getAttribute('height')).toBe('500');
});

it('画手仅显示授权私密词语，不显示私密提示或角色描述；身份变化清除旧响应', async () => {
  let resolve!: (word: { word: string; category: string; hints: string[] }) => void;
  fake.drawerWord.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  const { rerender, container } = render(view({ ...room, drawerKey: 'me' }));
  expect(fake.drawerWord).toHaveBeenCalledTimes(1);
  rerender(view(room));
  await act(async () => { resolve({ word: '西瓜', category: '食物', hints: ['绝不能显示'] }); });
  expect(container.textContent).not.toContain('西瓜');
  await act(async () => { rerender(view({ ...room, round: 2, drawerKey: 'me' })); });
  expect(screen.getByText('题词：西瓜')).toBeTruthy();
  expect(container.textContent).not.toMatch(/绝不能显示|内鬼|目击者|AI/);
});

it('清空画板需要明确确认，取消不清空；撤销保留独立操作', async () => {
  const state: RoomView = { ...room, drawerKey: 'me', strokes: [{ id: 's', tool: 'pen', color: '#10234b', size: 8, points: [{ x: 1, y: 1 }], playerKey: 'me', playerName: '我', at: 1 }] };
  await act(async () => { render(view(state)); });
  fireEvent.click(screen.getByRole('button', { name: '清空画板' }));
  expect(fake.clearCanvas).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '取消' }));
  expect(fake.clearCanvas).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '撤销上一笔' })); });
  expect(fake.undoStroke).toHaveBeenCalledWith(1);
  fireEvent.click(screen.getByRole('button', { name: '清空画板' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: '确认清空' })); });
  expect(fake.clearCanvas).toHaveBeenCalledWith(1);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('只有当前画手可发送带压力的归一化笔触，取消笔触不发送', async () => {
  const { rerender } = render(<CandyProvider><DrawingCanvas room={room} selfKey="me" disabled={false} /></CandyProvider>);
  const canvas = screen.getByLabelText('同步绘画画布');
  const pointer = (type: string, x: number, y: number, pressure = 0.75) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, button: { value: 0 }, clientX: { value: x }, clientY: { value: y }, pressure: { value: pressure }, pointerType: { value: 'mouse' } });
    fireEvent(canvas, event);
  };
  pointer('pointerdown', 200, 125); pointer('pointerup', 400, 250);
  expect(fake.stroke).not.toHaveBeenCalled();
  await act(async () => { rerender(<CandyProvider><DrawingCanvas room={{ ...room, drawerKey: 'me' }} selfKey="me" disabled={false} /></CandyProvider>); });
  pointer('pointerdown', 200, 125); pointer('pointermove', 300, 200); pointer('pointerup', 400, 250);
  expect(fake.stroke).toHaveBeenCalledWith(expect.objectContaining({ round: 1, tool: 'pen', points: [{ x: 250, y: 250, p: 0.75 }, { x: 375, y: 400, p: 0.75 }, { x: 500, y: 500, p: 0.75 }] }));
  pointer('pointerdown', 200, 125); pointer('pointercancel', 400, 250);
  expect(fake.stroke).toHaveBeenCalledTimes(1);
});


it.each(['ack-first', 'broadcast-first'] as const)('eraser stays visible without double replay when %s', async order => {
  let acknowledge!: (stroke: CanvasStroke) => void;
  fake.stroke.mockReturnValueOnce(new Promise<CanvasStroke>(resolve => { acknowledge = resolve; }));
  const state: RoomView = { ...room, drawerKey: 'me', strokes: [] };
  const draw = (state: RoomView) => <CandyProvider><DrawingCanvas room={state} selfKey="me" disabled={false} /></CandyProvider>;
  const { rerender } = render(draw(state));
  const canvas = screen.getByLabelText('同步绘画画布') as HTMLCanvasElement;
  const paint: string[] = [];
  const stack: string[] = [];
  const ctx = {
    globalCompositeOperation: 'source-over', fillStyle: '',
    save() { stack.push(this.globalCompositeOperation); },
    restore() { this.globalCompositeOperation = stack.pop()!; },
    clearRect() { paint.length = 0; }, fillRect: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), quadraticCurveTo: vi.fn(), closePath: vi.fn(), arc: vi.fn(),
    fill() { paint.push(this.globalCompositeOperation === 'destination-out' ? 'erase' : this.fillStyle); },
  };
  Object.defineProperty(canvas, '__mockCanvasCtx', { value: ctx });
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const pointer = (type: string, x: number) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, button: { value: 0 }, clientX: { value: x }, clientY: { value: 100 }, pressure: { value: 0.5 }, pointerType: { value: 'mouse' } });
    fireEvent(canvas, event);
  };
  fireEvent.click(screen.getByRole('button', { name: '橡皮擦' }));
  pointer('pointerdown', 100.123); pointer('pointermove', 200.456); pointer('pointerup', 300.789);
  expect(paint).toEqual(['erase']);
  const payload = fake.stroke.mock.calls[0]![0] as StrokeInput;
  const accepted: CanvasStroke = {
    ...payload, id: 'accepted-eraser', playerKey: 'me', playerName: '我', at: 1,
    points: payload.points.map(point => ({ ...point, x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10 })),
  };
  const laterPen: CanvasStroke = { id: 'later-pen', tool: 'pen', color: '#ff0000', size: 8, points: [{ x: 100, y: 100 }], playerKey: 'me', playerName: '我', at: 2 };
  if (order === 'ack-first') {
    await act(async () => { acknowledge(accepted); });
    expect(paint).toEqual(['erase']);
    rerender(draw({ ...state, strokes: [accepted, laterPen] }));
  } else {
    rerender(draw({ ...state, strokes: [accepted, laterPen] }));
    expect(paint).toEqual(['erase', '#ff0000']);
    await act(async () => { acknowledge(accepted); });
  }
  expect(paint).toEqual(['erase', '#ff0000']);
  // After authoritative removal an acknowledged eraser must never resurrect.
  rerender(draw({ ...state, strokes: [laterPen] }));
  expect(paint).toEqual(['#ff0000']);
});

it('late stroke acknowledgements never repaint a previous round', async () => {
  let acknowledge!: (stroke: CanvasStroke) => void;
  fake.stroke.mockReturnValueOnce(new Promise<CanvasStroke>(resolve => { acknowledge = resolve; }));
  const state: RoomView = { ...room, drawerKey: 'me', strokes: [] };
  const draw = (state: RoomView) => <CandyProvider><DrawingCanvas room={state} selfKey="me" disabled={false} /></CandyProvider>;
  const { rerender } = render(draw(state));
  const canvas = screen.getByLabelText('同步绘画画布') as HTMLCanvasElement;
  const clear = vi.fn();
  const ctx = { save: vi.fn(), restore: vi.fn(), clearRect: clear, fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), quadraticCurveTo: vi.fn(), closePath: vi.fn(), arc: vi.fn(), fill: vi.fn() };
  Object.defineProperty(canvas, '__mockCanvasCtx', { value: ctx });
  vi.spyOn(canvas, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  const pointer = (type: string) => {
    const event = new Event(type, { bubbles: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, button: { value: 0 }, clientX: { value: 100 }, clientY: { value: 100 }, pressure: { value: 0.5 } });
    fireEvent(canvas, event);
  };
  pointer('pointerdown'); pointer('pointerup');
  rerender(draw({ ...state, round: 2 }));
  clear.mockClear();
  const payload = fake.stroke.mock.calls[0]![0] as StrokeInput;
  await act(async () => { acknowledge({ ...payload, id: 'old-round', playerKey: 'me', playerName: '我', at: 1 }); });
  expect(clear).not.toHaveBeenCalled();
});
