import G, { N } from "/shared/gomoku.js";
import { onTap, stepThrough, slab, disc, ring, INK, PAPER, DANFO, SAND } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const scoreOf = (v, seat) => ({
  mine: v.b.filter((x) => x === seat + 1).length,
  theirs: v.b.filter((x) => x === 2 - seat).length,
  unit: "stones, five in a line wins",
});

const GAP = 26, X0 = 24, Y0 = 24;
const px = (i) => [X0 + (i % N) * GAP, Y0 + Math.floor(i / N) * GAP];

export default function gomoku({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;

  function draw() {
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(0, 0, W, H);
    slab(ctx, X0 - 16, Y0 - 16, (N - 1) * GAP + 32, (N - 1) * GAP + 32, SAND, { r: 8, shadow: 6, line: 4 });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    for (let k = 0; k < N; k++) {
      ctx.beginPath(); ctx.moveTo(X0, Y0 + k * GAP); ctx.lineTo(X0 + (N - 1) * GAP, Y0 + k * GAP); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X0 + k * GAP, Y0); ctx.lineTo(X0 + k * GAP, Y0 + (N - 1) * GAP); ctx.stroke();
    }
    for (const i of [3 * N + 3, 3 * N + 9, 9 * N + 3, 9 * N + 9, 6 * N + 6]) { const [x, y] = px(i); disc(ctx, x, y, 3, INK, { shadow: 0, line: 0 }); }
    if (!view) return;
    view.b.forEach((v, i) => { if (v) { const [x, y] = px(i); disc(ctx, x, y, 11, v === 1 ? INK : PAPER, { shadow: 2, line: 2.5 }); } });
    if (view.last !== null && view.last !== undefined) { const [x, y] = px(view.last); disc(ctx, x, y, 4, DANFO, { shadow: 0, line: 1.5 }); }
    if (view.win) for (const i of view.win) { const [x, y] = px(i); ring(ctx, x, y, 13, DANFO, 3); }
  }

  const offTap = onTap(stage, (x, y) => {
    if (!canMove()) return;
    const c = Math.round((x - X0) / GAP), r = Math.round((y - Y0) / GAP);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const i = r * N + c;
    if (!view.b[i]) submit({ i });
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events) { await stepThrough(events, seat, (snap) => { view = snap; draw(); }, { mine: 120, theirs: 450 }); },
    destroy() { offTap(); },
  };
}
