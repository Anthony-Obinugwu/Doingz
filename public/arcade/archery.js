import G from "/shared/archery.js";
import { onDrag, loop, tween, sleep, popup, slab, disc, label, arrow, INK, PAPER, RED, BLUE, DANFO, SKY, LEAF, WOOD, GREEN } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
export const scoreOf = (v, seat) => ({ mine: v.scores[seat], theirs: v.scores[1 - seat], unit: `arrow ${Math.min(6, v.arrows[seat] + 1)} of 6` });

const TX = 180, TY = 225, TR = 132;
const RING_COLORS = [PAPER, PAPER, INK, INK, BLUE, BLUE, RED, RED, DANFO, DANFO];

export default function archery({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  let aim = null;
  let stopSway = null;
  let flagT = 0;

  function scene() {
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = LEAF;
    ctx.fillRect(0, 370, W, H - 370);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 368, W, 4);
    // Durbar pennants on a line, blowing with the wind
    const wx = view?.wind?.x || 0;
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, 60); ctx.quadraticCurveTo(180, 82, 360, 60); ctx.stroke();
    const cols = [GREEN, PAPER, DANFO, RED];
    for (let i = 0; i < 9; i++) {
      const x = 20 + i * 40, y = 60 + Math.sin((i / 8) * Math.PI) * 11;
      const flap = Math.sin(flagT / 300 + i) * 3;
      ctx.fillStyle = cols[i % 4];
      ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.lineTo(x + wx * 40 + flap, y + 24); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    }
    // target stand
    ctx.strokeStyle = INK; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(TX - 70, 380); ctx.lineTo(TX - 30, TY); ctx.moveTo(TX + 70, 380); ctx.lineTo(TX + 30, TY); ctx.stroke();
    ctx.strokeStyle = WOOD; ctx.lineWidth = 5; ctx.stroke();
    disc(ctx, TX, TY, TR + 6, "#e8dcc0", { shadow: 6, line: 3 });
    for (let k = 0; k < 10; k++) disc(ctx, TX, TY, TR * (1 - k / 10), RING_COLORS[k], { shadow: 0, line: k < 2 || k > 3 ? 1.5 : 1.5 });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(TX - 4, TY); ctx.lineTo(TX + 4, TY); ctx.moveTo(TX, TY - 4); ctx.lineTo(TX, TY + 4); ctx.stroke();
  }

  function windBadge() {
    if (!view) return;
    const w = view.wind;
    const strength = Math.round(Math.hypot(w.x, w.y) * 100);
    slab(ctx, 120, 400, 120, 46, PAPER, { r: 8, shadow: 4, line: 3 });
    label(ctx, `Wind ${strength}`, 160, 423, { size: 17 });
    if (strength > 0) {
      const l = Math.hypot(w.x, w.y);
      arrow(ctx, 212 - (w.x / l) * 12, 423 - (w.y / l) * 12, 212 + (w.x / l) * 12, 423 + (w.y / l) * 12, DANFO, 4);
    } else label(ctx, "calm", 212, 423, { size: 13 });
  }

  function stuckArrow(x, y, s, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-9, 16); ctx.stroke();
    ctx.fillStyle = s === seat ? RED : BLUE;
    ctx.beginPath(); ctx.moveTo(-8, 13); ctx.lineTo(-16, 18); ctx.lineTo(-10, 22); ctx.lineTo(-4, 18); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    disc(ctx, 0, 0, 2.5, INK, { shadow: 0, line: 0 });
    ctx.restore();
  }

  function draw(extra) {
    scene();
    for (const s of view?.shots || []) stuckArrow(TX + s.x * TR, TY + s.y * TR, s.seat);
    windBadge();
    extra?.();
  }

  const sight = (t) => {
    const k = t / 1000;
    return [aim.fx + Math.sin(k * 1.7) * TR * 0.09 + Math.sin(k * 4.1) * TR * 0.015, aim.fy - 70 + Math.cos(k * 1.3) * TR * 0.08];
  };
  const crosshair = (x, y) => {
    ctx.lineWidth = 4; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.moveTo(x - 22, y); ctx.lineTo(x + 22, y); ctx.moveTo(x, y - 22); ctx.lineTo(x, y + 22); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = PAPER; ctx.stroke();
  };

  const off = onDrag(stage, {
    down(x, y) {
      if (!canMove()) return;
      aim = { fx: x, fy: y, t0: performance.now() };
      stopSway = loop((t) => { flagT = t; const [sx, sy] = sight(performance.now() - aim.t0); draw(() => crosshair(sx, sy)); });
    },
    move(x, y) { if (aim) { aim.fx = x; aim.fy = y; } },
    up(x) {
      if (!aim) return;
      stopSway?.();
      const [sx, sy] = sight(performance.now() - aim.t0);
      aim = null;
      draw();
      if (x === null) return;
      submit({ x: (sx - TX) / TR, y: (sy - TY) / TR });
    },
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events, m, before) {
      for (const e of events) {
        if (e.type !== "arrow") continue;
        const tx = TX + e.x * TR, ty = TY + e.y * TR;
        view = { ...before.view, wind: e.wind };
        await tween(320, (p) => draw(() => stuckArrow(180 + (tx - 180) * p, 470 + (ty - 470) * p, e.seat, 2.4 - 1.4 * p)));
        before = { view: { ...before.view, shots: [...before.view.shots, { seat: e.seat, x: e.x, y: e.y }] } };
        view = { ...before.view, wind: e.wind };
        await popup(stage, draw, e.value === 10 ? "10!" : e.value ? String(e.value) : "Miss", Math.min(320, Math.max(40, tx)), Math.max(40, ty - 26));
        await sleep(150);
      }
    },
    destroy() { off(); stopSway?.(); },
  };
}
