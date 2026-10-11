// Lagos Mini Golf: six holes around the city. Lowest total strokes wins.
import { collideSegment, rollFriction, len, num, capVec, segmentsCross } from "./phys.js";
import { normalR } from "./rules.js";

export const W = 360;
export const H = 540;
export const BALL_R = 6;
export const HOLE_R = 11;
export const MAX_V = 900;
const DT = 1 / 240;
const DECEL = 260;
const DRAG = 0.55;
const BOUNCE = 0.75;
const CAPTURE_SPEED = 420;
const MAX_STROKES = 6; // a seventh means you pick up

const rectWalls = (x, y, w, h) => [[x, y, x + w, y], [x + w, y, x + w, y + h], [x + w, y + h, x, y + h], [x, y + h, x, y]];
const polyWalls = (pts) => pts.map((p, i) => [...p, ...pts[(i + 1) % pts.length]]);

// Each hole: walls (segments), water (rects), blocks (solid rects with a label for drawing),
// and a path of waypoints the computer follows.
export const HOLES = [
  {
    name: "Ikeja Straight", par: 2, start: [180, 455], hole: [180, 105],
    outline: [[40, 40], [320, 40], [320, 500], [40, 500]],
    blocks: [[140, 250, 80, 34, "danfo"]], water: [],
    path: [[95, 270], [180, 105]],
  },
  {
    name: "Third Mainland", par: 2, start: [180, 470], hole: [180, 85],
    outline: [[60, 40], [300, 40], [300, 500], [60, 500]],
    blocks: [], water: [[60, 150, 75, 250], [225, 150, 75, 250]],
    path: [[180, 85]],
  },
  {
    name: "Danfo Park", par: 4, start: [290, 470], hole: [85, 95],
    outline: [[40, 40], [320, 40], [320, 500], [40, 500]],
    blocks: [[40, 200, 150, 38, "danfo"], [170, 330, 150, 38, "danfo"]], water: [],
    path: [[105, 420], [105, 290], [255, 285], [255, 150], [85, 95]],
  },
  {
    name: "Lekki Toll", par: 3, start: [85, 440], hole: [260, 105],
    outline: [[40, 300], [200, 300], [200, 60], [320, 60], [320, 500], [40, 500]],
    blocks: [[200, 196, 36, 12, "gate"], [284, 196, 36, 12, "gate"]], water: [],
    path: [[260, 420], [260, 250], [260, 105]],
  },
  {
    name: "Oshodi Dogleg", par: 4, start: [75, 450], hole: [285, 105],
    outline: [[40, 40], [320, 40], [320, 500], [40, 500]],
    walls: [[40, 370, 240, 370], [120, 210, 320, 210]],
    blocks: [], water: [],
    path: [[285, 440], [285, 290], [80, 290], [80, 140], [285, 105]],
  },
  {
    name: "Eko Atlantic", par: 3, start: [180, 470], hole: [180, 95],
    outline: [[40, 40], [320, 40], [320, 500], [40, 500]],
    blocks: [], water: [[100, 190, 160, 160]],
    path: [[295, 330], [285, 160], [180, 95]],
  },
];

/** All wall segments of a hole. */
export function wallsOf(h) {
  return [...polyWalls(h.outline), ...(h.walls || []), ...h.blocks.flatMap((b) => rectWalls(b[0], b[1], b[2], b[3]))];
}
const WALLS = HOLES.map(wallsOf);
const inRect = (x, y, r) => x > r[0] && x < r[0] + r[2] && y > r[1] && y < r[1] + r[3];

/** Rolls one stroke from (x, y). Returns where it stopped, or holed / splash. */
export function simulate(holeIdx, x, y, vx, vy, frames) {
  const h = HOLES[holeIdx];
  const walls = WALLS[holeIdx];
  const b = { x, y, vx, vy, r: BALL_R };
  for (let i = 0; i < 2400; i++) {
    b.x += b.vx * DT;
    b.y += b.vy * DT;
    for (const w of walls) collideSegment(b, w[0], w[1], w[2], w[3], BOUNCE);
    if (frames && i % 4 === 0) frames.push([b.x, b.y]);
    for (const r of h.water) if (inRect(b.x, b.y, r)) return { x: b.x, y: b.y, splash: true, holed: false };
    rollFriction(b, DECEL, DRAG, DT);
    const sp = len(b.vx, b.vy);
    if (len(b.x - h.hole[0], b.y - h.hole[1]) < HOLE_R && sp < CAPTURE_SPEED) {
      if (frames) frames.push([h.hole[0], h.hole[1]]);
      return { x: h.hole[0], y: h.hole[1], holed: true, splash: false };
    }
    if (sp < 3) break;
  }
  return { x: b.x, y: b.y, holed: false, splash: false };
}

