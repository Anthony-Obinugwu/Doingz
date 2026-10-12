// 20 Questions, as a duel. Each side secretly picks a thing. Round 1: you question the computer to find
// its thing. Round 2: it questions you. Questions and guesses both count; fewest wins.
// Answers are checked against what Doingz knows, so nobody can fib.
import { bad } from "./rules.js";
import { THINGS, QUESTIONS, thingById, questionById, truth } from "./twenty-kb.js";

const LIMIT = 20;

function endRound(g) {
  if (g.round === 0) { g.round = 1; g.asker = 1; }
  else g.phase = "done";
}

/** Things still possible for the current round, from the answers so far. */
export function candidates(g, round = g.round) {
  const log = g.log[round];
  return THINGS.filter((t) => log.every((e) =>
    e.kind === "q" ? truth(t.id, e.q) === e.answer : e.kind === "guess" ? e.right || e.id !== t.id : true));
}

const game = {
  id: "twenty",
  title: "20 Questions",
  blurb: "Guess their thing in fewer questions than they guess yours.",
  how: "Pick a secret, then ask yes-or-no questions. Fewest questions wins.",
  W: 360,
  H: 520,
  snapshots: true,
  HTML: true,

  init(st) {
    st.g = { phase: "pick", picks: [null, null], round: 0, asker: 0, used: [0, 0], solved: [false, false], log: [[], []], pending: null };
  },

  toMove(st) {
    const g = st.g;
    if (g.phase === "done") return [];
    if (g.phase === "pick") return [0, 1].filter((s) => g.picks[s] === null);
    return g.pending ? [1 - g.asker] : [g.asker];
  },

  apply(st, seat, move) {
    const g = st.g;
    if (g.phase === "pick") {
      if (!thingById.has(move.pick)) bad("bad_move", "Pick something from the list");
      g.picks[seat] = move.pick;
      if (g.picks[0] && g.picks[1]) g.phase = "play";
      return [{ type: "picked", seat }];
    }
    const answerer = 1 - g.asker;
    if (move.answer !== undefined) {
      if (seat !== answerer || !g.pending) bad("bad_move", "Nothing to answer", 409);
      const right = truth(g.picks[seat], g.pending.q);
      const said = move.answer === "y" || move.answer === true;
      g.log[g.round].push({ kind: "q", q: g.pending.q, answer: right, corrected: said !== right });
      const ev = { type: "answer", seat, q: g.pending.q, answer: right, corrected: said !== right };
      g.pending = null;
      if (g.used[g.asker] >= LIMIT) { g.used[g.asker] = LIMIT + 1; endRound(g); }
      return [ev];
    }
    if (seat !== g.asker || g.pending) bad("not_your_turn", "Wait for the answer", 409);
    if (move.giveUp) {
      g.used[seat] = LIMIT + 1;
      const ev = { type: "gave_up", seat, was: g.picks[answerer] };
      endRound(g);
      return [ev];
    }
    if (move.ask !== undefined) {
      if (!questionById.has(move.ask)) bad("bad_move", "Pick a question from the list");
      if (g.log[g.round].some((e) => e.kind === "q" && e.q === move.ask)) bad("bad_move", "You asked that already");
      g.used[seat] += 1;
      g.pending = { q: move.ask };
      return [{ type: "ask", seat, q: move.ask }];
    }
    if (move.guess !== undefined) {
      if (!thingById.has(move.guess)) bad("bad_move", "Pick something from the list");
      g.used[seat] += 1;
      const right = move.guess === g.picks[answerer];
      g.log[g.round].push({ kind: "guess", id: move.guess, right });
      const ev = { type: "guess", seat, id: move.guess, right, was: right ? move.guess : null };
      if (right) { g.solved[seat] = true; endRound(g); }
      else if (g.used[seat] >= LIMIT) { g.used[seat] = LIMIT + 1; ev.was = g.picks[answerer]; endRound(g); }
      return [ev];
    }
    bad("bad_move", "Ask, guess or answer");
  },

  cpu(st, seat, R) {
    const g = st.g;
    if (g.phase === "pick") return { pick: THINGS[Math.floor(R() * THINGS.length)].id };
    if (g.pending) return { answer: truth(g.picks[seat], g.pending.q) ? "y" : "n" };
    const cands = candidates(g);
    if (cands.length <= 2) return { guess: cands[Math.floor(R() * cands.length)].id };
    const asked = new Set(g.log[g.round].filter((e) => e.kind === "q").map((e) => e.q));
    const scored = QUESTIONS.filter((q) => !asked.has(q.id)).map((q) => {
      const yes = cands.filter((t) => truth(t.id, q.id)).length;
      return { q: q.id, split: Math.min(yes, cands.length - yes) };
    }).filter((x) => x.split > 0).sort((a, b) => b.split - a.split);
    if (!scored.length) return { guess: cands[Math.floor(R() * cands.length)].id };
    // Mostly the best split, sometimes a slightly worse one, like a person would.
    const r = R();
    const pick = scored[Math.min(scored.length - 1, r < 0.55 ? 0 : r < 0.85 ? 1 : 2)];
    return { ask: pick.q };
  },

  result(st) {
    const g = st.g;
    if (g.phase !== "done") return null;
    const score = g.used.slice();
    return { winner: score[0] === score[1] ? null : score[0] < score[1] ? 0 : 1, score };
  },

  view(st, seat) {
    const g = st.g;
    return {
      phase: g.phase,
      round: g.round,
      asker: g.asker,
      used: g.used,
      solved: g.solved,
      log: g.log,
      pending: g.pending,
      mine: g.picks[seat],
      picked: g.picks.map(Boolean),
      theirs: g.phase === "done" ? g.picks[1 - seat] : null,
      seat,
    };
  },
};
export default game;
