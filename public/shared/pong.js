// Zobo Pong: land the ball in your opponent's zobo cups. Two balls a turn, clear all six to win.
import { randNormal, rand, num } from "./phys.js";
import { turnOf, normalR } from "./rules.js";

export const CUP_R = 24;
// Back row of three, then two, then the front cup nearest the thrower.
export const CUPS = [[132, 110], [180, 110], [228, 110], [156, 152], [204, 152], [180, 194]];
export const THROW_FROM = [180, 500];
const SCATTER = 9;
const MAX_TURNS = 12;

const game = {
  id: "pong",
  title: "Zobo Pong",
  blurb: "Six cups of zobo. Two balls a turn. Clear them first.",
  how: "Pick up the ball and flick it at the cups. Longer flicks go further.",
  W: 360,
  H: 540,

  init(st) {
    // cups[s] = the cups seat s is defending
    st.g = { cups: [[1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1]], turn: 0, balls: 2, turns: [0, 0] };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    const tx = num(move.x, 0, 360) + randNormal(st) * SCATTER;
    const ty = num(move.y, 20, 360) + randNormal(st) * SCATTER;
    const target = g.cups[1 - seat];
    let best = -1;
    let bestD = Infinity;
    target.forEach((alive, i) => {
      if (!alive) return;
      const d = Math.sqrt((tx - CUPS[i][0]) ** 2 + (ty - CUPS[i][1]) ** 2);
      if (d < bestD) { bestD = d; best = i; }
    });
    let cup = -1;
    let rim = false;
    if (best >= 0 && bestD < CUP_R - 7) cup = best;
    else if (best >= 0 && bestD < CUP_R + 3) {
      rim = true;
      if (rand(st) < 0.4) cup = best;
    }
    if (cup >= 0) target[cup] = 0;
    const ev = { type: "ball", seat, x: tx, y: ty, cup, rim };
    g.balls -= 1;
    if (g.balls === 0 || !target.some(Boolean)) {
      g.turns[seat] += 1;
      g.turn = 1 - seat;
      g.balls = 2;
    }
    return [ev];
  },

  cpu(st, seat, R) {
    const target = st.g.cups[1 - seat];
    const alive = target.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
    const [cx, cy] = CUPS[alive[Math.floor(R() * alive.length)]];
    return { x: cx + normalR(R) * 20, y: cy + normalR(R) * 20 };
  },

  result(st) {
    const g = st.g;
    const left = g.cups.map((c) => c.filter(Boolean).length); // cups each seat still has
    const score = [6 - left[1], 6 - left[0]];                  // cups each seat sank
    if (left[1] === 0) return { winner: 0, score };
    if (left[0] === 0) return { winner: 1, score };
    if (g.turns[0] >= MAX_TURNS && g.turns[1] >= MAX_TURNS) {
      return { winner: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1, score };
    }
    return null;
  },
};
export default game;
