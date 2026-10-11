// Shared physics and randomness for the arcade. Runs in the browser AND on the server.
//
// Rule for everything in this folder: simulations use only + - * / and Math.sqrt.
// Those are exact in IEEE-754 on every JavaScript engine, so an iPhone, an Android phone
// and the server get bit-identical results from the same inputs. Trig, Math.random and
// clocks stay out of simulations: anything random is decided by the server (with the
// seeded rng below) and passed in as data.

// ---------- seeded rng (state is a 32-bit integer stored in the match) ----------

/** Returns [value in [0,1), next state]. */
export function rngNext(s) {
  const n = (s + 0x6d2b79f5) >>> 0;
  let t = n;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, n];
}

/** Uniform [0,1) drawn from st.rng, advancing it. */
export function rand(st) {
  const [v, n] = rngNext(st.rng);
  st.rng = n;
  return v;
}
export const randRange = (st, a, b) => a + (b - a) * rand(st);
export const randInt = (st, a, b) => a + Math.floor(rand(st) * (b - a + 1));
/** Roughly normal, mean 0, sd 1 (sum of uniforms, no transcendental functions). */
export const randNormal = (st) => (rand(st) + rand(st) + rand(st) + rand(st) - 2) * 1.7320508075688772;

// ---------- vectors ----------

export const len = (x, y) => Math.sqrt(x * x + y * y);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const round2 = (v) => Math.round(v * 100) / 100;

/** Scales (x, y) down so its length is at most max. */
export function capVec(x, y, max) {
  const l = len(x, y);
  if (l <= max || l === 0) return [x, y];
  return [(x * max) / l, (y * max) / l];
}

/** Validates a numeric move field from the network. */
export function num(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw Object.assign(new Error("bad_move"), { status: 400, code: "bad_move" });
  return clamp(n, lo, hi);
}

// ---------- collisions ----------

/** Equal-mass circle-circle collision. Mutates a and b ({x,y,vx,vy,r}). Returns true if they touched. */
export function collideCircles(a, b, restitution = 0.92) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const min = a.r + b.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  // separate
  const push = (min - d) / 2;
  a.x -= nx * push; a.y -= ny * push;
  b.x += nx * push; b.y += ny * push;
  // exchange the normal component of velocity
  const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (rel >= 0) return true;
  const j = (-(1 + restitution) * rel) / 2;
  a.vx -= j * nx; a.vy -= j * ny;
  b.vx += j * nx; b.vy += j * ny;
  return true;
}

/** Circle against a fixed point (radius pr), e.g. a basketball rim. Mutates c. */
export function collidePoint(c, px, py, pr, restitution) {
  const dx = c.x - px;
  const dy = c.y - py;
  const min = c.r + pr;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min || d2 === 0) return false;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  c.x = px + nx * min;
  c.y = py + ny * min;
  const vn = c.vx * nx + c.vy * ny;
  if (vn < 0) {
    c.vx -= (1 + restitution) * vn * nx;
    c.vy -= (1 + restitution) * vn * ny;
  }
  return true;
}

/** Circle against a wall segment (x1,y1)-(x2,y2). Mutates c. */
export function collideSegment(c, x1, y1, x2, y2, restitution) {
  const sx = x2 - x1;
  const sy = y2 - y1;
  const l2 = sx * sx + sy * sy;
  let t = l2 === 0 ? 0 : ((c.x - x1) * sx + (c.y - y1) * sy) / l2;
  t = clamp(t, 0, 1);
  return collidePoint(c, x1 + sx * t, y1 + sy * t, 0, restitution);
}

/** True if segments p1-p2 and p3-p4 cross. */
export function segmentsCross(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  const d = (p2x - p1x) * (p4y - p3y) - (p2y - p1y) * (p4x - p3x);
  if (d === 0) return false;
  const u = ((p3x - p1x) * (p4y - p3y) - (p3y - p1y) * (p4x - p3x)) / d;
  const v = ((p3x - p1x) * (p2y - p1y) - (p3y - p1y) * (p2x - p1x)) / d;
  return u > 0 && u < 1 && v > 0 && v < 1;
}

/** Slows a body by rolling friction: a constant deceleration plus a little drag. */
export function rollFriction(b, decel, drag, dt) {
  const s = len(b.vx, b.vy);
  if (s === 0) return;
  const ns = Math.max(0, s - decel * dt) * (1 - drag * dt);
  b.vx = (b.vx / s) * ns;
  b.vy = (b.vy / s) * ns;
}

export const TAU = 6.283185307179586;
