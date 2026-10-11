// Archery at the Durbar: six arrows each, wind changes every shot. Highest total wins.
import { randNormal, rand, num } from "./phys.js";
import { turnOf, normalR } from "./rules.js";

const ARROWS = 6;
const SCATTER = 0.04;

/** Score on a target of radius 1: 10 in the middle ring down to 1 at the edge. */
export function ringScore(x, y) {
  const d = Math.sqrt(x * x + y * y);
  if (d >= 1) return 0;
  return 10 - Math.floor(d * 10);
}

function newWind(st) {
  // Strength 0–0.3 target radii, any direction. Decided by the server, sent as data.
  const s = rand(st) * 0.3;
  const a = rand(st) * Math.PI * 2;
  return { x: Math.round(s * Math.cos(a) * 1000) / 1000, y: Math.round(s * Math.sin(a) * 1000) / 1000 };
}

const game = {
  id: "archery",
  title: "Archery",
  blurb: "Durbar day. Six arrows each, and mind the wind.",
  how: "Hold to draw, aim against the wind, let go to shoot.",
  W: 360,
  H: 460,

  init(st) {
    st.g = { scores: [0, 0], arrows: [0, 0], turn: 0, wind: newWind(st), shots: [] };
  },

  toMove: (st) => turnOf(game, st),

  apply(st, seat, move) {
    const g = st.g;
    const x = num(move.x, -1.6, 1.6) + g.wind.x + randNormal(st) * SCATTER;
    const y = num(move.y, -1.6, 1.6) + g.wind.y + randNormal(st) * SCATTER;
    const value = ringScore(x, y);
    g.scores[seat] += value;
    g.arrows[seat] += 1;
    g.shots.push({ seat, x, y, value });
    if (g.shots.length > 12) g.shots.shift();
    const ev = { type: "arrow", seat, x, y, value, wind: g.wind };
    g.turn = 1 - seat;
    g.wind = newWind(st);
    return [ev];
  },

  cpu(st, seat, R) {
    const w = st.g.wind;
    return { x: -w.x + normalR(R) * 0.13, y: -w.y + normalR(R) * 0.13 };
  },

  result(st) {
    const g = st.g;
    if (g.arrows[0] < ARROWS || g.arrows[1] < ARROWS) return null;
    const [a, b] = g.scores;
    return { winner: a === b ? null : a > b ? 0 : 1, score: [a, b] };
  },
};
export default game;
