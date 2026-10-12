// Arcade screens: the game list, and the frame every game plays inside.
import { makeStage, sfx, haptic, confetti, isMuted, setMuted } from "./kit.js";

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
  wordhunt: I(`<rect x="6" y="6" width="24" height="24" rx="4" fill="#fffdf4"/><rect x="34" y="6" width="24" height="24" rx="4" fill="#ffc81e"/><rect x="6" y="34" width="24" height="24" rx="4" fill="#ffc81e"/><rect x="34" y="34" width="24" height="24" rx="4" fill="#fffdf4"/><path d="M18 18 L46 18 L18 46" stroke="#d9412b" stroke-width="5"/><text x="18" y="24" font-size="15" font-weight="900" text-anchor="middle" stroke="none" fill="#1d1b16" font-family="Archivo, sans-serif">W</text>`),
  anagrams: I(`<rect x="4" y="22" width="16" height="20" rx="3" fill="#fffdf4"/><rect x="24" y="22" width="16" height="20" rx="3" fill="#ffc81e"/><rect x="44" y="22" width="16" height="20" rx="3" fill="#fffdf4"/><text x="12" y="37" font-size="13" font-weight="900" text-anchor="middle" stroke="none" fill="#1d1b16" font-family="Archivo, sans-serif">E</text><text x="32" y="37" font-size="13" font-weight="900" text-anchor="middle" stroke="none" fill="#1d1b16" font-family="Archivo, sans-serif">K</text><text x="52" y="37" font-size="13" font-weight="900" text-anchor="middle" stroke="none" fill="#1d1b16" font-family="Archivo, sans-serif">O</text><path d="M12 14 q20 -12 40 0 M46 10 l6 4 -7 2" fill="none"/>`),
  twenty: I(`<circle cx="32" cy="32" r="26" fill="#2a62d4"/><text x="32" y="44" font-size="34" font-weight="900" text-anchor="middle" stroke="none" fill="#fffdf4" font-family="Archivo, sans-serif">?</text>`),
  paintball: I(`<ellipse cx="20" cy="50" rx="14" ry="6" fill="#1d1b16"/><ellipse cx="20" cy="42" rx="14" ry="6" fill="#1d1b16"/><circle cx="40" cy="24" r="10" fill="#fffdf4"/><path d="M30 24 h20" stroke="#d9412b" stroke-width="5"/><circle cx="46" cy="44" r="7" fill="#ff8fb1"/>`),
};

