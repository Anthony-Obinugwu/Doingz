import G, { HOLES, simulate, BALL_R, HOLE_R, MAX_V } from "/shared/golf.js";
import { onDrag, playFrames, sleep, popup, slab, disc, label, arrow, INK, PAPER, RED, PINK, DANFO, LEAF, WATER } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
const total = (arr) => arr.reduce((a, b) => a + (b || 0), 0);
export const scoreOf = (v, seat) => ({
  mine: total(v.strokes[seat]) + (v.turn === seat && v.hole < HOLES.length ? v.stroke : 0),
  theirs: total(v.strokes[1 - seat]) + (v.turn !== seat && v.hole < HOLES.length ? v.stroke : 0),
  unit: v.hole < HOLES.length ? `hole ${v.hole + 1} of ${HOLES.length}, strokes` : "strokes",
});

const PULL = 4.2;
const DARK = "#2c6e37";

export default function golf({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  let shown = null;       // { hole, ball:[x,y], who }
  let drag = null;

  function course(hi) {
    const h = HOLES[hi];
    ctx.fillStyle = DARK;
    ctx.fillRect(0, 0, W, H);
    // fairway with a hard shadow
    const path = () => { ctx.beginPath(); h.outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    ctx.save(); ctx.translate(6, 6); path(); ctx.fillStyle = INK; ctx.fill(); ctx.restore();
    path(); ctx.fillStyle = LEAF; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke();
    for (const r of h.water) {
      slab(ctx, r[0], r[1], r[2], r[3], WATER, { r: 10, shadow: 0, line: 3 });
      ctx.strokeStyle = PAPER; ctx.lineWidth = 2;
      for (let y = r[1] + 18; y < r[1] + r[3] - 8; y += 22) {
        ctx.beginPath();
        for (let x = r[0] + 10; x < r[0] + r[2] - 10; x += 4) ctx.lineTo(x, y + Math.sin(x / 8) * 2.5);
        ctx.stroke();
      }
    }
    for (const w of h.walls || []) {
      ctx.strokeStyle = INK; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(w[0], w[1]); ctx.lineTo(w[2], w[3]); ctx.stroke();
    }
    for (const [x, y, w, hh, kind] of h.blocks) {
      if (kind === "danfo") {
        slab(ctx, x, y, w, hh, DANFO, { r: 6, shadow: 4, line: 3 });
        ctx.fillStyle = INK;
        ctx.fillRect(x + 2, y + hh * 0.62, w - 4, 3);
        ctx.fillRect(x + 2, y + hh * 0.78, w - 4, 3);
        for (let wx = x + 8; wx < x + w - 12; wx += 18) { ctx.fillStyle = "#bfe3ff"; ctx.fillRect(wx, y + 5, 12, hh * 0.4); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(wx, y + 5, 12, hh * 0.4); }
      } else {
        slab(ctx, x, y, w, hh, PAPER, { r: 3, shadow: 3, line: 2.5 });
        ctx.fillStyle = RED;
        for (let sx = x + 4; sx < x + w - 4; sx += 12) ctx.fillRect(sx, y + 2, 6, hh - 4);
      }
    }
    // hole and flag
    const [hx, hy] = h.hole;
    disc(ctx, hx, hy, HOLE_R, INK, { shadow: 0, line: 2 });
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy - 46); ctx.stroke();
    ctx.fillStyle = RED;
    ctx.beginPath(); ctx.moveTo(hx, hy - 46); ctx.lineTo(hx + 24, hy - 38); ctx.lineTo(hx, hy - 30); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    // hole name
    slab(ctx, 10, 504, 250, 28, PAPER, { r: 6, shadow: 3, line: 2.5 });
    label(ctx, `Hole ${hi + 1}: ${h.name}, par ${h.par}`, 20, 518, { size: 15, align: "left" });
  }

  const ballColor = (who) => (who === seat ? PAPER : PINK);

  function draw(extra, ballAt, who) {
    if (!shown) return;
    course(shown.hole);
    const b = ballAt || shown.ball;
    if (b) disc(ctx, b[0], b[1], BALL_R + 1, ballColor(who ?? shown.who), { shadow: 2, line: 2.5 });
    if (drag && shown.ball) {
      let vx = (drag.x0 - drag.x) * PULL, vy = (drag.y0 - drag.y) * PULL;
      const l = Math.hypot(vx, vy);
      if (l > MAX_V) { vx = (vx * MAX_V) / l; vy = (vy * MAX_V) / l; }
      const p = Math.min(1, l / MAX_V);
      arrow(ctx, shown.ball[0], shown.ball[1], shown.ball[0] + vx / 7, shown.ball[1] + vy / 7, p > 0.75 ? RED : p > 0.4 ? DANFO : PAPER, 5);
    }
    extra?.();
  }

  const off = onDrag(stage, {
    down(x, y) { if (canMove()) { drag = { x0: x, y0: y, x, y }; draw(); } },
    move(x, y) { if (drag) { drag.x = x; drag.y = y; draw(); } },
    up(x) {
      if (!drag) return;
      let vx = (drag.x0 - drag.x) * PULL, vy = (drag.y0 - drag.y) * PULL;
      drag = null;
      draw();
      const l = Math.hypot(vx, vy);
      if (x === null || l < 25) return;
      if (l > MAX_V) { vx = (vx * MAX_V) / l; vy = (vy * MAX_V) / l; }
      submit({ vx, vy });
    },
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) {
      view = m.view;
      if (view.hole < HOLES.length) shown = { hole: view.hole, ball: view.ball, who: view.turn };
      draw();
    },
    async play(events) {
      for (const e of events) {
        if (e.type !== "putt") continue;
        if (!shown || shown.hole !== e.hole || shown.who !== e.seat) {
          shown = { hole: e.hole, ball: e.from, who: e.seat };
          draw();
          if (e.seat !== seat) await popup(stage, () => draw(), "Computer's turn", 180, 270, PINK);
        }
        const frames = [];
        simulate(e.hole, e.from[0], e.from[1], e.vx, e.vy, frames);
        await playFrames(frames, (f) => draw(null, f, e.seat));
        const last = frames[frames.length - 1] || e.from;
        if (e.splash) {
          await popup(stage, () => draw(null, last, e.seat), "Splash! +1", last[0], last[1] - 20, WATER);
          shown.ball = e.from;
        } else if (e.holed) {
          shown.ball = null;
          await popup(stage, () => draw(null, [-50, -50], e.seat), e.stroke === 1 ? "Hole in one!" : "In!", e.from[0] < 180 ? 220 : 140, 260);
        } else {
          shown.ball = [e.x, e.y];
        }
        if (e.done && !e.holed) await popup(stage, () => draw(), "Picked up", 180, 270, PAPER);
        if (e.done) await popup(stage, () => draw(), `${e.count} stroke${e.count === 1 ? "" : "s"}`, 180, 300, DANFO);
        await sleep(e.seat === seat ? 60 : 220);
      }
    },
    destroy() { off(); },
  };
}
