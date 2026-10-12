import G, { legalPits } from "/shared/ayo.js";
import { onTap, stepThrough, popup, slab, disc, label, INK, PAPER, DANFO, WOOD } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const scoreOf = (v, seat) => ({ mine: v.store[seat], theirs: v.store[1 - seat], unit: "seeds, 25 wins" });

const PIT_R = 24, GAP = 54, X0 = 45;
const ROW_Y = [250, 140];   // seat 0's pits along the bottom, seat 1's along the top
const SEED = "#5b3a1e";

/** Where pit i sits on screen: bottom row left→right (0–5), top row right→left (6–11), so sowing goes anticlockwise. */
function pitXY(i) {
  if (i < 6) return [X0 + i * GAP, ROW_Y[0]];
  return [X0 + (11 - i) * GAP, ROW_Y[1]];
}

export default function ayo({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;

  function seeds(x, y, n) {
    if (n <= 12) {
      for (let k = 0; k < n; k++) {
        const a = k * 2.4, d = k === 0 ? 0 : 6 + (k % 3) * 4;
        disc(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 4.5, SEED, { shadow: 0, line: 1.5 });
      }
    } else label(ctx, String(n), x, y, { size: 20, color: PAPER, outline: 5 });
  }

  function draw(highlight = []) {
    ctx.fillStyle = "#2c6e37";
    ctx.fillRect(0, 0, W, H);
    slab(ctx, 14, 92, W - 28, 206, WOOD, { r: 30, shadow: 7, line: 4 });
    if (!view) return;
    const can = canMove() ? legalPits(view.pits, seat) : [];
    for (let i = 0; i < 12; i++) {
      const [x, y] = pitXY(i);
      disc(ctx, x, y, PIT_R, "#8a5a2e", { shadow: 0, line: 3 });
      if (highlight.includes(i)) { ctx.globalAlpha = 0.5; disc(ctx, x, y, PIT_R, DANFO, { shadow: 0, line: 0 }); ctx.globalAlpha = 1; }
      seeds(x, y, view.pits[i]);
      label(ctx, String(view.pits[i]), x, y + (i < 6 ? 36 : -36), { size: 13, color: PAPER, weight: 800 });
      if (can.includes(i)) { ctx.lineWidth = 3; ctx.strokeStyle = DANFO; ctx.beginPath(); ctx.arc(x, y, PIT_R + 4, 0, Math.PI * 2); ctx.stroke(); }
    }
    label(ctx, "Computer's pits", W / 2, 70, { size: 15, color: PAPER });
    label(ctx, "Your pits", W / 2, 322, { size: 15, color: PAPER });
    label(ctx, "Seeds travel anticlockwise ↺", W / 2, 344, { size: 12, color: "rgba(255,253,244,0.75)", weight: 700 });
  }

  const offTap = onTap(stage, (x, y) => {
    if (!canMove()) return;
    for (const i of legalPits(view.pits, seat)) {
      const [px, py] = pitXY(i);
      if (Math.hypot(x - px, y - py) < PIT_R + 8) return submit({ pit: i });
    }
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events) {
      await stepThrough(events, seat, async (snap, e) => {
        view = snap;
        draw([e.pit, ...e.path]);
        if (e.captured) await popup(stage, () => draw(e.taken), `+${e.captured}`, W / 2, 196, DANFO);
      }, { mine: 300, theirs: 700 });
      draw();
    },
    destroy() { offTap(); },
  };
}
