// Ayo (the Yoruba mancala, played the common "twos and threes" way, like Oware):
// 12 pits, 4 seeds each. Sow anticlockwise from one of your pits. If your last seed lands in an
// opponent's pit and makes it 2 or 3, take them, and keep taking the pits just before it while
// they're 2 or 3. You can't take every seed they have in one go, and if they have none you must
// give them some. First to 25 seeds wins.
import { bad, turnOf } from "./rules.js";

export const PITS = 12;
const WIN = 25;
const MAX_PLIES = 250;

export const ownerOf = (i) => (i < 6 ? 0 : 1);           // seat 0: pits 0–5 (bottom row), seat 1: 6–11 (top row)
const sideSeeds = (pits, s) => pits.slice(s * 6, s * 6 + 6).reduce((a, b) => a + b, 0);

/** Sows from pit i for seat s on a copy; returns { pits, captured, last, path }. */
export function sow(pitsIn, i, s) {
  const pits = pitsIn.slice();
  let n = pits[i];
  pits[i] = 0;
  let j = i;
  const path = [];
  while (n > 0) {
    j = (j + 1) % PITS;
    if (j === i) continue; // a big pile skips the pit it came from
    pits[j] += 1;
    path.push(j);
    n -= 1;
  }
  // captures
  let captured = 0;
  const taken = [];
  if (ownerOf(j) !== s) {
    const trial = pits.slice();
    let k = j;
    while (ownerOf(k) !== s && (trial[k] === 2 || trial[k] === 3)) {
      captured += trial[k];
      taken.push(k);
      trial[k] = 0;
      k = (k + PITS - 1) % PITS;
    }
    // grand slam: taking everything they have isn't allowed, so nothing is taken
    if (captured && sideSeeds(trial, 1 - s) === 0) { captured = 0; taken.length = 0; }
    else if (captured) for (const t of taken) pits[t] = 0;
  }
  return { pits, captured, last: j, path, taken };
}

/** Legal pits for seat s: non-empty, and if the opponent is empty, only pits that feed them. */
export function legalPits(pits, s) {
  const mine = [0, 1, 2, 3, 4, 5].map((k) => s * 6 + k).filter((i) => pits[i] > 0);
  if (sideSeeds(pits, 1 - s) > 0) return mine;
  return mine.filter((i) => sideSeeds(sow(pits, i, s).pits, 1 - s) > 0);
}

function search(pits, store, depth, alpha, beta, s, me) {
  if (store[0] >= WIN || store[1] >= WIN || depth === 0) return store[me] - store[1 - me];
  const moves = legalPits(pits, s);
  if (!moves.length) {
    const fin = store.slice();
    fin[1 - s] += sideSeeds(pits, 0) + sideSeeds(pits, 1);
    return (fin[me] - fin[1 - me]) * 10;
  }
  const maxing = s === me;
  let best = maxing ? -Infinity : Infinity;
  for (const i of moves) {
    const r = sow(pits, i, s);
    const st2 = store.slice();
    st2[s] += r.captured;
    const v = search(r.pits, st2, depth - 1, alpha, beta, 1 - s, me);
    if (maxing) { best = Math.max(best, v); alpha = Math.max(alpha, v); }
    else { best = Math.min(best, v); beta = Math.min(beta, v); }
    if (alpha >= beta) break;
  }
  return best;
}

const game = {
  id: "ayo",
  title: "Ayo",
  blurb: "The Yoruba seed game. Make twos and threes, take them.",
  how: "Tap one of your pits on the bottom row to sow its seeds.",
  W: 360,
  H: 360,
  snapshots: true,

  init(st) {
    st.g = { pits: Array(PITS).fill(4), store: [0, 0], turn: 0, last: null, plies: 0, over: false };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    const i = Number(move.pit);
    if (!legalPits(g.pits, seat).includes(i)) bad("bad_move", "You can't sow from that pit");
    const r = sow(g.pits, i, seat);
    g.pits = r.pits;
    g.store[seat] += r.captured;
    g.last = { pit: i, path: r.path, taken: r.taken };
    g.plies += 1;
    g.turn = 1 - seat;
    // If the next player can't move, the game ends and the seeds go to whoever's side they're on
    // (the mover keeps their own side; Oware rules give the rest to the player who can't be fed).
    const ev = { type: "sow", seat, pit: i, path: r.path, taken: r.taken, captured: r.captured };
    if (!legalPits(g.pits, g.turn).length || g.plies >= MAX_PLIES) {
      for (const s of [0, 1]) { g.store[s] += sideSeeds(g.pits, s); for (let k = 0; k < 6; k++) g.pits[s * 6 + k] = 0; }
      g.over = true;
    }
    return [ev];
  },

  cpu(st, seat, R) {
    const g = st.g;
    let best = null;
    for (const i of legalPits(g.pits, seat)) {
      const r = sow(g.pits, i, seat);
      const store = g.store.slice();
      store[seat] += r.captured;
      const v = search(r.pits, store, 5, -Infinity, Infinity, 1 - seat, seat) + R() * 0.9;
      if (!best || v > best.v) best = { v, i };
    }
    return { pit: best.i };
  },

  result(st) {
    const g = st.g;
    const score = g.store.slice();
    if (score[0] >= WIN) return { winner: 0, score };
    if (score[1] >= WIN) return { winner: 1, score };
    if (g.over) return { winner: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1, score };
    return null;
  },
};
export default game;
