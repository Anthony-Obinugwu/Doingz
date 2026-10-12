import G, { N, dark, legalMoves } from "/shared/draughts.js";
import { onTap, stepThrough, slab, disc, ring, label, INK, PAPER, RED, DANFO, SAND, WOOD } from "./kit.js";

export const W = G.W;
export const H = G.H;
const count = (v, s) => v.b.filter((p) => p && p.s === s).length;
export const scoreOf = (v, seat) => ({ mine: count(v, seat), theirs: count(v, 1 - seat), unit: "pieces left" });

const CELL = 42, X0 = 12, Y0 = 12;
const center = (i) => [X0 + (i % N) * CELL + CELL / 2, Y0 + Math.floor(i / N) * CELL + CELL / 2];

export default function draughts({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  let pick = null; // { from, path: [] }

  const candidates = () => {
    if (!pick) return [];
    return legalMoves(view.b, seat).filter((m) => m.from === pick.from && pick.path.every((x, i) => m.path[i] === x));
  };

  function draw() {
    ctx.fillStyle = "#3b2a1a";
    ctx.fillRect(0, 0, W, H);
    slab(ctx, X0, Y0, N * CELL, N * CELL, SAND, { r: 4, shadow: 6, line: 4 });
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      if (dark(r, c)) { ctx.fillStyle = WOOD; ctx.fillRect(X0 + c * CELL, Y0 + r * CELL, CELL, CELL); }
    }
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(X0, Y0, N * CELL, N * CELL);
    if (!view) return;
    if (view.last) for (const i of [view.last.from, ...view.last.path]) {
      const [x, y] = center(i);
      ctx.fillStyle = "rgba(255,200,30,0.4)"; ctx.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
    }
    // movable pieces glow when it's your turn
    const movers = canMove() ? new Set(legalMoves(view.b, seat).map((m) => m.from)) : new Set();
    view.b.forEach((p, i) => {
      if (!p) return;
      let [x, y] = center(i);
      if (pick && i === pick.from && pick.path.length) [x, y] = center(pick.path[pick.path.length - 1]);
      disc(ctx, x, y, 16, p.s === seat ? RED : PAPER, { shadow: 3, line: 3 });
      ctx.lineWidth = 2; ctx.strokeStyle = p.s === seat ? "rgba(255,253,244,0.6)" : "rgba(29,27,22,0.35)";
      ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
      if (p.k) label(ctx, "♛︎", x, y + 1, { size: 17, color: p.s === seat ? PAPER : INK, weight: 700 });
      if (movers.has(i) && !pick) ring(ctx, x, y, 19, DANFO, 2.5);
      if (pick && i === pick.from) ring(ctx, x, y, 19, DANFO, 4);
    });
    for (const m of candidates()) {
      const next = m.path[pick.path.length];
      if (next === undefined) continue;
      const [x, y] = center(next);
      disc(ctx, x, y, 8, DANFO, { shadow: 0, line: 2.5 });
    }
    label(ctx, "You play red, from the bottom", W / 2, Y0 + N * CELL + 22, { size: 15, color: PAPER });
  }

  const offTap = onTap(stage, (x, y) => {
    if (!canMove()) return;
    const c = Math.floor((x - X0) / CELL), r = Math.floor((y - Y0) / CELL);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const i = r * N + c;
    const moves = legalMoves(view.b, seat);
    if (moves.some((m) => m.from === i) && (!pick || !pick.path.length)) { pick = { from: i, path: [] }; draw(); return; }
    if (!pick) return;
    const next = candidates().filter((m) => m.path[pick.path.length] === i);
    if (!next.length) { pick = null; draw(); return; }
    pick.path.push(i);
    const done = next.find((m) => m.path.length === pick.path.length);
    if (done && next.length === 1) {
      const mv = { from: pick.from, path: pick.path.slice() };
      pick = null;
      submit(mv);
    } else draw();
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; pick = null; draw(); },
    async play(events) { await stepThrough(events, seat, (snap) => { view = snap; draw(); }, { mine: 150, theirs: 650 }); },
    destroy() { offTap(); },
  };
}
