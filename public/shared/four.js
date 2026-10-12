// Four in a Row: drop discs, line up four. Green (you go first) against danfo yellow.
import { bad, turnOf } from "./rules.js";

export const COLS = 7;
export const ROWS = 6;
const LINES = [[0, 1], [1, 0], [1, 1], [1, -1]];

export const at = (b, r, c) => (r < 0 || r >= ROWS || c < 0 || c >= COLS ? -1 : b[r * COLS + c]);

/** Row a disc would land in, or -1 if the column is full. */
export function dropRow(b, c) {
  for (let r = ROWS - 1; r >= 0; r--) if (b[r * COLS + c] === 0) return r;
  return -1;
}

/** Cells of a four through (r, c), or null. */
export function fourAt(b, r, c) {
  const p = b[r * COLS + c];
  if (!p) return null;
  for (const [dr, dc] of LINES) {
    const cells = [[r, c]];
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (at(b, rr, cc) === p) { cells.push([rr, cc]); rr += dr * s; cc += dc * s; }
    }
    if (cells.length >= 4) return cells;
  }
  return null;
}

function score(b, me) {
  // Count open windows of four: more of mine and fewer of theirs is better.
  const them = 3 - me;
  let s = 0;
  for (let r = 0; r < ROWS; r++) {
    if (b[r * COLS + 3] === me) s += 3;
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of LINES) {
        const er = r + dr * 3, ec = c + dc * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        let m = 0, t = 0;
        for (let k = 0; k < 4; k++) { const v = b[(r + dr * k) * COLS + c + dc * k]; if (v === me) m++; else if (v === them) t++; }
        if (m && t) continue;
        s += m === 3 ? 6 : m === 2 ? 2 : 0;
        s -= t === 3 ? 8 : t === 2 ? 2 : 0;
      }
    }
  }
  return s;
}

function negamax(b, depth, alpha, beta, me, cur) {
  const moves = [3, 2, 4, 1, 5, 0, 6].filter((c) => dropRow(b, c) >= 0);
  if (!moves.length) return 0;
  if (depth === 0) return (cur === me ? 1 : -1) * score(b, me);
  let best = -Infinity;
  for (const c of moves) {
    const r = dropRow(b, c);
    b[r * COLS + c] = cur;
    const v = fourAt(b, r, c) ? 10000 + depth : -negamax(b, depth - 1, -beta, -alpha, me, 3 - cur);
    b[r * COLS + c] = 0;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

const game = {
  id: "four",
  title: "Four in a Row",
  blurb: "Drop your discs. Four in a line wins.",
  how: "Tap a column to drop a disc.",
  W: 360,
  H: 400,
  snapshots: true,

  init(st) {
    st.g = { b: Array(COLS * ROWS).fill(0), turn: 0, last: null, win: null };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    const c = Number(move.col);
    if (!Number.isInteger(c) || c < 0 || c >= COLS) bad("bad_move", "Pick a column");
    const r = dropRow(g.b, c);
    if (r < 0) bad("bad_move", "That column is full");
    g.b[r * COLS + c] = seat + 1;
    g.last = [r, c];
    g.win = fourAt(g.b, r, c);
    g.turn = 1 - seat;
    return [{ type: "drop", seat, r, c }];
  },

  cpu(st, seat, R) {
    const b = st.g.b.slice();
    const me = seat + 1;
    let best = null;
    for (const c of [3, 2, 4, 1, 5, 0, 6]) {
      const r = dropRow(b, c);
      if (r < 0) continue;
      b[r * COLS + c] = me;
      const v = fourAt(b, r, c) ? 100000 : -negamax(b, 4, -Infinity, Infinity, me, 3 - me);
      b[r * COLS + c] = 0;
      const noisy = v + (R() - 0.5) * 6; // small wobble so it doesn't always play the same game
      if (!best || noisy > best.v) best = { v: noisy, c };
    }
    return { col: best.c };
  },

  result(st) {
    const g = st.g;
    if (g.win) {
      const w = g.b[g.win[0][0] * COLS + g.win[0][1]] - 1;
      return { winner: w, score: [w === 0 ? 1 : 0, w === 1 ? 1 : 0] };
    }
    if (g.b.every((v) => v)) return { winner: null, score: [0, 0] };
    return null;
  },
};
export default game;
