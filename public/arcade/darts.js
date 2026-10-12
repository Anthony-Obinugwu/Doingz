import G, { ORDER, RINGS } from "/shared/darts.js";
import { onFlick, loop, tween, sleep, popup, slab, disc, label, sfx, haptic, shake, burst, easeInCubic, INK, PAPER, RED, GREEN, DANFO, BLUE } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
export const scoreOf = (v, seat) => ({ mine: v.scores[seat], theirs: v.scores[1 - seat], unit: "left to zero" });

const BX = 180, BY = 218, BR = 138;
const FROM = [180, 470];

export default function darts({ stage, seat, canMove, submit, hint, them = () => "Computer" }) {
  const { ctx } = stage;
  let view = null;
  let stuck = [];          // darts in the board this turn: { x, y, seat }
  let lastSeat = null;
  let aim = null;          // { fx, fy, t0 } while holding
  let stopSway = null;
  let thrownFrom = null;   // where your flick left the screen, for the throw animation

  function board() {
    // number ring
    disc(ctx, BX, BY, BR + 26, INK, { shadow: 6, line: 0 });
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 10;
      label(ctx, String(ORDER[i]), BX + Math.cos(a) * (BR + 13), BY + Math.sin(a) * (BR + 13), { size: 15, color: PAPER });
    }
    const band = (r0, r1, colA, colB) => {
      for (let i = 0; i < 20; i++) {
        const a0 = -Math.PI / 2 + (i * Math.PI) / 10 - Math.PI / 20;
        ctx.beginPath();
        ctx.arc(BX, BY, r1, a0, a0 + Math.PI / 10);
        ctx.arc(BX, BY, r0, a0 + Math.PI / 10, a0, true);
        ctx.closePath();
        ctx.fillStyle = i % 2 ? colB : colA;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    };
    band(RINGS.outer * BR, RINGS.tripleIn * BR, INK, PAPER);
    band(RINGS.tripleIn * BR, RINGS.tripleOut * BR, RED, GREEN);
    band(RINGS.tripleOut * BR, RINGS.doubleIn * BR, INK, PAPER);
    band(RINGS.doubleIn * BR, BR, RED, GREEN);
    disc(ctx, BX, BY, RINGS.outer * BR, GREEN, { shadow: 0, line: 2 });
    disc(ctx, BX, BY, RINGS.bull * BR, RED, { shadow: 0, line: 2 });
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.arc(BX, BY, BR, 0, Math.PI * 2);
    ctx.stroke();
  }

  function dart(x, y, s, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, 22); ctx.stroke();
    ctx.fillStyle = s === seat ? DANFO : BLUE;
    ctx.beginPath(); ctx.moveTo(8, 18); ctx.lineTo(20, 26); ctx.lineTo(12, 32); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    disc(ctx, 0, 0, 3, INK, { shadow: 0, line: 0 });
    ctx.restore();
  }

  function draw(extra) {
    ctx.fillStyle = "#1f5c42";
    ctx.fillRect(0, 0, W, H);
    board();
    for (const d of stuck) dart(BX + d.x * BR, BY + d.y * BR, d.seat);
    // darts left this turn
    if (view && !G.result({ g: view })) {
      const who = view.turn;
      for (let i = 0; i < 3; i++) {
        slab(ctx, 132 + i * 34, 420, 24, 24, i < view.left ? (who === seat ? DANFO : BLUE) : "#2c6e52", { r: 12, shadow: 3, line: 2.5 });
      }
      label(ctx, who === seat ? "Your darts" : `${them()}'s darts`, 180, 405, { size: 15, color: PAPER });
    }
    extra?.();
  }

  const sight = (t) => {
    const k = (t / 1000) * 1.9;
    return [aim.fx + Math.sin(k * 1.3) * BR * 0.07, aim.fy - 70 + Math.cos(k) * BR * 0.06];
  };
  const crosshair = (x, y) => {
    ctx.lineWidth = 4; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.moveTo(x - 20, y); ctx.lineTo(x + 20, y); ctx.moveTo(x, y - 20); ctx.lineTo(x, y + 20); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = DANFO; ctx.stroke();
  };

  // GamePigeon-style: hold to pick up a dart, slide to aim (the sight floats above your finger and sways),
  // then flick up to throw. Letting go without a flick puts the dart back.
  const off = onFlick(stage, {
    grab(x, y) {
      if (!canMove()) return false;
      aim = { fx: x, fy: y, t0: performance.now(), hist: [[x, y, performance.now()]] };
      stopSway = loop(() => {
        const [sx, sy] = sight(performance.now() - aim.t0);
        draw(() => { crosshair(sx, sy); dart(aim.fx - 6, aim.fy - 4, seat, 2.4); label(ctx, "Flick up ↑", aim.fx, Math.min(H - 16, aim.fy + 70), { size: 15, color: PAPER, outline: 5 }); });
      });
      return true;
    },
    move(x, y) {
      const now = performance.now();
      aim.fx = x; aim.fy = y;
      aim.hist.push([x, y, now]);
      if (aim.hist.length > 60) aim.hist.shift();
    },
    release({ vy, dy, x, y }) {
      stopSway?.();
      // Aim where your finger was just before the flick, so the flick itself doesn't drag the sight up.
      const now = performance.now();
      const before = aim.hist.filter((h) => now - h[2] >= 130).pop() || aim.hist[0];
      if (before) { aim.fx = before[0]; aim.fy = before[1]; }
      const [sx, sy] = sight(now - aim.t0);
      aim = null;
      draw();
      if (vy > -450 || dy > -12) { hint("Flick up to throw. Slide first to aim."); return; }
      thrownFrom = [x, y];
      sfx("whoosh");
      submit({ x: (sx - BX) / BR, y: (sy - BY) / BR });
    },
    cancel() { stopSway?.(); aim = null; draw(); },
  });

  async function throwOne(e) {
    if (e.seat !== lastSeat) { stuck = []; lastSeat = e.seat; }
    const tx = BX + e.x * BR, ty = BY + e.y * BR;
    const from = e.seat === seat && thrownFrom ? thrownFrom : FROM;
    thrownFrom = null;
    if (e.seat !== seat) sfx("whoosh");
    await tween(300, (q) => {
      const p = easeInCubic(q) * 0.6 + q * 0.4;
      draw(() => dart(from[0] + (tx - from[0]) * p, from[1] + (ty - from[1]) * p - Math.sin(p * Math.PI) * 50, e.seat, 2.6 - 1.6 * p));
    });
    stuck.push({ x: e.x, y: e.y, seat: e.seat });
    draw();
    if (e.value) { sfx("thunk"); haptic(18); shake(stage, e.value >= 40 ? 6 : 3, 220); burst(stage, tx, ty, { colors: [DANFO, PAPER], n: e.value >= 40 ? 20 : 9, speed: 180, up: 60, size: 3.5 }); }
    else sfx("place");
    const word = e.bust ? "Bust!" : e.out ? "Checkout!" : e.value ? e.label : "Miss";
    await popup(stage, draw, word, Math.min(300, Math.max(60, tx)), Math.max(40, ty - 30), e.bust ? "#ff8f6b" : DANFO);
    if (e.bust || e.out) await sleep(250);
  }

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events) {
      for (const e of events) if (e.type === "dart") { await throwOne(e); await sleep(120); }
    },
    destroy() { off(); stopSway?.(); },
  };
}
