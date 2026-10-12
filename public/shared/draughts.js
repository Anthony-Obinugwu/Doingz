// Draughts (checkers), 8 x 8 English rules: men move and capture forwards, kings both ways one
// square at a time. Capturing is compulsory, a jump must continue while it can, and being
// crowned ends the move. You play from the bottom and move first.
import { bad, turnOf } from "./rules.js";

export const N = 8;
const NO_PROGRESS = 60; // plies without a capture or crowning before it's a draw

// board cells: 0 empty, else { s: seat, k: king }
export const dark = (r, c) => (r + c) % 2 === 1;

function initialBoard() {
  const b = Array(64).fill(0);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (!dark(r, c)) continue;
    if (r < 3) b[r * N + c] = { s: 1, k: false };
    if (r > 4) b[r * N + c] = { s: 0, k: false };
  }
  return b;
}

const forward = (s) => (s === 0 ? -1 : 1);
const dirsOf = (p) => (p.k ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : [[forward(p.s), -1], [forward(p.s), 1]]);
const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const crowns = (p, r) => !p.k && ((p.s === 0 && r === 0) || (p.s === 1 && r === N - 1));

/** All capture sequences for the piece at i: [{ from, path:[landing...], caps:[...] }]. */
function jumpsFrom(b, i, p) {
  const out = [];
  const walk = (cur, path, caps, board) => {
    const r = Math.floor(cur / N), c = cur % N;
    let extended = false;
    if (!(path.length && crowns(p, Math.floor(path[path.length - 1] / N)))) {
      for (const [dr, dc] of dirsOf(p)) {
        const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
        if (!inside(lr, lc)) continue;
        const mid = board[mr * N + mc];
        if (!mid || mid.s === p.s || caps.includes(mr * N + mc) || board[lr * N + lc]) continue;
        extended = true;
        const nb = board.slice();
        nb[lr * N + lc] = p; nb[cur] = 0;
        walk(lr * N + lc, [...path, lr * N + lc], [...caps, mr * N + mc], nb);
      }
    }
    if (!extended && path.length) out.push({ from: i, path, caps });
  };
  walk(i, [], [], b);
  return out;
}

/** Every legal move for seat s. */
export function legalMoves(b, s) {
  const jumps = [], steps = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p || p.s !== s) continue;
    jumps.push(...jumpsFrom(b, i, p));
    const r = Math.floor(i / N), c = i % N;
    for (const [dr, dc] of dirsOf(p)) {
      const nr = r + dr, nc = c + dc;
      if (inside(nr, nc) && !b[nr * N + nc]) steps.push({ from: i, path: [nr * N + nc], caps: [] });
    }
  }
  return jumps.length ? jumps : steps;
}

/** Plays a legal move on board b (mutates). Returns whether it crowned. */
export function play(b, mv) {
  const p = b[mv.from];
  b[mv.from] = 0;
  for (const x of mv.caps) b[x] = 0;
  const to = mv.path[mv.path.length - 1];
  const crowned = crowns(p, Math.floor(to / N));
  b[to] = crowned ? { s: p.s, k: true } : p;
  return crowned;
}

const same = (a, b) => a.from === b.from && a.path.length === b.path.length && a.path.every((x, i) => x === b.path[i]);

function evaluate(b, s) {
  let v = 0;
  let mine = 0, theirs = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const r = Math.floor(i / N);
    const adv = p.s === 0 ? 7 - r : r;
    const val = p.k ? 170 : 100 + adv * 4;
    v += p.s === s ? val : -val;
    if (p.s === s) mine++; else theirs++;
  }
  // When ahead, hunt: kings close in on what's left.
  if (mine > theirs) {
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || p.s !== s || !p.k) continue;
      let near = 99;
      for (let j = 0; j < 64; j++) {
        const q = b[j];
        if (q && q.s !== s) near = Math.min(near, Math.max(Math.abs((i >> 3) - (j >> 3)), Math.abs((i & 7) - (j & 7))));
      }
      v -= near * 3;
    }
  }
  return v;
}

function search(b, depth, alpha, beta, s, me) {
  const moves = legalMoves(b, s);
  if (!moves.length) return s === me ? -10000 - depth : 10000 + depth;
  if (depth === 0) return evaluate(b, me);
  const maxing = s === me;
  let best = maxing ? -Infinity : Infinity;
  for (const mv of moves) {
    const nb = b.slice();
    play(nb, mv);
    const v = search(nb, depth - 1, alpha, beta, 1 - s, me);
    if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return best;
}

const game = {
  id: "draughts",
  title: "Draughts",
  blurb: "Checkers, the way we call it. Jump them all.",
  how: "Tap your piece, then where it goes. Captures are compulsory.",
  // House rule: after 60 moves with no capture or crowning, more pieces wins.
  W: 360,
  H: 380,
  snapshots: true,

  init(st) {
    st.g = { b: initialBoard(), turn: 0, last: null, quiet: 0, plies: 0 };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    const path = Array.isArray(move.path) ? move.path.map(Number) : [];
    const want = { from: Number(move.from), path };
    const mv = legalMoves(g.b, seat).find((m) => same(m, want));
    if (!mv) bad("bad_move", "That move isn't allowed");
    const crowned = play(g.b, mv);
    g.quiet = mv.caps.length || crowned ? 0 : g.quiet + 1;
    g.plies += 1;
    g.last = mv;
    g.turn = 1 - seat;
    return [{ type: "move", seat, from: mv.from, path: mv.path, caps: mv.caps, crowned }];
  },

  cpu(st, seat, R) {
    const g = st.g;
    let best = null;
    for (const mv of legalMoves(g.b, seat)) {
      const nb = g.b.slice();
      play(nb, mv);
      const v = search(nb, 3, -Infinity, Infinity, 1 - seat, seat) + (R() - 0.5) * 30;
      if (!best || v > best.v) best = { v, mv };
    }
    return { from: best.mv.from, path: best.mv.path };
  },

  result(st) {
    const g = st.g;
    const count = (s) => g.b.filter((p) => p && p.s === s).length;
    const score = [count(0), count(1)];
    if (!legalMoves(g.b, g.turn).length) return { winner: 1 - g.turn, score };
    // No capture or crowning for a long time: whoever has more pieces takes it.
    if (g.quiet >= NO_PROGRESS || g.plies >= 300) return { winner: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1, score, how: "on pieces" };
    return null;
  },
};
export default game;
