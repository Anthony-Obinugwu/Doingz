import G from "/shared/anagrams.js";
import { onTap, popup, slab, label, sfx, note, haptic, burst, INK, PAPER, DANFO, GREEN, RED, BLUE } from "./kit.js";
import { startRound, foundListHtml, summaryHtml } from "./wordround.js";

export const W = G.W;
export const H = G.H;
export const scoreOf = (v, seat) => ({
  mine: v.scores[seat],
  theirs: v.played[1 - v.seat] ? v.scores[1 - seat] : "…",
  unit: "points",
});

const SLOT = 50, GAP = 6, X0 = (360 - (SLOT * 6 + GAP * 5)) / 2;
const slotX = (k) => X0 + k * (SLOT + GAP);
const ANSWER_Y = 120, TILES_Y = 250;

export default function anagrams({ stage, seat, canMove, submit, hint, bar }) {
  const { ctx } = stage;
  let view = null;
  let round = null;
  let order = [];      // tile order on screen (indexes into board)
  let typed = [];      // tile indexes in the answer
  let wantStart = false;
  let flash = null;

  const word = () => typed.map((i) => view.board[i]).join("");

  function draw() {
    ctx.fillStyle = BLUE;
    ctx.fillRect(0, 0, W, H);
    if (!view?.board) {
      slab(ctx, 40, 140, 280, 160, PAPER, { r: 14, shadow: 5, line: 3 });
      label(ctx, view && !canMove() ? "Waiting for the other player" : "Your letters appear", W / 2, 200, { size: 22 });
      label(ctx, view && !canMove() ? "" : "when you start your round", W / 2, 232, { size: 22 });
      return;
    }
    if (round) {
      const s = Math.ceil(round.left() / 1000);
      label(ctx, `${s}s`, 24, 40, { size: 22, align: "left", color: s <= 10 ? "#ffd2c8" : PAPER });
      label(ctx, `${round.found.length} words, ${round.score} pts`, 336, 40, { size: 20, align: "right", color: PAPER });
    }
    for (let k = 0; k < 6; k++) {
      const filled = k < typed.length;
      slab(ctx, slotX(k), ANSWER_Y - SLOT / 2, SLOT, SLOT, filled ? (flash || PAPER) : "rgba(255,253,244,0.25)", { r: 8, shadow: filled ? 3 : 0, line: 2.5 });
      if (filled) label(ctx, view.board[typed[k]].toUpperCase(), slotX(k) + SLOT / 2, ANSWER_Y + 2, { size: 28 });
    }
    order.forEach((i, k) => {
      if (typed.includes(i)) {
        ctx.strokeStyle = "rgba(255,253,244,0.4)"; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.strokeRect(slotX(k), TILES_Y - SLOT / 2, SLOT, SLOT); ctx.setLineDash([]);
        return;
      }
      slab(ctx, slotX(k), TILES_Y - SLOT / 2, SLOT, SLOT, DANFO, { r: 8, shadow: 4, line: 3 });
      label(ctx, view.board[i].toUpperCase(), slotX(k) + SLOT / 2, TILES_Y + 2, { size: 28 });
    });
  }

  function enter() {
    if (!round) return;
    const w = word();
    const st = round.check(w);
    if (st === "new" || st === "naija") {
      const pts = G.points(w.length) * (st === "naija" ? 2 : 1);
      round.add(w, pts);
      flash = GREEN;
      sfx("good");
      haptic(12);
      burst(stage, W / 2, ANSWER_Y, { colors: [GREEN, DANFO, PAPER], n: 10 + w.length * 3, up: 100 });
      popup(stage, draw, st === "naija" ? `Naija word! +${pts}` : `+${pts}`, W / 2, 330, DANFO);
    } else {
      flash = st === "again" ? DANFO : RED;
      sfx(st === "again" ? "meh" : "bad");
      if (st !== "again") haptic([10, 40, 10]);
      hint(st === "again" ? "Already found" : w.length < 3 ? "Three letters or more" : "Not in the word list");
    }
    setTimeout(() => { flash = null; typed = []; draw(); setBar(); hint(G.how); }, 280);
    draw();
  }

  function setBar() {
    if (round) {
      bar.innerHTML = `<div class="word-actions">
          <button class="btn light" id="an-shuffle">Shuffle</button>
          <button class="btn light" id="an-clear">Clear</button>
          <button class="btn" id="an-enter">Enter</button>
        </div>${foundListHtml(round.found)}`;
      bar.querySelector("#an-shuffle").addEventListener("click", () => { for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } draw(); });
      bar.querySelector("#an-clear").addEventListener("click", () => { typed = []; draw(); });
      bar.querySelector("#an-enter").addEventListener("click", enter);
      return;
    }
    if (view && view.played[0] && view.played[1]) { bar.innerHTML = summaryHtml(view, seat); return; }
    if (canMove() && !view?.board) {
      bar.innerHTML = `<button class="btn" id="an-start">Start my 60 seconds</button>`;
      bar.querySelector("#an-start").addEventListener("click", () => { wantStart = true; bar.innerHTML = ""; submit({ start: true }); });
    } else bar.innerHTML = "";
  }

  function begin() {
    wantStart = false;
    order = [0, 1, 2, 3, 4, 5];
    typed = [];
    round = startRound(view, {
      onTick: () => draw(),
      onEnd: (r) => { const words = r.found.slice(); round = null; typed = []; draw(); setBar(); submit({ words }); },
    });
    setBar();
  }

  const offTap = onTap(stage, (x, y) => {
    if (!round) return;
    const k = Math.floor((x - X0) / (SLOT + GAP));
    if (k < 0 || k > 5) return;
    if (Math.abs(y - TILES_Y) < SLOT / 2 + 6) {
      const i = order[k];
      if (!typed.includes(i)) { typed.push(i); note(typed.length - 1); draw(); }
    } else if (Math.abs(y - ANSWER_Y) < SLOT / 2 + 6 && k < typed.length) {
      typed.splice(k, 1);
      sfx("tap");
      draw();
    }
  });

  const keys = (e) => {
    if (!round) return;
    if (e.key === "Enter") return enter();
    if (e.key === "Backspace") { typed.pop(); return draw(); }
    const ch = e.key.toLowerCase();
    const i = order.find((j) => view.board[j] === ch && !typed.includes(j));
    if (i !== undefined) { typed.push(i); draw(); }
  };
  document.addEventListener("keydown", keys);

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) {
      view = m.view;
      if (view.hashes && !round && m.toMove.includes(m.seat) && (wantStart || view.startedAgo !== null)) begin();
      draw();
      setBar();
    },
    async play(events) {
      for (const e of events) {
        if (e.type === "round_end") await popup(stage, draw, `${e.seat === seat ? "You" : "They"}: ${e.count} words, ${e.score} pts`, W / 2, 330, e.seat === seat ? DANFO : PAPER);
      }
    },
    pause() {},
    resume() {},
    destroy() { offTap(); round?.stop?.(); document.removeEventListener("keydown", keys); bar.innerHTML = ""; },
  };
}
