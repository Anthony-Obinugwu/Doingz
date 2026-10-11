// Lagoon Knockout: three tokens each on a raft. Both sides aim at once, then everything slides.
// Fall off the raft and you're out. The raft shrinks every round.
import { collideCircles, rollFriction, len, num, capVec } from "./phys.js";
import { bad, normalR } from "./rules.js";

export const W = 360;
export const H = 520;
export const CX = 180;
export const CY = 260;
export const START_HALF = 150;
export const SHRINK = 14;
export const MIN_HALF = 70;
export const PIECE_R = 17;
export const MAX_V = 650;
const DT = 1 / 240;
const DECEL = 300;
const DRAG = 0.4;
const MAX_ROUNDS = 10;

const START = [
  [[120, 350], [180, 372], [240, 350]],
  [[120, 170], [180, 148], [240, 170]],
];

export const onRaft = (p, half) => Math.abs(p.x - CX) <= half && Math.abs(p.y - CY) <= half;

/** Slides all pieces at once. Mutates pieces; returns them. */
export function simulate(pieces, half, frames) {
  for (let i = 0; i < 2400; i++) {
    let moving = false;
    for (const p of pieces) {
      if (!p.alive) continue;
      p.x += p.vx * DT;
      p.y += p.vy * DT;
    }
    for (let a = 0; a < pieces.length; a++) {
      for (let b = a + 1; b < pieces.length; b++) {
        if (pieces[a].alive && pieces[b].alive) collideCircles(pieces[a], pieces[b], 0.95);
      }
    }
    for (const p of pieces) {
      if (!p.alive) continue;
      if (!onRaft(p, half)) { p.alive = false; continue; }
      rollFriction(p, DECEL, DRAG, DT);
      if (len(p.vx, p.vy) < 2) { p.vx = 0; p.vy = 0; } else moving = true;
    }
    if (frames && i % 4 === 0) frames.push(pieces.map((p) => [p.x, p.y, p.alive ? 1 : 0]));
    if (!moving) break;
  }
  for (const p of pieces) { p.vx = 0; p.vy = 0; }
  if (frames) frames.push(pieces.map((p) => [p.x, p.y, p.alive ? 1 : 0]));
  return pieces;
}

function stopDistance(s) {
  const b = { vx: s, vy: 0, x: 0 };
  for (let i = 0; i < 4800 && b.vx > 2; i++) { b.x += b.vx * DT; rollFriction(b, DECEL, DRAG, DT); }
  return b.x;
}
function speedFor(dist) {
  let lo = 0, hi = MAX_V;
  for (let k = 0; k < 20; k++) {
    const mid = (lo + hi) / 2;
    if (stopDistance(mid) < dist) lo = mid; else hi = mid;
  }
  return hi;
}

const alive = (g, seat) => g.pieces.filter((p) => p.seat === seat && p.alive).length;

const game = {
  id: "knockout",
  title: "Knockout",
  blurb: "Tokens on a lagoon raft. Push theirs into the water.",
  how: "Drag from each of your tokens to aim it, then press Go.",
  W,
  H,

  init(st) {
    const pieces = [];
    for (const seat of [0, 1]) START[seat].forEach(([x, y]) => pieces.push({ seat, x, y, vx: 0, vy: 0, r: PIECE_R, alive: true }));
    st.g = { pieces, half: START_HALF, round: 0, pending: [null, null] };
  },

  toMove(st) {
    if (game.result(st)) return [];
    return [0, 1].filter((s) => st.g.pending[s] === null);
  },

  apply(st, seat, move) {
    const g = st.g;
    if (g.pending[seat] !== null) bad("already_moved", "Waiting for the other side", 409);
    const shots = [];
    for (const s of Array.isArray(move.shots) ? move.shots.slice(0, 3) : []) {
      const i = Number(s.i);
      const p = g.pieces[i];
      if (!p || p.seat !== seat || !p.alive) bad("bad_move", "That isn't your token");
      const [vx, vy] = capVec(num(s.vx, -MAX_V, MAX_V), num(s.vy, -MAX_V, MAX_V), MAX_V);
      shots.push({ i, vx, vy });
    }
    g.pending[seat] = shots;
    if (g.pending.some((p) => p === null)) return [{ type: "aimed", seat }];

    // Both sides have aimed: slide everything together.
    const before = g.pieces.map((p) => ({ ...p }));
    const halfBefore = g.half;
    for (const list of g.pending) for (const s of list) { g.pieces[s.i].vx = s.vx; g.pieces[s.i].vy = s.vy; }
    simulate(g.pieces, g.half);
    const afterSlide = g.pieces.map((p) => ({ ...p }));
    g.half = Math.max(MIN_HALF, g.half - SHRINK);
    for (const p of g.pieces) if (p.alive && !onRaft(p, g.half)) p.alive = false;
    g.round += 1;
    const ev = { type: "round", shots: g.pending, before, halfBefore, afterSlide, after: g.pieces.map((p) => ({ ...p })), half: g.half, round: g.round };
    g.pending = [null, null];
    return [ev];
  },

  cpu(st, seat, R) {
    const g = st.g;
    const mine = g.pieces.map((p, i) => ({ p, i })).filter(({ p }) => p.seat === seat && p.alive);
    const theirs = g.pieces.filter((p) => p.seat !== seat && p.alive);
    const shots = [];
    for (const { p, i } of mine) {
      if (!theirs.length) break;
      const t = theirs.reduce((a, b) => (len(b.x - p.x, b.y - p.y) < len(a.x - p.x, a.y - p.y) ? b : a));
      const dx = t.x - p.x, dy = t.y - p.y, d = len(dx, dy) || 1;
      let s = speedFor(d + 60) * (1 + normalR(R) * 0.08);
      // Don't launch ourselves off: limit the distance to what stays on the shrinking raft.
      const ux = dx / d, uy = dy / d;
      const room = g.half - SHRINK;
      for (let k = 0; k < 12; k++) {
        const stop = stopDistance(s);
        const ex = p.x + ux * stop, ey = p.y + uy * stop;
        if (Math.abs(ex - CX) < room - 4 && Math.abs(ey - CY) < room - 4) break;
        s *= 0.85;
      }
      const a = normalR(R) * 0.07, c = Math.cos(a), sn = Math.sin(a);
      shots.push({ i, vx: (ux * c - uy * sn) * s, vy: (ux * sn + uy * c) * s });
    }
    return { shots };
  },

  result(st) {
    const g = st.g;
    const a = alive(g, 0), b = alive(g, 1);
    const score = [a, b];
    if (a === 0 && b === 0) return { winner: null, score };
    if (a === 0) return { winner: 1, score };
    if (b === 0) return { winner: 0, score };
    if (g.round >= MAX_ROUNDS) return { winner: a === b ? null : a > b ? 0 : 1, score };
    return null;
  },

  // The phones only learn the other side's aim once the round has played out.
  view(st, seat) {
    const g = st.g;
    return { ...g, pending: g.pending.map((p, s) => (s === seat ? p : p === null ? null : "ready")) };
  },
};
export default game;
