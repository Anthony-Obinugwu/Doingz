// Reversi: trap your opponent's discs between yours to flip them. Most discs at the end wins.
import { bad } from "./rules.js";

export const N = 8;
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];

/** Discs flipped by playing p at i (empty array if the move is illegal). */
export function flips(b, i, p) {
  if (b[i]) return [];
  const r0 = Math.floor(i / N), c0 = i % N, q = 3 - p, out = [];
  for (const [dr, dc] of DIRS) {
    const line = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === q) { line.push(r * N + c); r += dr; c += dc; }
    if (line.length && r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === p) out.push(...line);
  }
  return out;
}
export const movesFor = (b, p) => b.map((_, i) => i).filter((i) => flips(b, i, p).length);
const count = (b, p) => b.filter((v) => v === p).length;

function evaluate(b, me) {
  const them = 3 - me;
  let s = 0;
  for (let i = 0; i < 64; i++) s += b[i] === me ? WEIGHTS[i] : b[i] === them ? -WEIGHTS[i] : 0;
  return s + 4 * (movesFor(b, me).length - movesFor(b, them).length);
}

function search(b, depth, alpha, beta, me, cur) {
  const moves = movesFor(b, cur);
  if (depth === 0 || (!moves.length && !movesFor(b, 3 - cur).length)) {
    if (!moves.length && !movesFor(b, 3 - cur).length) return (count(b, me) - count(b, 3 - me)) * 1000;
    return evaluate(b, me);
  }
  if (!moves.length) return search(b, depth - 1, alpha, beta, me, 3 - cur);
  const maxing = cur === me;
  let best = maxing ? -Infinity : Infinity;
  for (const i of moves) {
    const f = flips(b, i, cur);
    b[i] = cur; f.forEach((j) => (b[j] = cur));
    const v = search(b, depth - 1, alpha, beta, me, 3 - cur);
    b[i] = 0; f.forEach((j) => (b[j] = 3 - cur));
    if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return best;
}

const game = {
  id: "reversi",
  title: "Reversi",
  blurb: "Flip their discs by trapping them between yours.",
  how: "Tap a glowing square. Corners are gold.",
  W: 360,
  H: 400,
  snapshots: true,

  init(st) {
    const b = Array(64).fill(0);
    b[27] = 2; b[28] = 1; b[35] = 1; b[36] = 2;
    st.g = { b, turn: 0, last: null, passed: null };
  },

  toMove: (st) => (game.result(st) ? [] : [st.g.turn]),

  apply(st, seat, move) {
    const g = st.g;
    const i = Number(move.i);
    const p = seat + 1;
    const f = Number.isInteger(i) && i >= 0 && i < 64 ? flips(g.b, i, p) : [];
    if (!f.length) bad("bad_move", "You can't play there");
    g.b[i] = p;
    f.forEach((j) => (g.b[j] = p));
    g.last = i;
    g.passed = null;
    const other = 1 - seat;
    if (movesFor(g.b, other + 1).length) g.turn = other;
    else if (movesFor(g.b, p).length) { g.turn = seat; g.passed = other; } // they can't move: go again
    return [{ type: "place", seat, i, flipped: f, passed: g.passed }];
  },

  cpu(st, seat, R) {
    const b = st.g.b.slice();
    const p = seat + 1;
    let best = null;
    for (const i of movesFor(b, p)) {
      const f = flips(b, i, p);
      b[i] = p; f.forEach((j) => (b[j] = p));
      const v = search(b, 2, -Infinity, Infinity, p, 3 - p) + (R() - 0.5) * 8;
      b[i] = 0; f.forEach((j) => (b[j] = 3 - p));
      if (!best || v > best.v) best = { v, i };
    }
    return { i: best.i };
  },

  result(st) {
    const b = st.g.b;
    if (movesFor(b, 1).length || movesFor(b, 2).length) return null;
    const score = [count(b, 1), count(b, 2)];
    return { winner: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1, score };
  },
};
export default game;
