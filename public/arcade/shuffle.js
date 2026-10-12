import G, { simulate, ZONES, LEFT, RIGHT, END, START, PUCK_R, MAX_V } from "/shared/shuffle.js";
import { onFlick, streak, playFrames, sleep, popup, slab, label, sfx, haptic, shake, burst, INK, PAPER, RED, BLUE, DANFO, SAND, GREEN } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
export const scoreOf = (v, seat) => ({
  mine: v.scores[seat],
  theirs: v.scores[1 - seat],
  unit: v.round < 3 ? `round ${v.round + 1} of 3` : "points",
});

const POWER = 3.4;  // swipe length to launch speed
const REACH = 60;
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
      if (drag) {
        const [vx, vy] = velocity(drag);
        const l = Math.hypot(vx, vy);
        streak(ctx, drag.trail, PAPER);
        const dx = drag.x - drag.x0, dy = drag.y - drag.y0, d = Math.hypot(dx, dy) || 1, k = Math.min(1, REACH / d);
        cover(START[0] + dx * k, START[1] + dy * k, seat);
        // power meter: green is safe, red slides off the end
        const p = Math.min(1, l / MAX_V);
        slab(ctx, W - 30, 250, 16, 150, PAPER, { r: 8, shadow: 3, line: 2.5 });
        slab(ctx, W - 30, 250 + 150 * (1 - p), 16, 150 * p, l > 820 ? RED : GREEN, { r: 8, shadow: 0, line: 2.5 });
      } else {
        cover(START[0], START[1], seat);
        label(ctx, "Swipe up ↑", START[0], START[1] + 34, { size: 14, color: INK });
      }
    }
    extra?.();
  }

  // Push the cover forward with your finger and let go: the swipe is the shot.
  const velocity = (d) => {
    let vx = (d.x - d.x0) * POWER, vy = (d.y - d.y0) * POWER;
    const l = Math.hypot(vx, vy);
    if (l > MAX_V) { vx = (vx * MAX_V) / l; vy = (vy * MAX_V) / l; }
    return [vx, vy];
  };
  const off = onFlick(stage, {
    grab(x, y) {
      if (!canMove() || Math.hypot(x - START[0], y - START[1]) > 70) return false;
      drag = { x0: x, y0: y, x, y, trail: null };
      draw();
      return true;
    },
    move(x, y, trail) { drag.x = x; drag.y = y; drag.trail = trail; draw(); },
    release() {
      const [vx, vy] = velocity(drag);
      drag = null;
      draw();
      if (vy > -60) { hint("Swipe the cover up the board."); return; }
      sfx("slide");
      submit({ vx, vy });
    },
    cancel() { drag = null; draw(); },
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
        if (e.seat !== seat) sfx("slide");
        let prev = null;
        await playFrames(frames, (f) => {
          draw(null, f.map(([x, y, a], i) => ({ x, y, alive: a, seat: seats[i] })));
          // a clack when covers hit each other (a sudden change in a cover's speed), a drop when one goes off
          if (prev) f.forEach(([x, y, a], i) => {
            const [px, py, pa] = prev[i] || [x, y, a];
            if (pa && !a) { sfx("meh"); }
            if (i < f.length - 1 && a && Math.hypot(x - px, y - py) > 0.5 && pa) {
              const q = prev.__v?.[i];
              const v = Math.hypot(x - px, y - py);
              if (q !== undefined && v > q + 1.2) { sfx("click"); haptic(10); burst(stage, x, y, { color: PAPER, n: 6, speed: 120, up: 0, g: 0, size: 3 }); }
            }
          });
          const vs = f.map(([x, y], i) => (prev ? Math.hypot(x - prev[i][0], y - prev[i][1]) : 0));
          prev = f.map((p) => p.slice());
          prev.__v = vs;
        });
        v = { ...v, thrown, pucks: e.after };
        if (e.roundOver) {
          view = { ...v, pucks: e.after };
          const [a, b] = [e.roundPoints[seat], e.roundPoints[1 - seat]];
          await popup(stage, () => draw(null, e.after), `Round: you ${a}, them ${b}`, W / 2, 300, a > b ? DANFO : PAPER);
          await sleep(300);
          v = { ...v, pucks: [], thrown: [0, 0] };
        }
        await sleep(120);
      }
    },
    destroy() { off(); },
  };
}
