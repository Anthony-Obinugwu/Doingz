import G, { simulate, SPOTS, FLOOR, RIM_Y, FRONT, BACK, BOARD_X, BOARD_TOP, BOARD_BOT, BALL_R, RELEASE_Y, MAX_V } from "/shared/basketball.js";
import { onDrag, playFrames, sleep, popup, slab, disc, label, dots, INK, PAPER, RED, BLUE, DANFO, SKY, SAND, GREY } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
export const scoreOf = (v, seat) => ({ mine: v.scores[seat], theirs: v.scores[1 - seat], unit: `shot ${Math.min(6, v.shots[seat] + 1)} of 6` });

const ORANGE = "#f08a24";
const PULL = 6.2;

export default function basketball({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  let drag = null;

  function court() {
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, W, H);
    // Lagos skyline behind the court
    ctx.fillStyle = GREY;
    [[0, 250, 60, 220], [55, 290, 50, 180], [100, 220, 44, 250], [140, 300, 70, 170], [205, 265, 40, 205]].forEach(([x, y, w, h]) => {
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = DANFO;
      for (let wy = y + 12; wy < y + h - 20; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 16) ctx.fillRect(wx, wy, 7, 10);
      ctx.fillStyle = GREY;
    });
    // floor
    ctx.fillStyle = SAND;
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = INK;
    ctx.fillRect(0, FLOOR - 2, W, 4);
    // pole, backboard, rim, net
    slab(ctx, 334, BOARD_BOT, 12, FLOOR - BOARD_BOT, GREY, { r: 2, shadow: 3, line: 3 });
    slab(ctx, BOARD_X, BOARD_TOP, 12, BOARD_BOT - BOARD_TOP, PAPER, { r: 2, shadow: 4, line: 3 });
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const x = FRONT + ((BACK - FRONT) * i) / 4;
      ctx.moveTo(x, RIM_Y); ctx.lineTo(FRONT + 8 + ((BACK - FRONT - 16) * i) / 4, RIM_Y + 38);
    }
    ctx.moveTo(FRONT + 4, RIM_Y + 14); ctx.lineTo(BACK - 4, RIM_Y + 14);
    ctx.moveTo(FRONT + 8, RIM_Y + 30); ctx.lineTo(BACK - 8, RIM_Y + 30);
    ctx.stroke();
    ctx.lineWidth = 9; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(FRONT, RIM_Y); ctx.lineTo(BOARD_X, RIM_Y); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = RED; ctx.stroke();
  }

  function ball(x, y) {
    disc(ctx, x, y, BALL_R, ORANGE, { shadow: 2, line: 2.5 });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - BALL_R, y); ctx.lineTo(x + BALL_R, y); ctx.moveTo(x, y - BALL_R); ctx.lineTo(x, y + BALL_R); ctx.stroke();
  }

  function spotMarker(x, pts, who) {
    slab(ctx, x - 18, FLOOR + 10, 36, 24, who === seat ? DANFO : BLUE, { r: 6, shadow: 3, line: 2.5 });
    label(ctx, pts === 3 ? "3PT" : "2PT", x, FLOOR + 22, { size: 13, color: who === seat ? INK : PAPER });
  }

  function shooter(x) {
    // a flat cartoon shooter under the ball
    ctx.fillStyle = INK;
    ctx.fillRect(x - 3, RELEASE_Y + 14, 6, FLOOR - RELEASE_Y - 14);
    disc(ctx, x, RELEASE_Y + 26, 9, "#8d5524", { shadow: 0, line: 2.5 });
  }

  const currentSpot = () => {
    if (!view) return null;
    const who = view.turn;
    const i = view.shots[who];
    return i < SPOTS.length ? { ...SPOTS[i], who } : null;
  };

  function preview(vx, vy, sx) {
    const pts = [];
    let x = sx, y = RELEASE_Y;
    for (let i = 1; i <= 12; i++) {
      const t = i / 40;
      pts.push([x + vx * t, y + vy * t + 0.5 * 980 * t * t]);
    }
    return pts;
  }

  const shotVelocity = (d) => {
    let vx = Math.max(0, (d.x0 - d.x) * PULL), vy = Math.min(0, (d.y0 - d.y) * PULL);
    const l = Math.hypot(vx, vy);
    if (l > MAX_V) { vx = (vx * MAX_V) / l; vy = (vy * MAX_V) / l; }
    return [vx, vy];
  };

  function draw(extra, ballAt) {
    court();
    const s = currentSpot();
    if (s) {
      spotMarker(s.x, s.pts, s.who);
      if (!ballAt) { shooter(s.x); ball(s.x, RELEASE_Y); }
      if (drag) {
        const [vx, vy] = shotVelocity(drag);
        dots(ctx, preview(vx, vy, s.x), INK);
        label(ctx, `${Math.round((Math.hypot(vx, vy) / MAX_V) * 100)}%`, s.x, RELEASE_Y + 60, { size: 16, color: PAPER, outline: 5 });
      }
    }
    if (ballAt) ball(...ballAt);
    extra?.();
  }

  const off = onDrag(stage, {
    down(x, y) { if (canMove() && currentSpot()) { drag = { x0: x, y0: y, x, y }; draw(); } },
    move(x, y) { if (drag) { drag.x = x; drag.y = y; draw(); } },
    up(x) {
      if (!drag) return;
      const [vx, vy] = shotVelocity(drag);
      drag = null;
      draw();
      if (x === null || Math.hypot(vx, vy) < 120) return;
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
        if (e.type !== "shot") continue;
        view = { ...v, turn: e.seat };
        draw();
        await sleep(e.seat === seat ? 0 : 400);
        const frames = [];
        simulate(e.spot, e.vx, e.vy, frames);
        await playFrames(frames, (f) => draw(null, f));
        if (e.scored) await popup(stage, () => draw(null, frames[frames.length - 1]), e.swish ? `Swish! +${e.pts}` : `+${e.pts}`, 250, 190);
        else await popup(stage, () => draw(null, frames[frames.length - 1]), "Miss", 250, 190, PAPER);
        const shots = v.shots.slice();
        shots[e.seat] += 1;
        v = { ...v, shots };
      }
    },
    destroy() { off(); },
  };
}
