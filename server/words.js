// The dictionary engine for the word games (server only: the phone never gets the dictionary).
import fs from "node:fs";
import { ANSWERS } from "./content/answers.js";

const read = (name) =>
  fs.readFileSync(new URL(`./content/${name}`, import.meta.url), "utf8").split("\n").map((w) => w.trim()).filter(Boolean);

export function loadWordEngine() {
  const valid = new Set(read("valid.txt"));
  const common = new Set(read("common.txt"));
  // Naija daily-word answers count too (and score double in the word games).
  const naija = new Set(ANSWERS.map((a) => a.word.toLowerCase()));
  for (const w of naija) valid.add(w);

  const prefixes = new Set();
  for (const w of valid) for (let k = 1; k < w.length; k++) prefixes.add(w.slice(0, k));

  const neighbours = (n) => {
    const out = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, list = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if ((dr || dc) && rr >= 0 && rr < n && cc >= 0 && cc < n) list.push(rr * n + cc);
      }
      out.push(list);
    }
    return out;
  };
  const NB = { 4: neighbours(4) };

  /** Every valid word (3–8 letters) traceable on an n x n letter grid. */
  function solveGrid(board, n = 4) {
    const found = new Set();
    const nb = NB[n] || (NB[n] = neighbours(n));
    const walk = (i, word, used) => {
      const w = word + board[i];
      if (w.length >= 3 && valid.has(w)) found.add(w);
      if (w.length >= 8 || !prefixes.has(w)) return;
      used[i] = 1;
      for (const j of nb[i]) if (!used[j]) walk(j, w, used);
      used[i] = 0;
    };
    for (let i = 0; i < n * n; i++) walk(i, "", new Uint8Array(n * n));
    return [...found].sort((a, b) => b.length - a.length || a.localeCompare(b));
  }

  const sixes = [...common].filter((w) => w.length === 6).sort();
  const byLetters = (w) => [...w].sort().join("");

  /** Every valid word of 3–6 letters spelled from the six letters of `seed`. */
  function anagramsOf(seed) {
    const counts = {};
    for (const ch of seed) counts[ch] = (counts[ch] || 0) + 1;
    const out = [];
    for (const w of valid) {
      if (w.length < 3 || w.length > 6) continue;
      const c = { ...counts };
      let ok = true;
      for (const ch of w) { if (!c[ch]) { ok = false; break; } c[ch]--; }
      if (ok) out.push(w);
    }
    return out.sort((a, b) => b.length - a.length || a.localeCompare(b));
  }

  return { valid, common, naija, solveGrid, anagramsOf, sixes, byLetters };
}
