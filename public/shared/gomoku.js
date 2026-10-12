// Gomoku: five stones in a row on a 13 x 13 board.
import { bad, turnOf } from "./rules.js";

export const N = 13;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** Length of the line through i for player p in direction d, plus how many ends are open. */
function lineInfo(b, i, p, dr, dc) {
  const r0 = Math.floor(i / N), c0 = i % N;
  let len = 1, open = 0;
  for (const s of [1, -1]) {
    let r = r0 + dr * s, c = c0 + dc * s;
    while (r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === p) { len++; r += dr * s; c += dc * s; }
    if (r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === 0) open++;
  }
  return [len, open];
}

/** The five (or more) through i, or null. */
export function fiveAt(b, i) {
  const p = b[i];
  if (!p) return null;
  const r0 = Math.floor(i / N), c0 = i % N;
  for (const [dr, dc] of DIRS) {
    const cells = [i];
    for (const s of [1, -1]) {
      let r = r0 + dr * s, c = c0 + dc * s;
      while (r >= 0 && r < N && c >= 0 && c < N && b[r * N + c] === p) { cells.push(r * N + c); r += dr * s; c += dc * s; }
    }
    if (cells.length >= 5) return cells;
  }
  return null;
}

const SHAPE = (len, open) => {
  if (len >= 5) return 1_000_000;
  if (open === 0) return 0;
  if (len === 4) return open === 2 ? 100_000 : 12_000;
  if (len === 3) return open === 2 ? 10_000 : 600;
  if (len === 2) return open === 2 ? 400 : 40;
  return open === 2 ? 12 : 2;
};

/** How good it is for p to play i (attack) — also used for blocking the other side. */
function cellValue(b, i, p) {
  b[i] = p;
  let v = 0;
  for (const [dr, dc] of DIRS) { const [len, open] = lineInfo(b, i, p, dr, dc); v += SHAPE(len, open); }
  b[i] = 0;
  return v;
}

const game = {
  id: "gomoku",
  title: "Gomoku",
  blurb: "Five stones in a row. Block theirs, build yours.",
  how: "Tap a crossing to place a stone. Five in a line wins.",
  W: 360,
  H: 380,
  snapshots: true,

  init(st) {
    st.g = { b: Array(N * N).fill(0), turn: 0, last: null, win: null };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    const i = Number(move.i);
    if (!Number.isInteger(i) || i < 0 || i >= N * N || g.b[i]) bad("bad_move", "That spot is taken");
    g.b[i] = seat + 1;
    g.last = i;
    g.win = fiveAt(g.b, i);
    g.turn = 1 - seat;
    return [{ type: "stone", seat, i }];
  },

  cpu(st, seat, R) {
    const b = st.g.b;
    const me = seat + 1, them = 3 - me;
    if (b.every((v) => !v)) return { i: Math.floor(N / 2) * N + Math.floor(N / 2) };
    let best = null;
    for (let i = 0; i < N * N; i++) {
      if (b[i]) continue;
      // only look near existing stones
      const r = Math.floor(i / N), c = i % N;
      let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < N && cc >= 0 && cc < N && b[rr * N + cc]) { near = true; break; }
      }
      if (!near) continue;
      const v = cellValue(b, i, me) * 1.15 + cellValue(b, i, them) + R() * 30;
      if (!best || v > best.v) best = { v, i };
    }
    return { i: best.i };
  },

  result(st) {
    const g = st.g;
    if (g.win) { const w = g.b[g.win[0]] - 1; return { winner: w, score: [w === 0 ? 1 : 0, w === 1 ? 1 : 0] }; }
    if (g.b.every((v) => v)) return { winner: null, score: [0, 0] };
    return null;
  },
};
export default game;
