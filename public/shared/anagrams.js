// Anagrams: make words from six letters. 60 seconds. A six-letter word is always hiding in there.
import { wordGame } from "./words.js";
import { rand } from "./phys.js";

const POINTS = { 3: 100, 4: 400, 5: 1200, 6: 2000 };

/** Can `word` be spelled from `letters` (each letter used once)? */
export function fits(letters, word) {
  const pool = [...letters];
  for (const ch of word) {
    const k = pool.indexOf(ch);
    if (k < 0) return false;
    pool.splice(k, 1);
  }
  return true;
}

export default wordGame({
  id: "anagrams",
  title: "Anagrams",
  blurb: "Six letters, sixty seconds. Find the six-letter word.",
  how: "Tap letters to spell a word, then Enter. Three letters or more.",
  roundMs: 60_000,
  H: 440,
  points: (len) => POINTS[len] || 0,
  cpuChance: (len) => ({ 3: 0.4, 4: 0.33, 5: 0.25, 6: 0.3 })[len] ?? 0,

  makeBoard(st, engine) {
    for (let tries = 0; tries < 60; tries++) {
      const seed = engine.sixes[Math.floor(rand(st) * engine.sixes.length)];
      const words = engine.anagramsOf(seed);
      if (words.length < 12) continue;
      const board = [...seed];
      for (let i = board.length - 1; i > 0; i--) { const j = Math.floor(rand(st) * (i + 1)); [board[i], board[j]] = [board[j], board[i]]; }
      return { board, words };
    }
    const seed = engine.sixes[0];
    return { board: [...seed], words: engine.anagramsOf(seed) };
  },
});
