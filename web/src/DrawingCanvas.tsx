'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStroke } from 'perfect-freehand';
import {
  CandyBadge, CandyButton, CandyColorPicker, CandyGameIcon, CandyIconButton,
  CandyModal, CandyPanel, CandySlider, CANDY_THEME_COLOR_PRESETS,
} from 'candy-ui';
import type { CanvasStroke, DrawPoint, RoomView } from '@shared/protocol';
import { detectClientDevice } from './device';
import { actions, updateDeviceModality } from './socket';
import { notify } from './store';

const CANVAS_W = 800;
const CANVAS_H = 500;
type Brush = 'pen' | 'eraser';
type Stroke = Pick<CanvasStroke, 'tool' | 'color' | 'size' | 'points'>;
type PendingStroke = { context: string; stroke: Stroke; knownIds: Set<string>; serverId?: string };

// The server rounds coordinates to tenths and pressure to hundredths before broadcasting.
function sameStroke(local: Stroke, remote: CanvasStroke) {
  return local.tool === remote.tool && local.color === remote.color && Math.round(local.size) === remote.size &&
    local.points.length === remote.points.length && local.points.every((point, index) => {
      const other = remote.points[index]!;
      return Math.abs(point.x - other.x) <= 0.051 && Math.abs(point.y - other.y) <= 0.051 && Math.abs((point.p ?? 0.5) - (other.p ?? 0.5)) <= 0.0051;
    });
}

