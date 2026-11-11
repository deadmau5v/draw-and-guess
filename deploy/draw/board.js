const W=960,H=720;
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
// 在设备像素上填充；k 为逻辑坐标到设备像素的缩放
function floodFill(ctx, x, y, color) {
  const cw = ctx.canvas.width, ch = ctx.canvas.height;
  const k = cw / W;
  x = Math.round(x * k); y = Math.round(y * k);
  if (x < 0 || y < 0 || x >= cw || y >= ch) return;
  const img = ctx.getImageData(0, 0, cw, ch), d = img.data;
  const i0 = (y * cw + x) * 4;
  const t = [d[i0], d[i0 + 1], d[i0 + 2]];
  const [r, g, b] = hexToRgb(color);
  if (Math.abs(t[0] - r) + Math.abs(t[1] - g) + Math.abs(t[2] - b) < 10) return;
  const tol = 90;
  const match = (i) => Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) <= tol;
  const seen = new Uint8Array(cw * ch);
  const stack = [x, y];
  while (stack.length) {
    const cy = stack.pop();
    let cx = stack.pop();
    let idx = cy * cw + cx;
    while (cx >= 0 && !seen[idx] && match(idx * 4)) { cx--; idx--; }
    cx++; idx++;
    let up = false, down = false;
    while (cx < cw && !seen[idx] && match(idx * 4)) {
      seen[idx] = 1;
      if (cy > 0) { const u = idx - cw; if (!seen[u] && match(u * 4)) { if (!up) { stack.push(cx, cy - 1); up = true; } } else up = false; }
      if (cy < ch - 1) { const dn = idx + cw; if (!seen[dn] && match(dn * 4)) { if (!down) { stack.push(cx, cy + 1); down = true; } } else down = false; }
      cx++; idx++;
    }
  }
  // 填充区域 + 向外 1px 的抗锯齿边缘按原像素与目标色的差异混合，避免白边和硬边
  for (let i = 0, n = cw * ch; i < n; i++) {
    const p = i * 4;
    if (seen[i]) { d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255; continue; }
    const xx = i % cw;
    if (!((xx > 0 && seen[i - 1] === 1) || (xx < cw - 1 && seen[i + 1] === 1) || (i >= cw && seen[i - cw] === 1) || (i + cw < n && seen[i + cw] === 1))) continue;
    // 边缘像素：越接近原底色，越多地混入填充色
    const diff = Math.abs(d[p] - t[0]) + Math.abs(d[p + 1] - t[1]) + Math.abs(d[p + 2] - t[2]);
    const a = Math.max(0, Math.min(1, 1 - diff / 400)) * 0.85;
    d[p] = d[p] + (r - d[p]) * a; d[p + 1] = d[p + 1] + (g - d[p + 1]) * a; d[p + 2] = d[p + 2] + (b - d[p + 2]) * a;
  }
  ctx.putImageData(img, 0, 0);
}

