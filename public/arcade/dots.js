import G, { D, B, H_LINES, LINES } from "/shared/dots.js";
import { onTap, stepThrough, slab, disc, label, INK, PAPER, RED, BLUE, DANFO } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const scoreOf = (v, seat) => ({
  mine: v.boxes.filter((x) => x === seat + 1).length,
  theirs: v.boxes.filter((x) => x === 2 - seat).length,
  unit: "boxes of 16",
});

const GAP = 70, X0 = 40, Y0 = 40;
/** End points of line l. */
function ends(l) {
  if (l < H_LINES) { const r = Math.floor(l / B), c = l % B; return [X0 + c * GAP, Y0 + r * GAP, X0 + (c + 1) * GAP, Y0 + r * GAP]; }
  const k = l - H_LINES, r = Math.floor(k / D), c = k % D;
  return [X0 + c * GAP, Y0 + r * GAP, X0 + c * GAP, Y0 + (r + 1) * GAP];
}

export default function dots({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  const col = (v) => (v === seat + 1 ? RED : BLUE);

  function draw() {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    if (!view) return;
    view.boxes.forEach((v, i) => {
      if (!v) return;
      const r = Math.floor(i / B), c = i % B;
      slab(ctx, X0 + c * GAP + 6, Y0 + r * GAP + 6, GAP - 12, GAP - 12, col(v), { r: 6, shadow: 0, line: 0 });
      label(ctx, v === seat + 1 ? "You" : "CPU", X0 + c * GAP + GAP / 2, Y0 + r * GAP + GAP / 2, { size: 16, color: PAPER });
    });
    for (let l = 0; l < LINES; l++) {
      const [x1, y1, x2, y2] = ends(l);
      const v = view.lines[l];
      ctx.lineCap = "round";
      if (v) {
        ctx.strokeStyle = INK; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = l === view.last ? DANFO : col(v); ctx.lineWidth = 6; ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(29,27,22,0.12)"; ctx.lineWidth = 6; ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    for (let r = 0; r < D; r++) for (let c = 0; c < D; c++) disc(ctx, X0 + c * GAP, Y0 + r * GAP, 7, INK, { shadow: 0, line: 0 });
  }

  const offTap = onTap(stage, (x, y) => {
    if (!canMove()) return;
    let best = null;
    for (let l = 0; l < LINES; l++) {
      if (view.lines[l]) continue;
      const [x1, y1, x2, y2] = ends(l);
      const d = Math.hypot(x - (x1 + x2) / 2, y - (y1 + y2) / 2);
      if (d < 30 && (!best || d < best.d)) best = { d, l };
    }
    if (best) submit({ line: best.l });
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events) { await stepThrough(events, seat, (snap) => { view = snap; draw(); }, { mine: 120, theirs: 420 }); },
    destroy() { offTap(); },
  };
}
