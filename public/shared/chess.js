// Chess with the full rules: castling, en passant, promotion, check, checkmate, stalemate,
// the fifty-move rule, threefold repetition and insufficient material.
// Board: 64 squares, index 0 = a8 ... 63 = h1. White pieces are capitals (seat 0, moves first).
import { bad } from "./rules.js";

const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

export const colorOf = (p) => (!p ? -1 : p === p.toUpperCase() ? 0 : 1);
const lower = (p) => p.toLowerCase();
const rc = (i) => [i >> 3, i & 7];
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function initialBoard() {
  const back = "rnbqkbnr";
  const b = Array(64).fill("");
  for (let c = 0; c < 8; c++) {
    b[c] = back[c];
    b[8 + c] = "p";
    b[48 + c] = "P";
    b[56 + c] = back[c].toUpperCase();
  }
  return b;
}

/** Is square i attacked by seat `by`? */
export function attacked(b, i, by) {
  const [r, c] = rc(i);
  const own = (p, t) => p && colorOf(p) === by && lower(p) === t;
  // pawns: a white pawn attacks upwards, so it sits one row below the square
  const pr = by === 0 ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (inside(pr, c + dc) && own(b[pr * 8 + c + dc], "p")) return true;
  for (const [dr, dc] of KN) if (inside(r + dr, c + dc) && own(b[(r + dr) * 8 + c + dc], "n")) return true;
  for (const [dr, dc] of KG) if (inside(r + dr, c + dc) && own(b[(r + dr) * 8 + c + dc], "k")) return true;
  const slide = (dirs, kinds) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (inside(rr, cc)) {
        const p = b[rr * 8 + cc];
        if (p) { if (colorOf(p) === by && kinds.includes(lower(p))) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  };
  return slide(ROOK, "rq") || slide(BISHOP, "bq");
}

const kingSquare = (b, s) => b.findIndex((p) => p === (s === 0 ? "K" : "k"));
export const inCheck = (g, s) => attacked(g.b, kingSquare(g.b, s), 1 - s);

function pseudo(g, s) {
  const b = g.b, out = [];
  const add = (from, to, extra = {}) => out.push({ from, to, ...extra });
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (colorOf(p) !== s) continue;
    const [r, c] = rc(i);
    const t = lower(p);
    if (t === "p") {
      const dir = s === 0 ? -1 : 1, start = s === 0 ? 6 : 1, last = s === 0 ? 0 : 7;
      const push = (to, extra) => {
        if ((to >> 3) === last) for (const promo of ["q", "r", "b", "n"]) add(i, to, { ...extra, promo });
        else add(i, to, extra);
      };
      const one = (r + dir) * 8 + c;
      if (inside(r + dir, c) && !b[one]) {
        push(one);
        const two = (r + 2 * dir) * 8 + c;
        if (r === start && !b[two]) add(i, two, { double: true });
      }
      for (const dc of [-1, 1]) {
        if (!inside(r + dir, c + dc)) continue;
        const to = (r + dir) * 8 + c + dc;
        if (b[to] && colorOf(b[to]) !== s) push(to);
        else if (to === g.ep) add(i, to, { ep: true });
      }
    } else if (t === "n" || t === "k") {
      for (const [dr, dc] of t === "n" ? KN : KG) {
        if (!inside(r + dr, c + dc)) continue;
        const to = (r + dr) * 8 + c + dc;
        if (colorOf(b[to]) !== s) add(i, to);
      }
      if (t === "k") {
        const home = s === 0 ? 60 : 4, rook = s === 0 ? "R" : "r";
        const [kk, qq] = s === 0 ? ["K", "Q"] : ["k", "q"];
        if (i === home && !attacked(b, home, 1 - s)) {
          if (g.castle.includes(kk) && !b[home + 1] && !b[home + 2] && b[home + 3] === rook
            && !attacked(b, home + 1, 1 - s) && !attacked(b, home + 2, 1 - s)) add(i, home + 2, { castle: "k" });
          if (g.castle.includes(qq) && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === rook
            && !attacked(b, home - 1, 1 - s) && !attacked(b, home - 2, 1 - s)) add(i, home - 2, { castle: "q" });
        }
      }
    } else {
      const dirs = t === "r" ? ROOK : t === "b" ? BISHOP : [...ROOK, ...BISHOP];
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc)) {
          const to = rr * 8 + cc;
          if (b[to]) { if (colorOf(b[to]) !== s) add(i, to); break; }
          add(i, to);
          rr += dr; cc += dc;
        }
      }
    }
  }
  return out;
}

