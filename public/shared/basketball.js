// Basketball on a Lagos street court: six shots each from moving spots. Threes count three.
import { collidePoint, collideSegment, num, capVec } from "./phys.js";
import { turnOf, normalR } from "./rules.js";

export const W = 360;
export const H = 520;
export const FLOOR = 470;
export const RIM_Y = 230;
export const FRONT = 268;
export const BACK = 316;
export const BOARD_X = 324;
export const BOARD_TOP = 150;
export const BOARD_BOT = 245;
export const BALL_R = 11;
export const RELEASE_Y = 330;
export const SPOTS = [
  { x: 150, pts: 2 }, { x: 90, pts: 3 }, { x: 175, pts: 2 },
  { x: 60, pts: 3 }, { x: 120, pts: 2 }, { x: 40, pts: 3 },
];
export const MAX_V = 1100;
const G = 980;
const DT = 1 / 240;

/** Flies one shot. Pure arithmetic: the phone and the server get the same answer. */
export function simulate(spotX, vx, vy, frames) {
  const b = { x: spotX, y: RELEASE_Y, vx, vy, r: BALL_R };
  let scored = false;
  let touched = false;
  let prevY = b.y;
  let bounces = 0;
  for (let i = 0; i < 1440; i++) {
    b.vy += G * DT;
    b.x += b.vx * DT;
    b.y += b.vy * DT;
    if (collidePoint(b, FRONT, RIM_Y, 2.5, 0.62)) touched = true;
    if (collidePoint(b, BACK, RIM_Y, 2.5, 0.62)) touched = true;
    if (collideSegment(b, BOARD_X, BOARD_TOP, BOARD_X, BOARD_BOT, 0.6)) touched = true;
    if (!scored && prevY < RIM_Y && b.y >= RIM_Y && b.vy > 0 && b.x > FRONT + 2 && b.x < BACK - 2) scored = true;
    if (b.y + b.r > FLOOR) {
      b.y = FLOOR - b.r;
      b.vy = -b.vy * 0.55;
      b.vx *= 0.8;
      bounces += 1;
    }
    prevY = b.y;
    if (frames && i % 4 === 0) frames.push([b.x, b.y]);
    if (bounces >= 2 || b.x < -40 || b.x > W + 40) break;
  }
  return { scored, swish: scored && !touched };
}

const game = {
  id: "basketball",
  title: "Basketball",
  blurb: "Street court shootout. Six shots each, threes from deep.",
  how: "Drag back from the ball and let go to shoot.",
  W,
  H,

  init(st) {
    st.g = { scores: [0, 0], shots: [0, 0], made: [0, 0], turn: 0 };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    const [vx, vy] = capVec(num(move.vx, 0, MAX_V), num(move.vy, -MAX_V, 0), MAX_V);
    const spot = SPOTS[g.shots[seat]];
    const { scored, swish } = simulate(spot.x, vx, vy);
    if (scored) { g.scores[seat] += spot.pts; g.made[seat] += 1; }
    g.shots[seat] += 1;
    g.turn = 1 - seat;
    return [{ type: "shot", seat, spot: spot.x, pts: spot.pts, vx, vy, scored, swish }];
  },

  cpu(st, seat, R) {
    const spot = SPOTS[st.g.shots[seat]];
    // Find the launch angle with the widest margin for error, then shoot it like a person would.
    const dx = (FRONT + BACK) / 2 + 2 - spot.x;
    const up = RELEASE_Y - (RIM_Y - 4);
    let best = { v: 760, th: 1.1, window: -1 };
    for (let deg = 50; deg <= 72; deg += 2) {
      const th = (deg * Math.PI) / 180;
      const denom = 2 * Math.cos(th) ** 2 * (dx * Math.tan(th) - up);
      if (denom <= 0) continue;
      const v = Math.sqrt((G * dx * dx) / denom);
      if (v > MAX_V) continue;
      let window = 0;
      for (const dv of [-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03]) {
        if (simulate(spot.x, v * (1 + dv) * Math.cos(th), -v * (1 + dv) * Math.sin(th)).scored) window++;
      }
      if (window > best.window) best = { v, th, window };
    }
    const v = best.v * (1 + normalR(R) * 0.075);
    const th = best.th + normalR(R) * 0.045;
    return { vx: v * Math.cos(th), vy: -v * Math.sin(th) };
  },

  result(st) {
    const g = st.g;
    if (g.shots[0] < SPOTS.length || g.shots[1] < SPOTS.length) return null;
    const [a, b] = g.scores;
    return { winner: a === b ? null : a > b ? 0 : 1, score: [a, b] };
  },
};
export default game;
