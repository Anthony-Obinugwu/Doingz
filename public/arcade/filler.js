import G, { COLS, ROWS, COLORS, allowed } from "/shared/filler.js";
import { onTap, stepThrough, slab, label, INK, PAPER, RED, BLUE, DANFO, GREEN, PURPLE, PINK } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const scoreOf = (v, seat) => ({
  mine: v.own.filter((x) => x === seat + 1).length,
  theirs: v.own.filter((x) => x === 2 - seat).length,
  unit: `squares, ${Math.floor((COLS * ROWS) / 2) + 1} wins`,
});

const PALETTE = [RED, DANFO, GREEN, BLUE, PURPLE, PINK];
const CELL = 42, X0 = 12, Y0 = 12;
const SW = 48, SY = 326;
const swatchX = (k) => 18 + k * (SW + 6);

export default function filler({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;

  function draw() {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    if (!view) return;
    ctx.fillStyle = INK;
    ctx.fillRect(X0 + 5, Y0 + 5, COLS * CELL, ROWS * CELL);
    view.cells.forEach((k, i) => {
      const r = Math.floor(i / COLS), c = i % COLS;
      ctx.fillStyle = PALETTE[k];
      ctx.fillRect(X0 + c * CELL, Y0 + r * CELL, CELL, CELL);
      if (view.own[i]) {
        ctx.fillStyle = view.own[i] === seat + 1 ? "rgba(255,253,244,0.28)" : "rgba(29,27,22,0.22)";
        ctx.fillRect(X0 + c * CELL, Y0 + r * CELL, CELL, CELL);
      }
    });
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(X0, Y0, COLS * CELL, ROWS * CELL);
    // outline each player's patch edge
    view.own.forEach((o, i) => {
      if (!o) return;
      const r = Math.floor(i / COLS), c = i % COLS, x = X0 + c * CELL, y = Y0 + r * CELL;
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      const other = (j, ok) => !ok || view.own[j] !== o;
      ctx.beginPath();
      if (other(i - COLS, r > 0)) { ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); }
      if (other(i + COLS, r < ROWS - 1)) { ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); }
      if (other(i - 1, c > 0)) { ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); }
      if (other(i + 1, c < COLS - 1)) { ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); }
      ctx.stroke();
    });
    label(ctx, "You", X0 + CELL / 2, Y0 + (ROWS - 1) * CELL + CELL / 2, { size: 14, color: PAPER, outline: 4 });
    label(ctx, "CPU", X0 + (COLS - 1) * CELL + CELL / 2, Y0 + CELL / 2, { size: 14, color: PAPER, outline: 4 });
    const ok = allowed(view, seat);
    for (let k = 0; k < COLORS; k++) {
      const on = canMove() && ok.includes(k);
      slab(ctx, swatchX(k), SY, SW, SW, PALETTE[k], { r: 8, shadow: on ? 4 : 0, line: 3 });
      if (!ok.includes(k)) {
        ctx.strokeStyle = INK; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(swatchX(k) + 10, SY + 10); ctx.lineTo(swatchX(k) + SW - 10, SY + SW - 10); ctx.stroke();
      }
    }
  }

  const offTap = onTap(stage, (x, y) => {
    if (!canMove() || y < SY - 6 || y > SY + SW + 6) return;
    const k = Math.floor((x - 18) / (SW + 6));
    if (k >= 0 && k < COLORS && allowed(view, seat).includes(k)) submit({ color: k });
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events) { await stepThrough(events, seat, (snap) => { view = snap; draw(); }, { mine: 250, theirs: 550 }); },
    destroy() { offTap(); },
  };
}
