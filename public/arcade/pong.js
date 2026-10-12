import G, { CUPS, CUP_R, THROW_FROM } from "/shared/pong.js";
import { onFlick, streak, tween, sleep, popup, slab, disc, label, sfx, haptic, shake, burst, easeOutCubic, INK, PAPER, RED, BLUE, DANFO } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
// cups each side has sunk
export const scoreOf = (v, seat) => ({
  mine: 6 - v.cups[1 - seat].filter(Boolean).length,
  theirs: 6 - v.cups[seat].filter(Boolean).length,
  unit: "cups sunk",
});

const ZOBO = "#7a1f2b";

export default function pong({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  let rack = null;        // which seat's cups are on the table: [flags], defender
  let swipe = null;

  function table(defender, cups) {
    ctx.fillStyle = "#1c4fb8";
    ctx.fillRect(0, 0, W, H);
    slab(ctx, 22, 20, W - 44, H - 40, BLUE, { r: 10, shadow: 6, line: 4 });
    ctx.strokeStyle = PAPER; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2, 24); ctx.lineTo(W / 2, H - 24); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(26, 300); ctx.lineTo(W - 26, 300); ctx.stroke();
    label(ctx, defender === seat ? "Your cups" : "Their cups", W / 2, 46, { size: 18, color: PAPER, outline: 5 });
    CUPS.forEach(([x, y], i) => {
      if (!cups[i]) {
        ctx.strokeStyle = "rgba(29,27,22,0.35)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, CUP_R - 4, 0, Math.PI * 2); ctx.stroke();
        return;
      }
      disc(ctx, x, y, CUP_R, RED, { shadow: 4, line: 3 });
      disc(ctx, x, y, CUP_R - 6, ZOBO, { shadow: 0, line: 2 });
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath(); ctx.arc(x - 6, y - 6, 4, 0, Math.PI * 2); ctx.fill();
    });
  }

  function ball(x, y, r = 9) { disc(ctx, x, y, r, PAPER, { shadow: 3, line: 3 }); }

  function draw(extra) {
    if (!view) return;
    const defender = rack?.defender ?? 1 - seat;
    table(defender, rack?.cups ?? view.cups[defender]);
    if (swipe) {
      streak(ctx, swipe.trail, DANFO);
      ball(swipe.x, swipe.y, 12);
    } else if (canMove()) {
      ball(...THROW_FROM, 11);
      label(ctx, `Ball ${3 - view.balls} of 2 · flick it ↑`, W / 2, 470, { size: 15, color: PAPER });
    }
    extra?.();
  }

  // Pick the ball up and flick it at the cups: the flick's direction and length decide where it lands.
  let thrownFrom = null;
  const off = onFlick(stage, {
    grab(x, y) {
      if (!canMove() || Math.hypot(x - THROW_FROM[0], y - THROW_FROM[1]) > 80) return false;
      swipe = { x0: x, y0: y, x, y, trail: null };
      draw();
      return true;
    },
    move(x, y, trail) { swipe.x = x; swipe.y = y; swipe.trail = trail; draw(); },
    release({ dx, dy, x, y }) {
      swipe = null;
      draw();
      if (dy > -40) return hint("Flick the ball up towards the cups");
      hint(G.how);
      thrownFrom = [x, y];
      sfx("whoosh");
      submit({ x: Math.max(0, Math.min(360, THROW_FROM[0] + dx * 1.15)), y: Math.max(20, Math.min(360, THROW_FROM[1] + dy * 1.2)) });
    },
    cancel() { swipe = null; draw(); },
  });

  async function throwBall(e) {
    const [fx, fy] = e.seat === seat && thrownFrom ? thrownFrom : THROW_FROM;
    thrownFrom = null;
    if (e.seat !== seat) sfx("whoosh");
    // The ball arcs up off the table (it grows), its shadow slides along the table under it.
    await tween(560, (q) => {
      const p = easeOutCubic(q) * 0.35 + q * 0.65;
      const gx = fx + (e.x - fx) * p, gy = fy + (e.y - fy) * p, lift = Math.sin(p * Math.PI);
      draw(() => {
        ctx.fillStyle = "rgba(29,27,22,0.28)";
        ctx.beginPath(); ctx.ellipse(gx + lift * 10, gy + lift * 18, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
        ball(gx, gy - lift * 60, 9 + lift * 9);
      });
    });
    if (e.cup >= 0) {
      const [cx, cy] = CUPS[e.cup];
      if (e.rim) { sfx("click"); await tween(320, (p) => draw(() => ball(cx + Math.cos(p * 12) * CUP_R * 0.55 * (1 - p), cy + Math.sin(p * 12) * CUP_R * 0.55 * (1 - p), 9))); }
      sfx("splash");
      haptic([14, 40, 14]);
      burst(stage, cx, cy, { colors: [ZOBO, RED, PAPER], n: 22, speed: 220, up: 140 });
      shake(stage, 4, 220);
      rack.cups[e.cup] = 0;
      await popup(stage, draw, e.rim ? "Rattled in!" : "Splash!", cx, cy - 30);
    } else {
      sfx("tap");
      const ex = e.x + (e.x - fx) * 0.25, ey = e.y - 60;
      await tween(340, (p) => draw(() => ball(e.x + (ex - e.x) * p, e.y + (ey - e.y) * p - Math.sin(p * Math.PI) * 25, 9)));
      await popup(stage, draw, e.rim ? "Off the rim" : "Miss", Math.min(300, Math.max(60, e.x)), Math.max(70, e.y - 20), PAPER);
    }
  }

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; rack = null; draw(); },
    async play(events, m, before) {
      const cups = before.view.cups.map((c) => c.slice());
      for (const e of events) {
        if (e.type !== "ball") continue;
        rack = { defender: 1 - e.seat, cups: cups[1 - e.seat] };
        view = { ...before.view, balls: 2 };
        draw();
        await sleep(e.seat === seat ? 0 : 350);
        await throwBall(e);
        await sleep(150);
      }
      rack = null;
    },
    destroy() { off(); },
  };
}
