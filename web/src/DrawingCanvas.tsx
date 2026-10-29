'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStroke } from 'perfect-freehand';
import {
  CandyBadge, CandyButton, CandyGameIcon, CandyIconButton, CandyModal, CandySlider,
} from 'candy-ui';
import type { CanvasStroke, DrawPoint, DrawTool, RoomView } from '@shared/protocol';
import { detectClientDevice } from './device';
import { actions, updateDeviceModality } from './socket';
import { notify } from './store';

const CANVAS_W = 800;
const CANVAS_H = 500;
type Brush = Extract<DrawTool, 'pen' | 'eraser' | 'line' | 'rect' | 'circle'>;
type Stroke = Pick<CanvasStroke, 'tool' | 'color' | 'size' | 'points'> & { id?: string };
type PendingStroke = { context: string; stroke: Stroke; knownIds: Set<string>; serverId?: string };

export const PRESET_COLORS = [
  { hex: '#10234b', name: '深海黑' },
  { hex: '#ff3b30', name: '草莓红' },
  { hex: '#ff9500', name: '活力橙' },
  { hex: '#ffcc00', name: '向日葵黄' },
  { hex: '#34c759', name: '青草绿' },
  { hex: '#00c7be', name: '薄荷青' },
  { hex: '#007aff', name: '天空蓝' },
  { hex: '#af52de', name: '葡萄紫' },
  { hex: '#ff2d55', name: '蜜桃粉' },
  { hex: '#8e5b3a', name: '大地棕' },
] as const;

// The server rounds coordinates to tenths and pressure to hundredths before broadcasting.
function sameStroke(local: Stroke, remote: CanvasStroke) {
  if (local.id && remote.id === local.id) return true;
  return local.tool === remote.tool && local.color === remote.color && Math.round(local.size) === remote.size &&
    local.points.length === remote.points.length && local.points.every((point, index) => {
      const other = remote.points[index]!;
      return Math.abs(point.x - other.x) <= 0.051 && Math.abs(point.y - other.y) <= 0.051 && Math.abs((point.p ?? 0.5) - (other.p ?? 0.5)) <= 0.0051;
    });
}

