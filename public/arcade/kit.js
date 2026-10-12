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
  // A see-through layer on top for particles and confetti, so games don't have to redraw for them.
  const fxc = document.createElement("canvas");
  fxc.className = "stage-fx";
  fxc.setAttribute("aria-hidden", "true");
  host.append(fxc);
  const fx = fxc.getContext("2d");
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
    fxc.style.width = canvas.style.width;
    fxc.style.height = canvas.style.height;
    fxc.width = canvas.width;
    fxc.height = canvas.height;
    fx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
    place();
  };
  // Keep the effects layer exactly over the board's drawing area.
  const place = () => {
    fxc.style.left = `${canvas.offsetLeft + canvas.clientLeft}px`;
    fxc.style.top = `${canvas.offsetTop + canvas.clientTop}px`;
  };
  requestAnimationFrame(place);
  fit();
  const ro = new ResizeObserver(() => { fit(); stage.onResize?.(); });
  ro.observe(host);
  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const stage = {
    canvas, ctx, W, H, toLocal, fit, fx, fxCanvas: fxc, parts: [], scale: () => cssScale,
    destroy: () => { ro.disconnect(); stage.stopFx?.(); canvas.remove(); fxc.remove(); },
  };
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

/** A popup word (e.g. "+3", "Bust!") that springs in, floats up and fades, drawn on top of a redraw function. */
export async function popup(stage, redraw, text, x, y, color = DANFO) {
  const ctx = stage.ctx;
  if (!text) return;
  sfx(color === PAPER ? "meh" : color === RED || color === "#ff8f6b" ? "bad" : "pop");
  const size = text.length > 14 ? 24 : 32;
  const half = Math.min(150, text.length * size * 0.27 + 10);
  const cx = Math.max(half + 6, Math.min(stage.W - half - 6, x));
  await tween(900, (p) => {
    redraw();
    const s = p < 0.22 ? easeOutBack(p / 0.22) : 1;
    ctx.save();
    ctx.globalAlpha = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
    ctx.translate(cx, y - easeOutCubic(p) * 28);
    ctx.rotate((1 - Math.min(1, p / 0.22)) * -0.12);
    ctx.scale(s, s);
    label(ctx, text, 0, 0, { size, color, outline: 7 });
    ctx.restore();
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
export async function stepThrough(events, seat, show, { mine = 160, theirs = 560, sound = "place" } = {}) {
  for (const e of events) {
    if (!e.snap) continue;
    if (e.seat !== seat) await sleep(140); // a beat before their move lands, like a thinking pause
    await show(e.snap, e);
    if (sound) { sfx(typeof sound === "function" ? sound(e) : sound); if (e.seat !== seat) haptic(8); }
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

// ---------- feel: easing, sound, haptics, shake, particles ----------

export const easeOutCubic = (p) => 1 - (1 - p) ** 3;
export const easeInCubic = (p) => p * p * p;
export const easeOutBack = (p) => { const c = 1.9; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };
export const easeOutBounce = (p) => {
  const n = 7.5625, d = 2.75;
  if (p < 1 / d) return n * p * p;
  if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
  if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
  return n * (p -= 2.625 / d) * p + 0.984375;
};

let audio = null;
let muted = false;
try { muted = localStorage.getItem("doingz-sound") === "off"; } catch { /* storage blocked */ }
export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem("doingz-sound", m ? "off" : "on"); } catch { /* storage blocked */ }
}
// Browsers only allow sound after a tap, so the audio context starts on the first one.
function ac() {
  if (!audio) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = new AC();
  }
  if (audio.state === "suspended") audio.resume().catch(() => {});
  return audio;
}
if (typeof window !== "undefined") window.addEventListener("pointerdown", () => ac(), { capture: true, passive: true });

function tone(a, { f = 440, f2 = null, dur = 0.12, type = "sine", vol = 0.2, at = 0, attack = 0.005 }) {
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
let noiseBuf = null;
function noise(a, { dur = 0.2, vol = 0.25, f = 1200, f2 = null, q = 1, type = "bandpass", at = 0 }) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.currentTime + at;
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  const fl = a.createBiquadFilter();
  fl.type = type;
  fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(fl).connect(g).connect(a.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const SOUNDS = {
  tap: (a) => tone(a, { f: 1100, dur: 0.04, type: "triangle", vol: 0.12 }),
  click: (a) => { tone(a, { f: 520, f2: 260, dur: 0.07, type: "triangle", vol: 0.22 }); noise(a, { dur: 0.04, f: 3000, vol: 0.1 }); },
  place: (a) => { tone(a, { f: 300, f2: 140, dur: 0.12, type: "sine", vol: 0.35 }); noise(a, { dur: 0.06, f: 900, vol: 0.15 }); },
  whoosh: (a) => noise(a, { dur: 0.28, f: 500, f2: 2600, q: 0.8, vol: 0.22 }),
  thunk: (a) => { tone(a, { f: 160, f2: 70, dur: 0.16, vol: 0.45 }); noise(a, { dur: 0.05, f: 1800, vol: 0.2 }); },
  clank: (a) => { tone(a, { f: 1250, dur: 0.35, type: "triangle", vol: 0.12 }); tone(a, { f: 1890, dur: 0.25, type: "triangle", vol: 0.08 }); },
  swish: (a) => noise(a, { dur: 0.32, f: 5200, f2: 2400, q: 1.6, vol: 0.28 }),
  splash: (a) => { noise(a, { dur: 0.4, f: 1400, f2: 400, q: 0.7, vol: 0.32 }); tone(a, { f: 700, f2: 1400, dur: 0.08, vol: 0.08, at: 0.03 }); },
  boom: (a) => { tone(a, { f: 110, f2: 38, dur: 0.6, vol: 0.6 }); noise(a, { dur: 0.6, f: 600, f2: 120, type: "lowpass", vol: 0.5 }); },
  splat: (a) => { noise(a, { dur: 0.16, f: 900, f2: 300, vol: 0.35 }); tone(a, { f: 220, f2: 110, dur: 0.1, vol: 0.2 }); },
  card: (a) => noise(a, { dur: 0.09, f: 3800, f2: 1800, q: 0.9, vol: 0.2 }),
  slide: (a) => noise(a, { dur: 0.5, f: 700, f2: 300, q: 0.6, vol: 0.12 }),
  pop: (a) => { tone(a, { f: 660, dur: 0.09, type: "triangle", vol: 0.22 }); tone(a, { f: 990, dur: 0.14, type: "triangle", vol: 0.2, at: 0.07 }); },
  meh: (a) => tone(a, { f: 330, f2: 220, dur: 0.18, type: "triangle", vol: 0.16 }),
  bad: (a) => { tone(a, { f: 200, f2: 120, dur: 0.25, type: "sawtooth", vol: 0.1 }); },
  good: (a) => [523, 659, 784].forEach((f, i) => tone(a, { f, dur: 0.12, type: "triangle", vol: 0.2, at: i * 0.06 })),
  turn: (a) => { tone(a, { f: 880, dur: 0.16, vol: 0.16 }); tone(a, { f: 1320, dur: 0.22, vol: 0.14, at: 0.1 }); },
  sent: (a) => { noise(a, { dur: 0.22, f: 1200, f2: 4200, q: 1, vol: 0.12 }); tone(a, { f: 1046, dur: 0.12, vol: 0.1, at: 0.08 }); },
  tick: (a) => tone(a, { f: 1500, dur: 0.03, type: "square", vol: 0.05 }),
  win: (a) => [523, 659, 784, 1046, 1318].forEach((f, i) => tone(a, { f, dur: i === 4 ? 0.5 : 0.14, type: "triangle", vol: 0.22, at: i * 0.09 })),
  lose: (a) => [392, 330, 262].forEach((f, i) => tone(a, { f, dur: i === 2 ? 0.45 : 0.2, type: "triangle", vol: 0.2, at: i * 0.16 })),
  draw: (a) => [440, 440].forEach((f, i) => tone(a, { f, dur: 0.18, type: "triangle", vol: 0.18, at: i * 0.2 })),
};

/** Plays a short synthesised sound: no audio files to load. */
export function sfx(name) {
  if (muted) return;
  const a = audio && audio.state === "running" ? audio : null;
  if (!a || !SOUNDS[name]) return;
  try { SOUNDS[name](a); } catch { /* audio not available */ }
}

/** A note that climbs with n: for letters joining a word, cards landing in a row, and so on. */
export function note(n) {
  if (muted || !audio || audio.state !== "running") return;
  const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
  try { tone(audio, { f: 392 * 2 ** (scale[Math.min(scale.length - 1, n)] / 12), dur: 0.11, type: "triangle", vol: 0.16 }); } catch { /* no audio */ }
}

/** A buzz on phones that support it (Android; iPhones ignore it). */
export function haptic(pattern = 12) {
  if (muted) return;
  try { navigator.vibrate?.(pattern); } catch { /* not allowed */ }
}

/** Shakes the board for a hit, a boom or a bust. */
export function shake(stage, strength = 6, ms = 320) {
  if (reduced() || !stage?.canvas?.animate) return;
  const k = [];
  for (let i = 0; i <= 8; i++) {
    const d = strength * (1 - i / 8);
    k.push({ transform: `translate(${(i % 2 ? -1 : 1) * d}px, ${((i * 7) % 3 - 1) * d * 0.6}px)` });
  }
  stage.canvas.animate(k, { duration: ms, easing: "ease-out" });
  stage.fxCanvas?.animate(k, { duration: ms, easing: "ease-out" });
}

function runFx(stage) {
  if (stage.stopFx) return;
  let last = performance.now();
  stage.stopFx = loop(() => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const { fx, W, H } = stage;
    fx.clearRect(0, 0, W, H);
    stage.parts = stage.parts.filter((p) => (p.life -= dt) > 0);
    for (const p of stage.parts) {
      p.vy += (p.g ?? 600) * dt;
      p.vx *= p.drag ?? 0.99;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      fx.save();
      fx.globalAlpha = Math.min(1, p.life / 0.35);
      fx.translate(p.x, p.y);
      fx.rotate(p.rot);
      fx.fillStyle = p.color;
      if (p.kind === "rect") {
        fx.fillRect(-p.r, -p.r * 0.55, p.r * 2, p.r * 1.1);
        fx.strokeStyle = INK; fx.lineWidth = 1.2; fx.strokeRect(-p.r, -p.r * 0.55, p.r * 2, p.r * 1.1);
      } else if (p.kind === "ring") {
        const k = 1 - p.life / p.max;
        fx.strokeStyle = p.color; fx.lineWidth = 5 * (1 - k) + 1;
        fx.beginPath(); fx.arc(0, 0, p.r + k * p.grow, 0, Math.PI * 2); fx.stroke();
      } else {
        fx.beginPath(); fx.arc(0, 0, p.r, 0, Math.PI * 2); fx.fill();
        fx.strokeStyle = INK; fx.lineWidth = 1.5; fx.stroke();
      }
      fx.restore();
    }
    if (!stage.parts.length) { fx.clearRect(0, 0, W, H); stage.stopFx = null; return false; }
    return true;
  });
}

/** A burst of chunky particles at (x, y), e.g. a splash, a splat or sparks. */
export function burst(stage, x, y, { color = DANFO, colors = null, n = 16, speed = 260, up = 120, g = 700, size = 4.5, ring: withRing = true } = {}) {
  if (reduced() || !stage?.fx) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.65);
    stage.parts.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, g, r: size * (0.6 + Math.random() * 0.7),
      color: colors ? colors[i % colors.length] : color, life: 0.5 + Math.random() * 0.4, rot: 0, spin: 0, kind: "dot", drag: 0.97,
    });
  }
  if (withRing) stage.parts.push({ x, y, vx: 0, vy: 0, g: 0, r: 6, grow: 38, color: PAPER, life: 0.35, max: 0.35, rot: 0, spin: 0, kind: "ring" });
  runFx(stage);
}

