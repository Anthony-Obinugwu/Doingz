// Sea Battle off the Lagos coast: find and sink the other fleet before they sink yours.
// Fleets are placed by the server; you can reshuffle yours before the first shot.
import { bad, turnOf } from "./rules.js";
import { randInt } from "./phys.js";

export const N = 9;
export const FLEET = [5, 4, 3, 3, 2];
export const SHIP_NAMES = ["Tanker", "Ferry", "Trawler", "Tug", "Canoe"];

function placeFleet(st) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const taken = Array(N * N).fill(-1);
    const ships = [];
    let ok = true;
    for (let k = 0; k < FLEET.length && ok; k++) {
      let placed = false;
      for (let t = 0; t < 200 && !placed; t++) {
        const horiz = randInt(st, 0, 1) === 1;
        const r = randInt(st, 0, horiz ? N - 1 : N - FLEET[k]);
        const c = randInt(st, 0, horiz ? N - FLEET[k] : N - 1);
        const cells = [...Array(FLEET[k]).keys()].map((j) => (horiz ? r * N + c + j : (r + j) * N + c));
        // keep ships from touching, so every ship is findable on its own
        const clash = cells.some((i) => {
          const rr = Math.floor(i / N), cc = i % N;
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const r2 = rr + dr, c2 = cc + dc;
            if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N && taken[r2 * N + c2] >= 0) return true;
          }
          return false;
        });
        if (clash) continue;
        cells.forEach((i) => (taken[i] = k));
        ships.push({ cells, horiz });
        placed = true;
      }
      if (!placed) ok = false;
    }
    if (ok) return ships;
  }
  throw new Error("couldn't place fleet");
}

const sunk = (ship, shots) => ship.cells.every((i) => shots[i]);
const allSunk = (fleet, shots) => fleet.every((s) => sunk(s, shots));

const game = {
  id: "seabattle",
  title: "Sea Battle",
  blurb: "Hunt their fleet off the Lagos coast.",
  how: "Tap a square in their waters to fire. You take turns.",
  W: 360,
  H: 545,
  snapshots: true,

  init(st) {
    // shots[s] = squares seat s has fired at on the OTHER fleet's waters: 0 none, 1 miss, 2 hit
    st.g = { fleets: [placeFleet(st), placeFleet(st)], shots: [Array(N * N).fill(0), Array(N * N).fill(0)], turn: 0, last: null, shuffles: 0 };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    if (move.reshuffle) {
      if (g.shots[0].some(Boolean) || g.shots[1].some(Boolean)) bad("too_late", "The battle has started");
      if (g.shuffles >= 10) bad("too_many", "That's enough shuffling");
      g.shuffles += 1;
      g.fleets[seat] = placeFleet(st);
      return [{ type: "reshuffle", seat }];
    }
    const i = Number(move.i);
    if (!Number.isInteger(i) || i < 0 || i >= N * N || g.shots[seat][i]) bad("bad_move", "You've fired there already");
    const enemy = g.fleets[1 - seat];
    const k = enemy.findIndex((s) => s.cells.includes(i));
    g.shots[seat][i] = k >= 0 ? 2 : 1;
    const sank = k >= 0 && sunk(enemy[k], g.shots[seat]) ? k : -1;
    g.last = { seat, i };
    g.turn = 1 - seat;
    return [{ type: "shot", seat, i, hit: k >= 0, sank, name: sank >= 0 ? SHIP_NAMES[sank] : null }];
  },

  cpu(st, seat, R) {
    const g = st.g;
    const shots = g.shots[seat];
    const enemy = g.fleets[1 - seat];
    const open = (i) => i >= 0 && i < N * N && !shots[i];
    // Hits on ships that aren't sunk yet: finish them first.
    const live = [];
    for (let i = 0; i < N * N; i++) {
      if (shots[i] !== 2) continue;
      const ship = enemy.find((s) => s.cells.includes(i));
      if (!sunk(ship, shots)) live.push(i);
    }
    if (live.length) {
      const cand = [];
      if (live.length >= 2) {
        const horiz = Math.floor(live[0] / N) === Math.floor(live[1] / N);
        const sorted = live.slice().sort((a, b) => a - b);
        const lo = sorted[0], hi = sorted[sorted.length - 1];
        if (horiz) { if (lo % N > 0) cand.push(lo - 1); if (hi % N < N - 1) cand.push(hi + 1); }
        else cand.push(lo - N, hi + N);
      }
      for (const i of live) {
        if (i % N > 0) cand.push(i - 1);
        if (i % N < N - 1) cand.push(i + 1);
        cand.push(i - N, i + N);
      }
      const ok = cand.filter(open);
      if (ok.length) return { i: ok[0] };
    }
    // Hunt on a checkerboard, skipping squares next to sunk ships.
    const nextToSunk = (i) => enemy.some((s) => sunk(s, shots) && s.cells.some((j) => Math.abs((j % N) - (i % N)) <= 1 && Math.abs(Math.floor(j / N) - Math.floor(i / N)) <= 1));
    let pool = [...Array(N * N).keys()].filter((i) => open(i) && (Math.floor(i / N) + (i % N)) % 2 === 0 && !nextToSunk(i));
    if (!pool.length) pool = [...Array(N * N).keys()].filter((i) => open(i) && !nextToSunk(i));
    if (!pool.length) pool = [...Array(N * N).keys()].filter(open);
    return { i: pool[Math.floor(R() * pool.length)] };
  },

  result(st) {
    const g = st.g;
    const score = [g.shots[0].filter((v) => v === 2).length, g.shots[1].filter((v) => v === 2).length];
    if (allSunk(g.fleets[1], g.shots[0])) return { winner: 0, score };
    if (allSunk(g.fleets[0], g.shots[1])) return { winner: 1, score };
    return null;
  },

  // You see your own fleet, and only the ships of theirs you've sunk.
  view(st, seat) {
    const g = st.g;
    const theirs = g.fleets[1 - seat].map((s, k) => (sunk(s, g.shots[seat]) || game.result(st) ? { ...s, k } : null)).filter(Boolean);
    return {
      mine: g.fleets[seat],
      theirs,
      myShots: g.shots[seat],
      theirShots: g.shots[1 - seat],
      turn: g.turn,
      last: g.last,
      canShuffle: !g.shots[0].some(Boolean) && !g.shots[1].some(Boolean),
      sunkCount: [g.fleets[1].filter((s) => sunk(s, g.shots[0])).length, g.fleets[0].filter((s) => sunk(s, g.shots[1])).length],
      seat,
    };
  },
};
export default game;
