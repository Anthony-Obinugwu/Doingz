// Canvas kit for the arcade: a crisp, scaled stage, pointer input, and neo-brutalist drawing
// (flat colour, thick ink outlines, hard offset shadows).

export const INK = "#1d1b16";
export const PAPER = "#fffdf4";
export const DANFO = "#ffc81e";
export const GREEN = "#0f8a46";
export const LEAF = "#3fa34d";
export const BLUE = "#2a62d4";
export const SKY = "#8fd3ff";
export const RED = "#d9412b";
export const PINK = "#ff8fb1";
export const PURPLE = "#45206b";
export const SAND = "#e9c98f";
export const WOOD = "#c98b4b";
export const GREY = "#7a7363";
export const WATER = "#3d8bfd";

/** A canvas that keeps a fixed logical size (W x H) and scales crisply to fit its box. */
export function makeStage(host, W, H) {
  const canvas = document.createElement("canvas");
  canvas.className = "stage";
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  let cssScale = 1;
  const fit = () => {
    const box = host.getBoundingClientRect();
    const s = Math.max(0.2, Math.min(box.width / W, box.height / H));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    cssScale = s;
    canvas.style.width = `${W * s}px`;
    canvas.style.height = `${H * s}px`;
    canvas.width = Math.round(W * s * dpr);
    canvas.height = Math.round(H * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  };
  fit();
  const ro = new ResizeObserver(() => { fit(); stage.onResize?.(); });
  ro.observe(host);
  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const stage = { canvas, ctx, W, H, toLocal, fit, scale: () => cssScale, destroy: () => { ro.disconnect(); canvas.remove(); } };
  return stage;
}

/** Pointer drag on the stage, in logical coordinates. Returns a function that removes it. */
export function onDrag(stage, { down, move, up }) {
  const c = stage.canvas;
  let active = null;
  const d = (e) => {
    if (active !== null) return;
    active = e.pointerId;
    c.setPointerCapture(e.pointerId);
    e.preventDefault();
    down?.(...stage.toLocal(e), e);
  };
  const m = (e) => { if (e.pointerId === active) { e.preventDefault(); move?.(...stage.toLocal(e), e); } };
  const u = (e) => {
    if (e.pointerId !== active) return;
    active = null;
    up?.(...stage.toLocal(e), e);
  };
  const cancel = (e) => { if (e.pointerId === active) { active = null; up?.(null, null, e); } };
  c.addEventListener("pointerdown", d);
  c.addEventListener("pointermove", m);
  c.addEventListener("pointerup", u);
  c.addEventListener("pointercancel", cancel);
  return () => {
    c.removeEventListener("pointerdown", d);
    c.removeEventListener("pointermove", m);
    c.removeEventListener("pointerup", u);
    c.removeEventListener("pointercancel", cancel);
  };
}

/** requestAnimationFrame loop; fn(t) returns false to stop. Returns stop(). */
export function loop(fn) {
  let id = 0;
  let on = true;
  const t0 = performance.now();
  const tick = (now) => {
    if (!on) return;
    if (fn(Math.max(0, now - t0)) === false) { on = false; return; }
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => { on = false; cancelAnimationFrame(id); };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Plays recorded frames at 60 a second, calling draw(frame, index). Resolves when done. */
export function playFrames(frames, draw, speed = 1) {
  if (!frames.length) return Promise.resolve();
  if (reduced()) { draw(frames[frames.length - 1], frames.length - 1); return Promise.resolve(); }
  return new Promise((resolve) => {
    loop((t) => {
      const i = Math.min(frames.length - 1, Math.floor((t / 1000) * 60 * speed));
      draw(frames[i], i);
      if (i >= frames.length - 1) { resolve(); return false; }
      return true;
    });
  });
}

/** Tweens 0→1 over ms, calling draw(p). */
export function tween(ms, draw) {
  if (reduced()) { draw(1); return Promise.resolve(); }
  return new Promise((resolve) => {
    loop((t) => {
      const p = Math.min(1, t / ms);
      draw(p);
      if (p >= 1) { resolve(); return false; }
      return true;
    });
  });
}

// ---------- neo-brutalist drawing ----------

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

/** A flat slab with an ink outline and a hard shadow. */
export function slab(ctx, x, y, w, h, fill, { r = 6, shadow = 4, line = 3 } = {}) {
  if (shadow) { ctx.fillStyle = INK; rrect(ctx, x + shadow, y + shadow, w, h, r); ctx.fill(); }
  ctx.fillStyle = fill;
  rrect(ctx, x, y, w, h, r);
  ctx.fill();
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.stroke(); }
}

export function disc(ctx, x, y, r, fill, { shadow = 3, line = 3 } = {}) {
  if (shadow) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x + shadow, y + shadow, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = INK; ctx.stroke(); }
}

export function label(ctx, text, x, y, { size = 18, color = INK, align = "center", weight = 900, base = "middle", outline = 0 } = {}) {
  ctx.font = `${weight} ${size}px Archivo, system-ui, sans-serif`;
  if ("fontStretch" in ctx) ctx.fontStretch = "condensed";
  ctx.textAlign = align;
  ctx.textBaseline = base;
  if (outline) { ctx.lineWidth = outline; ctx.strokeStyle = INK; ctx.strokeText(text, x, y); }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export function arrow(ctx, x1, y1, x2, y2, color = INK, width = 5) {
  const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy);
  if (l < 2) return;
  const ux = dx / l, uy = dy / l, head = Math.min(16, l * 0.4);
  ctx.strokeStyle = INK;
  ctx.lineWidth = width + 4;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - ux * head * 0.6, y2 - uy * head * 0.6); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - ux * head - uy * head * 0.6, y2 - uy * head + ux * head * 0.6);
  ctx.lineTo(x2 - ux * head + uy * head * 0.6, y2 - uy * head - ux * head * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

/** A popup word (e.g. "+3", "Bust!") that rises and fades, drawn on top of a redraw function. */
export async function popup(stage, redraw, text, x, y, color = DANFO) {
  const ctx = stage.ctx;
  await tween(700, (p) => {
    redraw();
    ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    label(ctx, text, x, y - p * 26, { size: 30, color, outline: 6 });
    ctx.globalAlpha = 1;
  });
  redraw();
}

/** Simple dotted guide line through points. */
export function dots(ctx, pts, color = INK) {
  ctx.fillStyle = color;
  pts.forEach(([x, y], i) => {
    ctx.globalAlpha = 1 - i / (pts.length + 2);
    ctx.beginPath();
    ctx.arc(x, y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ---------- turn-based helpers ----------

/** Shows each move's snapshot in turn: quick for yours, slower for the computer's so you can follow. */
export async function stepThrough(events, seat, show, { mine = 160, theirs = 560 } = {}) {
  for (const e of events) {
    if (!e.snap) continue;
    await show(e.snap, e);
    await sleep(e.seat === seat ? mine : theirs);
  }
}

/** Grid cell under a point, or -1. */
export function cellAt(x, y, x0, y0, size, cols, rows) {
  const c = Math.floor((x - x0) / size), r = Math.floor((y - y0) / size);
  return c >= 0 && c < cols && r >= 0 && r < rows ? r * cols + c : -1;
}

/** Tap (pointerdown + pointerup without much movement) on the stage, in logical coordinates. */
export function onTap(stage, fn) {
  let start = null;
  const d = (e) => { start = stage.toLocal(e); };
  const u = (e) => {
    if (!start) return;
    const [x, y] = stage.toLocal(e);
    if (Math.hypot(x - start[0], y - start[1]) < 18) fn(x, y);
    start = null;
  };
  stage.canvas.addEventListener("pointerdown", d);
  stage.canvas.addEventListener("pointerup", u);
  return () => { stage.canvas.removeEventListener("pointerdown", d); stage.canvas.removeEventListener("pointerup", u); };
}

/** A ring highlight around a cell. */
export function ring(ctx, x, y, r, color = DANFO, width = 4) {
  ctx.lineWidth = width + 3; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
}
