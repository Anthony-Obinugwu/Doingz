// Word Hunt: swipe through touching letters on a 4 x 4 grid. 80 seconds. Longer words score more.
import { wordGame, adjacent } from "./words.js";
import { rand } from "./phys.js";

export const N = 4;
const POINTS = { 3: 100, 4: 400, 5: 800, 6: 1400, 7: 1800 };
// English letter weights (no Q, so no "QU" tile to explain).
const WEIGHTS = "eeeeeeeeeeeeaaaaaaaaaiiiiiiiioooooooonnnnnnrrrrrrttttttllllssssssuuuuddddgggbbccmmppffhhvvwwyykjxz";

/** Is `word` traceable on the board through touching, unused tiles? */
export function onBoard(board, word) {
  const walk = (i, k, used) => {
    if (board[i] !== word[k]) return false;
    if (k === word.length - 1) return true;
    used.add(i);
    for (let j = 0; j < N * N; j++) if (!used.has(j) && adjacent(i, j, N) && walk(j, k + 1, used)) return true;
    used.delete(i);
    return false;
  };
  for (let i = 0; i < N * N; i++) if (walk(i, 0, new Set())) return true;
  return false;
}

export default wordGame({
  id: "wordhunt",
  title: "Word Hunt",
  blurb: "Swipe through touching letters. 80 seconds.",
  how: "Swipe across touching letters to make words of three or more.",
  roundMs: 80_000,
  points: (len) => (len >= 8 ? 2200 : POINTS[len] || 0),
  cpuChance: (len) => ({ 3: 0.34, 4: 0.3, 5: 0.2, 6: 0.12 })[len] ?? 0.06,

  makeBoard(st, engine) {
    let best = null;
    for (let tries = 0; tries < 60; tries++) {
      const board = [];
      for (let i = 0; i < N * N; i++) board.push(WEIGHTS[Math.floor(rand(st) * WEIGHTS.length)]);
      const words = engine.solveGrid(board, N);
      const long = words.some((w) => w.length >= 6);
      if (!best || words.length > best.words.length) best = { board, words };
      if (words.length >= 60 && long) return { board, words };
    }
    return best;
  },
});