export function createArcade(app) {
  const { api, screen, toast, esc, plural, setTab, showTabs, getMode } = app;
  let cur = null;   // the game on screen: { id, match, inst, stage, mod, busy, seq, poll }
  let meta = null;  // the arcade listing
  let picking = null; // "friend" | "quick": the next game tile tapped starts a friend game
  let stake = 0;
  let waiting = null; // { code, vatarId, devCode, timer }

  const vatar = () => (getMode() === "dev" ? null : window.Vatar);
  const MATCH_ERRORS = {
    not_available: "Friend games open once Lagos Life switches them on for Doingz.",
    not_multiplayer: "Friend games open once Lagos Life switches them on for Doingz.",
    friendly_only: "Game-money stakes aren't on yet. Try a friendly.",
    limit: "That's over today's game-money limit.",
    not_found: "No open game with that code.",
    not_open: "That game is full, started or over.",
    signed_out: "Sign in to Lagos Life to play friends.",
    off: "Friend games are switched off right now.",
  };
  const matchError = (e) => toast(MATCH_ERRORS[e.code] || e.message || "That didn't work. Try again.");

  // ---------- the list ----------

  async function renderList() {
    leave();
    stopWaiting();
    setTab("arcade");
    let d;
    try { d = await api("/api/arcade"); } catch (e) { return screen(`<h1 class="big title">Arcade</h1><p>${esc(e.message)}</p>`); }
    meta = d;
    const left = d.player.arcadeScoredLeft;
    const title = (id) => d.games.find((g) => g.id === id)?.title || id;
    screen(`
      <h1 class="big title">Arcade</h1>
      <p>Play the computer or a friend. Your first ${d.rules.scoredPerDay} games each day earn points: ${d.rules.win} for a win, ${d.rules.draw} for a draw.
        ${left ? `${plural(left, "scored game")} left today.` : "Today's scored games are done; keep playing for fun."}</p>

      <section class="panel people">
        <h2 class="big">Play with people</h2>
        ${d.friends.length ? `<div class="thread" aria-label="Your friend games">${d.friends.map((f) => `
          <button class="bubble ${f.yourMove ? "in" : "out"}" data-friend-match="${f.id}">
            <span class="bubble-icon">${ICONS[f.game] || ""}</span>
            <span class="bubble-text"><b>${esc(title(f.game))}</b>
              <small>${f.yourMove ? `${esc(f.them)} played · <strong>Your move</strong>` : `Sent · waiting for ${esc(f.them)}`}</small></span>
            ${f.yourMove ? `<i class="badge" aria-hidden="true">1</i>` : ""}
          </button>`).join("")}</div>` : ""}
        ${picking ? `<p class="pick-note"><b>${picking === "friend" ? "Now pick a game to challenge your friend to." : "Now pick a game. If someone's already waiting, you'll play their game."}</b>
            <button class="linkish" data-people="cancel">Cancel</button></p>` : `
          <div class="people-actions">
            <button class="btn" data-people="friend">Invite a friend</button>
            <button class="btn light" data-people="quick">Quick match</button>
          </div>
          <form class="join-row" data-join>
            <input name="code" maxlength="6" autocomplete="off" autocapitalize="characters" placeholder="Got a code?" aria-label="Friend's code" />
            <button class="btn light" type="submit">Join</button>
          </form>`}
        ${vatar() ? `<div class="stake-row" role="group" aria-label="Stake">${[0, 500, 1000, 5000].map((v) =>
          `<button data-stake="${v}" aria-pressed="${v === stake}">${v ? "₦" + v.toLocaleString("en-NG") : "Friendly"}</button>`).join("")}</div>
          <p class="muted note">Stakes are Lagos Life game money, never real money. The winner takes the pot.</p>` : ""}
      </section>

      ${[["skill", "Skill and aim"], ["board", "Board and cards"], ["words", "Words and party"]].map(([kind, heading]) => `
        <h2 class="arcade-section">${heading}</h2>
        <div class="arcade-grid">
          ${d.games.filter((g) => g.kind === kind).map((g) => `
            <button class="game-tile${picking ? " picking" : ""}" data-arcade="${g.id}" title="${esc(g.blurb)}">
              <span class="app-icon">${ICONS[g.id] || ""}</span>
              <b>${esc(g.title)}</b>
              ${d.live[g.id] && !picking ? `<em aria-label="Game in progress">▶</em>` : ""}
            </button>`).join("")}
        </div>`).join("")}`);
  }

  // Taps inside the people panel (the app's own click handler routes data-arcade to tapGame).
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-people],[data-stake],[data-friend-match],[data-cancel-wait],[data-claim],[data-resign],[data-sound]");
    if (!t) return;
    if (t.dataset.sound !== undefined) {
      setMuted(!isMuted());
      t.textContent = isMuted() ? "🔇" : "🔊";
      t.setAttribute("aria-pressed", String(!isMuted()));
      sfx("tap");
      return;
    }
    if (t.dataset.people === "cancel") { picking = null; return renderList(); }
    if (t.dataset.people) { picking = t.dataset.people; return renderList(); }
    if (t.dataset.stake !== undefined) { stake = Number(t.dataset.stake); return renderList(); }
    if (t.dataset.friendMatch) return openMatch(t.dataset.friendMatch);
    if (t.dataset.cancelWait !== undefined) return cancelWaiting();
    if (t.dataset.claim !== undefined) return claimWin();
    if (t.dataset.resign !== undefined) return resign();
  });
  document.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-join]");
    if (!f) return;
    e.preventDefault();
    const code = String(new FormData(f).get("code") || "").trim().toUpperCase();
    if (code.length === 6) joinCode(code);
    else toast("Codes are six letters");
  });

  /** A game tile was tapped: play the computer, or start a friend game if we're picking one. */
  function tapGame(id) {
    if (!picking) return open(id);
    const how = picking;
    picking = null;
    return how === "friend" ? challenge(id) : quickMatch(id);
  }

  // ---------- finding a friend ----------

  function waitingScreen({ code, game, quick }) {
    leave();
    setTab("arcade-wait");
    const title = meta?.games.find((g) => g.id === game)?.title || "a game";
    screen(`<section class="stack waiting">
      <h1 class="big title">${quick ? "Finding a player" : "Waiting for your friend"}</h1>
      ${code ? `<p>Share this code. Your friend taps Arcade, then <b>Join</b>, and types it in:</p>
        <p class="code-big" aria-label="Code ${esc(code.split("").join(" "))}">${esc(code)}</p>` : ""}
      <p>Game: <b>${esc(title)}</b>${stake && vatar() ? `, stake ₦${stake.toLocaleString("en-NG")} game money` : ""}.</p>
      <p class="muted">${quick ? "Anyone looking for a game can join." : "This code works for 15 minutes."}</p>
      <button class="btn light" data-cancel-wait>Cancel</button>
    </section>`);
  }

  function stopWaiting() {
    if (waiting?.timer) clearInterval(waiting.timer);
    waiting = null;
  }

  async function cancelWaiting() {
    const w = waiting;
    stopWaiting();
    try {
      if (w?.devCode) await api("/api/arcade/leave-lobby", { code: w.devCode });
      if (w?.vatarId) { await window.Vatar.match.leave(); await api("/api/arcade/leave-lobby", { vatarMatchId: w.vatarId }); }
    } catch { /* already gone */ }
    renderList();
  }

  /** Lagos Life: once the Vatar match is playing, both phones ask our server for the game. */
  async function pairAndOpen(vatarId) {
    for (let k = 0; k < 8; k++) {
      try {
        const d = await api("/api/arcade/pair", { vatarMatchId: vatarId });
        stopWaiting();
        return openMatch(d.match.id, d.match);
      } catch (e) {
        if (e.code !== "lobby_pending" && e.code !== "not_started") { toast(e.message); return renderList(); }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    toast("Couldn't start the game. Try again.");
    renderList();
  }

  function watchVatar(vm, game, quick) {
    waiting = { vatarId: vm.id, timer: null };
    waitingScreen({ code: quick ? null : vm.code, game, quick });
    const check = async () => {
      try {
        const now = await window.Vatar.match.current();
        if (!waiting || !now || now.id !== vm.id) return;
        if (now.status === "playing") { const id = vm.id; stopWaiting(); pairAndOpen(id); }
        if (now.status === "cancelled" || now.status === "void") { stopWaiting(); toast("That game was cancelled"); renderList(); }
      } catch { /* try again next tick */ }
    };
    waiting.timer = setInterval(check, 2500);
  }

  async function challenge(game) {
    if (getMode() === "dev") {
      try {
        const d = await api("/api/arcade/dev-lobby", { game });
        waiting = { devCode: d.code, timer: null };
        waitingScreen({ code: d.code, game });
        waiting.timer = setInterval(async () => {
          try {
            const s = await api(`/api/arcade/dev-lobby?code=${d.code}`);
            if (s.matchId && waiting) { stopWaiting(); openMatch(s.matchId); }
          } catch { /* keep waiting */ }
        }, 2000);
      } catch (e) { matchError(e); }
      return;
    }
    try {
      const vm = await window.Vatar.match.create({ stake, seats: 2 });
      await api("/api/arcade/lobby", { vatarMatchId: vm.id, game });
      watchVatar(vm, game, false);
    } catch (e) { if (e.code !== "cancelled") matchError(e); }
  }

  async function quickMatch(game) {
    if (getMode() === "dev") {
      try {
        const d = await api("/api/arcade/dev-quick", { game });
        if (d.match) return openMatch(d.match.id, d.match);
        waiting = { devCode: d.code, timer: null };
        waitingScreen({ code: null, game, quick: true });
        waiting.timer = setInterval(async () => {
          try {
            const s = await api(`/api/arcade/dev-lobby?code=${d.code}`);
            if (s.matchId && waiting) { stopWaiting(); openMatch(s.matchId); }
          } catch { /* keep waiting */ }
        }, 2000);
      } catch (e) { matchError(e); }
      return;
    }
    try {
      const vm = await window.Vatar.match.quick({ stake });
      if (vm.status === "playing") return pairAndOpen(vm.id);
      await api("/api/arcade/lobby", { vatarMatchId: vm.id, game });
      watchVatar(vm, game, true);
    } catch (e) { if (e.code !== "cancelled") matchError(e); }
  }

  async function joinCode(code) {
    if (getMode() === "dev") {
      try { const d = await api("/api/arcade/dev-join", { code }); return openMatch(d.match.id, d.match); } catch (e) { return matchError(e); }
    }
    try {
      const vm = await window.Vatar.match.join(code);
      return pairAndOpen(vm.id);
    } catch (e) { if (e.code !== "cancelled") matchError(e); }
  }

  /** On start-up inside Lagos Life: if we're in a friend match already, go back to it. */
  async function resumeVatar() {
    if (!vatar()?.match) return;
    try {
      const vm = await window.Vatar.match.current();
      if (vm?.status === "playing") pairAndOpen(vm.id);
    } catch { /* not in a match */ }
  }

  // ---------- the game screen ----------

  function leave() {
    if (!cur) return;
    clearTimeout(cur.poll);
    cur.inst?.destroy?.();
    cur.stage?.destroy?.();
    cur = null;
    showTabs(true);
  }

  const myTurn = () => cur && cur.match.status === "playing" && cur.match.toMove.includes(cur.match.seat);
  const opponent = () => (cur ? cur.match.names[1 - cur.match.seat] : "");

  function setStatus(text, extra = "") {
    const el = document.getElementById("game-status");
    if (el) el.innerHTML = esc(text) + extra;
  }
  function defaultStatus() {
    if (!cur) return;
    const mine = myTurn(), playing = cur.match.status === "playing";
    document.getElementById("pl-me")?.classList.toggle("on", playing && mine);
    document.getElementById("pl-them")?.classList.toggle("on", playing && !mine);
    if (cur.match.status !== "playing") return setStatus("Game over");
    if (myTurn()) return setStatus(cur.hint || cur.mod.how || "Your turn");
    if (!cur.match.multi) return setStatus("Computer is playing…");
    const claim = cur.match.canClaim ? ` <button class="linkish" data-claim>They've gone quiet: claim the win</button>` : "";
    setStatus(`${opponent()} is playing…`, claim);
  }

  function updateScore() {
    if (!cur) return;
    const s = cur.mod.scoreOf(cur.match.view, cur.match.seat);
    document.getElementById("score-a").textContent = s.mine;
    document.getElementById("score-b").textContent = s.theirs;
    document.getElementById("score-unit").textContent = s.unit || "";
  }

  function showResult(fresh = true) {
    const m = cur.match;
    const r = m.result;
    if (!r) return;
    const won = r.winner === m.seat;
    const draw = r.winner === null;
    const them = m.names[1 - m.seat];
    const pts = r.points?.[m.seat] || 0;
    let head = won ? "You win!" : draw ? "It's a draw" : `${them} wins`;
    let note = "";
    if (r.forfeit === m.seat) head = m.multi ? "You resigned" : "You left the game";
    else if (r.forfeit !== undefined) note = `${them} resigned.`;
    if (r.timeout !== undefined) note = r.timeout === m.seat ? "You ran out of time." : `${them} went quiet, so the win is yours.`;
    clearTimeout(cur.poll);
    document.querySelector("[data-resign]")?.remove();
    if (fresh) {
      if (won) { sfx("win"); haptic([20, 50, 20, 50, 60]); if (cur.stage) confetti(cur.stage, 110); }
      else if (draw) sfx("draw");
      else { sfx("lose"); haptic(60); }
    }
    const box = document.getElementById("game-result");
    box.hidden = false;
    box.className = `game-result ${won ? "won" : draw ? "drew" : "lost"}`;
    box.innerHTML = `<div class="panel result-card">
      <p class="result-burst" aria-hidden="true">${won ? "🏆" : draw ? "🤝" : "😮‍💨"}</p>
      <h2 class="big">${esc(head)}</h2>
      ${note ? `<p>${esc(note)}</p>` : ""}
      <p><b>${m.scored ? (pts ? `+${pts} points` : "No points this time") : "Practice game: no points"}</b></p>
      <div class="stack">
        ${m.multi ? `<button class="btn" data-people="friend">Challenge someone again</button>` : `<button class="btn" data-arcade="${m.game}">Play again</button>`}
        <button class="btn light" data-go="arcade">Back to the arcade</button>
      </div></div>`;
  }

  /** Opens a match: a new one against the computer (by game id) or an existing friend game. */
  async function open(id) {
    let d;
    try { d = await api("/api/arcade/start", { game: id }); } catch (e) { toast(e.message); return renderList(); }
    return mount(d.match);
  }
  async function openMatch(matchId, match) {
    if (!match) {
      try { match = (await api(`/api/arcade/match?id=${encodeURIComponent(matchId)}`)).match; } catch (e) { toast(e.message); return renderList(); }
    }
    return mount(match);
  }

  async function mount(match) {
    leave();
    stopWaiting();
    setTab("arcade-game");
    const id = match.game;
    const mod = await import(`/arcade/${id}.js`);
    showTabs(false);
    if (!meta) { try { meta = await api("/api/arcade"); } catch { /* titles fall back to ids */ } }
    const g = (meta?.games || []).find((x) => x.id === id) || { title: id };
    screen(`
      <div class="game">
        <span class="grabber" aria-hidden="true"></span>
        <div class="row">
          <button class="back" data-go="arcade">‹ Arcade</button>
          ${match.multi && match.status === "playing" ? `<button class="linkish" data-resign>Resign</button>` : ""}
          <button class="sound" data-sound aria-pressed="${!isMuted()}" aria-label="Sound">${isMuted() ? "🔇" : "🔊"}</button>
          <span class="chip">${match.multi ? "Friend game" : match.scored ? "Scored game" : "Practice"}</span>
        </div>
        <div class="versus">
          <div class="player" id="pl-me"><span class="avatar">${esc(initial("You"))}</span><span class="pname">You</span><b id="score-a">0</b></div>
          <div class="vs-mid"><b>${esc(g.title)}</b><span id="score-unit"></span></div>
          <div class="player them" id="pl-them"><span class="avatar">${esc(initial(match.names[1 - match.seat]))}</span><span class="pname">${esc(match.names[1 - match.seat])}</span><b id="score-b">0</b></div>
        </div>
        <p class="game-status" id="game-status" aria-live="polite"></p>
        <div class="stage-box" id="stage-box"><div class="game-result" id="game-result" hidden></div></div>
        <div class="game-bar" id="game-bar"></div>
      </div>`);
    const box = document.getElementById("stage-box");
    const stage = mod.HTML ? null : makeStage(box, mod.W, mod.H);
    if (mod.HTML) box.classList.add("html-game");
    cur = { id, match, stage, mod, busy: false, hint: null, seq: match.seq ?? null, poll: 0 };
    const me = cur;
    cur.inst = mod.default({
      stage,
      host: box,
      bar: document.getElementById("game-bar"),
      seat: match.seat,
      canMove: () => myTurn() && !me.busy,
      submit,
      hint: (t) => { me.hint = t; defaultStatus(); },
      toast,
      them: () => me.match.names[1 - me.match.seat],
    });
    cur.inst.render(match);
    updateScore();
    defaultStatus();
    if (match.status !== "playing") showResult(false);
    else banner(myTurn() ? "Your turn" : `${opponent()}'s turn`, myTurn() ? "go" : "wait");
    if (match.multi) schedulePoll(me);
  }

  const initial = (name) => (name === "Computer" ? "🤖" : name === "You" ? "Me" : String(name).trim().slice(0, 1).toUpperCase() || "?");

  /** A big slab that drops in over the board for a moment: "Your turn", "Sent", "You win!". */
  function banner(text, kind = "go", ms = 1100) {
    const box = document.getElementById("stage-box");
    if (!box) return;
    box.querySelector(".banner")?.remove();
    const b = document.createElement("div");
    b.className = `banner ${kind}`;
    b.setAttribute("aria-hidden", "true");
    b.textContent = text;
    box.append(b);
    if (kind === "go") { sfx("turn"); haptic([10, 60, 10]); }
    if (ms) setTimeout(() => b.remove(), ms);
    return b;
  }

  /** iMessage-style: after your move in a friend game, a little bubble flies off to say it's been sent. */
  function sentBubble() {
    const box = document.getElementById("stage-box");
    if (!box) return;
    const b = document.createElement("div");
    b.className = "sent-bubble";
    b.textContent = `Sent to ${opponent()} ✓`;
    box.append(b);
    sfx("sent");
    setTimeout(() => b.remove(), 1600);
  }

  // Friend games: while it's their turn, check for their moves every couple of seconds.
  function schedulePoll(me, ms = 2000) {
    clearTimeout(me.poll);
    me.poll = setTimeout(() => poll(me), ms);
  }
  // On your own turn we still check now and then, in case they resign or claim a timeout.
  async function poll(me) {
    if (cur !== me || me.match.status !== "playing") return;
    if (me.busy) return schedulePoll(me, 1500);
    const mine = myTurn();
    try {
      const q = me.seq === null ? "" : `&since=${me.seq}`;
      const d = await api(`/api/arcade/match?id=${encodeURIComponent(me.match.id)}${q}`);
      if (cur !== me || me.busy) return schedulePoll(me, 1500);
      if (!d.events.length && d.match.status === "playing" && d.match.canClaim === me.match.canClaim && mine) {
        // Nothing new: leave the board alone so a drag or a half-typed word isn't disturbed.
        return schedulePoll(me, 5000);
      }
      const wasMine = mine;
      if (d.events.length) {
        me.busy = true;
        const before = me.match;
        me.match = { ...before, toMove: [] };
        await me.inst.play(d.events, d.match, before);
        me.busy = false;
        if (cur !== me) return;
      }
      me.seq = d.seq;
      me.match = d.match;
      me.inst.render(d.match);
      updateScore();
      defaultStatus();
      if (d.match.status !== "playing") return showResult();
      if (!wasMine && myTurn()) banner("Your turn", "go");
    } catch { /* network blip: try again */ }
    schedulePoll(me);
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
      setStatus(d.events.some((e) => e.seat !== me.match.seat) ? `${opponent()} is playing…` : "");
      await me.inst.play(d.events, d.match, before);
      if (cur !== me) return d;
      me.match = d.match;
      if (d.match.seq !== null && d.match.seq !== undefined) me.seq = d.match.seq;
      me.busy = false; // before render, so the game sees whose turn it is
      me.inst.render(d.match);
      updateScore();
      if (d.match.status !== "playing") showResult();
      else if (d.match.multi) { if (!d.match.toMove.includes(d.match.seat)) sentBubble(); schedulePoll(me); }
      return d;
    } catch (e) {
      toast(e.message || "That didn't go through");
      if (cur === me) me.inst.render(me.match);
      return null;
    } finally {
      if (cur === me) { me.busy = false; defaultStatus(); }
    }
  }

  async function claimWin() {
    if (!cur) return;
    try {
      const d = await api("/api/arcade/claim", { matchId: cur.match.id });
      cur.match = d.match;
      updateScore();
      showResult();
    } catch (e) { toast(e.message); }
  }

  async function resign() {
    if (!cur || !window.confirm("Resign this game? They'll get the win.")) return;
    try {
      const d = await api("/api/arcade/forfeit", { matchId: cur.match.id });
      cur.match = d.match;
      showResult();
    } catch (e) { toast(e.message); }
  }

  return {
    renderList,
    open: tapGame,
    openMatch,
    leave: () => { leave(); stopWaiting(); },
    resumeVatar,
    active: () => !!cur,
    pause: () => cur?.inst?.pause?.(),
    resume: () => cur?.inst?.resume?.(),
  };
}
