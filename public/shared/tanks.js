// Tanks over Olumo Rock hills: take turns lobbing shells, wind changes every shot.
import { len, num, capVec, rand, randRange } from "./phys.js";
import { turnOf, normalR } from "./rules.js";

export const W = 360;
export const H = 480;
export const STEP = 4;                 // terrain sample spacing
export const SAMPLES = W / STEP + 1;   // 91
export const MAX_V = 520;
export const BLAST = 30;
const G = 260;
const DT = 1 / 120;
const MAX_SHOTS = 12;
const GROUND_FLOOR = 470;

/** Ground height (y, pointing down) at x, by straight lines between samples. */
export function groundAt(h, x) {
  if (x <= 0) return h[0];
  if (x >= W) return h[SAMPLES - 1];
  const i = Math.floor(x / STEP);
  const t = (x - i * STEP) / STEP;
  return h[i] * (1 - t) + h[i + 1] * t;
}

export const muzzle = (tank) => [tank.x, tank.y - 16];

/** Flies a shell. Returns where it burst (or null if it left the screen). Pure arithmetic. */
export function simulate(h, tanks, shooter, vx, vy, wind, frames) {
  let [x, y] = muzzle(tanks[shooter]);
  for (let i = 0; i < 1800; i++) {
    vx += wind * DT;
    vy += G * DT;
    x += vx * DT;
    y += vy * DT;
    if (frames && i % 2 === 0) frames.push([x, y]);
    if (x < -30 || x > W + 30) return null;
    for (let s = 0; s < tanks.length; s++) {
      if (i < 10 && s === shooter) continue; // leave our own barrel first
      if (len(x - tanks[s].x, y - (tanks[s].y - 6)) < 12) return { x, y, direct: s };
    }
    if (y >= groundAt(h, x)) return { x, y: groundAt(h, x), direct: -1 };
  }
  return null;
}

/** Digs the crater and works out the damage. Mutates h and tanks; returns damage per tank. */
export function blast(h, tanks, bx, by) {
  for (let i = 0; i < SAMPLES; i++) {
    const dx = i * STEP - bx;
    if (dx * dx >= BLAST * BLAST) continue;
    const bottom = by + Math.sqrt(BLAST * BLAST - dx * dx);
    if (h[i] < bottom) h[i] = Math.min(GROUND_FLOOR, bottom);
  }
  const dmg = tanks.map((t) => {
    const d = len(t.x - bx, t.y - 6 - by);
    if (d < 12) return 45;
    if (d < 42) return Math.round(35 * (1 - (d - 12) / 30));
    return 0;
  });
  tanks.forEach((t, s) => {
    t.hp = Math.max(0, t.hp - dmg[s]);
    t.y = groundAt(h, t.x);
  });
  return dmg;
}

function makeTerrain(st) {
  // Rolling hills with a rock in the middle; flattened under each tank.
  const p1 = rand(st) * 6.283, p2 = rand(st) * 6.283, a1 = randRange(st, 25, 45), a2 = randRange(st, 10, 22);
  const peak = randRange(st, 60, 110);
  const h = [];
  for (let i = 0; i < SAMPLES; i++) {
    const x = i * STEP;
    const rock = peak * Math.max(0, 1 - Math.abs(x - 180) / 90);
    let y = 360 - a1 * Math.sin(x / 70 + p1) - a2 * Math.sin(x / 23 + p2) - rock;
    if (x < 70 || x > 290) y = 380 - a2 * 0.4 * Math.sin(x / 23 + p2);
    h.push(Math.round(Math.min(440, Math.max(170, y)) * 100) / 100);
  }
  return h;
}
const newWind = (st) => Math.round(randRange(st, -55, 55));

const game = {
  id: "tanks",
  title: "Tanks",
  blurb: "Lob shells over the hills. Wind changes every shot.",
  how: "Drag from your tank to set the angle and power, let go to fire.",
  W,
  H,

  init(st) {
    const h = makeTerrain(st);
    const tanks = [{ x: 44, hp: 100 }, { x: 316, hp: 100 }].map((t) => ({ ...t, y: groundAt(h, t.x) }));
    st.g = { h, tanks, turn: 0, wind: newWind(st), shots: [0, 0] };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    const [vx, vy] = capVec(num(move.vx, -MAX_V, MAX_V), num(move.vy, -MAX_V, 40), MAX_V);
    const wind = g.wind;
    const before = { h: g.h.slice(), tanks: g.tanks.map((t) => ({ ...t })) };
    const hit = simulate(g.h, g.tanks, seat, vx, vy, wind);
    const dmg = hit ? blast(g.h, g.tanks, hit.x, hit.y) : [0, 0];
    g.shots[seat] += 1;
    g.turn = 1 - seat;
    g.wind = newWind(st);
    return [{ type: "shell", seat, vx, vy, wind, before, hit, dmg, nextWind: g.wind }];
  },

  cpu(st, seat, R) {
    const g = st.g;
    const target = g.tanks[1 - seat];
    const dir = target.x > g.tanks[seat].x ? 1 : -1;
    let best = null;
    for (let deg = 20; deg <= 78; deg += 2.5) {
      const th = (deg * Math.PI) / 180;
      for (let v = 150; v <= MAX_V; v += 10) {
        const hit = simulate(g.h, g.tanks, seat, dir * v * Math.cos(th), -v * Math.sin(th), g.wind);
        if (!hit) continue;
        const miss = len(hit.x - target.x, hit.y - target.y);
        if (!best || miss < best.miss) best = { miss, th, v };
      }
    }
    if (!best) best = { th: 0.8, v: 330 };
    // Early shots are rough and tighten up as the computer "learns" the range, like a person.
    const rough = Math.max(0.7, 2.8 - 0.4 * g.shots[seat]);
    const th = best.th + normalR(R) * 0.03 * rough;
    const v = best.v * (1 + normalR(R) * 0.045 * rough);
    return { vx: dir * v * Math.cos(th), vy: -v * Math.sin(th) };
  },

  result(st) {
    const g = st.g;
    const score = g.tanks.map((t) => t.hp);
    const dead = score.map((hp) => hp <= 0);
    if (dead[0] && dead[1]) return { winner: null, score };
    if (dead[0]) return { winner: 1, score };
    if (dead[1]) return { winner: 0, score };
    if (g.shots[0] >= MAX_SHOTS && g.shots[1] >= MAX_SHOTS) {
      return { winner: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1, score };
    }
    return null;
  },
};
export default game;