function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, complete = true) {
  if (!stroke.points.length) return;
  const points = stroke.points.map(point => [point.x / 1000 * CANVAS_W, point.y / 1000 * CANVAS_H, point.p ?? 0.5]);
  const outline = getStroke(points, {
    size: stroke.size * 1.45,
    thinning: stroke.tool === 'eraser' ? 0 : 0.18,
    smoothing: 0.32,
    streamline: 0.22,
    last: complete,
    start: { cap: true, taper: 0 },
    end: { cap: true, taper: 0 },
    simulatePressure: stroke.points.every(point => point.p === undefined || point.p === 0.5),
  });
  ctx.save();
  if (stroke.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = stroke.color;
  ctx.beginPath();
  if (outline.length >= 3) {
    ctx.moveTo(outline[0]![0]!, outline[0]![1]!);
    for (let i = 0; i < outline.length; i++) {
      const current = outline[i]!;
      const next = outline[(i + 1) % outline.length]!;
      ctx.quadraticCurveTo(current[0]!, current[1]!, (current[0]! + next[0]!) / 2, (current[1]! + next[1]!) / 2);
    }
    ctx.closePath();
  } else {
    ctx.arc(points[0]![0]!, points[0]![1]!, stroke.size / 2, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

export function DrawingCanvas({ room, selfKey, disabled }: { room: RoomView; selfKey: string; disabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Brush>('pen');
  const [color, setColor] = useState('#10234b');
  const [size, setSize] = useState(8);
  const [secret, setSecret] = useState<{ context: string; word: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const activeRef = useRef<{ pointerId: number; context: string; stroke: Stroke } | null>(null);
  const pendingRef = useRef<PendingStroke[]>([]);
  const repaintRef = useRef<() => void>(() => {});
  const roomRef = useRef(room);
  roomRef.current = room;
  const playing = room.phase === 'playing';
  const isDrawer = room.drawerKey === selfKey;
  const canDraw = !disabled && playing && isDrawer;
  const context = `${room.code}:${room.round}:${room.drawerKey}:${selfKey}`;
  const contextRef = useRef(context);
  contextRef.current = context;
  const authorizedRef = useRef(canDraw);
  authorizedRef.current = canDraw;
  const drawerName = room.players.find(player => player.key === room.drawerKey)?.name ?? '画手';

  useEffect(() => {
    let cancelled = false;
    setSecret(null);
    if (!canDraw) return;
    // Never request the private word as a spectator. Ignore responses from a previous round or drawer.
    void actions.drawerWord().then(info => {
      if (!cancelled) setSecret({ context, word: info.word });
    }).catch(() => {
      if (!cancelled) notify('题词暂时未能加载，请检查连接');
    });
    return () => { cancelled = true; };
  }, [canDraw, context]);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // JSDOM has no native canvas. Pointer/payload tests can install an explicit mock context.
    if (/jsdom/i.test(navigator.userAgent) && !('__mockCanvasCtx' in canvas)) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const strokes = room.strokes ?? [];
    const matchedIds = new Set<string>();
    pendingRef.current = pendingRef.current.filter(pending => {
      if (pending.context !== context) return false;
      const accepted = pending.serverId
        ? strokes.find(stroke => stroke.id === pending.serverId)
        : strokes.find(stroke => stroke.playerKey === selfKey && !pending.knownIds.has(stroke.id) && !matchedIds.has(stroke.id) && sameStroke(pending.stroke, stroke));
      if (!accepted) return true;
      matchedIds.add(accepted.id);
      for (const other of pendingRef.current) other.knownIds.add(accepted.id);
      return false;
    });
    for (const stroke of strokes) renderStroke(ctx, stroke);
    for (const pending of pendingRef.current) renderStroke(ctx, pending.stroke);
    if (canDraw && activeRef.current?.context === context) renderStroke(ctx, activeRef.current.stroke, false);
  }, [room.strokes, context, canDraw, selfKey]);
  repaintRef.current = repaint;

  useEffect(() => {
    activeRef.current = null;
    pendingRef.current = [];
    setConfirmClear(false);
  }, [context, canDraw]);
  useEffect(() => { repaint(); }, [repaint]);

  const toPoint = (event: React.PointerEvent<HTMLCanvasElement>): DrawPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1000, (event.clientX - rect.left) / (rect.width || CANVAS_W) * 1000)),
      y: Math.max(0, Math.min(1000, (event.clientY - rect.top) / (rect.height || CANVAS_H) * 1000)),
      p: event.pressure > 0 ? event.pressure : 0.5,
    };
  };
  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || activeRef.current || event.button > 0) return;
    event.preventDefault();
    if (event.pointerType === 'pen') {
      const device = detectClientDevice('pen');
      if (device) updateDeviceModality(device);
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    activeRef.current = { pointerId: event.pointerId, context, stroke: { tool, color, size, points: [toPoint(event)] } };
    repaint();
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current;
    if (!canDraw || !active || active.pointerId !== event.pointerId) return;
    if (active.stroke.points.length < 479) active.stroke.points.push(toPoint(event));
    repaint();
  };
  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    activeRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!cancelled && authorizedRef.current && active.context === contextRef.current) {
      active.stroke.points.push(toPoint(event));
      const queued: PendingStroke = { context: active.context, stroke: active.stroke, knownIds: new Set((roomRef.current.strokes ?? []).map(stroke => stroke.id)) };
      pendingRef.current.push(queued);
      repaint();
      void actions.stroke({ round: room.round, ...active.stroke }).then(accepted => {
        if (contextRef.current !== queued.context || !authorizedRef.current || !pendingRef.current.includes(queued)) return;
        // An acknowledgement identifies the stroke, but only a broadcast replaces the optimistic copy.
        if (accepted) queued.serverId = accepted.id;
        repaintRef.current();
      }).catch(err => {
        if (contextRef.current !== queued.context || !pendingRef.current.includes(queued)) return;
        pendingRef.current = pendingRef.current.filter(pending => pending !== queued);
        repaintRef.current();
        notify(err instanceof Error ? err.message : '笔触同步失败');
      });
    }
    repaint();
  };
  const clear = () => {
    if (!canDraw || clearing) return;
    setClearing(true);
    void actions.clearCanvas(room.round).then(() => setConfirmClear(false)).catch(err => notify(err instanceof Error ? err.message : '清空失败')).finally(() => setClearing(false));
  };

  return <div className="pictionary-canvas-stage" aria-label="绘画区域">
    <div className="pictionary-canvas-heading">
      <CandyBadge variant="blue"><CandyGameIcon name="pencil" size={14} /> {drawerName} 作画</CandyBadge>
      {playing && isDrawer ? <strong>{secret?.context === context && canDraw ? `题词：${secret.word}` : '正在加载题词…'}</strong> : playing ? <span>{room.wordCategory || '看画猜词'}{room.wordLength ? ` · ${room.wordLength} 字` : ''}</span> : <span>本轮画作</span>}
    </div>
    <div className="pictionary-canvas-frame">
      <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
        className={`pictionary-canvas${canDraw ? ' pictionary-canvas-editable' : ''}`}
        aria-label="同步绘画画布" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={event => finishStroke(event)} onPointerCancel={event => finishStroke(event, true)}
        onLostPointerCapture={event => finishStroke(event, true)} />
    </div>
    {isDrawer && playing && <CandyPanel theme="frosted" style={{ padding: 10 }} className="pictionary-drawing-tools" role="toolbar" aria-label="画板工具栏">
      <div className="pictionary-tool-group" role="group" aria-label="画笔工具">
        <CandyButton type="button" size="xs" variant={tool === 'pen' ? 'blue' : 'gray'} aria-pressed={tool === 'pen'} disabled={!canDraw} onClick={() => setTool('pen')} leftIcon={<CandyGameIcon name="pencil" size={14} />}>画笔</CandyButton>
        <CandyButton type="button" size="xs" variant={tool === 'eraser' ? 'blue' : 'gray'} aria-pressed={tool === 'eraser'} disabled={!canDraw} onClick={() => setTool('eraser')} leftIcon={<CandyGameIcon name="cross" size={14} />}>橡皮擦</CandyButton>
      </div>
      <CandyColorPicker aria-label="画笔颜色" size="sm" value={color} presets={CANDY_THEME_COLOR_PRESETS} disabled={!canDraw} onChange={next => { setColor(next); setTool('pen'); }} />
      <div className="pictionary-brush-size"><span>粗细 {size}px</span><CandySlider aria-label="画笔粗细" min={2} max={42} step={2} value={size} color="blue" disabled={!canDraw} onChange={setSize} /></div>
      <div className="pictionary-tool-group">
        <CandyIconButton type="button" size="xs" variant="gray" aria-label="撤销上一笔" title="撤销上一笔" disabled={!canDraw || !room.strokes?.length} icon={<CandyGameIcon name="refresh" size={16} />} onClick={() => { void actions.undoStroke(room.round).catch(err => notify(err instanceof Error ? err.message : '撤销失败')); }} />
        <CandyIconButton type="button" size="xs" variant="red" aria-label="清空画板" title="清空画板" disabled={!canDraw || !room.strokes?.length} icon={<CandyGameIcon name="cross" size={16} />} onClick={() => setConfirmClear(true)} />
      </div>
    </CandyPanel>}
    {confirmClear && <CandyModal isOpen title="清空画板？" onClose={() => { if (!clearing) setConfirmClear(false); }}>
      <p>全部笔触将被删除，无法撤销。</p>
      <div className="pictionary-tool-group"><CandyButton variant="gray" disabled={clearing} onClick={() => setConfirmClear(false)}>取消</CandyButton><CandyButton variant="red" disabled={!canDraw || clearing} onClick={clear}>确认清空</CandyButton></div>
    </CandyModal>}
  </div>;
}
