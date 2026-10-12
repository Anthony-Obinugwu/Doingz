import G, { simulate, SPOTS, FLOOR, RIM_Y, FRONT, BACK, BOARD_X, BOARD_TOP, BOARD_BOT, BALL_R, RELEASE_Y, MAX_V } from "/shared/basketball.js";
import { onFlick, streak, playFrames, sleep, popup, slab, disc, label, dots, sfx, haptic, burst, shake, INK, PAPER, RED, BLUE, DANFO, SKY, SAND, GREY } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
export const scoreOf = (v, seat) => ({ mine: v.scores[seat], theirs: v.scores[1 - seat], unit: `shot ${Math.min(6, v.shots[seat] + 1)} of 6` });

const ORANGE = "#f08a24";
const POWER = 6.2;   // swipe length to launch speed
const REACH = 70;    // how far the ball follows your finger before you let go

export default function basketball({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  let drag = null;     // { x0, y0, x, y, trail } while your finger is on the ball
  let released = null; // where the ball left your hand, so the flight starts there

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

  // Swipe the ball toward the hoop: the swipe's direction is the throw's direction, its length the power.
  const shotVelocity = (d) => {
    let vx = Math.max(0, (d.x - d.x0) * POWER), vy = Math.min(0, (d.y - d.y0) * POWER);
    const l = Math.hypot(vx, vy);
    if (l > MAX_V) { vx = (vx * MAX_V) / l; vy = (vy * MAX_V) / l; }
    return [vx, vy];
  };
  const inHand = (s) => {
    const dx = drag.x - drag.x0, dy = drag.y - drag.y0, l = Math.hypot(dx, dy) || 1, k = Math.min(1, REACH / l);
    return [s.x + dx * k, RELEASE_Y + dy * k];
  };

  function draw(extra, ballAt) {
    court();
    const s = currentSpot();
    if (s) {
      spotMarker(s.x, s.pts, s.who);
      if (!ballAt) shooter(s.x);
      if (drag) {
        const [vx, vy] = shotVelocity(drag);
        streak(ctx, drag.trail, PAPER);
        dots(ctx, preview(vx, vy, s.x).slice(0, 6), INK);
        ball(...inHand(s));
      } else if (!ballAt) {
        // the ball bobs gently in the shooter's hands, waiting for your swipe
        const bob = canMove() ? Math.sin(performance.now() / 260) * 2.5 : 0;
        ball(s.x, RELEASE_Y + bob);
        if (canMove()) label(ctx, "Swipe ↗", s.x + 4, RELEASE_Y - 34, { size: 15, color: PAPER, outline: 5 });
      }
    }
    if (ballAt) ball(...ballAt);
    extra?.();
  }

  const off = onFlick(stage, {
    grab(x, y) {
      const s = currentSpot();
      if (!canMove() || !s || Math.hypot(x - s.x, y - RELEASE_Y) > 80) return false;
      drag = { x0: x, y0: y, x, y, trail: null };
      return true;
    },
    move(x, y, trail) { drag.x = x; drag.y = y; drag.trail = trail; draw(); },
    release() {
      const s = currentSpot();
      const [vx, vy] = shotVelocity(drag);
      const at = s ? inHand(s) : null;
      drag = null;
      if (Math.hypot(vx, vy) < 120) { draw(); return; }
      released = at;
      sfx("whoosh");
      submit({ vx, vy });
    },
    cancel() { drag = null; draw(); },
  });
  // keep the idle ball bobbing
  let idle = 0;
  const bobLoop = () => { if (!drag && canMove() && !released) draw(); idle = requestAnimationFrame(bobLoop); };
  idle = requestAnimationFrame(bobLoop);

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
        // Start the flight from where the ball left your fingers, easing onto the true path.
        const from = e.seat === seat && released ? released : null;
        released = null;
        if (from) for (let i = 0; i < Math.min(8, frames.length); i++) {
          const k = i / 8;
          frames[i] = [from[0] + (frames[i][0] - from[0]) * k, from[1] + (frames[i][1] - from[1]) * k];
        } else sfx("whoosh");
        let rimmed = false, netted = false;
        await playFrames(frames, (f, i) => {
          draw(null, f);
          const near = Math.abs(f[1] - RIM_Y) < 14 && f[0] > FRONT - 12 && f[0] < BOARD_X + 4;
          if (near && !rimmed && !e.swish && (Math.abs(f[0] - FRONT) < 14 || f[0] > BACK - 6)) { rimmed = true; sfx("clank"); haptic(10); }
          if (e.scored && !netted && f[1] > RIM_Y + 6 && f[0] > FRONT && f[0] < BACK) { netted = true; sfx("swish"); haptic([12, 30, 12]); burst(stage, (FRONT + BACK) / 2, RIM_Y + 20, { colors: [DANFO, PAPER, "#f08a24"], n: 18, up: 40 }); }
          if (i > 0 && frames[i - 1][1] < f[1] && f[1] >= 470 - 12 - 1) sfx("thunk");
        });
        if (e.scored) await popup(stage, () => draw(null, frames[frames.length - 1]), e.swish ? `Swish! +${e.pts}` : `+${e.pts}`, 250, 190);
        else { shake(stage, 3, 200); await popup(stage, () => draw(null, frames[frames.length - 1]), "Miss", 250, 190, PAPER); }
        const shots = v.shots.slice();
        shots[e.seat] += 1;
        v = { ...v, shots };
      }
    },
    destroy() { off(); cancelAnimationFrame(idle); },
  };
}