/** Confetti over the whole board for a win. */
export function confetti(stage, n = 90) {
  if (reduced() || !stage?.fx) return;
  const colors = [DANFO, GREEN, RED, BLUE, PINK, PAPER, SKY];
  for (let i = 0; i < n; i++) {
    stage.parts.push({
      x: Math.random() * stage.W, y: -20 - Math.random() * 160, vx: (Math.random() - 0.5) * 120, vy: 60 + Math.random() * 140,
      g: 160, r: 4 + Math.random() * 3, color: colors[i % colors.length], life: 2.4 + Math.random() * 1.2,
      rot: Math.random() * 6, spin: (Math.random() - 0.5) * 12, kind: "rect", drag: 0.995,
    });
  }
  runFx(stage);
}

/**
 * GamePigeon-style flick: put your finger on the thing, swipe, let go.
 * grab(x, y) says whether this touch picks it up; release gets the swipe
 * { dx, dy } (whole swipe), { vx, vy } (speed over the last ~90 ms, px a second) and the release point.
 */
export function onFlick(stage, { grab, move, release, cancel }) {
  let trail = null;
  return onDrag(stage, {
    down(x, y) {
      if (!grab(x, y)) return;
      trail = { x0: x, y0: y, pts: [[x, y, performance.now()]] };
      haptic(8);
      sfx("tap");
    },
    move(x, y) {
      if (!trail) return;
      const now = performance.now();
      trail.pts.push([x, y, now]);
      while (trail.pts.length > 2 && now - trail.pts[0][2] > 140) trail.pts.shift();
      move?.(x, y, trail);
    },
    up(x, y) {
      if (!trail) return;
      const t = trail;
      trail = null;
      if (x === null) return cancel?.();
      const now = performance.now();
      const recent = t.pts.filter((p) => now - p[2] <= 90);
      const first = recent.length ? recent[0] : t.pts[0];
      const dt = Math.max(0.016, (now - first[2]) / 1000);
      release({ dx: x - t.x0, dy: y - t.y0, vx: (x - first[0]) / dt, vy: (y - first[1]) / dt, x, y, x0: t.x0, y0: t.y0 });
    },
  });
}

/** Draws the fading streak behind a finger while flicking. */
export function streak(ctx, trail, color = PAPER) {
  if (!trail || trail.pts.length < 2) return;
  const pts = trail.pts;
  for (let i = 1; i < pts.length; i++) {
    ctx.globalAlpha = (i / pts.length) * 0.7;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 + (i / pts.length) * 9;
    ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
