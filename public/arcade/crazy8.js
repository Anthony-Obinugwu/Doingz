import G, { SUITS, RANKS, cardSuit, cardRank, isEight } from "/shared/crazy8.js";
import { onTap, stepThrough, popup, slab, label, INK, PAPER, RED, DANFO, GREEN, BLUE } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const scoreOf = (v) => ({ mine: v.hand.length, theirs: v.theirs, unit: "cards left" });

const CW = 52, CH = 74;
const isRed = (c) => cardSuit(c) === 1 || cardSuit(c) === 2;
const playableIn = (v, c) => isEight(c) || cardSuit(c) === v.suit || cardRank(c) === cardRank(v.top);

export default function crazy8({ stage, seat, canMove, submit, hint, bar }) {
  const { ctx } = stage;
  let view = null;
  let choosing = null; // an 8 waiting for its suit

  function card(c, x, y, { lift = false, dim = false } = {}) {
    const yy = lift ? y - 10 : y;
    slab(ctx, x, yy, CW, CH, PAPER, { r: 7, shadow: 3, line: 2.5 });
    const col = isRed(c) ? RED : INK;
    label(ctx, RANKS[cardRank(c)], x + 8, yy + 13, { size: 16, color: col, align: "left" });
    label(ctx, SUITS[cardSuit(c)] + "︎", x + CW / 2, yy + CH / 2 + 8, { size: 26, color: col, weight: 400 });
    if (isEight(c)) { ctx.lineWidth = 3; ctx.strokeStyle = DANFO; ctx.strokeRect(x + 4, yy + 4, CW - 8, CH - 8); }
    if (dim) { ctx.fillStyle = "rgba(29,27,22,0.35)"; ctx.fillRect(x, yy, CW, CH); }
  }
  function back(x, y) {
    slab(ctx, x, y, CW, CH, GREEN, { r: 7, shadow: 3, line: 2.5 });
    ctx.strokeStyle = PAPER; ctx.lineWidth = 2;
    ctx.strokeRect(x + 7, y + 7, CW - 14, CH - 14);
    label(ctx, "Dz", x + CW / 2, y + CH / 2, { size: 18, color: PAPER });
  }

  // My hand wraps into rows of six.
  const handPos = (k, n) => {
    const perRow = Math.min(6, n), row = Math.floor(k / 6), inRow = Math.min(6, n - row * 6), idx = k % 6;
    const step = Math.min(CW + 6, (W - 24 - CW) / Math.max(1, perRow - 1));
    const total = step * (inRow - 1) + CW;
    return [(W - total) / 2 + idx * step, 300 + row * (CH + 14)];
  };

  function draw() {
    ctx.fillStyle = "#1f6b45";
    ctx.fillRect(0, 0, W, H);
    if (!view) return;
    // their hand
    const n = view.theirs;
    for (let k = 0; k < Math.min(n, 10); k++) back(24 + k * Math.min(30, (W - 48 - CW) / Math.max(1, Math.min(n, 10) - 1)), 16);
    label(ctx, `Computer: ${n} card${n === 1 ? "" : "s"}`, W / 2, 106, { size: 15, color: PAPER });
    // deck and top card
    back(96, 140);
    label(ctx, `${view.deck} left`, 96 + CW / 2, 140 + CH + 14, { size: 13, color: PAPER });
    card(view.top, 212, 140);
    slab(ctx, 278, 160, 54, 34, PAPER, { r: 17, shadow: 3, line: 2.5 });
    label(ctx, SUITS[view.suit] + "︎", 305, 178, { size: 22, color: view.suit === 1 || view.suit === 2 ? RED : INK, weight: 400 });
    // my hand
    const mine = canMove();
    view.hand.forEach((c, k) => {
      const [x, y] = handPos(k, view.hand.length);
      const ok = mine && playableIn(view, c);
      card(c, x, y, { lift: ok, dim: mine && !ok });
    });
    setBar();
  }

  function setBar() {
    if (!canMove() || !view) { bar.innerHTML = ""; return; }
    if (choosing !== null) {
      bar.innerHTML = `<div class="suit-pick">${SUITS.map((s, i) => `<button class="btn ${i === 1 || i === 2 ? "red" : ""}" data-suit="${i}">${s}︎</button>`).join("")}</div>`;
      bar.querySelectorAll("[data-suit]").forEach((b) => b.addEventListener("click", () => {
        const c = choosing;
        choosing = null;
        submit({ card: c, suit: Number(b.dataset.suit) });
      }));
      return;
    }
    const canDraw = view.drawsThisTurn < 3 && view.deck > 0;
    bar.innerHTML = `<div class="row">
      <button class="btn light" id="c8-draw" ${canDraw ? "" : "disabled"}>Draw${view.drawsThisTurn ? ` (${3 - view.drawsThisTurn} left)` : ""}</button>
      <button class="btn light" id="c8-pass" ${canDraw ? "disabled" : ""}>Pass</button></div>`;
    bar.querySelector("#c8-draw").addEventListener("click", () => submit({ draw: true }));
    bar.querySelector("#c8-pass").addEventListener("click", () => submit({ pass: true }));
  }

  const offTap = onTap(stage, (x, y) => {
    if (!canMove()) return;
    for (let k = view.hand.length - 1; k >= 0; k--) {
      const [cx, cy] = handPos(k, view.hand.length);
      if (x >= cx && x <= cx + CW && y >= cy - 10 && y <= cy + CH) {
        const c = view.hand[k];
        if (!playableIn(view, c)) return hint("That card doesn't match. Draw instead.");
        hint(G.how);
        if (isEight(c)) { choosing = c; setBar(); hint("Pick the new suit"); return; }
        return submit({ card: c });
      }
    }
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; choosing = null; hint(G.how); draw(); },
    async play(events) {
      await stepThrough(events, seat, async (snap, e) => {
        view = snap;
        draw();
        if (e.seat !== seat) {
          const text = e.type === "play" ? (isEight(e.card) ? `Crazy 8! ${SUITS[e.suit]}︎` : "Computer plays") : e.type === "draw" ? "Computer draws" : "Computer passes";
          await popup(stage, draw, text, W / 2, 250, DANFO);
        }
      }, { mine: 120, theirs: 250 });
    },
    destroy() { offTap(); bar.innerHTML = ""; },
  };
}
