// Darts: race from 201 to exactly zero. Three darts a turn; going below zero is a bust.
import { randNormal, num } from "./phys.js";
import { turnOf, normalR } from "./rules.js";

export const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export const RINGS = { bull: 0.037, outer: 0.094, tripleIn: 0.582, tripleOut: 0.629, doubleIn: 0.953 };
const START = 201;
const TURNS = 10;
const SCATTER = 0.035;

/** Score at board point (x, y), board radius 1, y pointing down. */
export function scoreAt(x, y) {
  const d = Math.sqrt(x * x + y * y);
  if (d > 1) return { value: 0, label: "Miss" };
  if (d <= RINGS.bull) return { value: 50, label: "Bull" };
  if (d <= RINGS.outer) return { value: 25, label: "25" };
  let ang = Math.atan2(x, -y);
  if (ang < 0) ang += 2 * Math.PI;
  const n = ORDER[Math.floor((ang + Math.PI / 20) / (Math.PI / 10)) % 20];
  if (d >= RINGS.tripleIn && d <= RINGS.tripleOut) return { value: n * 3, label: `T${n}` };
  if (d >= RINGS.doubleIn) return { value: n * 2, label: `D${n}` };
  return { value: n, label: String(n) };
}

/** Board point at the middle of number n's ring of radius r. */
function spot(n, r) {
  const a = (ORDER.indexOf(n) * Math.PI) / 10;
  return [r * Math.sin(a), -r * Math.cos(a)];
}

function endTurn(g, seat) {
  g.taken[seat] += 1;
  g.turn = 1 - seat;
  g.left = 3;
  g.turnStart[g.turn] = g.scores[g.turn];
}

const game = {
  id: "darts",
  title: "Darts",
  blurb: "Race from 201 to zero. Don't go under.",
  how: "Hold to aim, let go to throw. The sight moves with your hand.",
  W: 360,
  H: 460,

  init(st) {
    st.g = { scores: [START, START], turnStart: [START, START], taken: [0, 0], left: 3, turn: 0 };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    const ax = num(move.x, -1.4, 1.4);
    const ay = num(move.y, -1.4, 1.4);
    const x = ax + randNormal(st) * SCATTER;
    const y = ay + randNormal(st) * SCATTER;
    const hit = scoreAt(x, y);
    const left = g.scores[seat] - hit.value;
    const ev = { type: "dart", seat, x, y, value: hit.value, label: hit.label, bust: false, out: false };
    if (left < 0) {
      ev.bust = true;
      g.scores[seat] = g.turnStart[seat];
      endTurn(g, seat);
    } else {
      g.scores[seat] = left;
      if (left === 0) ev.out = true;
      else if (--g.left === 0) endTurn(g, seat);
    }
    return [ev];
  },

  cpu(st, seat, R) {
    const rem = st.g.scores[seat];
    let t;
    if (rem > 60) t = spot(20, 0.6055);
    else if (rem === 50) t = [0, 0];
    else if (rem === 25) t = [0, -0.065];
    else if (rem <= 20) t = spot(rem, 0.79);
    else if (rem <= 40 && rem % 2 === 0) t = spot(rem / 2, 0.976);
    else if (rem % 3 === 0) t = spot(rem / 3, 0.6055);
    else t = spot(rem - 20 <= 20 ? rem - 20 : 20, 0.79);
    return { x: t[0] + normalR(R) * 0.07, y: t[1] + normalR(R) * 0.07 };
  },

  result(st) {
    const g = st.g;
    const score = g.scores.slice();
    if (g.scores[0] === 0) return { winner: 0, score };
    if (g.scores[1] === 0) return { winner: 1, score };
    if (g.taken[0] >= TURNS && g.taken[1] >= TURNS) {
      return { winner: score[0] === score[1] ? null : score[0] < score[1] ? 0 : 1, score };
    }
    return null;
  },
};
export default game;
