import G, { simulate, muzzle, SAMPLES, STEP, MAX_V, BLAST } from "/shared/tanks.js";
import { onDrag, playFrames, tween, sleep, popup, slab, disc, label, arrow, dots, INK, PAPER, RED, BLUE, DANFO, SKY, LEAF } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
export const scoreOf = (v, seat) => ({ mine: v.tanks[seat].hp, theirs: v.tanks[1 - seat].hp, unit: "health" });

const ROCK = "#9b8f7a";
const PULL = 2.3;

export default function tanks({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  let drag = null;
  let aimAngle = [Math.PI / 4, Math.PI - Math.PI / 4];

  function terrain(h) {
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, W, H);
    disc(ctx, 300, 70, 26, DANFO, { shadow: 0, line: 3 });
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < SAMPLES; i++) ctx.lineTo(i * STEP, h[i]);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = LEAF;
    ctx.fill();
    // granite in the middle: Olumo Rock
    ctx.save();
    ctx.clip();
    ctx.fillStyle = ROCK;
    ctx.fillRect(110, 0, 140, H);
    ctx.restore();
    ctx.beginPath();
    for (let i = 0; i < SAMPLES; i++) ctx.lineTo(i * STEP, h[i]);
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  }

  function tank(t, s, angle) {
    const col = s === seat ? RED : BLUE;
    const [mx, my] = muzzle(t);
    ctx.lineWidth = 7; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(mx, my + 4); ctx.lineTo(mx + Math.cos(angle) * 20, my + 4 - Math.sin(angle) * 20); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
    disc(ctx, t.x, t.y - 12, 8, col, { shadow: 0, line: 3 });
    slab(ctx, t.x - 15, t.y - 10, 30, 11, col, { r: 4, shadow: 2, line: 3 });
    // health bar
    slab(ctx, t.x - 20, t.y - 42, 40, 8, PAPER, { r: 3, shadow: 2, line: 2 });
    ctx.fillStyle = t.hp > 50 ? "#0f8a46" : t.hp > 25 ? DANFO : RED;
    ctx.fillRect(t.x - 18.5, t.y - 40.5, (37 * t.hp) / 100, 5);
  }

  function windBadge(wind) {
    slab(ctx, 120, 14, 120, 40, PAPER, { r: 8, shadow: 4, line: 3 });
    label(ctx, `Wind ${Math.abs(wind)}`, 162, 34, { size: 16 });
    if (wind) arrow(ctx, 210 - Math.sign(wind) * 14, 34, 210 + Math.sign(wind) * 14, 34, DANFO, 4);
    else label(ctx, "calm", 212, 34, { size: 13 });
  }

  const shotFromDrag = (t, d) => {
    const [mx, my] = muzzle(t);
    let vx = (d.x - mx) * PULL, vy = (d.y - my) * PULL;
    vy = Math.min(vy, -10);
    const l = Math.hypot(vx, vy);
    if (l > MAX_V) { vx = (vx * MAX_V) / l; vy = (vy * MAX_V) / l; }
    return [vx, vy];
  };

  function draw(extra, state, wind) {
    if (!view) return;
    const st = state || view;
    terrain(st.h);
    st.tanks.forEach((t, s) => tank(t, s, aimAngle[s]));
    windBadge(wind ?? view.wind);
    if (drag && !state) {
      const t = view.tanks[seat];
      const [vx, vy] = shotFromDrag(t, drag);
      const [mx, my] = muzzle(t);
      const pts = [];
      for (let i = 1; i <= 8; i++) { const k = i / 24; pts.push([mx + vx * k, my + vy * k + 130 * k * k]); }
      dots(ctx, pts, INK);
      label(ctx, `${Math.round((Math.hypot(vx, vy) / MAX_V) * 100)}%`, mx + (seat === 0 ? 30 : -30), my - 40, { size: 16, color: PAPER, outline: 5 });
    }
    extra?.();
  }

  const off = onDrag(stage, {
    down(x, y) { if (canMove()) { drag = { x, y }; aim(); } },
    move(x, y) { if (drag) { drag = { x, y }; aim(); } },
    up(x) {
      if (!drag) return;
      const [vx, vy] = shotFromDrag(view.tanks[seat], drag);
      drag = null;
      draw();
      if (x === null || Math.hypot(vx, vy) < 60) return;
      submit({ vx, vy });
    },
  });
  function aim() {
    const [vx, vy] = shotFromDrag(view.tanks[seat], drag);
    aimAngle[seat] = Math.atan2(-vy, vx);
    draw();
  }

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events) {
      for (const e of events) {
        if (e.type !== "shell") continue;
        const st = { h: e.before.h, tanks: e.before.tanks };
        aimAngle[e.seat] = Math.atan2(-e.vy, e.vx);
        draw(null, st, e.wind);
        await sleep(e.seat === seat ? 0 : 450);
        const frames = [];
        simulate(e.before.h.slice(), e.before.tanks.map((t) => ({ ...t })), e.seat, e.vx, e.vy, e.wind, frames);
        await playFrames(frames, (f) => draw(() => disc(ctx, f[0], f[1], 5, INK, { shadow: 0, line: 0 }), st, e.wind), 1.4);
        if (e.hit) {
          await tween(380, (p) => draw(() => {
            disc(ctx, e.hit.x, e.hit.y, BLAST * (0.4 + p * 0.8), p < 0.5 ? DANFO : RED, { shadow: 0, line: 3 });
          }, st, e.wind));
          // terrain and tanks after the blast come from the server's next state
          const after = { h: st.h.slice(), tanks: st.tanks.map((t, s) => ({ ...t, hp: Math.max(0, t.hp - e.dmg[s]) })) };
          for (let i = 0; i < SAMPLES; i++) {
            const dx = i * STEP - e.hit.x;
            if (dx * dx < BLAST * BLAST) after.h[i] = Math.max(after.h[i], Math.min(470, e.hit.y + Math.sqrt(BLAST * BLAST - dx * dx)));
          }
          const total = e.dmg[0] + e.dmg[1];
          const victim = e.dmg[1 - e.seat] ? 1 - e.seat : e.dmg[e.seat] ? e.seat : -1;
          if (victim >= 0) await popup(stage, () => draw(null, after, e.nextWind), `-${e.dmg[victim]}`, st.tanks[victim].x, st.tanks[victim].y - 60, RED);
          else await popup(stage, () => draw(null, after, e.nextWind), total ? "" : "Miss", e.hit.x, Math.max(80, e.hit.y - 40), PAPER);
        } else {
          await popup(stage, () => draw(null, st, e.nextWind), "Off the map", W / 2, 120, PAPER);
        }
        await sleep(150);
      }
    },
    destroy() { off(); },
  };
}
