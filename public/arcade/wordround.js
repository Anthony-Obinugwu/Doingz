// Shared bits of the two word games' screens: the round clock, word checks and the found list.
import { fingerprint } from "/shared/words.js";
import { loop } from "./kit.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Runs one timed round on the phone. `view` must contain the board and fingerprints.
 * check(word) -> "new" | "naija" | "again" | "no";  add(word) records it.
 */
export function startRound(view, { onTick, onEnd }) {
  const valid = new Set(view.hashes);
  const naija = new Set(view.naijaHashes || []);
  const t0 = performance.now() - Math.min(view.startedAgo || 0, view.roundMs);
  const found = [];
  const r = {
    found,
    score: 0,
    left: () => Math.max(0, view.roundMs - (performance.now() - t0)),
    check(word) {
      if (word.length < 3) return "no";
      if (found.includes(word)) return "again";
      const h = fingerprint(view.salt, word);
      if (!valid.has(h)) return "no";
      return naija.has(h) ? "naija" : "new";
    },
    add(word, points) { found.push(word); r.score += points; },
    stop: null,
  };
  let ended = false;
  r.stop = loop(() => {
    onTick?.(r);
    if (r.left() <= 0 && !ended) { ended = true; onEnd(r); return false; }
    return true;
  });
  return r;
}

export function foundListHtml(words, naijaWords = []) {
  return `<div class="found-list">${words.map((w) => `<span class="${naijaWords.includes(w) ? "naija" : ""}">${esc(w)}</span>`).join("")}</div>`;
}

/** After the game: both players' words and the best ones you missed. */
export function summaryHtml(view, seat) {
  const mine = Array.isArray(view.found[seat]) ? view.found[seat] : [];
  const theirs = Array.isArray(view.found[1 - seat]) ? view.found[1 - seat] : [];
  return `<div class="tq-card">
      <h3>${mine.length} words for you, ${theirs.length} for them</h3>
      ${foundListHtml(mine)}
      ${view.missed?.length ? `<p class="muted note">Best ones you missed:</p>${foundListHtml(view.missed)}` : ""}
    </div>`;
}

export { esc };
