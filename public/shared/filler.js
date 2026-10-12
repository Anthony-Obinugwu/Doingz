// Filler: you start in the bottom-left corner, the computer in the top-right. Pick a colour to grow
// your patch into every touching square of that colour. Most squares wins.
import { bad, turnOf } from "./rules.js";
import { randInt } from "./phys.js";

export const COLS = 8;
export const ROWS = 7;
export const COLORS = 6;
const CORNERS = [(ROWS - 1) * COLS, COLS - 1];   // seat 0 bottom-left, seat 1 top-right

const neighbours = (i) => {
  const r = Math.floor(i / COLS), c = i % COLS, out = [];
  if (r > 0) out.push(i - COLS);
  if (r < ROWS - 1) out.push(i + COLS);
  if (c > 0) out.push(i - 1);
  if (c < COLS - 1) out.push(i + 1);
  return out;
};

/** Recolours seat's patch to colour k and absorbs touching squares of that colour. Mutates. */
export function grow(g, seat, k) {
  const mine = seat + 1;
  for (let i = 0; i < g.cells.length; i++) if (g.own[i] === mine) g.cells[i] = k;
  const stack = g.own.map((o, i) => (o === mine ? i : -1)).filter((i) => i >= 0);
  let gained = 0;
  while (stack.length) {
    const i = stack.pop();
    for (const j of neighbours(i)) {
      if (!g.own[j] && g.cells[j] === k) { g.own[j] = mine; gained++; stack.push(j); }
    }
  }
  return gained;
}

const currentColour = (g, seat) => g.cells[CORNERS[seat]];
export const allowed = (g, seat) => [...Array(COLORS).keys()].filter((k) => k !== currentColour(g, 0) && k !== currentColour(g, 1));
const clone = (g) => ({ cells: g.cells.slice(), own: g.own.slice() });
const size = (g, seat) => g.own.filter((o) => o === seat + 1).length;

const game = {
  id: "filler",
  title: "Filler",
  blurb: "Pick colours to swallow the board.",
  how: "Tap a colour. Your patch takes every touching square of it.",
  W: 360,
  H: 380,
  snapshots: true,

  init(st) {
    const cells = [];
    for (let i = 0; i < COLS * ROWS; i++) {
      // avoid big same-colour blobs so every pick matters
      let k;
      do k = randInt(st, 0, COLORS - 1);
      while ((i % COLS && cells[i - 1] === k) || (i >= COLS && cells[i - COLS] === k));
      cells.push(k);
    }
    if (cells[CORNERS[0]] === cells[CORNERS[1]]) cells[CORNERS[1]] = (cells[CORNERS[1]] + 1) % COLORS;
    const own = Array(COLS * ROWS).fill(0);
    own[CORNERS[0]] = 1;
    own[CORNERS[1]] = 2;
    st.g = { cells, own, turn: 0, last: null, turns: 0 };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    const k = Number(move.color);
    if (!allowed(g, seat).includes(k)) bad("bad_move", "You can't pick that colour now");
    const gained = grow(g, seat, k);
    g.last = { seat, color: k };
    g.turn = 1 - seat;
    g.turns += 1;
    return [{ type: "fill", seat, color: k, gained }];
  },

  cpu(st, seat, R) {
    const g = st.g;
    let best = null;
    for (const k of allowed(g, seat)) {
      const a = clone(g);
      const gain = grow(a, seat, k);
      // what's the best they can do back?
      let reply = 0;
      for (const k2 of [...Array(COLORS).keys()].filter((x) => x !== k && x !== a.cells[CORNERS[1 - seat]])) {
        reply = Math.max(reply, grow(clone(a), 1 - seat, k2));
      }
      const v = gain - reply * 0.6 + R() * 0.8;
      if (!best || v > best.v) best = { v, k };
    }
    return { color: best.k };
  },

  result(st) {
    const g = st.g;
    const score = [size(g, 0), size(g, 1)];
    const total = COLS * ROWS;
    if (score[0] > total / 2) return { winner: 0, score };
    if (score[1] > total / 2) return { winner: 1, score };
    if (score[0] + score[1] === total || g.turns >= 120) return { winner: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1, score };
    return null;
  },
};
export default game;
