// Shuffleboard with bottle tops: flick four covers each per round into the 1, 2 and 3 zones.
// Covers can knock each other off. Three rounds, highest total wins.
import { collideCircles, rollFriction, len, num, capVec } from "./phys.js";
import { normalR } from "./rules.js";

export const W = 360;
export const H = 560;
export const LEFT = 50;
export const RIGHT = 310;
export const END = 40;
export const ZONES = [{ y0: 40, y1: 100, pts: 3 }, { y0: 100, y1: 170, pts: 2 }, { y0: 170, y1: 250, pts: 1 }];
export const START = [180, 500];
export const PUCK_R = 15;
export const MAX_V = 950;
const MIN_V = 380;
const DT = 1 / 240;
const DECEL = 220;
const DRAG = 0.3;
const ROUNDS = 3;
const PER_ROUND = 4;

export const zonePoints = (y) => (ZONES.find((z) => y >= z.y0 && y < z.y1) || { pts: 0 }).pts;

/** Slides every cover until all stop. Covers that leave the board fall off. Mutates `pucks`. */
export function simulate(pucks, frames) {
  const live = pucks.filter((p) => p.alive);
  for (let i = 0; i < 2400; i++) {
    let moving = false;
    for (const p of live) {
      if (!p.alive) continue;
      p.x += p.vx * DT;
      p.y += p.vy * DT;
    }
    for (let a = 0; a < live.length; a++) {
      for (let b = a + 1; b < live.length; b++) {
        if (live[a].alive && live[b].alive) collideCircles(live[a], live[b], 0.9);
      }
    }
    for (const p of live) {
      if (!p.alive) continue;
      if (p.x < LEFT || p.x > RIGHT || p.y < END) { p.alive = false; p.vx = 0; p.vy = 0; continue; }
      rollFriction(p, DECEL, DRAG, DT);
      if (len(p.vx, p.vy) < 2) { p.vx = 0; p.vy = 0; } else moving = true;
    }
    if (frames && i % 4 === 0) frames.push(pucks.map((p) => [p.x, p.y, p.alive ? 1 : 0]));
    if (!moving) break;
  }
  if (frames) frames.push(pucks.map((p) => [p.x, p.y, p.alive ? 1 : 0]));
  for (const p of pucks) { p.vx = 0; p.vy = 0; }
  return pucks;
}

const cleanVelocity = (vx, vy) => {
  let [x, y] = capVec(num(vx, -MAX_V, MAX_V), num(vy, -MAX_V, -40), MAX_V);
  const s = len(x, y);
  if (s < MIN_V) { x = (x / s) * MIN_V; y = (y / s) * MIN_V; }
  return [x, y];
};

function rollDistance(s) {
  const b = { vx: s, vy: 0, x: 0 };
  for (let i = 0; i < 4800 && b.vx > 2; i++) { b.x += b.vx * DT; rollFriction(b, DECEL, DRAG, DT); }
  return b.x;
}
function speedFor(dist) {
  let lo = 0, hi = MAX_V;
  for (let k = 0; k < 22; k++) {
    const mid = (lo + hi) / 2;
    if (rollDistance(mid) < dist) lo = mid; else hi = mid;
  }
  return hi;
}

const game = {
  id: "shuffle",
  title: "Shuffleboard",
  blurb: "Flick bottle covers into the zones. Knock theirs off.",
  how: "Put your finger on the cover and swipe it up the board. Too hard and it falls off.",
  W,
  H,

  init(st) {
    st.g = { round: 0, turn: 0, thrown: [0, 0], pucks: [], scores: [0, 0], rounds: [] };
  },

  toMove: (st) => (game.result(st) ? [] : [st.g.turn]),

  apply(st, seat, move) {
    const g = st.g;
    const [vx, vy] = cleanVelocity(move.vx, move.vy);
    const before = g.pucks.map((p) => ({ ...p }));
    g.pucks.push({ seat, x: START[0], y: START[1], vx, vy, r: PUCK_R, alive: true });
    simulate(g.pucks);
    g.thrown[seat] += 1;
    const ev = { type: "flick", seat, vx, vy, before, after: g.pucks.map((p) => ({ ...p })), roundOver: false };
    if (g.thrown[0] >= PER_ROUND && g.thrown[1] >= PER_ROUND) {
      const pts = [0, 0];
      for (const p of g.pucks) if (p.alive) pts[p.seat] += zonePoints(p.y);
      g.scores[0] += pts[0];
      g.scores[1] += pts[1];
      g.rounds.push(pts);
      ev.roundOver = true;
      ev.roundPoints = pts;
      g.round += 1;
      g.pucks = [];
      g.thrown = [0, 0];
      g.turn = g.round % 2;
    } else {
      g.turn = g.thrown[1 - seat] < PER_ROUND ? 1 - seat : seat;
    }
    return [ev];
  },

  cpu(st, seat, R) {
    const g = st.g;
    // Knock out the opponent's best-placed cover sometimes, otherwise draw into the 3 zone.
    const theirs = g.pucks.filter((p) => p.alive && p.seat !== seat && zonePoints(p.y) >= 2);
    let tx = 180 + normalR(R) * 18;
    let ty = 68;
    let extra = 0;
    if (theirs.length && R() < 0.6) {
      const t = theirs.sort((a, b) => a.y - b.y)[0];
      tx = t.x;
      ty = t.y;
      extra = 140; // hit it hard enough to carry it off the end
    }
    const dx = tx - START[0];
    const dy = ty - START[1];
    const d = len(dx, dy);
    const s = Math.min(MAX_V, speedFor(d + extra)) * (1 + normalR(R) * 0.035);
    const a = normalR(R) * 0.022;
    const ux = dx / d, uy = dy / d, c = Math.cos(a), sn = Math.sin(a);
    return { vx: (ux * c - uy * sn) * s, vy: (ux * sn + uy * c) * s };
  },

  result(st) {
    const g = st.g;
    if (g.round < ROUNDS) return null;
    const [a, b] = g.scores;
    return { winner: a === b ? null : a > b ? 0 : 1, score: [a, b] };
  },
};
export default game;
