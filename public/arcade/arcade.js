// Arcade screens: the game list, and the frame every game plays inside.
import { makeStage } from "./kit.js";

// Small original icons for the game tiles (inline SVG, flat colours, ink outlines).
const I = (body) => `<svg viewBox="0 0 64 64" aria-hidden="true" stroke="#1d1b16" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
const ICONS = {
  darts: I(`<circle cx="32" cy="32" r="26" fill="#fffdf4"/><circle cx="32" cy="32" r="17" fill="#d9412b"/><circle cx="32" cy="32" r="8" fill="#0f8a46"/><path d="M50 10 L34 30" /><path d="M50 10 l6 -2 -2 6z" fill="#ffc81e"/>`),
  archery: I(`<circle cx="32" cy="32" r="26" fill="#2a62d4"/><circle cx="32" cy="32" r="18" fill="#d9412b"/><circle cx="32" cy="32" r="9" fill="#ffc81e"/><path d="M8 56 L30 34"/><path d="M8 56 l-2 -8 M8 56 l8 2"/>`),
  basketball: I(`<rect x="38" y="8" width="20" height="16" fill="#fffdf4"/><path d="M36 26 h24" stroke-width="4" stroke="#d9412b"/><circle cx="22" cy="42" r="14" fill="#f08a24"/><path d="M8 42 h28 M22 28 v28"/>`),
  pong: I(`<path d="M10 22 h16 l-3 30 h-10z" fill="#d9412b"/><path d="M38 22 h16 l-3 30 h-10z" fill="#d9412b"/><ellipse cx="18" cy="22" rx="8" ry="3" fill="#7a1f2b"/><ellipse cx="46" cy="22" rx="8" ry="3" fill="#7a1f2b"/><circle cx="32" cy="10" r="5" fill="#fffdf4"/>`),
  golf: I(`<rect x="6" y="40" width="52" height="18" rx="4" fill="#3fa34d"/><ellipse cx="42" cy="48" rx="6" ry="3" fill="#1d1b16"/><path d="M42 48 V10"/><path d="M42 10 l14 6 -14 6z" fill="#d9412b"/><circle cx="16" cy="48" r="4" fill="#fffdf4"/>`),
  shuffle: I(`<rect x="14" y="4" width="36" height="56" rx="4" fill="#e9c98f"/><path d="M14 18 h36 M14 30 h36"/><circle cx="32" cy="12" r="6" fill="#d9412b"/><circle cx="26" cy="44" r="6" fill="#2a62d4"/>`),
  knockout: I(`<rect x="2" y="2" width="60" height="60" fill="#3d8bfd" stroke="none"/><rect x="12" y="12" width="40" height="40" fill="#c98b4b"/><circle cx="24" cy="38" r="6" fill="#d9412b"/><circle cx="40" cy="24" r="6" fill="#2a62d4"/><path d="M24 38 L34 30"/>`),
  tanks: I(`<path d="M2 58 Q20 34 32 44 T62 40 V62 H2z" fill="#3fa34d"/><rect x="12" y="30" width="20" height="10" rx="3" fill="#d9412b"/><path d="M26 30 L40 18"/><circle cx="50" cy="12" r="5" fill="#ffc81e"/>`),
  four: I(`<rect x="6" y="10" width="52" height="46" rx="6" fill="#2a62d4"/><circle cx="20" cy="24" r="6" fill="#fffdf4"/><circle cx="32" cy="24" r="6" fill="#ffc81e"/><circle cx="44" cy="24" r="6" fill="#fffdf4"/><circle cx="20" cy="42" r="6" fill="#0f8a46"/><circle cx="32" cy="42" r="6" fill="#0f8a46"/><circle cx="44" cy="42" r="6" fill="#ffc81e"/>`),
  draughts: I(`<rect x="6" y="6" width="52" height="52" fill="#e9c98f"/><path d="M6 32h52M32 6v52" stroke-width="2"/><rect x="6" y="6" width="26" height="26" fill="#c98b4b"/><rect x="32" y="32" width="26" height="26" fill="#c98b4b"/><circle cx="19" cy="19" r="9" fill="#d9412b"/><circle cx="45" cy="45" r="9" fill="#fffdf4"/>`),
  chess: I(`<path d="M22 54 h20 l-3 -8 h-14z" fill="#fffdf4"/><path d="M25 46 q-6 -14 2 -24 q4 -8 12 -6 l4 -6 2 8 q4 6 0 14 l-6 -4 q0 10 0 18z" fill="#fffdf4"/><circle cx="37" cy="22" r="1.5" fill="#1d1b16"/>`),
  reversi: I(`<rect x="6" y="6" width="52" height="52" rx="4" fill="#3fa34d"/><circle cx="22" cy="22" r="9" fill="#1d1b16"/><circle cx="42" cy="22" r="9" fill="#fffdf4"/><circle cx="22" cy="42" r="9" fill="#fffdf4"/><circle cx="42" cy="42" r="9" fill="#1d1b16"/>`),
  gomoku: I(`<rect x="6" y="6" width="52" height="52" rx="4" fill="#e9c98f"/><path d="M6 20h52M6 32h52M6 44h52M20 6v52M32 6v52M44 6v52" stroke-width="1.5"/><circle cx="20" cy="20" r="5" fill="#1d1b16"/><circle cx="32" cy="32" r="5" fill="#1d1b16"/><circle cx="44" cy="44" r="5" fill="#1d1b16"/><circle cx="44" cy="20" r="5" fill="#fffdf4"/>`),
  ayo: I(`<rect x="4" y="16" width="56" height="32" rx="14" fill="#c98b4b"/><circle cx="16" cy="26" r="5" fill="#8a5a2e"/><circle cx="32" cy="26" r="5" fill="#8a5a2e"/><circle cx="48" cy="26" r="5" fill="#8a5a2e"/><circle cx="16" cy="40" r="5" fill="#8a5a2e"/><circle cx="32" cy="40" r="5" fill="#8a5a2e"/><circle cx="48" cy="40" r="5" fill="#8a5a2e"/>`),
  dots: I(`<rect x="12" y="12" width="20" height="20" fill="#d9412b" stroke="none"/><path d="M12 12 h40 M12 12 v40 M32 12 v20 M12 32 h20" stroke-width="4"/><circle cx="12" cy="12" r="3.5" fill="#1d1b16"/><circle cx="32" cy="12" r="3.5" fill="#1d1b16"/><circle cx="52" cy="12" r="3.5" fill="#1d1b16"/><circle cx="12" cy="32" r="3.5" fill="#1d1b16"/><circle cx="32" cy="32" r="3.5" fill="#1d1b16"/><circle cx="52" cy="32" r="3.5" fill="#1d1b16"/><circle cx="12" cy="52" r="3.5" fill="#1d1b16"/><circle cx="32" cy="52" r="3.5" fill="#1d1b16"/><circle cx="52" cy="52" r="3.5" fill="#1d1b16"/>`),
  seabattle: I(`<rect x="2" y="2" width="60" height="60" fill="#3d8bfd" stroke="none"/><path d="M10 38 h40 l-6 10 h-28z" fill="#7a7363"/><rect x="24" y="28" width="12" height="10" fill="#fffdf4"/><path d="M44 14 l8 8 M52 14 l-8 8" stroke="#d9412b" stroke-width="4"/>`),
  filler: I(`<rect x="6" y="6" width="17" height="17" fill="#d9412b"/><rect x="23" y="6" width="17" height="17" fill="#ffc81e"/><rect x="40" y="6" width="17" height="17" fill="#2a62d4"/><rect x="6" y="23" width="17" height="17" fill="#0f8a46"/><rect x="23" y="23" width="17" height="17" fill="#45206b"/><rect x="40" y="23" width="17" height="17" fill="#d9412b"/><rect x="6" y="40" width="17" height="17" fill="#2a62d4"/><rect x="23" y="40" width="17" height="17" fill="#ff8fb1"/><rect x="40" y="40" width="17" height="17" fill="#ffc81e"/>`),
  crazy8: I(`<rect x="8" y="10" width="30" height="42" rx="4" fill="#fffdf4" transform="rotate(-10 23 31)"/><rect x="26" y="10" width="30" height="42" rx="4" fill="#fffdf4" transform="rotate(8 41 31)"/><text x="41" y="38" font-size="20" font-weight="900" fill="#d9412b" stroke="none" text-anchor="middle" font-family="Archivo, sans-serif">8</text>`),
  paintball: I(`<ellipse cx="20" cy="50" rx="14" ry="6" fill="#1d1b16"/><ellipse cx="20" cy="42" rx="14" ry="6" fill="#1d1b16"/><circle cx="40" cy="24" r="10" fill="#fffdf4"/><path d="M30 24 h20" stroke="#d9412b" stroke-width="5"/><circle cx="46" cy="44" r="7" fill="#ff8fb1"/>`),
};

export function createArcade(app) {
  const { api, screen, toast, esc, fmt, plural, setTab, showTabs } = app;
  let cur = null; // { id, match, inst, stage, mod, busy }
  let meta = null;

  async function renderList() {
    leave();
    setTab("arcade");
    let d;
    try { d = await api("/api/arcade"); } catch (e) { return screen(`<h1 class="big title">Arcade</h1><p>${esc(e.message)}</p>`); }
    meta = d;
    const left = d.player.arcadeScoredLeft;
    screen(`
      <h1 class="big title">Arcade</h1>
      <p>Beat the computer. Your first ${d.rules.scoredPerDay} games each day earn points: ${d.rules.win} for a win, ${d.rules.draw} for a draw.
        ${left ? `${plural(left, "scored game")} left today.` : "Today's scored games are done; keep playing for fun."}</p>
      ${[["skill", "Skill and aim"], ["board", "Board and cards"]].map(([kind, heading]) => `
        <h2 class="arcade-section">${heading}</h2>
        <div class="arcade-grid">
          ${d.games.filter((g) => g.kind === kind).map((g) => `
            <button class="game-tile" data-arcade="${g.id}">
              ${ICONS[g.id] || ""}
              <b>${esc(g.title)}</b>
              <span>${esc(g.blurb)}</span>
              ${d.live[g.id] ? `<em>Carry on</em>` : ""}
            </button>`).join("")}
        </div>`).join("")}
      <p class="muted fine">Word games are next.</p>`);
  }

  function leave() {
    if (!cur) return;
    cur.inst?.destroy?.();
    cur.stage?.destroy();
    cur = null;
    showTabs(true);
  }

  const myTurn = () => cur && cur.match.status === "playing" && cur.match.toMove.includes(cur.match.seat);

  function setStatus(text) {
    const el = document.getElementById("game-status");
    if (el) el.textContent = text;
  }
  function defaultStatus() {
    if (!cur) return;
    if (cur.match.status !== "playing") return setStatus("Game over");
    setStatus(myTurn() ? cur.hint || cur.mod.how || "Your turn" : "Computer is playing…");
  }

  function updateScore() {
    if (!cur) return;
    const s = cur.mod.scoreOf(cur.match.view, cur.match.seat);
    document.getElementById("score-a").textContent = s.mine;
    document.getElementById("score-b").textContent = s.theirs;
    document.getElementById("score-unit").textContent = s.unit || "";
  }

  function showResult() {
    const m = cur.match;
    const r = m.result;
    if (!r) return;
    const won = r.winner === m.seat;
    const draw = r.winner === null;
    const pts = r.points?.[m.seat] || 0;
    const box = document.getElementById("game-result");
    box.hidden = false;
    box.innerHTML = `<div class="panel result-card">
      <h2 class="big">${r.forfeit === m.seat ? "You left the game" : won ? "You win!" : draw ? "It's a draw" : "Computer wins"}</h2>
      <p><b>${m.scored ? (pts ? `+${pts} points` : "No points this time") : "Practice game: no points"}</b></p>
      <div class="stack">
        <button class="btn" data-arcade="${m.game}">Play again</button>
        <button class="btn light" data-go="arcade">Back to the arcade</button>
      </div></div>`;
  }

  async function open(id) {
    leave();
    setTab("arcade-game");
    let d;
    try { d = await api("/api/arcade/start", { game: id }); } catch (e) { toast(e.message); return renderList(); }
    const mod = await import(`/arcade/${id}.js`);
    showTabs(false);
    const g = (meta?.games || []).find((x) => x.id === id) || { title: id };
    screen(`
      <div class="game">
        <div class="row">
          <button class="back" data-go="arcade">‹ Arcade</button>
          <span class="chip">${d.match.scored ? "Scored game" : "Practice"}</span>
        </div>
        <div class="score-strip">
          <div><span>You</span><b id="score-a">0</b></div>
          <div class="game-name"><b>${esc(g.title)}</b><span id="score-unit"></span></div>
          <div><span>Computer</span><b id="score-b">0</b></div>
        </div>
        <p class="game-status" id="game-status" aria-live="polite"></p>
        <div class="stage-box" id="stage-box"><div class="game-result" id="game-result" hidden></div></div>
        <div class="game-bar" id="game-bar"></div>
      </div>`);
    const stage = makeStage(document.getElementById("stage-box"), mod.W, mod.H);
    cur = { id, match: d.match, stage, mod, busy: false, hint: null };
    cur.inst = mod.default({
      stage,
      bar: document.getElementById("game-bar"),
      seat: d.match.seat,
      canMove: () => myTurn() && !cur.busy,
      submit,
      hint: (t) => { cur.hint = t; defaultStatus(); },
      toast,
    });
    cur.inst.render(d.match);
    updateScore();
    defaultStatus();
    if (d.match.status !== "playing") showResult();
  }

  async function submit(move) {
    if (!cur || cur.busy) return null;
    const me = cur;
    me.busy = true;
    setStatus("…");
    try {
      const d = await api("/api/arcade/move", { matchId: me.match.id, move });
      if (cur !== me) return d;
      const before = me.match;
      me.match = { ...before, toMove: [] }; // no input while the animation plays
      setStatus(d.events.some((e) => e.seat !== me.match.seat) ? "Computer is playing…" : "");
      await me.inst.play(d.events, d.match, before);
      if (cur !== me) return d;
      me.match = d.match;
      me.busy = false; // before render, so the game sees whose turn it is
      me.inst.render(d.match);
      updateScore();
      if (d.match.status !== "playing") showResult();
      return d;
    } catch (e) {
      toast(e.message || "That didn't go through");
      if (cur === me) me.inst.render(me.match);
      return null;
    } finally {
      if (cur === me) { me.busy = false; defaultStatus(); }
    }
  }

  return {
    renderList,
    open,
    leave,
    active: () => !!cur,
    pause: () => cur?.inst?.pause?.(),
    resume: () => cur?.inst?.resume?.(),
  };
}