export function makeBoard(canvas) {
  // 逻辑坐标固定 960×720，后备像素按显示尺寸 × devicePixelRatio 分配，保证高清屏下线条锐利
  const ctx = canvas.getContext("2d", { alpha: false });
  const b = { ops: [], strokes: [] };
  let scale = 1;
  const playQ = [];
  let raf = 0;
  const setT = () => { ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; };
  function sizeTo(cssW) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let pw = Math.round(cssW * dpr);
    pw = Math.max(480, Math.min(pw, 2880));
    if (pw === canvas.width) return false;
    canvas.width = pw; canvas.height = Math.round(pw * H / W);
    scale = canvas.width / W;
    setT();
    return true;
  }
  const clear = () => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore(); };
  const mid = (P, i, j) => [(P[i] + P[j]) / 2, (P[i + 1] + P[j + 1]) / 2];
  const style = (st) => { ctx.strokeStyle = st.c; ctx.fillStyle = st.c; ctx.lineWidth = st.s; ctx.lineCap = "round"; ctx.lineJoin = "round"; };
  const dot = (st, x, y) => { style(st); ctx.beginPath(); ctx.arc(x, y, st.s / 2, 0, Math.PI * 2); ctx.fill(); };

  // 增量绘制：每加入一个点，画一段「中点 → 中点」的二次贝塞尔曲线
  function drawInc(st) {
    const P = st.pts, n = P.length / 2;
    if (n === 1) return dot(st, P[0], P[1]);
    style(st);
    ctx.beginPath();
    if (n === 2) { ctx.moveTo(P[0], P[1]); const m = mid(P, 0, 2); ctx.lineTo(m[0], m[1]); }
    else {
      const i = (n - 3) * 2;
      const m1 = mid(P, i, i + 2), m2 = mid(P, i + 2, i + 4);
      ctx.moveTo(m1[0], m1[1]); ctx.quadraticCurveTo(P[i + 2], P[i + 3], m2[0], m2[1]);
    }
    ctx.stroke();
  }
  function drawTail(st) {
    const P = st.pts, n = P.length / 2;
    if (n < 2) return;
    const i = (n - 2) * 2, m = mid(P, i, i + 2);
    style(st); ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(P[i + 2], P[i + 3]); ctx.stroke();
  }
  // 整笔重绘：一条连续路径，无接缝
  function drawFull(st) {
    const P = st.pts, n = P.length / 2;
    if (!n) return;
    if (n === 1) return dot(st, P[0], P[1]);
    style(st);
    ctx.beginPath(); ctx.moveTo(P[0], P[1]);
    let m = mid(P, 0, 2); ctx.lineTo(m[0], m[1]);
    for (let k = 1; k < n - 1; k++) { const i = k * 2; const m2 = mid(P, i, i + 2); ctx.quadraticCurveTo(P[i], P[i + 1], m2[0], m2[1]); }
    ctx.lineTo(P[(n - 1) * 2], P[(n - 1) * 2 + 1]);
    ctx.stroke();
  }

  function apply(o, render = true) {
    if (o.k === "clear") { b.strokes = []; if (render) clear(); return; }
    if (o.k === "undo") { b.strokes.pop(); if (render) redraw(); return; }
    if (o.k === "fill") { b.strokes.push({ sid: o.id, fill: o }); if (render) floodFill(ctx, o.x, o.y, o.c); return; }
    if (o.k === "line") {
      let st = b.strokes[b.strokes.length - 1];
      if (!st || st.sid !== o.id || st.fill) { st = { sid: o.id, c: o.c, s: o.s, pts: [] }; b.strokes.push(st); }
      for (let i = 0; i + 1 < o.p.length; i += 2) {
        st.pts.push(o.p[i], o.p[i + 1]);
        if (render) drawInc(st);
      }
      if (o.e) { st.done = true; if (render) drawTail(st); }
    }
  }
  function redraw() {
    clear();
    for (const st of b.strokes) st.fill ? floodFill(ctx, st.fill.x, st.fill.y, st.fill.c) : drawFull(st);
  }
  // 远端笔画：拆成逐点队列，用 requestAnimationFrame 平滑回放，避免一顿一顿地跳出来
  function pump() {
    raf = 0;
    let budget = Math.max(3, Math.ceil(playQ.length / 4));
    while (playQ.length && budget-- > 0) apply(playQ.shift());
    if (playQ.length) raf = requestAnimationFrame(pump);
  }
  b.feed = (ops) => {
    for (const o of ops) {
      b.ops.push(o);
      if (o.k === "line" && o.p.length > 2) {
        for (let i = 0; i + 1 < o.p.length; i += 2) {
          const last = i + 2 >= o.p.length;
          playQ.push({ k: "line", id: o.id, c: o.c, s: o.s, p: [o.p[i], o.p[i + 1]], e: last ? o.e : undefined });
        }
      } else playQ.push(o);
    }
    if (!raf) raf = requestAnimationFrame(pump);
  };
  const flushQ = () => { if (raf) cancelAnimationFrame(raf); raf = 0; while (playQ.length) apply(playQ.shift()); };
  b.add = (o) => { flushQ(); b.ops.push(o); apply(o); };
  b.load = (ops) => { playQ.length = 0; b.ops = []; b.strokes = []; for (const o of ops) { b.ops.push(o); apply(o, false); } redraw(); };
  b.reset = () => { playQ.length = 0; b.ops = []; b.strokes = []; clear(); };
  b.resize = (cssW) => { flushQ(); if (sizeTo(cssW)) redraw(); };
  b.hasStrokes = () => b.strokes.length > 0;
  b.toDataURL = () => canvas.toDataURL("image/png");
  sizeTo(W);
  clear();
  return b;
}

