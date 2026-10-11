// Paintball at the vulcanizer's tyre yard: 30-second rounds of pop-ups behind tyre stacks.
// Splat the masked players, leave the ones in green alone. Two rounds each.
import { randInt, rand, num } from "./phys.js";
import { bad } from "./rules.js";

export const W = 360;
export const H = 520;
export const ROUND_MS = 30_000;
export const SLOTS = [[70, 200], [180, 180], [290, 200], [70, 360], [180, 340], [290, 360]];
const ROUNDS = 2;
const MAX_RESTARTS = 3;

function schedule(st) {
  const pops = [];
  const busyUntil = SLOTS.map(() => 0);
  let t = 900;
  let id = 0;
  while (t < ROUND_MS - 1500) {
    const free = SLOTS.map((_, i) => i).filter((i) => busyUntil[i] < t);
    if (free.length) {
      const slot = free[randInt(st, 0, free.length - 1)];
      const dur = randInt(st, 800, 1300);
      pops.push({ id: id++, slot, t, dur, friend: rand(st) < 0.18 });
      busyUntil[slot] = t + dur + 250;
    }
    t += randInt(st, 520, 980);
  }
  return pops;
}

const game = {
  id: "paintball",
  title: "Paintball",
  blurb: "Tyre-yard shootout. Splat the masks, spare the green.",
  how: "Tap the masked players before they duck. Six shots, then reload. Green shirts cost a point.",
  W,
  H,

  init(st) {
    st.g = { turn: 0, played: [0, 0], scores: [0, 0], rounds: [[], []], live: null, restarts: 0 };
  },

  toMove: (st) => (game.result(st) ? [] : [st.g.turn]),

  apply(st, seat, move, ctx) {
    const g = st.g;
    if (ctx.cpu) {
      // The computer plays a whole round at once against its own schedule.
      const pops = schedule(st);
      let score = 0;
      let hits = 0;
      let enemies = 0;
      for (const p of pops) {
        if (!p.friend) enemies++;
        const r = rand(st);
        if (!p.friend && r < 0.66) { score++; hits++; }
        if (p.friend && r < 0.1) score--;
      }
      score = Math.max(0, score);
      return finishRound(g, seat, score, { hits, enemies });
    }

    if (move.start || move.restart) {
      if (g.live && move.restart) {
        if (g.restarts >= MAX_RESTARTS) bad("no_restarts", "No more restarts this match", 409);
        g.restarts += 1;
      } else if (g.live) {
        bad("round_running", "Your round is already running", 409);
      }
      g.live = { pops: schedule(st), startedAt: ctx.now };
      return [{ type: "round_start", seat }];
    }

    if (!g.live) bad("no_round", "Start a round first", 409);
    const elapsed = ctx.now - g.live.startedAt;
    if (elapsed < ROUND_MS - 4000) bad("too_early", "The round isn't over yet", 409);
    const byId = new Map(g.live.pops.map((p) => [p.id, p]));
    const seen = new Set();
    let score = 0;
    let hits = 0;
    const enemies = g.live.pops.filter((p) => !p.friend).length;
    for (const h of Array.isArray(move.hits) ? move.hits.slice(0, 200) : []) {
      const p = byId.get(Number(h.id));
      const t = num(h.t, 0, ROUND_MS + 2000);
      if (!p || seen.has(p.id)) continue;
      if (t < p.t - 60 || t > p.t + p.dur + 150) continue; // it wasn't up then
      seen.add(p.id);
      if (p.friend) score--;
      else { score++; hits++; }
    }
    score = Math.max(0, score);
    g.live = null;
    return finishRound(g, seat, score, { hits, enemies });
  },

  cpu: () => ({ auto: true }),

  result(st) {
    const g = st.g;
    if (g.played[0] < ROUNDS || g.played[1] < ROUNDS) return null;
    const [a, b] = g.scores;
    return { winner: a === b ? null : a > b ? 0 : 1, score: [a, b] };
  },

  view(st) {
    const g = st.g;
    // The schedule only reaches the phone once its round has started.
    return { ...g, live: g.live ? { pops: g.live.pops, startedAt: g.live.startedAt } : null };
  },
};

function finishRound(g, seat, score, detail) {
  g.played[seat] += 1;
  g.scores[seat] += score;
  g.rounds[seat].push(score);
  g.turn = 1 - seat;
  return [{ type: "round_end", seat, score, ...detail }];
}

export default game;