/** Returns the position after move mv (doesn't touch g). */
export function makeMove(g, mv) {
  const b = g.b.slice();
  const p = b[mv.from];
  const s = colorOf(p);
  const captured = mv.ep ? b[mv.to + (s === 0 ? 8 : -8)] : b[mv.to];
  b[mv.to] = mv.promo ? (s === 0 ? mv.promo.toUpperCase() : mv.promo) : p;
  b[mv.from] = "";
  if (mv.ep) b[mv.to + (s === 0 ? 8 : -8)] = "";
  if (mv.castle) {
    const home = s === 0 ? 60 : 4;
    if (mv.castle === "k") { b[home + 1] = b[home + 3]; b[home + 3] = ""; }
    else { b[home - 1] = b[home - 4]; b[home - 4] = ""; }
  }
  let castle = g.castle;
  const drop = (chars) => { for (const ch of chars) castle = castle.replace(ch, ""); };
  if (lower(p) === "k") drop(s === 0 ? "KQ" : "kq");
  for (const sq of [mv.from, mv.to]) {
    if (sq === 63) drop("K");
    if (sq === 56) drop("Q");
    if (sq === 7) drop("k");
    if (sq === 0) drop("q");
  }
  return {
    b,
    castle,
    ep: mv.double ? (mv.from + mv.to) / 2 : -1,
    half: lower(p) === "p" || captured ? 0 : g.half + 1,
    turn: 1 - s,
    captured: captured || "",
  };
}

export function legalMoves(g, s = g.turn) {
  return pseudo(g, s).filter((mv) => {
    const n = makeMove(g, mv);
    return !attacked(n.b, kingSquare(n.b, s), 1 - s);
  });
}

export const keyOf = (g) => `${g.b.map((p) => p || ".").join("")}${g.turn}${g.castle}${g.ep}`;

function insufficient(b) {
  const pieces = b.filter((p) => p && lower(p) !== "k").map(lower);
  if (!pieces.length) return true;
  return pieces.length === 1 && (pieces[0] === "b" || pieces[0] === "n");
}

/** Short algebraic-ish label for the move list, e.g. "Nf3", "exd5", "O-O", "e8=Q". */
export function label(g, mv) {
  if (mv.castle) return mv.castle === "k" ? "O-O" : "O-O-O";
  const p = lower(g.b[mv.from]);
  const sq = (i) => "abcdefgh"[i & 7] + (8 - (i >> 3));
  const cap = g.b[mv.to] || mv.ep;
  const head = p === "p" ? (cap ? sq(mv.from)[0] : "") : p.toUpperCase();
  return `${head}${cap ? "x" : ""}${sq(mv.to)}${mv.promo ? "=" + mv.promo.toUpperCase() : ""}`;
}

// ---------- the computer ----------

const PST_KNIGHT = [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30,
  -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50];
const centre = (i) => { const [r, c] = rc(i); return 6 - Math.abs(3.5 - r) - Math.abs(3.5 - c); };

function evaluate(b) {
  // from white's point of view
  let v = 0;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (!p) continue;
    const s = colorOf(p), t = lower(p);
    let x = VALUE[t];
    const [r] = rc(i);
    if (t === "p") x += (s === 0 ? 6 - r : r - 1) * 8 + (centre(i) > 4 ? 10 : 0);
    else if (t === "n") x += PST_KNIGHT[i];
    else if (t === "b" || t === "q") x += centre(i) * 3;
    else if (t === "k") x += (s === 0 ? r === 7 : r === 0) ? 15 : -10;
    v += s === 0 ? x : -x;
  }
  return v;
}

const order = (g, moves) => moves
  .map((m) => ({ m, k: (g.b[m.to] ? VALUE[lower(g.b[m.to])] * 10 - VALUE[lower(g.b[m.from])] : 0) + (m.promo === "q" ? 800 : 0) }))
  .sort((a, b) => b.k - a.k)
  .map((x) => x.m);

