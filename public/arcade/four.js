import G, { COLS, ROWS, dropRow } from "/shared/four.js";
import { onTap, tween, stepThrough, slab, disc, ring, label, INK, PAPER, GREEN, DANFO, BLUE } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const scoreOf = (v, seat) => ({
  mine: v.b.filter((x) => x === seat + 1).length,
  theirs: v.b.filter((x) => x === 2 - seat).length,
  unit: "discs, four in a line wins",
});

const CELL = 46, X0 = 19, Y0 = 70, R = 18;
const cx = (c) => X0 + c * CELL + CELL / 2;
const cy = (r) => Y0 + r * CELL + CELL / 2;

export default function four({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  const colorOf = (v) => (v === seat + 1 ? GREEN : DANFO);

  function draw(extra, falling) {
    ctx.fillStyle = "#1c4fb8";
    ctx.fillRect(0, 0, W, H);
    if (view && canMove()) for (let c = 0; c < COLS; c++) if (dropRow(view.b, c) >= 0) label(ctx, "▼", cx(c), 40, { size: 18, color: "rgba(255,253,244,0.5)" });
    slab(ctx, X0 - 8, Y0 - 8, COLS * CELL + 16, ROWS * CELL + 16, BLUE, { r: 12, shadow: 6, line: 4 });
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const v = view?.b[r * COLS + c];
      disc(ctx, cx(c), cy(r), R, v ? colorOf(v) : PAPER, { shadow: 0, line: 3 });
    }
    if (falling) disc(ctx, cx(falling.c), falling.y, R, colorOf(falling.v), { shadow: 2, line: 3 });
    if (view?.last && !falling) ring(ctx, cx(view.last[1]), cy(view.last[0]), 7, PAPER, 3);
    if (view?.win) for (const [r, c] of view.win) ring(ctx, cx(c), cy(r), R + 2, PAPER, 4);
    extra?.();
  }

  const offTap = onTap(stage, (x) => {
    if (!canMove()) return;
    const c = Math.floor((x - X0) / CELL);
    if (c < 0 || c >= COLS || dropRow(view.b, c) < 0) return;
    submit({ col: c });
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events, m, before) {
      view = before.view;
      await stepThrough(events, seat, async (snap, e) => {
        const target = cy(e.r);
        await tween(260 + e.r * 25, (p) => draw(null, { c: e.c, y: 40 + (target - 40) * p * p, v: e.seat + 1 }));
        view = snap;
        draw();
      }, { mine: 60, theirs: 300 });
    },
    destroy() { offTap(); },
  };
}
