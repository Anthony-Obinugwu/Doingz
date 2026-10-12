import G, { legalMoves, colorOf, inCheck } from "/shared/chess.js";
import { onTap, stepThrough, slab, disc, label, INK, PAPER, RED, DANFO } from "./kit.js";

export const W = G.W;
export const H = G.H;
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const material = (v, s) => v.b.reduce((a, p) => a + (colorOf(p) === s ? VAL[p.toLowerCase()] : 0), 0);
export const scoreOf = (v, seat) => ({ mine: material(v, seat), theirs: material(v, 1 - seat), unit: "material on the board" });

const CELL = 42, X0 = 12, Y0 = 12;
const LIGHT = "#f3e2c0", DARK = "#b9773e";
// Filled glyphs for both sides, forced to text style (no emoji) with U+FE0E.
const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const sq = (i) => [X0 + (i & 7) * CELL, Y0 + (i >> 3) * CELL];

export default function chess({ stage, seat, canMove, submit, hint }) {
  const { ctx } = stage;
  let view = null;
  let pick = -1;

  function piece(p, x, y) {
    const g = GLYPH[p.toLowerCase()] + "︎";
    const white = colorOf(p) === 0;
    ctx.font = `34px "Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols 2", "DejaVu Sans", serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.lineJoin = "round";
    ctx.strokeText(g, x + 1.5, y + 3.5);
    ctx.fillStyle = INK; ctx.fillText(g, x + 1.5, y + 3.5);
    ctx.lineWidth = 3; ctx.strokeStyle = white ? INK : PAPER;
    ctx.strokeText(g, x, y + 2);
    ctx.fillStyle = white ? PAPER : INK;
    ctx.fillText(g, x, y + 2);
  }

  function draw() {
    ctx.fillStyle = "#3b2a1a";
    ctx.fillRect(0, 0, W, H);
    slab(ctx, X0, Y0, 8 * CELL, 8 * CELL, LIGHT, { r: 4, shadow: 6, line: 4 });
    for (let i = 0; i < 64; i++) {
      const [x, y] = sq(i);
      if (((i >> 3) + (i & 7)) % 2) { ctx.fillStyle = DARK; ctx.fillRect(x, y, CELL, CELL); }
    }
    if (!view) return;
    if (view.last) for (const i of [view.last.from, view.last.to]) { const [x, y] = sq(i); ctx.fillStyle = "rgba(255,200,30,0.45)"; ctx.fillRect(x, y, CELL, CELL); }
    if (inCheck(view, view.turn)) {
      const k = view.b.findIndex((p) => p === (view.turn === 0 ? "K" : "k"));
      const [x, y] = sq(k);
      ctx.fillStyle = "rgba(217,65,43,0.6)"; ctx.fillRect(x, y, CELL, CELL);
    }
    if (pick >= 0) { const [x, y] = sq(pick); ctx.lineWidth = 4; ctx.strokeStyle = DANFO; ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4); }
    ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.strokeRect(X0, Y0, 8 * CELL, 8 * CELL);
    view.b.forEach((p, i) => { if (p) { const [x, y] = sq(i); piece(p, x + CELL / 2, y + CELL / 2); } });
    if (pick >= 0) {
      for (const m of legalMoves(view, seat).filter((m) => m.from === pick)) {
        const [x, y] = sq(m.to);
        if (view.b[m.to]) { ctx.lineWidth = 4; ctx.strokeStyle = RED; ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 4, 0, Math.PI * 2); ctx.stroke(); }
        else disc(ctx, x + CELL / 2, y + CELL / 2, 7, DANFO, { shadow: 0, line: 2 });
      }
    }
    // files and ranks
    for (let k = 0; k < 8; k++) {
      label(ctx, "abcdefgh"[k], X0 + k * CELL + CELL - 6, Y0 + 8 * CELL - 7, { size: 10, color: k % 2 ? INK : PAPER, weight: 700 });
      label(ctx, String(8 - k), X0 + 6, Y0 + k * CELL + 8, { size: 10, color: k % 2 ? PAPER : INK, weight: 700 });
    }
    const moves = (view.moves || []).slice(-6);
    if (moves.length) {
      const start = (view.moves.length - moves.length);
      const text = moves.map((m, i) => {
        const ply = view.plies - view.moves.length + start + i; // 0 = white's first move
        return (ply % 2 === 0 ? `${Math.floor(ply / 2) + 1}. ` : "") + m;
      }).join("  ");
      label(ctx, text, W / 2, Y0 + 8 * CELL + 24, { size: 14, color: PAPER, weight: 700 });
    }
  }

  const offTap = onTap(stage, (x, y) => {
    if (!canMove()) return;
    const c = Math.floor((x - X0) / CELL), r = Math.floor((y - Y0) / CELL);
    if (c < 0 || c > 7 || r < 0 || r > 7) return;
    const i = r * 8 + c;
    if (colorOf(view.b[i]) === seat) { pick = i; draw(); return; }
    if (pick < 0) return;
    const mv = legalMoves(view, seat).find((m) => m.from === pick && m.to === i && (!m.promo || m.promo === "q"));
    pick = -1;
    if (mv) submit({ from: mv.from, to: mv.to, promo: mv.promo });
    else draw();
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; pick = -1; draw(); },
    async play(events) { await stepThrough(events, seat, (snap) => { view = snap; draw(); }, { mine: 150, theirs: 500 }); },
    destroy() { offTap(); },
  };
}
