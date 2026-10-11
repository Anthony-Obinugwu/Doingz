import G, { CUPS, CUP_R, THROW_FROM } from "/shared/pong.js";
import { onDrag, tween, sleep, popup, slab, disc, label, INK, PAPER, RED, BLUE, DANFO } from "./kit.js";

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
    if (canMove()) {
      ball(...THROW_FROM, 11);
      label(ctx, `Ball ${3 - view.balls} of 2`, W / 2, 470, { size: 15, color: PAPER });
    }
    if (swipe) {
      ctx.strokeStyle = DANFO; ctx.lineWidth = 6; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(swipe.x0, swipe.y0); ctx.lineTo(swipe.x, swipe.y); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    extra?.();
  }

  const off = onDrag(stage, {
    down(x, y) { if (canMove()) { swipe = { x0: x, y0: y, x, y }; draw(); } },
    move(x, y) { if (swipe) { swipe.x = x; swipe.y = y; draw(); } },
    up(x, y) {
      if (!swipe) return;
      const s = swipe;
      swipe = null;
      draw();
      if (x === null) return;
      const dx = x - s.x0, dy = y - s.y0;
      if (dy > -40) return hint("Swipe up towards the cups");
      hint(G.how);
      submit({ x: Math.max(0, Math.min(360, THROW_FROM[0] + dx * 1.15)), y: Math.max(20, Math.min(360, THROW_FROM[1] + dy * 1.2)) });
    },
  });

  async function throwBall(e) {
    const [fx, fy] = THROW_FROM;
    await tween(520, (p) => draw(() => ball(fx + (e.x - fx) * p, fy + (e.y - fy) * p, 9 + Math.sin(p * Math.PI) * 8)));
    if (e.cup >= 0) {
      rack.cups[e.cup] = 0;
      const [cx, cy] = CUPS[e.cup];
      await tween(260, (p) => draw(() => { ctx.strokeStyle = PAPER; ctx.lineWidth = 4; ctx.globalAlpha = 1 - p; ctx.beginPath(); ctx.arc(cx, cy, CUP_R + p * 20, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }));
      await popup(stage, draw, e.rim ? "Rattled in!" : "Splash!", cx, cy - 30);
    } else {
      const ex = e.x + (e.x - fx) * 0.15, ey = e.y - 40;
      await tween(260, (p) => draw(() => ball(e.x + (ex - e.x) * p, e.y + (ey - e.y) * p, 9)));
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
