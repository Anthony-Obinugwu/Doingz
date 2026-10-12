import G, { simulate, CX, CY, PIECE_R, MAX_V, SHRINK, MIN_HALF } from "/shared/knockout.js";
import { onDrag, playFrames, tween, sleep, popup, slab, disc, arrow, label, INK, PAPER, RED, BLUE, DANFO, WOOD, WATER, sfx, haptic, shake, burst } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
const alive = (v, s) => v.pieces.filter((p) => p.seat === s && p.alive).length;
export const scoreOf = (v, seat) => ({ mine: alive(v, seat), theirs: alive(v, 1 - seat), unit: "tokens left" });

const PULL = 3.1;

export default function knockout({ stage, seat, canMove, submit, hint, bar }) {
  const { ctx } = stage;
  let view = null;
  let aims = {};            // piece index -> { vx, vy }
  let drag = null;          // { i, x, y }

  bar.innerHTML = `<button class="btn" id="ko-go">Go</button>`;
  const go = bar.querySelector("#ko-go");

  function scene(half, waveT = 0) {
    ctx.fillStyle = WATER;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,253,244,0.55)"; ctx.lineWidth = 2;
    for (let y = 20; y < H; y += 26) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 6) ctx.lineTo(x, y + Math.sin((x + waveT) / 18 + y) * 3);
      ctx.stroke();
    }
    slab(ctx, CX - half, CY - half, half * 2, half * 2, WOOD, { r: 6, shadow: 7, line: 4 });
    ctx.strokeStyle = "rgba(29,27,22,0.35)"; ctx.lineWidth = 2;
    for (let y = CY - half + 22; y < CY + half; y += 22) { ctx.beginPath(); ctx.moveTo(CX - half + 3, y); ctx.lineTo(CX + half - 3, y); ctx.stroke(); }
  }

  function token(x, y, s, n, a = 1) {
    ctx.globalAlpha = a;
    disc(ctx, x, y, PIECE_R, s === seat ? RED : BLUE, { shadow: 3, line: 3 });
    label(ctx, String(n), x, y + 1, { size: 15, color: PAPER });
    ctx.globalAlpha = 1;
  }

  function draw(extra, pieces, half) {
    if (!view) return;
    scene(half ?? view.half);
    const list = pieces || view.pieces;
    list.forEach((p, i) => { if (p.alive) token(p.x, p.y, p.seat, (i % 3) + 1); });
    if (!pieces) {
      for (const [i, a] of Object.entries(aims)) {
        const p = view.pieces[i];
        arrow(ctx, p.x, p.y, p.x + a.vx / PULL, p.y + a.vy / PULL, DANFO, 5);
      }
      if (drag) {
        const p = view.pieces[drag.i];
        arrow(ctx, p.x, p.y, drag.x, drag.y, PAPER, 5);
      }
    }
    extra?.();
    go.disabled = !canMove();
    go.textContent = canMove() ? "Go" : "Waiting…";
  }

  const capped = (dx, dy) => {
    let vx = dx * PULL, vy = dy * PULL;
    const l = Math.hypot(vx, vy);
    if (l > MAX_V) { vx = (vx * MAX_V) / l; vy = (vy * MAX_V) / l; }
    return { vx, vy };
  };

  const off = onDrag(stage, {
    down(x, y) {
      if (!canMove()) return;
      const i = view.pieces.findIndex((p) => p.alive && p.seat === seat && Math.hypot(p.x - x, p.y - y) < PIECE_R + 14);
      if (i >= 0) { drag = { i, x, y }; draw(); }
    },
    move(x, y) { if (drag) { drag.x = x; drag.y = y; draw(); } },
    up(x, y) {
      if (!drag) return;
      const p = view.pieces[drag.i];
      if (x !== null) {
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < 14) delete aims[drag.i];
        else aims[drag.i] = capped(x - p.x, y - p.y);
      }
      drag = null;
      draw();
    },
  });

  go.addEventListener("click", () => {
    if (!canMove()) return;
    const shots = Object.entries(aims).map(([i, a]) => ({ i: Number(i), vx: a.vx, vy: a.vy }));
    submit({ shots });
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; aims = {}; draw(); },
    async play(events, m, before) {
      let half = before.view.half;
      for (const e of events) {
        if (e.type !== "round") continue;
        // Reveal both sides' aims for a moment.
        await tween(700, () => draw(() => {
          for (const list of e.shots) for (const s of list) {
            const p = e.before[s.i];
            arrow(ctx, p.x, p.y, p.x + s.vx / PULL, p.y + s.vy / PULL, p.seat === seat ? DANFO : PAPER, 5);
          }
        }, e.before, half));
        const pieces = e.before.map((p) => ({ ...p }));
        for (const list of e.shots) for (const s of list) { pieces[s.i].vx = s.vx; pieces[s.i].vy = s.vy; }
        half = e.halfBefore;
        const frames = [];
        simulate(pieces, half, frames);
        sfx("whoosh");
        let prevF = null;
        await playFrames(frames, (f) => {
          draw(null, f.map(([x, y, a], i) => ({ ...e.before[i], x, y, alive: a })), half);
          if (prevF) f.forEach(([x, y, a], i) => {
            if (prevF[i][2] && !a) { sfx("splash"); burst(stage, prevF[i][0], prevF[i][1], { colors: [WATER, PAPER], n: 14, up: 150 }); }
          });
          // a bump: two tokens touching that weren't a frame ago
          if (prevF) for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
            if (!f[i][2] || !f[j][2]) continue;
            const near = Math.hypot(f[i][0] - f[j][0], f[i][1] - f[j][1]) < 2 * PIECE_R + 2;
            const was = Math.hypot(prevF[i][0] - prevF[j][0], prevF[i][1] - prevF[j][1]) < 2 * PIECE_R + 2;
            if (near && !was) { sfx("thunk"); haptic(14); shake(stage, 4, 160); }
          }
          prevF = f;
        });
        const from = half;
        await tween(450, (p) => draw(null, e.afterSlide, from + (e.half - from) * p));
        half = e.half;
        const fell = e.afterSlide.filter((p, i) => p.alive && !e.after[i].alive).length;
        const fellSlide = e.before.filter((p, i) => p.alive && !e.afterSlide[i].alive).length;
        if (fell + fellSlide) await popup(stage, () => draw(null, e.after, half), `${fell + fellSlide} in the lagoon!`, W / 2, 60, PAPER);
        await sleep(150);
      }
    },
    destroy() { off(); bar.innerHTML = ""; },
  };
}
