import G, { N, movesFor } from "/shared/reversi.js";
import { onTap, stepThrough, popup, slab, disc, label, INK, PAPER, DANFO, LEAF } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const scoreOf = (v, seat) => ({
  mine: v.b.filter((x) => x === seat + 1).length,
  theirs: v.b.filter((x) => x === 2 - seat).length,
  unit: "discs",
});

const CELL = 42, X0 = 12, Y0 = 20;

export default function reversi({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;

  function draw(flash) {
    ctx.fillStyle = "#2c6e37";
    ctx.fillRect(0, 0, W, H);
    slab(ctx, X0, Y0, N * CELL, N * CELL, LEAF, { r: 6, shadow: 6, line: 4 });
    for (const i of [0, 7, 56, 63]) {
      ctx.fillStyle = "rgba(255,200,30,0.45)";
      ctx.fillRect(X0 + (i % N) * CELL + 2, Y0 + Math.floor(i / N) * CELL + 2, CELL - 4, CELL - 4);
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    for (let k = 1; k < N; k++) {
      ctx.beginPath(); ctx.moveTo(X0 + k * CELL, Y0); ctx.lineTo(X0 + k * CELL, Y0 + N * CELL); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X0, Y0 + k * CELL); ctx.lineTo(X0 + N * CELL, Y0 + k * CELL); ctx.stroke();
    }
    if (!view) return;
    view.b.forEach((v, i) => {
      if (!v) return;
      const x = X0 + (i % N) * CELL + CELL / 2, y = Y0 + Math.floor(i / N) * CELL + CELL / 2;
      disc(ctx, x, y, 16, v === 1 ? INK : PAPER, { shadow: 2, line: 2.5 });
      if (flash?.includes(i)) { ctx.globalAlpha = 0.45; disc(ctx, x, y, 16, DANFO, { shadow: 0, line: 0 }); ctx.globalAlpha = 1; }
    });
    if (view.last !== null && view.last !== undefined) {
      const i = view.last;
      disc(ctx, X0 + (i % N) * CELL + CELL / 2, Y0 + Math.floor(i / N) * CELL + CELL / 2, 4, DANFO, { shadow: 0, line: 1.5 });
    }
    if (canMove()) {
      for (const i of movesFor(view.b, seat + 1)) {
        ctx.fillStyle = "rgba(255,253,244,0.75)";
        ctx.beginPath(); ctx.arc(X0 + (i % N) * CELL + CELL / 2, Y0 + Math.floor(i / N) * CELL + CELL / 2, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
    label(ctx, seat === 0 ? "You are black" : "You are white", W / 2, Y0 + N * CELL + 28, { size: 16, color: PAPER });
  }

  const offTap = onTap(stage, (x, y) => {
    if (!canMove()) return;
    const c = Math.floor((x - X0) / CELL), r = Math.floor((y - Y0) / CELL);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const i = r * N + c;
    if (movesFor(view.b, seat + 1).includes(i)) submit({ i });
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events) {
      await stepThrough(events, seat, async (snap, e) => {
        view = { ...snap, last: e.i };
        draw([e.i, ...e.flipped]);
        if (e.passed !== null && e.passed !== undefined) {
          await popup(stage, () => draw(), e.passed === seat ? "You have no move: pass" : "Computer has no move", W / 2, H / 2, DANFO);
        }
      }, { mine: 220, theirs: 600 });
      draw();
    },
    destroy() { offTap(); },
  };
}