/** How far a ball rolls on open ground from speed s (same friction as the sim). */
function rollDistance(s) {
  const b = { x: 0, y: 0, vx: s, vy: 0 };
  for (let i = 0; i < 4800 && b.vx > 3; i++) {
    b.x += b.vx * DT;
    rollFriction(b, DECEL, DRAG, DT);
  }
  return b.x;
}
function speedFor(dist) {
  let lo = 0;
  let hi = MAX_V;
  for (let k = 0; k < 22; k++) {
    const mid = (lo + hi) / 2;
    if (rollDistance(mid) < dist) lo = mid;
    else hi = mid;
  }
  return hi;
}

function clearLine(holeIdx, x1, y1, x2, y2) {
  const h = HOLES[holeIdx];
  for (const w of WALLS[holeIdx]) {
    // test the ball's two edges as well as its centre
    for (const off of [-BALL_R, 0, BALL_R]) {
      const dx = y2 - y1;
      const dy = -(x2 - x1);
      const l = len(dx, dy) || 1;
      const ox = (dx / l) * off;
      const oy = (dy / l) * off;
      if (segmentsCross(x1 + ox, y1 + oy, x2 + ox, y2 + oy, w[0], w[1], w[2], w[3])) return false;
    }
  }
  const steps = Math.ceil(len(x2 - x1, y2 - y1) / 4);
  for (let i = 1; i < steps; i++) {
    const px = x1 + ((x2 - x1) * i) / steps;
    const py = y1 + ((y2 - y1) * i) / steps;
    for (const r of h.water) if (inRect(px, py, [r[0] - 8, r[1] - 8, r[2] + 16, r[3] + 16])) return false;
  }
  return true;
}

const game = {
  id: "golf",
  title: "Lagos Mini Golf",
  blurb: "Six holes across Lagos, from Ikeja to Eko Atlantic.",
  how: "Drag back from the ball and let go. Water costs a stroke.",
  W,
  H,

  init(st) {
    st.g = { hole: 0, turn: 0, strokes: [[], []], stroke: 0, ball: HOLES[0].start.slice() };
  },

  toMove: (st) => (game.result(st) ? [] : [st.g.turn]),

  apply(st, seat, move) {
    const g = st.g;
    const [vx, vy] = capVec(num(move.vx, -MAX_V, MAX_V), num(move.vy, -MAX_V, MAX_V), MAX_V);
    const from = g.ball.slice();
    const r = simulate(g.hole, from[0], from[1], vx, vy);
    g.stroke += r.splash ? 2 : 1;
    const ev = { type: "putt", seat, hole: g.hole, from, vx, vy, ...r, stroke: g.stroke, done: false };
    if (r.splash) g.ball = from;
    else g.ball = [r.x, r.y];
    if (r.holed || g.stroke >= MAX_STROKES) {
      const count = r.holed ? Math.min(g.stroke, MAX_STROKES + 1) : MAX_STROKES + 1;
      g.strokes[seat][g.hole] = count;
      ev.done = true;
      ev.count = count;
      if (seat === 0) {
        g.turn = 1;
      } else {
        g.hole += 1;
        g.turn = 0;
      }
      g.stroke = 0;
      g.ball = g.hole < HOLES.length ? HOLES[g.hole].start.slice() : from;
    }
    return [ev];
  },

  cpu(st, seat, R) {
    const g = st.g;
    const h = HOLES[g.hole];
    const [bx, by] = g.ball;
    let target = h.path[0];
    let last = false;
    // Furthest waypoint (ending at the hole) the ball can see from here.
    for (let i = h.path.length - 1; i >= 0; i--) {
      if (clearLine(g.hole, bx, by, h.path[i][0], h.path[i][1])) {
        target = h.path[i];
        last = i === h.path.length - 1;
        break;
      }
    }
    const dx = target[0] - bx;
    const dy = target[1] - by;
    const d = len(dx, dy) || 1;
    const s = speedFor(last ? d + 30 : d) * (1 + normalR(R) * 0.06);
    const a = normalR(R) * (last ? 0.035 : 0.05);
    const ux = dx / d;
    const uy = dy / d;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    return { vx: (ux * c - uy * sn) * s, vy: (ux * sn + uy * c) * s };
  },

  result(st) {
    const g = st.g;
    if (g.hole < HOLES.length) return null;
    const score = g.strokes.map((s) => s.reduce((a, b) => a + b, 0));
    return { winner: score[0] === score[1] ? null : score[0] < score[1] ? 0 : 1, score };
  },
};
export default game;
