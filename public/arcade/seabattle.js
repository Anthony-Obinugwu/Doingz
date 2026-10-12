import G, { N, FLEET } from "/shared/seabattle.js";
import { onTap, stepThrough, popup, slab, disc, label, INK, PAPER, RED, DANFO, WATER, GREY } from "./kit.js";

export const W = G.W;
export const H = G.H;
export const scoreOf = (v) => ({ mine: v.sunkCount[v.seat], theirs: v.sunkCount[1 - v.seat], unit: `ships sunk of ${FLEET.length}` });

const BIG = 32, BX = (360 - BIG * N) / 2, BY = 36;
const SMALL = 19, SX = (360 - SMALL * N) / 2, SY = 352;

export default function seabattle({ stage, seat, canMove, submit, hint, bar, them = () => "Computer" }) {
  const { ctx } = stage;
  let view = null;

  function grid(x0, y0, size, title) {
    slab(ctx, x0, y0, size * N, size * N, WATER, { r: 6, shadow: 5, line: 3.5 });
    ctx.strokeStyle = "rgba(255,253,244,0.35)"; ctx.lineWidth = 1;
    for (let k = 1; k < N; k++) {
      ctx.beginPath(); ctx.moveTo(x0 + k * size, y0); ctx.lineTo(x0 + k * size, y0 + size * N); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x0, y0 + k * size); ctx.lineTo(x0 + size * N, y0 + k * size); ctx.stroke();
    }
    label(ctx, title, W / 2, y0 - 14, { size: 16, color: INK });
  }

  function ship(x0, y0, size, s, color) {
    const r0 = Math.min(...s.cells.map((i) => Math.floor(i / N))), c0 = Math.min(...s.cells.map((i) => i % N));
    const w = s.horiz ? s.cells.length : 1, h = s.horiz ? 1 : s.cells.length;
    slab(ctx, x0 + c0 * size + 3, y0 + r0 * size + 3, w * size - 6, h * size - 6, color, { r: size / 2.4, shadow: 0, line: 2.5 });
  }

  function marks(x0, y0, size, shots) {
    shots.forEach((v, i) => {
      if (!v) return;
      const x = x0 + (i % N) * size + size / 2, y = y0 + Math.floor(i / N) * size + size / 2;
      if (v === 1) disc(ctx, x, y, size * 0.14, PAPER, { shadow: 0, line: 1.5 });
      else {
        ctx.strokeStyle = INK; ctx.lineWidth = size * 0.28;
        ctx.beginPath(); ctx.moveTo(x - size * 0.25, y - size * 0.25); ctx.lineTo(x + size * 0.25, y + size * 0.25);
        ctx.moveTo(x + size * 0.25, y - size * 0.25); ctx.lineTo(x - size * 0.25, y + size * 0.25); ctx.stroke();
        ctx.strokeStyle = RED; ctx.lineWidth = size * 0.15; ctx.stroke();
      }
    });
  }

  function draw() {
    ctx.fillStyle = "#cfe9ff";
    ctx.fillRect(0, 0, W, H);
    if (!view) return;
    grid(BX, BY, BIG, "Their waters: tap to fire");
    for (const s of view.theirs) ship(BX, BY, BIG, s, GREY);
    marks(BX, BY, BIG, view.myShots);
    grid(SX, SY, SMALL, "Your fleet");
    for (const s of view.mine) ship(SX, SY, SMALL, s, DANFO);
    marks(SX, SY, SMALL, view.theirShots);
    if (view.last) {
      const [x0, y0, size, shots] = view.last.seat === seat ? [BX, BY, BIG, view.myShots] : [SX, SY, SMALL, view.theirShots];
      const i = view.last.i;
      ctx.lineWidth = 3; ctx.strokeStyle = DANFO;
      ctx.strokeRect(x0 + (i % N) * size + 1.5, y0 + Math.floor(i / N) * size + 1.5, size - 3, size - 3);
    }
    setBar();
  }

  function setBar() {
    if (!view?.canShuffle || !canMove()) { bar.innerHTML = ""; return; }
    if (bar.querySelector("#sb-shuffle")) return;
    bar.innerHTML = `<button class="btn light" id="sb-shuffle">Shuffle my fleet</button>`;
    bar.querySelector("#sb-shuffle").addEventListener("click", () => submit({ reshuffle: true }));
  }

  const offTap = onTap(stage, (x, y) => {
    if (!canMove()) return;
    const c = Math.floor((x - BX) / BIG), r = Math.floor((y - BY) / BIG);
    if (c < 0 || c >= N || r < 0 || r >= N) return;
    const i = r * N + c;
    if (!view.myShots[i]) submit({ i });
  });

  stage.onResize = () => draw();
  hint(G.how);
  return {
    render(m) { view = m.view; draw(); },
    async play(events) {
      await stepThrough(events, seat, async (snap, e) => {
        view = snap;
        draw();
        if (e.type !== "shot") return;
        const mine = e.seat === seat;
        const text = e.sank >= 0 ? `${mine ? "Sunk their" : "They sank your"} ${e.name.toLowerCase()}!` : e.hit ? "Hit!" : "Splash";
        await popup(stage, draw, text, W / 2, mine ? 190 : 330, e.hit ? DANFO : PAPER);
      }, { mine: 100, theirs: 300, sound: (e) => (e.type !== "shot" ? "place" : e.hit ? "boom" : "splash") });
    },
    destroy() { offTap(); bar.innerHTML = ""; },
  };
}