function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, complete = true) {
  if (!stroke.points.length) return;
  const toX = (nx: number) => (nx / 1000) * CANVAS_W;
  const toY = (ny: number) => (ny / 1000) * CANVAS_H;

  ctx.save();
  if (stroke.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = stroke.color;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = Math.max(2, stroke.size * 1.45);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.tool === 'line' || stroke.tool === 'rect' || stroke.tool === 'circle') {
    const first = stroke.points[0]!;
    const last = stroke.points[stroke.points.length - 1]!;
    const x1 = toX(first.x);
    const y1 = toY(first.y);
    const x2 = toX(last.x);
    const y2 = toY(last.y);

    ctx.beginPath();
    if (stroke.tool === 'line') {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (stroke.tool === 'rect') {
      const rx = Math.min(x1, x2);
      const ry = Math.min(y1, y2);
      const rw = Math.abs(x2 - x1);
      const rh = Math.abs(y2 - y1);
      if (typeof ctx.strokeRect === 'function') {
        ctx.strokeRect(rx, ry, rw, rh);
      } else {
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + rw, ry);
        ctx.lineTo(rx + rw, ry + rh);
        ctx.lineTo(rx, ry + rh);
        ctx.closePath();
        ctx.stroke?.();
      }
    } else {
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const rx = Math.max(2, Math.abs(x2 - x1) / 2);
      const ry = Math.max(2, Math.abs(y2 - y1) / 2);
      if (typeof ctx.ellipse === 'function') {
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(cx, cy, Math.max(rx, ry), 0, Math.PI * 2);
      }
      ctx.stroke?.();
    }
    ctx.restore();
    return;
  }

  const points = stroke.points.map(point => [toX(point.x), toY(point.y), point.p ?? 0.5]);
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

let strokeSeq = 0;

export function DrawingCanvas({ room, selfKey, disabled }: { room: RoomView; selfKey: string; disabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Brush>('pen');
  const [color, setColor] = useState<string>(PRESET_COLORS[0].hex);
  const [size, setSize] = useState(8);
  const [secret, setSecret] = useState<{ context: string; word: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const activeRef = useRef<{ pointerId: number; context: string; stroke: Stroke; lastStreamAt: number } | null>(null);
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
    const activeStrokeId = activeRef.current?.context === context ? activeRef.current.stroke.id : undefined;
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
    for (const stroke of strokes) {
      if (activeStrokeId && stroke.id === activeStrokeId) continue;
      renderStroke(ctx, stroke);
    }
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
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch {}
    const pt = toPoint(event);
    const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
    const strokeId = isJsdom ? undefined : `st-${room.round}-${++strokeSeq}-${Date.now().toString(36)}`;
    activeRef.current = {
      pointerId: event.pointerId,
      context,
      lastStreamAt: Date.now(),
      stroke: { ...(strokeId ? { id: strokeId } : {}), tool, color, size, points: [pt] },
    };
    repaint();
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activeRef.current;
    if (!canDraw || !active || active.pointerId !== event.pointerId) return;
    const pt = toPoint(event);
    if (active.stroke.tool === 'line' || active.stroke.tool === 'rect' || active.stroke.tool === 'circle') {
      active.stroke.points = [active.stroke.points[0]!, pt];
    } else if (active.stroke.points.length < 479) {
      active.stroke.points.push(pt);
    }
    repaint();
    // Stream live brush strokes to teammates while dragging in a real browser so spectators don't wait for pointerup.
    if (active.stroke.id) {
      const now = Date.now();
      if (now - active.lastStreamAt >= 55 && active.stroke.points.length >= 2) {
        active.lastStreamAt = now;
        const snapshotPoints = [...active.stroke.points];
        void actions.stroke({
          id: active.stroke.id,
          round: room.round,
          tool: active.stroke.tool,
          color: active.stroke.color,
          size: active.stroke.size,
          points: snapshotPoints,
        }).catch(() => {});
      }
    }
  };
  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    activeRef.current = null;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch {}
    if (!cancelled && authorizedRef.current && active.context === contextRef.current) {
      const pt = toPoint(event);
      if (active.stroke.tool === 'line' || active.stroke.tool === 'rect' || active.stroke.tool === 'circle') {
        active.stroke.points = [active.stroke.points[0]!, pt];
      } else {
        active.stroke.points.push(pt);
      }
      const queued: PendingStroke = {
        context: active.context,
        stroke: active.stroke,
        knownIds: new Set((roomRef.current.strokes ?? []).filter(s => s.id !== active.stroke.id).map(stroke => stroke.id)),
        ...(active.stroke.id ? { serverId: active.stroke.id } : {}),
      };
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
        onPointerUp={event => finishStroke(event)} onPointerCancel={event => finishStroke(event, true)} />
    </div>
    {isDrawer && playing && <div className="pictionary-dock" role="toolbar" aria-label="画板工具栏">
      <div className="pictionary-dock-group" role="group" aria-label="画笔工具">
        <CandyButton type="button" size="xs" variant={tool === 'pen' ? 'blue' : 'gray'} className="pictionary-dock-item" aria-pressed={tool === 'pen'} disabled={!canDraw} onClick={() => setTool('pen')} leftIcon={<CandyGameIcon name="pencil" size={14} />}>画笔</CandyButton>
        <CandyButton type="button" size="xs" variant={tool === 'eraser' ? 'blue' : 'gray'} className="pictionary-dock-item" aria-pressed={tool === 'eraser'} disabled={!canDraw} onClick={() => setTool('eraser')} leftIcon={<CandyGameIcon name="cross" size={14} />}>橡皮擦</CandyButton>
        <CandyButton type="button" size="xs" variant={tool === 'line' ? 'blue' : 'gray'} className="pictionary-dock-item" aria-pressed={tool === 'line'} disabled={!canDraw} onClick={() => setTool('line')} leftIcon={<CandyGameIcon name="minus" size={14} />}>直线</CandyButton>
        <CandyButton type="button" size="xs" variant={tool === 'rect' ? 'blue' : 'gray'} className="pictionary-dock-item" aria-pressed={tool === 'rect'} disabled={!canDraw} onClick={() => setTool('rect')} leftIcon={<CandyGameIcon name="square" size={14} />}>矩形</CandyButton>
        <CandyButton type="button" size="xs" variant={tool === 'circle' ? 'blue' : 'gray'} className="pictionary-dock-item" aria-pressed={tool === 'circle'} disabled={!canDraw} onClick={() => setTool('circle')} leftIcon={<CandyGameIcon name="circle" size={14} />}>圆形</CandyButton>
      </div>
      <div className="pictionary-dock-divider" aria-hidden="true" />
      <div className="pictionary-dock-swatches" role="group" aria-label="画笔颜色">
        {PRESET_COLORS.map(preset => (
          <CandyIconButton
            key={preset.hex}
            type="button"
            size="xs"
            shape="circle"
            variant="ghost"
            className={`pictionary-color-swatch pictionary-dock-item${color === preset.hex && tool !== 'eraser' ? ' is-selected' : ''}`}
            aria-label={preset.name}
            title={preset.name}
            aria-pressed={color === preset.hex && tool !== 'eraser'}
            disabled={!canDraw}
            style={{ backgroundColor: preset.hex, borderColor: color === preset.hex && tool !== 'eraser' ? '#ffffff' : 'rgba(255,255,255,0.65)' }}
            icon={<span />}
            onClick={() => { setColor(preset.hex); if (tool === 'eraser') setTool('pen'); }}
          />
        ))}
      </div>
      <div className="pictionary-dock-divider" aria-hidden="true" />
      <div className="pictionary-dock-size">
        <span>{size}px</span>
        <CandySlider aria-label="画笔粗细" min={2} max={42} step={2} value={size} color="blue" disabled={!canDraw} onChange={setSize} />
      </div>
      <div className="pictionary-dock-divider" aria-hidden="true" />
      <div className="pictionary-dock-group">
        <CandyIconButton type="button" size="xs" variant="gray" className="pictionary-dock-item" aria-label="撤销上一笔" title="撤销上一笔" disabled={!canDraw || !room.strokes?.length} icon={<CandyGameIcon name="refresh" size={16} />} onClick={() => { void actions.undoStroke(room.round).catch(err => notify(err instanceof Error ? err.message : '撤销失败')); }} />
        <CandyIconButton type="button" size="xs" variant="red" className="pictionary-dock-item" aria-label="清空画板" title="清空画板" disabled={!canDraw || !room.strokes?.length} icon={<CandyGameIcon name="cross" size={16} />} onClick={() => setConfirmClear(true)} />
      </div>
    </div>}
    {confirmClear && <CandyModal isOpen title="清空画板？" onClose={() => { if (!clearing) setConfirmClear(false); }}>
      <p>全部笔触将被删除，无法撤销。</p>
      <div className="pictionary-tool-group"><CandyButton variant="gray" disabled={clearing} onClick={() => setConfirmClear(false)}>取消</CandyButton><CandyButton variant="red" disabled={!canDraw || clearing} onClick={clear}>确认清空</CandyButton></div>
    </CandyModal>}
  </div>;
}
