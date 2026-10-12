// Dots & Boxes on a 5 x 5 grid of dots. Close a box to keep it and go again.
import { bad } from "./rules.js";

export const D = 5;             // dots per side
export const B = D - 1;         // boxes per side
export const H_LINES = D * B;   // horizontal lines: row r (0..D-1), col c (0..B-1) -> r*B + c
export const LINES = H_LINES * 2;
// vertical lines: row r (0..B-1), col c (0..D-1) -> H_LINES + r*D + c

export const hLine = (r, c) => r * B + c;
export const vLine = (r, c) => H_LINES + r * D + c;
/** The four lines around box (r, c). */
export const boxLines = (r, c) => [hLine(r, c), hLine(r + 1, c), vLine(r, c), vLine(r, c + 1)];
/** Boxes that touch a line. */
export function boxesOf(l) {
  if (l < H_LINES) {
    const r = Math.floor(l / B), c = l % B;
    return [[r - 1, c], [r, c]].filter(([br]) => br >= 0 && br < B);
  }
  const k = l - H_LINES, r = Math.floor(k / D), c = k % D;
  return [[r, c - 1], [r, c]].filter(([, bc]) => bc >= 0 && bc < B);
}
const sides = (lines, r, c) => boxLines(r, c).filter((l) => lines[l]).length;

/** Draws line l for seat; returns the boxes it closed. */
function draw(g, l, seat) {
  g.lines[l] = seat + 1;
  const closed = [];
  for (const [r, c] of boxesOf(l)) {
    if (sides(g.lines, r, c) === 4 && g.boxes[r * B + c] === 0) { g.boxes[r * B + c] = seat + 1; closed.push(r * B + c); }
  }
  return closed;
}

/** How many boxes the opponent could take in a row after line l is drawn (greedy). */
function giveaway(lines, l) {
  const ls = lines.slice();
  ls[l] = 1;
  let taken = 0;
  for (let again = true; again;) {
    again = false;
    for (let r = 0; r < B; r++) for (let c = 0; c < B; c++) {
      if (sides(ls, r, c) === 3) { boxLines(r, c).forEach((x) => (ls[x] = 1)); taken++; again = true; }
    }
  }
  return taken;
}

const game = {
  id: "dots",
  title: "Dots & Boxes",
  blurb: "Draw lines, close boxes, go again.",
  how: "Tap between two dots to draw a line. Close a box to go again.",
  W: 360,
  H: 380,
  snapshots: true,

  init(st) {
    st.g = { lines: Array(LINES).fill(0), boxes: Array(B * B).fill(0), turn: 0, last: null };
  },

  toMove: (st) => (game.result(st) ? [] : [st.g.turn]),

  apply(st, seat, move) {
    const g = st.g;
    const l = Number(move.line);
    if (!Number.isInteger(l) || l < 0 || l >= LINES || g.lines[l]) bad("bad_move", "That line is drawn already");
    const closed = draw(g, l, seat);
    g.last = l;
    if (!closed.length) g.turn = 1 - seat;
    return [{ type: "line", seat, l, closed }];
  },

  cpu(st, seat, R) {
    const g = st.g;
    const open = g.lines.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
    // 1. take a box if one is there
    for (const l of open) if (boxesOf(l).some(([r, c]) => sides(g.lines, r, c) === 3)) return { line: l };
    // 2. a safe line that doesn't give a box away
    const safe = open.filter((l) => boxesOf(l).every(([r, c]) => sides(g.lines, r, c) < 2));
    if (safe.length) return { line: safe[Math.floor(R() * safe.length)] };
    // 3. give away as little as possible
    let best = null;
    for (const l of open) { const v = giveaway(g.lines, l) + R() * 0.5; if (!best || v < best.v) best = { v, l }; }
    return { line: best.l };
  },

  result(st) {
    const g = st.g;
    if (g.lines.some((v) => !v)) return null;
    const score = [g.boxes.filter((v) => v === 1).length, g.boxes.filter((v) => v === 2).length];
    return { winner: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1, score };
  },
};
export default game;
