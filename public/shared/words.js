// Shared pieces of the word games (Word Hunt, Anagrams), used by the server and the phone.
import { bad, normalR } from "./rules.js";
import { num } from "./phys.js";

/** 32-bit FNV-1a of salt + word. The phone checks words against these without seeing the list. */
export function fingerprint(salt, word) {
  let h = 0x811c9dc5;
  const s = salt + ":" + word;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** Hunt grid neighbours (8 directions) on an n x n board. */
export function adjacent(a, b, n = 4) {
  const ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
  return a !== b && Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1;
}

/**
 * Builds a timed word game. `kind` supplies: id, title, blurb, how, roundMs, points(len),
 * makeBoard(st, engine) -> { board, words: [...] }  and  fits(board, word) (letters/path check).
 * The dictionary engine is attached on the server as game.engine; the browser never needs it.
 */
export function wordGame(kind) {
  const game = {
    id: kind.id,
    title: kind.title,
    blurb: kind.blurb,
    how: kind.how,
    W: 360,
    H: kind.H || 480,
    roundMs: kind.roundMs,
    points: kind.points,
    snapshots: true,
    engine: null,

    init(st) {
      const { board, words } = kind.makeBoard(st, game.engine);
      // naija: answer words from the daily game score double when they turn up
      st.g = {
        board,
        words,                      // every valid word on this board (server only, see view)
        naija: words.filter((w) => game.engine.naija.has(w)),
        salt: (st.rng >>> 0).toString(36),
        turn: 0,
        played: [false, false],
        found: [[], []],
        scores: [0, 0],
        live: null,                 // { seat, startedAt }
      };
    },

    toMove: (st) => (game.result(st) ? [] : [st.g.turn]),

    apply(st, seat, move, ctx) {
      const g = st.g;
      if (ctx.cpu) {
        // The computer finds a share of the words, mostly short everyday ones.
        const picks = g.words.filter((w) => game.engine.common.has(w) && Math.random() < kind.cpuChance(w.length));
        return finish(g, seat, picks);
      }
      if (move.start) {
        if (g.live) bad("round_running", "Your round is already running", 409);
        g.live = { seat, startedAt: ctx.now };
        return [{ type: "round_start", seat }];
      }
      if (!g.live || g.live.seat !== seat) bad("no_round", "Start your round first", 409);
      const elapsed = ctx.now - g.live.startedAt;
      if (elapsed < kind.roundMs - 4000) bad("too_early", "The round isn't over yet", 409);
      const all = new Set(g.words);
      const words = [...new Set((Array.isArray(move.words) ? move.words.slice(0, 400) : []).map((w) => String(w).toLowerCase()))]
        .filter((w) => all.has(w));
      g.live = null;
      return finish(g, seat, words);
    },

    cpu: () => ({ auto: true }),

    result(st) {
      const g = st.g;
      if (!g.played[0] || !g.played[1]) return null;
      const [a, b] = g.scores;
      return { winner: a === b ? null : a > b ? 0 : 1, score: [a, b] };
    },

    // The board stays hidden until your round starts, and the word list until the game is over.
    view(st, seat) {
      const g = st.g;
      const over = !!game.result(st);
      const mineLive = g.live && g.live.seat === seat;
      const show = over || mineLive || g.played[seat];
      return {
        board: show ? g.board : null,
        hashes: mineLive ? g.words.map((w) => fingerprint(g.salt, w)) : null,
        naijaHashes: mineLive ? g.naija.map((w) => fingerprint(g.salt, w)) : null,
        salt: g.salt,
        startedAgo: mineLive ? Math.max(0, (Date.now() - g.live.startedAt)) : null,
        roundMs: kind.roundMs,
        turn: g.turn,
        played: g.played,
        scores: g.scores,
        found: over ? g.found : g.found.map((f, s) => (s === seat ? f : f.length)),
        total: over ? g.words.length : null,
        missed: over ? g.words.filter((w) => !g.found[seat].includes(w)).sort((a, b) => b.length - a.length).slice(0, 12) : null,
        seat,
      };
    },
  };

  function finish(g, seat, words) {
    let score = 0;
    for (const w of words) score += kind.points(w.length) * (g.naija.includes(w) ? 2 : 1);
    g.found[seat] = words.sort((a, b) => b.length - a.length || a.localeCompare(b));
    g.scores[seat] = score;
    g.played[seat] = true;
    g.turn = 1 - seat;
    return [{ type: "round_end", seat, score, count: words.length }];
  }

  return game;
}

export { normalR, num };
