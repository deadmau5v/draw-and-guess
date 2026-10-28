'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getStroke } from 'perfect-freehand';
import {
  CandyAlert, CandyBadge, CandyButton, CandyColorPicker, CandyGameIcon,
  CandyIconButton, CandyPanel, CandySlider, CANDY_THEME_COLOR_PRESETS,
} from 'candy-ui';
import type {
  AiCanvasGuess, CanvasStroke, DrawerSecretView, DrawPoint, DrawTool, PartyMode, RoomView,
} from '@shared/protocol';
import { detectClientDevice } from './device';
import { emitFloatingText, playJuiceSound } from './juice';
import { actions, updateDeviceModality } from './socket';
import { notify } from './store';

const CANVAS_W = 800;
const CANVAS_H = 500;

function hexToRgba(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return [r, g, b, 255];
}

function floodFillCanvas(ctx: CanvasRenderingContext2D, startX: number, startY: number, fillHex: string) {
  try {
    const imgData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const data = imgData.data;
    const x0 = Math.max(0, Math.min(CANVAS_W - 1, Math.floor(startX)));
    const y0 = Math.max(0, Math.min(CANVAS_H - 1, Math.floor(startY)));
    const startIdx = (y0 * CANVAS_W + x0) * 4;
    const [tr, tg, tb, ta] = [data[startIdx]!, data[startIdx + 1]!, data[startIdx + 2]!, data[startIdx + 3]!];
    const [fr, fg, fb, fa] = hexToRgba(fillHex);
    if (Math.abs(tr - fr) < 8 && Math.abs(tg - fg) < 8 && Math.abs(tb - fb) < 8 && Math.abs(ta - fa) < 8) return;

    const match = (idx: number) =>
      Math.abs(data[idx]! - tr) <= 24 &&
      Math.abs(data[idx + 1]! - tg) <= 24 &&
      Math.abs(data[idx + 2]! - tb) <= 24 &&
      Math.abs(data[idx + 3]! - ta) <= 24;

    const visited = new Uint8Array(CANVAS_W * CANVAS_H);
    const stack: number[] = [x0, y0];
    visited[y0 * CANVAS_W + x0] = 1;

    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      const idx = (y * CANVAS_W + x) * 4;
      data[idx] = fr;
      data[idx + 1] = fg;
      data[idx + 2] = fb;
      data[idx + 3] = fa;

      const neighbors = [
        [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (nx! >= 0 && nx! < CANVAS_W && ny! >= 0 && ny! < CANVAS_H) {
          const pIdx = ny! * CANVAS_W + nx!;
          if (!visited[pIdx] && match(pIdx * 4)) {
            visited[pIdx] = 1;
            stack.push(nx!, ny!);
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // JSDOM or cross-origin canvas fallback: fill background rect
    ctx.fillStyle = fillHex;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

function renderStrokeOnContext(ctx: CanvasRenderingContext2D, stroke: Pick<CanvasStroke, 'tool' | 'color' | 'size' | 'points'>, alpha = 1) {
  const pts = stroke.points;
  if (!pts.length) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const toX = (nx: number) => (nx / 1000) * CANVAS_W;
  const toY = (ny: number) => (ny / 1000) * CANVAS_H;

  if (stroke.tool === 'fill') {
    const first = pts[0]!;
    floodFillCanvas(ctx, toX(first.x), toY(first.y), stroke.color);
    ctx.restore();
    return;
  }

  const drawColor = stroke.tool === 'eraser' ? '#ffffff' : stroke.color;
  ctx.strokeStyle = drawColor;
  ctx.fillStyle = drawColor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = stroke.size;

  if (stroke.tool === 'line' && pts.length >= 2) {
    const start = pts[0]!;
    const end = pts[pts.length - 1]!;
    ctx.beginPath();
    ctx.moveTo(toX(start.x), toY(start.y));
    ctx.lineTo(toX(end.x), toY(end.y));
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (stroke.tool === 'rect' && pts.length >= 2) {
    const start = pts[0]!;
    const end = pts[pts.length - 1]!;
    const x = Math.min(toX(start.x), toX(end.x));
    const y = Math.min(toY(start.y), toY(end.y));
    const w = Math.abs(toX(end.x) - toX(start.x));
    const h = Math.abs(toY(end.y) - toY(start.y));
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
    return;
  }

  if (stroke.tool === 'circle' && pts.length >= 2) {
    const start = pts[0]!;
    const end = pts[pts.length - 1]!;
    const cx = (toX(start.x) + toX(end.x)) / 2;
    const cy = (toY(start.y) + toY(end.y)) / 2;
    const rx = Math.max(2, Math.abs(toX(end.x) - toX(start.x)) / 2);
    const ry = Math.max(2, Math.abs(toY(end.y) - toY(start.y)) / 2);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Freehand pen / eraser via `perfect-freehand` pressure-sensitive polygon outline
  const inputPoints = pts.map(pt => [toX(pt.x), toY(pt.y), pt.p ?? 0.5]);
  const outline = getStroke(inputPoints, {
    size: stroke.size * 1.15,
    thinning: stroke.tool === 'eraser' ? 0 : 0.45,
    smoothing: 0.55,
    streamline: 0.5,
    simulatePressure: pts.every(pt => pt.p === undefined || pt.p === 0.5),
  });

  if (outline.length >= 3) {
    ctx.beginPath();
    const first = outline[0]!;
    ctx.moveTo(first[0]!, first[1]!);
    for (let i = 1; i < outline.length; i++) {
      const p0 = outline[i]!;
      const p1 = outline[(i + 1) % outline.length]!;
      ctx.quadraticCurveTo(p0[0]!, p0[1]!, (p0[0]! + p1[0]!) / 2, (p0[1]! + p1[1]!) / 2);
    }
    ctx.closePath();
    ctx.fill();
  } else if (pts[0]) {
    ctx.beginPath();
    ctx.arc(toX(pts[0].x), toY(pts[0].y), stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function DrawingCanvas({
  room,
  selfKey,
  disabled,
}: {
  room: RoomView;
  selfKey: string;
  disabled: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState<string>('#10234b');
  const [size, setSize] = useState<number>(8);
  const [sabotageMode, setSabotageMode] = useState(false);
  const [secretInfo, setSecretInfo] = useState<DrawerSecretView | null>(null);
  const [wordVisible, setWordVisible] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [playingGif, setPlayingGif] = useState(false);
  const [playbackFrame, setPlaybackFrame] = useState(0);
  const [renderTick, setRenderTick] = useState(0);

  const activePointsRef = useRef<DrawPoint[]>([]);
  const drawingRef = useRef(false);

  const partyMode: PartyMode = room.party?.mode ?? room.settings.partyMode ?? 'classic';
  const playing = room.phase === 'playing';
  const isHost = room.hostKey === selfKey;
  const isDrawer = room.drawerKey === selfKey || (!room.drawerKey && isHost);
  const canDraw = !disabled && playing && (
    isDrawer ||
    partyMode === 'doodle-puzzle' ||
    partyMode === 'pictomania' ||
    partyMode === 'monsdrawsity' ||
    partyMode === 'complement' ||
    room.settings.turnMode === 'free'
  );

  const myQuadrant = useMemo(() => {
    if (partyMode !== 'doodle-puzzle') return undefined;
    const found = room.party?.quadrantOwners?.find(q => q.playerKey === selfKey);
    return found?.quadrant ?? 0;
  }, [partyMode, room.party?.quadrantOwners, selfKey]);

  const currentFrame = room.party?.currentFrame ?? 0;
  const totalFrames = room.party?.totalFrames ?? 4;

  // Fetch secret word / role for drawer, saboteur, witness, or multi-draw modes
  useEffect(() => {
    if (!playing || disabled || typeof actions?.drawerWord !== 'function') {
      setSecretInfo(null);
      return;
    }
    void actions.drawerWord().then(info => {
      setSecretInfo(info);
    }).catch(() => {
      setSecretInfo(null);
    });
  }, [playing, disabled, room.round, room.drawerKey, partyMode, selfKey]);

  // Secret Ink mode timer: re-render every 250ms while fading strokes exist
  useEffect(() => {
    if (partyMode !== 'secret-ink' || !playing) return;
    const timer = window.setInterval(() => setRenderTick(t => t + 1), 250);
    return () => window.clearInterval(timer);
  }, [partyMode, playing]);

  // Animation mode 5fps playback timer
  useEffect(() => {
    if (!playingGif && room.phase !== 'revealed') return;
    if (partyMode !== 'animation' && partyMode !== 'sandwich' && partyMode !== 'knock-off') return;
    const timer = window.setInterval(() => {
      setPlaybackFrame(f => (f + 1) % Math.max(1, totalFrames));
    }, 200); // 5 fps
    return () => window.clearInterval(timer);
  }, [playingGif, room.phase, partyMode, totalFrames]);

  const repaint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent) && !('__mockCanvasCtx' in canvas)) {
      return;
    }
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      return;
    }
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw 4-quadrant puzzle grid when in doodle-puzzle mode
    if (partyMode === 'doodle-puzzle') {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 104, 240, 0.28)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_W / 2, 0);
      ctx.lineTo(CANVAS_W / 2, CANVAS_H);
      ctx.moveTo(0, CANVAS_H / 2);
      ctx.lineTo(CANVAS_W, CANVAS_H / 2);
      ctx.stroke();
      ctx.restore();
    }

    const strokes = room.strokes ?? [];
    const now = Date.now();
    const isFrameMode = partyMode === 'animation' || partyMode === 'sandwich' || partyMode === 'knock-off';
    const activeDisplayFrame = (playingGif || room.phase === 'revealed') && isFrameMode ? playbackFrame : currentFrame;

    for (const s of strokes) {
      // Secret ink mode: hide strokes older than 2000ms while playing
      if (partyMode === 'secret-ink' && playing) {
        const age = now - s.at;
        if (age > 2000) continue;
        const alpha = Math.max(0.1, 1 - age / 2000);
        renderStrokeOnContext(ctx, s, alpha);
        continue;
      }

      if (isFrameMode) {
        const sFrame = s.frameIndex ?? 0;
        if (playing && !playingGif) {
          // Onion skin: show previous frame at 22% opacity in animation mode, or brief reference in knock-off
          if (sFrame === activeDisplayFrame - 1) {
            renderStrokeOnContext(ctx, s, partyMode === 'animation' ? 0.24 : 0.18);
          } else if (sFrame === activeDisplayFrame) {
            renderStrokeOnContext(ctx, s, 1);
          }
        } else {
          if (sFrame === activeDisplayFrame) {
            renderStrokeOnContext(ctx, s, 1);
          }
        }
        continue;
      }

      renderStrokeOnContext(ctx, s, 1);
    }

    // Render active in-progress stroke
    if (drawingRef.current && activePointsRef.current.length > 0) {
      renderStrokeOnContext(ctx, {
        tool,
        color,
        size,
        points: activePointsRef.current,
      }, 1);
    }
  }, [room.strokes, room.phase, partyMode, playing, playingGif, playbackFrame, currentFrame, tool, color, size, renderTick]);

  useEffect(() => {
    repaint();
  }, [repaint]);

  const toNormalizedPoint = (event: React.PointerEvent<HTMLCanvasElement>): DrawPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    const w = rect.width || CANVAS_W;
    const h = rect.height || CANVAS_H;
    const x = Math.max(0, Math.min(1000, ((event.clientX - rect.left) / w) * 1000));
    const y = Math.max(0, Math.min(1000, ((event.clientY - rect.top) / h) * 1000));
    const p = typeof event.pressure === 'number' && event.pressure > 0 ? event.pressure : 0.5;
    return { x, y, p };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    if (event.pointerType === 'pen' && typeof updateDeviceModality === 'function') {
      const detected = detectClientDevice('pen');
      if (detected) updateDeviceModality(detected);
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const pt = toNormalizedPoint(event);
    if (tool === 'fill') {
      playJuiceSound('highlight');
      void actions.stroke({
        round: room.round,
        tool: 'fill',
        color,
        size,
        points: [pt],
        frameIndex: currentFrame,
        ...(myQuadrant !== undefined ? { quadrant: myQuadrant } : {}),
        ...(sabotageMode ? { sabotage: true } : {}),
      }).catch(err => notify(err instanceof Error ? err.message : '填充同步失败'));
      return;
    }
    drawingRef.current = true;
    activePointsRef.current = [pt];
    repaint();
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !canDraw) return;
    const pt = toNormalizedPoint(event);
    if (tool === 'line' || tool === 'rect' || tool === 'circle') {
      activePointsRef.current = [activePointsRef.current[0]!, pt];
    } else if (activePointsRef.current.length < 480) {
      activePointsRef.current.push(pt);
    }
    repaint();
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pts = [...activePointsRef.current];
    activePointsRef.current = [];
    if (!pts.length) return;
    void actions.stroke({
      round: room.round,
      tool,
      color,
      size,
      points: pts,
      frameIndex: currentFrame,
      ...(myQuadrant !== undefined ? { quadrant: myQuadrant } : {}),
      ...(sabotageMode ? { sabotage: true } : {}),
    }).catch(err => notify(err instanceof Error ? err.message : '笔触同步失败'));
    repaint();
  };

  const triggerMultimodalJev = async () => {
    if (disabled || !playing || aiBusy) return;
    setAiBusy(true);
    try {
      let dataUrl: string | undefined;
      try {
        const raw = canvasRef.current?.toDataURL('image/png');
        if (raw && raw.startsWith('data:image/png;base64,')) dataUrl = raw;
      } catch {}
      const res: AiCanvasGuess = await actions.aiGuess(dataUrl);
      playJuiceSound('hintReveal');
      emitFloatingText({ text: `🤖 JEV 传神度 ${res.similarity}%`, color: 'purple' });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'JEV 识图暂时不可用');
    } finally {
      setAiBusy(false);
    }
  };

  const drawerName = room.players.find(p => p.key === room.drawerKey)?.name ?? '画手';

  return (
    <div className="drawing-canvas-stage" aria-label="你画我猜互动速写板">
      {secretInfo && (
        <div className="drawer-secret-bar">
          <div className="drawer-secret-left">
            <CandyBadge variant={secretInfo.role === 'saboteur' ? 'red' : secretInfo.role === 'witness' ? 'purple' : 'yellow'}>
              <CandyGameIcon name="pencil" size={14} />{' '}
              {secretInfo.role === 'saboteur' ? '内鬼坏坏视角' : secretInfo.role === 'witness' ? '目击者机密档案' : '画手机密题目'}
            </CandyBadge>
            <strong>
              {wordVisible ? `题目：「${secretInfo.word}」（${secretInfo.category}）` : '题目已隐藏（防偷看）'}
            </strong>
            {secretInfo.roleHint && <small className="drawer-role-hint">{secretInfo.roleHint}</small>}
          </div>
          <div className="drawer-secret-actions">
            {secretInfo.role === 'saboteur' && (
              <CandyButton
                type="button"
                size="xs"
                variant={sabotageMode ? 'red' : 'gray'}
                appearance={sabotageMode ? 'solid' : 'outline'}
                aria-pressed={sabotageMode}
                onClick={() => setSabotageMode(v => !v)}
              >
                {sabotageMode ? '🔥 破坏笔触开启中' : '开启内鬼破坏笔'}
              </CandyButton>
            )}
            <CandyButton
              type="button"
              size="xs"
              variant="ghost"
              appearance="outline"
              onClick={() => setWordVisible(v => !v)}
            >
              {wordVisible ? '隐藏题词' : '显示题词'}
            </CandyButton>
          </div>
        </div>
      )}

      {!secretInfo && playing && (
        <div className="drawer-public-bar">
          <CandyBadge variant="blue"><CandyGameIcon name="pencil" size={14} /> 当前主画手：{drawerName}</CandyBadge>
          <span>画布已实时同步（共 {(room.strokes ?? []).length} 笔）· 请在下方猜词或提问</span>
        </div>
      )}

      <div className="drawing-canvas-frame">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={`drawing-canvas-surface${canDraw ? ' drawing-canvas-editable' : ''}`}
          aria-label="同步绘画画布"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishStroke}
          onPointerCancel={finishStroke}
        />
        {partyMode === 'secret-ink' && playing && (
          <div className="canvas-mode-floating-badge">
            <CandyBadge variant="purple">👻 隐形墨水：落笔 2 秒后自动隐形</CandyBadge>
          </div>
        )}
        {(partyMode === 'animation' || partyMode === 'sandwich' || partyMode === 'knock-off') && (
          <div className="canvas-mode-floating-badge">
            <CandyBadge variant="yellow">
              🎬 第 {((playingGif || room.phase === 'revealed') ? playbackFrame : currentFrame) + 1} / {totalFrames} 帧
              {partyMode === 'knock-off' && room.party?.knockOffSeconds ? ` · 临摹限时 ${room.party.knockOffSeconds}s` : ''}
            </CandyBadge>
          </div>
        )}
      </div>

      <CandyPanel theme="frosted" style={{ padding: 10 }} className="drawing-toolbar" role="toolbar" aria-label="画板工具栏">
        <div className="drawing-tools-row">
          <div className="drawing-tool-buttons" role="group" aria-label="画笔工具">
            {([
              { id: 'pen', label: '压感画笔', icon: 'pencil' },
              { id: 'eraser', label: '橡皮擦', icon: 'cross' },
              { id: 'fill', label: '油漆桶', icon: 'potion' },
              { id: 'line', label: '直线', icon: 'arrow-right' },
              { id: 'rect', label: '矩形', icon: 'grid' },
              { id: 'circle', label: '圆形', icon: 'compass' },
            ] as const).map(item => (
              <CandyButton
                key={item.id}
                type="button"
                size="xs"
                variant={tool === item.id ? 'blue' : 'gray'}
                appearance={tool === item.id ? 'solid' : 'outline'}
                aria-pressed={tool === item.id}
                disabled={!canDraw}
                leftIcon={<CandyGameIcon name={item.icon} size={14} />}
                onClick={() => setTool(item.id)}
              >
                {item.label}
              </CandyButton>
            ))}
          </div>

          <div className="drawing-brush-controls">
            <CandyColorPicker
              aria-label="画笔颜色"
              size="sm"
              value={color}
              presets={CANDY_THEME_COLOR_PRESETS}
              disabled={!canDraw}
              onChange={nextColor => { setColor(nextColor); if (tool === 'eraser') setTool('pen'); }}
            />
            <div className="drawing-slider-wrap">
              <span className="drawing-size-label">粗细 {size}px</span>
              <CandySlider
                aria-label="画笔粗细"
                min={2}
                max={42}
                step={2}
                value={size}
                color="blue"
                disabled={!canDraw}
                onChange={setSize}
              />
            </div>
          </div>

          <div className="drawing-action-buttons">
            <CandyIconButton
              type="button"
              size="xs"
              variant="gray"
              aria-label="撤销上一笔"
              title="撤销上一笔"
              disabled={!canDraw || !(room.strokes ?? []).length}
              icon={<CandyGameIcon name="refresh" size={16} />}
              onClick={() => void actions.undoStroke(room.round).catch(err => notify(err.message))}
            />
            <CandyIconButton
              type="button"
              size="xs"
              variant="red"
              aria-label="清空画板"
              title="清空画板"
              disabled={!canDraw || !(room.strokes ?? []).length}
              icon={<CandyGameIcon name="cross" size={16} />}
              onClick={() => void actions.clearCanvas(room.round).catch(err => notify(err.message))}
            />
            {(partyMode === 'animation' || partyMode === 'sandwich' || partyMode === 'knock-off') && (
              <>
                <CandyButton
                  type="button"
                  size="xs"
                  variant="yellow"
                  disabled={!canDraw}
                  onClick={() => void actions.nextFrame(room.round).catch(err => notify(err.message))}
                >
                  下一帧接力
                </CandyButton>
                <CandyButton
                  type="button"
                  size="xs"
                  variant={playingGif ? 'green' : 'purple'}
                  onClick={() => setPlayingGif(v => !v)}
                >
                  {playingGif ? '暂停连播' : '5fps 连播'}
                </CandyButton>
              </>
            )}
            <CandyButton
              type="button"
              size="xs"
              variant="purple"
              disabled={disabled || !playing || aiBusy}
              leftIcon={<CandyGameIcon name="light" size={15} />}
              onClick={() => void triggerMultimodalJev()}
            >
              {aiBusy ? 'JEV 识图中…' : 'JEV 多模态识图'}
            </CandyButton>
          </div>
        </div>
      </CandyPanel>

      {room.aiGuess && (
        <CandyAlert
          tone="info"
          title={`${room.aiGuess.guess} · 视觉传神度 ${room.aiGuess.similarity}%`}
          icon={<CandyGameIcon name="light" size={20} />}
        >
          {room.aiGuess.comment}
        </CandyAlert>
      )}
    </div>
  );
}
