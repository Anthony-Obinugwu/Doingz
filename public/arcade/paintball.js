import G, { SLOTS, ROUND_MS } from "/shared/paintball.js";
import { loop, sleep, popup, slab, disc, label, INK, PAPER, RED, BLUE, GREEN, DANFO, PINK, SAND, GREY } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const how = G.how;
// Six shots, then a one-second reload. Missed shots still use paint.
export const scoreOf = (v, seat) => ({ mine: v.scores[seat], theirs: v.scores[1 - seat], unit: `round ${Math.min(2, v.played[seat] + 1)} of 2, splats` });

const SKIN = "#8d5524";
const UP_MS = 130;
const MAG = 6;            // shots before a reload, so spraying taps doesn't win
const RELOAD_MS = 1100;

export default function paintball({ stage, seat, canMove, submit, hint, bar }) {
  const { ctx } = stage;
  let view = null;
  let run = null;           // { pops, t0, hits:Set, splats:[], stop }
  let wantStart = false;    // the next live round came from our own Start / Restart
  let interrupted = false;

  function yard() {
    ctx.fillStyle = GREY;
    ctx.fillRect(0, 0, W, 300);
    ctx.strokeStyle = "rgba(29,27,22,0.45)"; ctx.lineWidth = 2;
    for (let x = 6; x < W; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 300); ctx.stroke(); }
    ctx.fillStyle = SAND;
    ctx.fillRect(0, 290, W, H - 290);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 288, W, 4);
    slab(ctx, 16, 14, 158, 30, DANFO, { r: 4, shadow: 3, line: 3 });
    label(ctx, "VULCANIZER", 95, 30, { size: 17 });
  }

  function tyres(x, y) {
    for (let k = 0; k < 3; k++) {
      const ty = y - k * 16;
      ctx.fillStyle = INK;
      ctx.beginPath(); ctx.ellipse(x + 3, ty + 3, 34, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2d2a24";
      ctx.beginPath(); ctx.ellipse(x, ty, 34, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = "#57534a";
      ctx.beginPath(); ctx.ellipse(x, ty - 2, 14, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  // A figure peeking up from behind tyre stack `slot`; `rise` 0..1.
  function figure(slot, rise, friend) {
    const [x, y] = SLOTS[slot];
    const top = y - 40;
    const hy = top - 40 * rise;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, top + 6); ctx.clip();
    slab(ctx, x - 20, hy + 14, 40, 44, friend ? GREEN : BLUE, { r: 8, shadow: 0, line: 3 });
    disc(ctx, x, hy + 2, 16, SKIN, { shadow: 0, line: 3 });
    if (friend) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 24, hy + 50); ctx.lineTo(x + 24, hy - 14); ctx.stroke();
      ctx.fillStyle = PAPER; ctx.fillRect(x + 24, hy - 14, 18, 12); ctx.strokeRect(x + 24, hy - 14, 18, 12);
    } else {
      ctx.fillStyle = RED; ctx.fillRect(x - 16, hy - 4, 32, 10);
      ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeRect(x - 16, hy - 4, 32, 10);
      ctx.fillStyle = PAPER; ctx.fillRect(x - 9, hy - 2, 6, 5); ctx.fillRect(x + 3, hy - 2, 6, 5);
    }
    ctx.restore();
  }

  const riseAt = (p, t) => {
    const e = t - p.t;
    if (e < 0 || e > p.dur) return 0;
    if (e < UP_MS) return e / UP_MS;
    if (e > p.dur - UP_MS) return (p.dur - e) / UP_MS;
    return 1;
  };

  function draw(t) {
    yard();
    if (run) {
      for (const p of run.pops) {
        if (run.hits.has(p.id)) continue;
        const r = riseAt(p, t);
        if (r > 0) figure(p.slot, r, p.friend);
      }
    }
    SLOTS.forEach(([x, y]) => tyres(x, y));
    if (run) {
      for (const s of run.splats) {
        const age = t - s.t;
        if (age > 700) continue;
        ctx.globalAlpha = 1 - age / 700;
        disc(ctx, s.x, s.y, 12 + age / 60, s.friend ? GREEN : PINK, { shadow: 0, line: 2 });
        ctx.globalAlpha = 1;
      }
      const left = Math.max(0, Math.ceil((ROUND_MS - t) / 1000));
      slab(ctx, 222, 14, 122, 30, PAPER, { r: 4, shadow: 3, line: 3 });
      label(ctx, `${left}s left, ${run.score} splats`, 283, 30, { size: 15 });
      // magazine
      if (run.reloadAt && t >= run.reloadAt) { run.ammo = MAG; run.reloadAt = 0; }
      slab(ctx, 16, 470, 150, 34, PAPER, { r: 6, shadow: 3, line: 3 });
      if (run.reloadAt) label(ctx, "Reloading…", 91, 488, { size: 16, color: RED });
      else for (let i = 0; i < MAG; i++) disc(ctx, 34 + i * 22, 487, 7, i < run.ammo ? PINK : "#d8d2c4", { shadow: 0, line: 2.5 });
    }
  }

  function setBar() {
    if (run) { bar.innerHTML = ""; return; }
    const mine = canMove();
    if (!mine) { bar.innerHTML = ""; return; }
    const restart = interrupted || (view?.live && !wantStart);
    bar.innerHTML = `<button class="btn" id="pb-start">${restart ? "Restart round" : `Start round ${view.played[seat] + 1}`}</button>`;
    bar.querySelector("#pb-start").addEventListener("click", async () => {
      wantStart = true;
      bar.innerHTML = "";
      await submit(restart ? { restart: true } : { start: true });
    });
  }

  function startRun(pops) {
    interrupted = false;
    wantStart = false;
    run = { pops, t0: performance.now(), hits: new Set(), splats: [], score: 0, hitList: [], ammo: MAG, reloadAt: 0 };
    setBar();
    run.stop = loop(() => {
      const t = performance.now() - run.t0;
      draw(t);
      if (t >= ROUND_MS) { finish(); return false; }
      return true;
    });
  }

  async function finish() {
    const r = run;
    run = null;
    r.stop?.();
    draw(0);
    await submit({ hits: r.hitList });
  }

  function tap(e) {
    if (!run) return;
    const [x, y] = stage.toLocal(e);
    const t = performance.now() - run.t0;
    if (run.reloadAt || run.ammo <= 0) return;
    run.ammo -= 1;
    if (run.ammo === 0) run.reloadAt = t + RELOAD_MS;
    for (const p of run.pops) {
      if (run.hits.has(p.id)) continue;
      const r = riseAt(p, t);
      if (r < 0.45) continue;
      const [sx, sy] = SLOTS[p.slot];
      const top = sy - 40 - 40 * r;
      if (x > sx - 24 && x < sx + 24 && y > top - 20 && y < sy - 34) {
        run.hits.add(p.id);
        run.hitList.push({ id: p.id, t: Math.round(t) });
        run.splats.push({ x, y, t, friend: p.friend });
        run.score += p.friend ? -1 : 1;
        return;
      }
    }
  }
  stage.canvas.addEventListener("pointerdown", tap);

  stage.onResize = () => draw(run ? performance.now() - run.t0 : 0);
  hint(G.how);
  return {
    render(m) {
      view = m.view;
      if (view.live && wantStart && m.toMove.includes(m.seat) && !run) startRun(view.live.pops);
      else { if (!run) draw(0); setBar(); }
    },
    async play(events) {
      for (const e of events) {
        if (e.type !== "round_end") continue;
        const who = e.seat === seat ? "You" : "Computer";
        await popup(stage, () => draw(0), `${who}: ${e.score} splats`, W / 2, 200, e.seat === seat ? DANFO : PAPER);
        await sleep(200);
      }
    },
    pause() {
      if (!run) return;
      run.stop?.();
      run = null;
      interrupted = true;
      draw(0);
      setBar();
    },
    resume() { setBar(); },
    destroy() { run?.stop?.(); stage.canvas.removeEventListener("pointerdown", tap); bar.innerHTML = ""; },
  };
}
