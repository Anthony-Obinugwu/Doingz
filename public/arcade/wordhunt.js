import G, { N } from "/shared/wordhunt.js";
import { adjacent } from "/shared/words.js";
import { onDrag, popup, slab, label, INK, PAPER, DANFO, GREEN, RED, LEAF } from "./kit.js";
import { startRound, foundListHtml, summaryHtml } from "./wordround.js";

export const W = G.W;
export const H = G.H;
export const scoreOf = (v, seat) => ({
  mine: v.scores[seat],
  theirs: v.played[1 - v.seat] ? v.scores[1 - seat] : "…",
  unit: "points",
});

const CELL = 78, X0 = 24, Y0 = 118;
const centre = (i) => [X0 + (i % N) * CELL + CELL / 2, Y0 + Math.floor(i / N) * CELL + CELL / 2];

export default function wordhunt({ stage, seat, canMove, submit, hint, bar }) {
  const { ctx } = stage;
  let view = null;
  let round = null;
  let path = [];
  let wantStart = false;

  const word = () => path.map((i) => view.board[i]).join("");

  function draw() {
    ctx.fillStyle = LEAF;
    ctx.fillRect(0, 0, W, H);
    if (!view?.board) {
      slab(ctx, 40, 150, 280, 180, PAPER, { r: 14, shadow: 5, line: 3 });
      label(ctx, view && !canMove() ? "Waiting for the other player" : "The board appears", W / 2, 215, { size: 22 });
      label(ctx, view && !canMove() ? "" : "when you start your round", W / 2, 248, { size: 22 });
      return;
    }
    const state = round && path.length ? round.check(word()) : null;
    const tileFill = state === "new" || state === "naija" ? GREEN : state === "again" ? DANFO : PAPER;
    // path line
    if (path.length > 1) {
      ctx.strokeStyle = INK; ctx.lineWidth = 16; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); path.forEach((i, k) => { const [x, y] = centre(i); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
      ctx.strokeStyle = DANFO; ctx.lineWidth = 9; ctx.stroke();
    }
    for (let i = 0; i < N * N; i++) {
      const [x, y] = centre(i);
      const on = path.includes(i);
      slab(ctx, x - 33, y - 33, 66, 66, on ? tileFill : PAPER, { r: 10, shadow: on ? 2 : 5, line: 3 });
      label(ctx, view.board[i].toUpperCase(), x, y + 2, { size: 38, color: on && tileFill === GREEN ? PAPER : INK });
    }
    // current word and clock
    slab(ctx, 24, 18, 312, 50, PAPER, { r: 10, shadow: 4, line: 3 });
    label(ctx, path.length ? word().toUpperCase() : round ? "Swipe a word" : "", W / 2, 44, { size: 26, color: state === "no" && path.length >= 3 ? RED : INK });
    if (round) {
      const s = Math.ceil(round.left() / 1000);
      label(ctx, `${s}s`, 40, 96, { size: 20, align: "left", color: s <= 10 ? RED : INK });
      label(ctx, `${round.found.length} words, ${round.score} pts`, 320, 96, { size: 20, align: "right" });
    }
  }

  function setBar() {
    if (round) { bar.innerHTML = foundListHtml(round.found); return; }
    if (view && G.result({ g: { played: view.played, scores: view.scores } })) { bar.innerHTML = summaryHtml(view, seat); return; }
    if (canMove() && !view?.board) {
      bar.innerHTML = `<button class="btn" id="wh-start">Start my 80 seconds</button>`;
      bar.querySelector("#wh-start").addEventListener("click", () => { wantStart = true; bar.innerHTML = ""; submit({ start: true }); });
    } else bar.innerHTML = "";
  }

  function begin() {
    wantStart = false;
    round = startRound(view, {
      onTick: () => draw(),
      onEnd: (r) => { const words = r.found.slice(); round = null; path = []; draw(); submit({ words }); },
    });
    setBar();
  }

  const tileAt = (x, y, slack) => {
    for (let i = 0; i < N * N; i++) { const [cx, cy] = centre(i); if (Math.hypot(x - cx, y - cy) < slack) return i; }
    return -1;
  };

  const off = onDrag(stage, {
    down(x, y) {
      if (!round) return;
      const i = tileAt(x, y, 36);
      if (i >= 0) { path = [i]; draw(); }
    },
    move(x, y) {
      if (!round || !path.length) return;
      const i = tileAt(x, y, 27); // a little smaller than the tile so diagonals are easy
      if (i < 0) return;
      if (path.length > 1 && i === path[path.length - 2]) { path.pop(); draw(); return; }
      if (!path.includes(i) && adjacent(path[path.length - 1], i, N)) { path.push(i); draw(); }
    },
    up() {
      if (!round || !path.length) return;
      const w = word();
      const st = round.check(w);
      if (st === "new" || st === "naija") {
        const pts = G.points(w.length) * (st === "naija" ? 2 : 1);
        round.add(w, pts);
        setBar();
        popup(stage, draw, st === "naija" ? `Naija word! +${pts}` : `+${pts}`, W / 2, 450, st === "naija" ? DANFO : PAPER);
      }
      path = [];
      draw();
    },
  });

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
        if (e.type === "round_end") await popup(stage, draw, `${e.seat === seat ? "You" : "They"}: ${e.count} words, ${e.score} pts`, W / 2, 300, e.seat === seat ? DANFO : PAPER);
      }
    },
    pause() {},
    resume() {},
    destroy() { off(); round?.stop?.(); bar.innerHTML = ""; },
  };
}
