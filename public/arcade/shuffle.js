import G, { simulate, ZONES, LEFT, RIGHT, END, START, PUCK_R, MAX_V } from "/shared/shuffle.js";
import { onDrag, playFrames, sleep, popup, slab, label, arrow, INK, PAPER, RED, BLUE, DANFO, SAND } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
export const scoreOf = (v, seat) => ({
  mine: v.scores[seat],
  theirs: v.scores[1 - seat],
  unit: v.round < 3 ? `round ${v.round + 1} of 3` : "points",
});

const PULL = 3.4;
const ZONE_TINT = ["#ffd75e", "#ffe7a0", "#fff1c9"];

export default function shuffle({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  let drag = null;

  function cover(x, y, s, alpha = 1) {
    ctx.globalAlpha = alpha;
    // bottle cover: crimped edge
    ctx.fillStyle = INK;
    ctx.beginPath();
    for (let i = 0; i < 21; i++) {
      const a = (i / 21) * Math.PI * 2;
      const r = i % 2 ? PUCK_R + 1 : PUCK_R + 3;
      ctx.lineTo(x + 3 + Math.cos(a) * r, y + 3 + Math.sin(a) * r);
    }
    ctx.fill();
    ctx.fillStyle = s === seat ? RED : BLUE;
    ctx.beginPath();
    for (let i = 0; i < 21; i++) {
      const a = (i / 21) * Math.PI * 2;
      const r = i % 2 ? PUCK_R - 1 : PUCK_R + 1.5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, PUCK_R - 6, 0, Math.PI * 2); ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function board() {
    ctx.fillStyle = "#3b2a1a";
    ctx.fillRect(0, 0, W, H);
    slab(ctx, LEFT, END - 26, RIGHT - LEFT, H - END + 10, SAND, { r: 8, shadow: 6, line: 4 });
    ZONES.forEach((z, i) => {
      ctx.fillStyle = ZONE_TINT[i];
      ctx.fillRect(LEFT + 2, z.y0, RIGHT - LEFT - 4, z.y1 - z.y0);
      ctx.fillStyle = INK;
      ctx.fillRect(LEFT, z.y1 - 1.5, RIGHT - LEFT, 3);
      label(ctx, String(z.pts), W / 2, (z.y0 + z.y1) / 2, { size: 40, color: "rgba(29,27,22,0.22)" });
    });
    ctx.fillStyle = INK;
    ctx.fillRect(LEFT, END - 1.5, RIGHT - LEFT, 3);
    label(ctx, "Off the end", W / 2, END - 13, { size: 12, color: INK });
    ctx.setLineDash([10, 8]);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(LEFT, 430); ctx.lineTo(RIGHT, 430); ctx.stroke();
    ctx.setLineDash([]);
  }

  function hud() {
    if (!view) return;
    const left = (s) => 4 - view.thrown[s];
    for (const s of [seat, 1 - seat]) {
      const x0 = s === seat ? 14 : W - 14;
      for (let i = 0; i < left(s); i++) cover(s === seat ? x0 + 4 + i * 0 : x0 - 4, 470 - i * 34, s);
    }
  }

  function draw(extra, pucks) {
    board();
    const list = pucks || view?.pucks || [];
    for (const p of list) if (p.alive !== false && p.alive !== 0) cover(p.x, p.y, p.seat);
    hud();
    if (!pucks && canMove()) {
      cover(START[0], START[1], seat);
      if (drag) {
        let vx = (drag.x0 - drag.x) * PULL, vy = (drag.y0 - drag.y) * PULL;
        const l = Math.hypot(vx, vy);
        if (l > MAX_V) { vx = (vx * MAX_V) / l; vy = (vy * MAX_V) / l; }
        arrow(ctx, START[0], START[1], START[0] + vx / 4.5, START[1] + vy / 4.5, l > 820 ? RED : DANFO, 5);
      }
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
      if (x === null || vy > -60) return;
      const l = Math.hypot(vx, vy);
      if (l > MAX_V) { vx = (vx * MAX_V) / l; vy = (vy * MAX_V) / l; }
      submit({ vx, vy });
    },
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events, m, before) {
      let v = before.view;
      for (const e of events) {
        if (e.type !== "flick") continue;
        const pucks = e.before.map((p) => ({ ...p }));
        pucks.push({ seat: e.seat, x: START[0], y: START[1], vx: e.vx, vy: e.vy, r: PUCK_R, alive: true });
        const thrown = v.thrown.slice();
        thrown[e.seat] += 1;
        view = { ...v, thrown };
        const frames = [];
        simulate(pucks, frames);
        const seats = pucks.map((p) => p.seat);
        if (e.seat !== seat) { draw(null, e.before); await sleep(350); }
        await playFrames(frames, (f) => draw(null, f.map(([x, y, a], i) => ({ x, y, alive: a, seat: seats[i] }))));
        v = { ...v, thrown, pucks: e.after };
        if (e.roundOver) {
          view = { ...v, pucks: e.after };
          const [a, b] = [e.roundPoints[seat], e.roundPoints[1 - seat]];
          await popup(stage, () => draw(null, e.after), `Round: you ${a}, them ${b}`, W / 2, 300);
          await sleep(300);
          v = { ...v, pucks: [], thrown: [0, 0] };
        }
        await sleep(120);
      }
    },
    destroy() { off(); },
  };
}