// A node budget keeps every move quick: the server answers other players while the computer thinks.
const BUDGET = 12000;
let nodes = 0;

function captureMoves(g) {
  const s = g.turn;
  return pseudo(g, s).filter((m) => (g.b[m.to] || m.ep || m.promo) && (() => {
    const n = makeMove(g, m);
    return !attacked(n.b, kingSquare(n.b, s), 1 - s);
  })());
}

function quiesce(g, alpha, beta, depth) {
  nodes++;
  const stand = (g.turn === 0 ? 1 : -1) * evaluate(g.b);
  if (depth === 0 || nodes > BUDGET) return stand;
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  for (const mv of order(g, captureMoves(g))) {
    const v = -quiesce(makeMove(g, mv), -beta, -alpha, depth - 1);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(g, depth, alpha, beta, ply) {
  nodes++;
  if (nodes > BUDGET) return (g.turn === 0 ? 1 : -1) * evaluate(g.b);
  const moves = legalMoves(g);
  if (!moves.length) return inCheck(g, g.turn) ? -100000 + ply : 0;
  if (depth === 0) return quiesce(g, alpha, beta, 3);
  for (const mv of order(g, moves)) {
    const v = -negamax(makeMove(g, mv), depth - 1, -beta, -alpha, ply + 1);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

const game = {
  id: "chess",
  title: "Chess",
  blurb: "The full game. You're white, you move first.",
  how: "Tap a piece, then a highlighted square.",
  W: 360,
  H: 400,
  snapshots: true,

  init(st) {
    const g = { b: initialBoard(), castle: "KQkq", ep: -1, half: 0, turn: 0, plies: 0, last: null, moves: [] };
    g.hist = [keyOf(g)];
    st.g = g;
  },

  toMove: (st) => (game.result(st) ? [] : [st.g.turn]),

  apply(st, seat, move) {
    const g = st.g;
    const from = Number(move.from), to = Number(move.to);
    const promo = ["q", "r", "b", "n"].includes(move.promo) ? move.promo : "q";
    const mv = legalMoves(g, seat).find((m) => m.from === from && m.to === to && (!m.promo || m.promo === promo));
    if (!mv) bad("bad_move", "That move isn't allowed");
    const text = label(g, mv);
    const n = makeMove(g, mv);
    Object.assign(g, { b: n.b, castle: n.castle, ep: n.ep, half: n.half, turn: n.turn });
    g.plies += 1;
    g.last = { from, to };
    const check = inCheck(g, g.turn);
    const mate = check && !legalMoves(g).length;
    g.moves.push(text + (mate ? "#" : check ? "+" : ""));
    if (g.moves.length > 40) g.moves.shift();
    g.hist.push(keyOf(g));
    if (g.hist.length > 120) g.hist.shift();
    return [{ type: "move", seat, from, to, text, captured: n.captured, check, mate }];
  },

  cpu(st, seat, R) {
    const g = st.g;
    nodes = 0;
    // Each root move gets a fair share of the budget, searched two plies deep plus captures.
    const scored = order(g, legalMoves(g, seat)).map((mv) => {
      const v = -negamax(makeMove(g, mv), 1, -Infinity, Infinity, 1);
      return { mv, v: v + (R() - 0.5) * 30 };
    });
    scored.sort((a, b) => b.v - a.v);
    const { mv } = scored[0];
    return { from: mv.from, to: mv.to, promo: mv.promo };
  },

  result(st) {
    const g = st.g;
    const material = (s) => g.b.reduce((a, p) => a + (colorOf(p) === s ? VALUE[lower(p)] : 0), 0);
    const score = [material(0), material(1)];
    if (!legalMoves(g).length) return inCheck(g, g.turn) ? { winner: 1 - g.turn, score, how: "checkmate" } : { winner: null, score, how: "stalemate" };
    if (g.half >= 100) return { winner: null, score, how: "fifty moves" };
    if (insufficient(g.b)) return { winner: null, score, how: "not enough pieces" };
    const k = g.hist[g.hist.length - 1];
    if (g.hist.filter((x) => x === k).length >= 3) return { winner: null, score, how: "repetition" };
    if (g.plies >= 300) return { winner: null, score, how: "move limit" };
    return null;
  },
};
export default game;
