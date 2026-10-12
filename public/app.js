// Doingz client. Talks to Lagos Life through the Vatar SDK, and to our own server for the game itself.
import { createArcade } from "/arcade/arcade.js";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const view = $("#view");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const naira = (n) => "₦" + Number(n).toLocaleString("en-NG");
const fmt = (n) => Number(n).toLocaleString("en-NG");
const plural = (n, one, many = one + "s") => `${n} ${n === 1 ? one : many}`;

const S = {
  framed: window.self !== window.top,
  mode: null,          // "live" | "test" | "dev"
  token: null,
  config: null,
  player: null,
  initSession: null,
  tab: "home",
  word: null,
  typing: "",
  round: null,
  answering: false,
  paused: false,
  submitted: -1,
};

// ---------- small UI helpers ----------

let toastTimer;
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
}

function setTab(tab) {
  S.tab = tab;
  $$("#tabs button").forEach((b) => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
}

function screen(html) {
  view.innerHTML = html;
  view.scrollTop = 0;
}

function showProblem(title, text, retry = true) {
  $("#tabs").hidden = true;
  screen(`<section class="stack problem">
    <h1 class="big title">${esc(title)}</h1>
    <p>${esc(text)}</p>
    ${retry ? `<button class="btn" data-go="reload">Try again</button>` : ""}
  </section>`);
}

// ---------- server calls ----------

async function rawPost(path, body) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.message || "Couldn't reach Doingz"), { code: data.error, status: r.status });
  return data;
}

async function api(path, body, retry = true) {
  let r;
  try {
    r = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(S.token ? { Authorization: "Bearer " + S.token } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error("Couldn't reach Doingz. Check your connection."), { code: "offline" });
  }
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && data.error === "signed_out" && retry) {
    await signIn(true);
    return api(path, body, false);
  }
  if (!r.ok) throw Object.assign(new Error(data.message || "Something went wrong"), { code: data.error, status: r.status });
  if (data.player) setPlayer(data.player);
  return data;
}

async function signIn(fresh) {
  let d;
  if (S.mode === "dev") {
    // Local testing: ?dev=ada and ?dev=bayo in two windows are two different players.
    const who = new URLSearchParams(location.search).get("dev") || "local";
    d = await rawPost("/api/dev-auth", { id: who, name: who === "local" ? "Local player" : who });
  } else {
    const session = fresh || !S.initSession ? (await window.Vatar.session()).session : S.initSession;
    S.initSession = null; // a session is only good for 15 minutes; fetch a fresh one next time
    d = await rawPost("/api/auth", { session, mode: S.mode });
  }
  S.token = d.token;
  setPlayer(d.player);
}

// ---------- player, theme, leaderboard ----------

function readThemePref() {
  try { return localStorage.getItem("doingz-theme"); } catch { return null; }
}
function writeThemePref(v) {
  try { localStorage.setItem("doingz-theme", v); } catch { /* storage blocked in this frame */ }
}
const owns = (id) => !!S.player?.owns.includes(id);

function applyTheme() {
  const pref = S.themePref ?? readThemePref();
  S.themePref = pref;
  document.documentElement.dataset.theme = owns("owambe_theme") && pref !== "danfo" ? "owambe" : "danfo";
}

function setPlayer(p) {
  S.player = p;
  $("#purse").hidden = false;
  $("#purse-points").textContent = fmt(p.points);
  applyTheme();
  queueScore();
}

// Vatar keeps each player's best score, one score every 20 seconds. Our score only goes up.
let scoreTimer = null;
let lastScoreAt = 0;
function queueScore() {
  if (S.mode === "dev" || !window.Vatar || !S.player || S.player.points <= 0 || S.player.points <= S.submitted) return;
  clearTimeout(scoreTimer);
  const wait = Math.max(0, lastScoreAt + 21_000 - Date.now());
  scoreTimer = setTimeout(async () => {
    lastScoreAt = Date.now();
    const want = S.player.points;
    try {
      await window.Vatar.submitScore(want);
      S.submitted = want;
    } catch (e) {
      if (e.code === "too_soon" || e.code === "rate_limited") queueScore();
    }
    if (S.player.points > S.submitted) queueScore();
  }, wait);
}

// ---------- purchases ----------

const productName = (id) => S.config.products.find((p) => p.id === id)?.name || "Your item";
const claiming = new Set();

async function claim(p) {
  if (!p?.purchaseId || claiming.has(p.purchaseId)) return;
  claiming.add(p.purchaseId);
  try {
    await api("/api/claim", { purchaseId: p.purchaseId });
    toast(`${productName(p.productId)} added`);
    refresh();
  } catch (e) {
    toast(e.code === "refunded" ? "That purchase was refunded" : "We'll add your purchase when you're back online");
  } finally {
    claiming.delete(p.purchaseId);
  }
}

const BUY_ERRORS = {
  owned: "You own this already",
  payment_failed: "The payment didn't go through",
  not_for_sale: "This isn't on sale right now",
  busy: "Finish the open payment first",
  rate_limited: "Give it a few seconds",
  signed_out: "Sign in to Lagos Life to buy",
  off: "The shop is closed right now",
};

async function buy(id) {
  if (S.mode === "dev") {
    await api("/api/dev-grant", { productId: id });
    toast(`${productName(id)} added (local test, no money)`);
    return refresh();
  }
  try {
    const p = await window.Vatar.purchase(id);
    await claim(p);
  } catch (e) {
    if (e.code !== "cancelled") toast(BUY_ERRORS[e.code] || "Couldn't open the payment. Try again.");
  }
}

// Re-draw whatever is on screen after something changed outside it (a purchase, a resume).
function refresh() {
  if (S.tab === "arcade-game") return; // a game in progress redraws itself
  if (S.tab === "arcade") return arcade.renderList();
  if (S.tab === "shop") return renderShop();
  if (S.tab === "home") return renderHome();
  if (S.tab === "word" && S.word) return drawWord();
  if (S.tab === "trivia" && S.round) return drawTrivia();
}

// ---------- home ----------

function dateLabel(iso) {
  return new Date(iso + "T12:00:00+01:00").toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Lagos" });
}

async function renderHome() {
  setTab("home");
  let w;
  try {
    w = (await api("/api/word")).word;
  } catch (e) {
    return showProblem("No network", e.message);
  }
  if (S.tab !== "home") return;
  const p = S.player;
  const solved = w.status === "won";
  const mini = Array.from({ length: 5 }, (_, i) =>
    solved ? `<span class="hit">${esc(w.answer[i])}</span>` : `<span></span>`).join("");
  const cta = w.status !== "playing" ? "See how you did" : w.guesses.length ? "Carry on" : "Play today's word";
  const left = p.triviaScoredLeft;

  screen(`
    <p class="hello">How far, ${esc(p.name.split(" ")[0] || "my person")}</p>
    <div class="stack">
      <section class="route">
        <h1 class="big">Today's word</h1>
        <p class="sub">Puzzle ${w.number}, ${esc(dateLabel(w.date))}<br>Clue: ${esc(w.category)}</p>
        <div class="mini" aria-hidden="true">${mini}</div>
        <button class="btn" data-go="word">${cta}</button>
      </section>

      <section class="panel quick">
        <h2 class="big">Quick fire</h2>
        <p>${S.config.trivia.questions} questions, ${S.config.trivia.timeLimitMs / 1000} seconds each.
          ${left ? `${plural(left, "scored round")} left today.` : "Today's scored rounds are done. Play on for practice."}</p>
        <button class="btn" data-go="trivia">Start a round</button>
      </section>

      <div class="stats">
        <div><b>${fmt(p.points)}</b><span>points</span></div>
        <div><b>${p.streak}</b><span>day streak</span></div>
        <div><b>${p.hints}</b><span>hints</span></div>
        <div><b>${p.shields}</b><span>shields</span></div>
      </div>

      ${owns("archive_pass") ? `<button class="linkish" data-go="archive">Open the word archive</button>` : ""}

      <details>
        <summary><b>How to play</b></summary>
        <p><b>Today's word.</b> Guess the five-letter Naija word in six tries. Green is the right letter in the right place.
          Blue is in the word, somewhere else. Grey isn't in the word. The clue tells you what kind of word it is.</p>
        <p>Fewer guesses earn more points, and your daily streak adds a bonus. A hint shows one letter but takes a quarter off that puzzle's points.</p>
        <p><b>Quick fire.</b> Your first ${S.config.trivia.scoredPerDay} rounds each day earn points. A right answer is worth 10, plus up to 10 more for speed. 50:50 halves that question's points.</p>
        <p>Points add up on the board. They can't be bought.</p>
      </details>
    </div>`);
}

// ---------- daily word ----------

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "<ZXCVBNM>"];
const RANK = { hit: 3, near: 2, miss: 1 };

async function openWord(day) {
  setTab("word");
  S.typing = "";
  try {
    S.word = (await api(`/api/word${day != null ? `?day=${day}` : ""}`)).word;
  } catch (e) {
    toast(e.message);
    return renderHome();
  }
  drawWord();
}

function letterStates() {
  const best = {};
  for (const g of S.word.guesses) {
    [...g.word].forEach((ch, i) => {
      const m = g.marks[i];
      if (!best[ch] || RANK[m] > RANK[best[ch]]) best[ch] = m;
    });
  }
  return best;
}

function gridHtml(flipLast) {
  const w = S.word;
  const lines = [];
  const rows = w.status === "playing" ? w.maxGuesses : w.guesses.length; // a finished puzzle drops its empty rows
  for (let r = 0; r < rows; r++) {
    const g = w.guesses[r];
    let cells = "";
    for (let i = 0; i < 5; i++) {
      if (g) {
        const flip = flipLast && r === w.guesses.length - 1 ? " flip" : "";
        cells += `<span class="tile ${g.marks[i]}${flip}">${g.word[i]}</span>`;
      } else if (r === w.guesses.length && w.status === "playing") {
        const ch = S.typing[i];
        const ghost = !ch && w.revealed.find((x) => x.pos === i);
        cells += ch ? `<span class="tile">${ch}</span>` : ghost ? `<span class="tile ghost">${ghost.letter}</span>` : `<span class="tile"></span>`;
      } else {
        cells += `<span class="tile"></span>`;
      }
    }
    lines.push(`<div class="line" data-line="${r}">${cells}</div>`);
  }
  return lines.join("");
}

function keyboardHtml() {
  const st = letterStates();
  return KEY_ROWS.map((row) => `<div class="krow">${[...row].map((k) => {
    if (k === "<") return `<button class="key wide" data-key="Enter">Enter</button>`;
    if (k === ">") return `<button class="key wide" data-key="Backspace" aria-label="Delete">Del</button>`;
    return `<button class="key ${st[k] || ""}" data-key="${k}">${k}</button>`;
  }).join("")}</div>`).join("");
}

function resultHtml() {
  const w = S.word;
  const won = w.status === "won";
  const cheers = ["Oshey!", "You sabi!", "Correct person!"];
  const pointsLine = w.practice
    ? "Archive game, so no points."
    : won ? `+${w.points} points. ${plural(S.player.streak, "day")} on your streak.` : "No points today. Come back tomorrow for a new word.";
  return `<section class="panel result">
    <h2 class="big">${won ? cheers[w.guesses.length % cheers.length] : "E no easy"}</h2>
    <p>${won ? `Solved in ${w.guesses.length} of ${w.maxGuesses}.` : "The word was"}</p>
    <p class="answer">${esc(w.answer)}</p>
    <p class="meaning">${esc(w.meaning)}</p>
    <p><b>${pointsLine}</b></p>
    <div class="stack">
      <button class="btn" data-go="trivia">Play Quick fire</button>
      <button class="btn light" data-go="${w.practice ? "archive" : "home"}">${w.practice ? "Back to the archive" : "Home"}</button>
    </div>
  </section>`;
}

function drawWord(flipLast = false) {
  const w = S.word;
  const playing = w.status === "playing";
  const hintLabel = S.player.hints ? `Hint (${S.player.hints})` : "Get 5 hints";
  screen(`
    <div class="row word-head">
      <button class="back" data-go="${w.practice ? "archive" : "home"}">‹ ${w.practice ? "Archive" : "Home"}</button>
      ${playing ? `<button class="hint-btn" data-go="hint">${hintLabel}</button>` : ""}
    </div>
    <div class="row">
      <h1 class="big puzzle">Puzzle ${w.number}</h1>
      <span class="chip">${esc(w.category)}</span>
    </div>
    ${w.practice ? `<p class="muted note">Archive game: no points, no streak.</p>` : ""}
    <div class="grid" id="grid" aria-label="Guesses">${gridHtml(flipLast)}</div>
    <div id="below"></div>`);
  const below = $("#below");
  if (playing) below.innerHTML = `<div class="keys">${keyboardHtml()}</div>`;
  else if (flipLast) setTimeout(() => S.tab === "word" && (below.innerHTML = resultHtml()), 5 * 110 + 450);
  else below.innerHTML = resultHtml();
}

function redrawCurrentLine() {
  const line = $(`#grid [data-line="${S.word.guesses.length}"]`);
  if (!line) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = gridHtml(false);
  line.innerHTML = tmp.querySelector(`[data-line="${S.word.guesses.length}"]`).innerHTML;
}

function shakeLine() {
  const line = $(`#grid [data-line="${S.word.guesses.length}"]`);
  if (!line) return;
  line.classList.remove("shake");
  void line.offsetWidth;
  line.classList.add("shake");
}

let guessing = false;
async function pressKey(k) {
  if (S.tab !== "word" || !S.word || S.word.status !== "playing" || guessing) return;
  if (k === "Backspace") S.typing = S.typing.slice(0, -1);
  else if (k === "Enter") return submitGuess();
  else if (/^[A-Z]$/.test(k) && S.typing.length < 5) S.typing += k;
  redrawCurrentLine();
}

async function submitGuess() {
  if (S.typing.length < 5) { shakeLine(); return toast("Five letters, please"); }
  guessing = true;
  try {
    const d = await api("/api/word/guess", { day: S.word.day, word: S.typing });
    S.word = d.word;
    S.typing = "";
    drawWord(true);
  } catch (e) {
    shakeLine();
    toast(e.message);
  } finally {
    guessing = false;
  }
}

async function useHint() {
  if (!S.player.hints) return buy("hints_5");
  try {
    S.word = (await api("/api/word/hint", { day: S.word.day })).word;
    drawWord();
  } catch (e) {
    toast(e.message);
  }
}

async function renderArchive() {
  setTab("archive");
  let days;
  try {
    ({ days } = await api("/api/word/archive"));
  } catch (e) {
    toast(e.message);
    return renderHome();
  }
  const label = { won: "Solved", lost: "Missed", playing: "Started", new: "Not played" };
  screen(`
    <button class="back" data-go="home">‹ Home</button>
    <h1 class="big title">Word archive</h1>
    <p>Every past daily word. Archive games are for fun: no points, no streak.</p>
    <ul class="board">${days.length ? days.map((d) => `
      <li><span class="rank">${d.number}</span><span class="name">${esc(dateLabel(d.date))}</span>
        <button class="chip" data-go="past" data-day="${d.day}">${label[d.status]}</button></li>`).join("")
      : `<li><span></span><span class="name">The first past word shows up here tomorrow.</span></li>`}</ul>`);
}

// ---------- Quick fire ----------

let raf = 0;
let deadline = 0;

async function startRound() {
  setTab("trivia");
  stopClock();
  try {
    S.round = (await api("/api/trivia/start", {})).round;
  } catch (e) {
    toast(e.message);
    return renderHome();
  }
  drawTrivia();
}

function stopClock() {
  cancelAnimationFrame(raf);
  raf = 0;
}

function runClock(timeLeftMs, limitMs) {
  stopClock();
  deadline = performance.now() + timeLeftMs;
  const bar = $("#timer i");
  const box = $("#timer");
  const tick = () => {
    const left = deadline - performance.now();
    if (bar) bar.style.transform = `scaleX(${Math.max(0, left / limitMs)})`;
    if (box) box.classList.toggle("low", left < 4000);
    if (left <= 0) { raf = 0; return answer(null); }
    raf = requestAnimationFrame(tick);
  };
  tick();
}

function drawTrivia() {
  const r = S.round;
  if (!r.question) return drawSummary();
  const q = r.question;
  const hints = S.player.hints;
  S.answering = false;
  screen(`
    <div class="row">
      <button class="back" data-go="home">‹ Home</button>
      <span class="chip">${r.scored ? "Scored round" : "Practice round"}</span>
    </div>
    <div class="row progress"><span>Question ${q.index + 1} of ${q.total}</span><b>${fmt(r.points)} pts</b></div>
    <div class="timer" id="timer" role="progressbar" aria-label="Time left"><i></i></div>
    <span class="chip">${esc(q.category)}</span>
    <p class="q-text">${esc(q.text)}</p>
    <div class="options">${q.options.map((o, k) =>
      `<button class="option${q.removed.includes(k) ? " gone" : ""}" data-opt="${k}">${esc(o)}</button>`).join("")}</div>
    <div class="q-foot">${q.removed.length ? "" : `<button class="btn light" data-go="fifty">${hints ? `50:50, uses 1 of ${hints} hints` : "Get 5 hints for 50:50"}</button>`}</div>`);
  if (S.paused) return;
  if (q.timeLeftMs <= 0) return answer(null);
  runClock(q.timeLeftMs, q.timeLimitMs);
}

async function answer(choice) {
  if (S.answering || !S.round?.question) return;
  S.answering = true;
  stopClock();
  $$(".option").forEach((b) => (b.disabled = true));
  try {
    const d = await api("/api/trivia/answer", { roundId: S.round.roundId, choice });
    const opts = $$(".option");
    opts[d.result.answer]?.classList.add("right");
    if (choice != null && choice !== d.result.answer) opts[choice]?.classList.add("wrong");
    if (d.result.timedOut && choice == null) toast("Time up");
    else if (d.result.correct) toast(`+${d.result.points}`);
    setTimeout(() => {
      S.round = d.round;
      if (S.tab === "trivia") drawTrivia();
    }, 1000);
  } catch (e) {
    toast(e.message);
    S.answering = false;
    if (e.code === "round_over" || e.code === "no_round") renderHome();
  }
}

async function useFifty() {
  if (!S.player.hints) return buy("hints_5");
  try {
    S.round = (await api("/api/trivia/fifty", { roundId: S.round.roundId })).round;
    drawTrivia();
  } catch (e) {
    toast(e.message);
  }
}

function drawSummary() {
  stopClock();
  const r = S.round;
  const verdict = r.correct >= 8 ? "Correct person!" : r.correct >= 5 ? "You try!" : "Next round go better";
  const left = S.player.triviaScoredLeft;
  screen(`
    <section class="stack summary">
      <h1 class="big title">${verdict}</h1>
      <p class="score-line">${r.correct}/${r.total}</p>
      <p><b>${r.scored ? `+${fmt(r.points)} points` : `${fmt(r.points)} points in practice (not counted)`}</b><br>
        ${left ? `${plural(left, "scored round")} left today.` : "Today's scored rounds are done. Practice rounds are still open."}</p>
      <button class="btn" data-go="trivia">Play another round</button>
      <button class="btn light" data-go="home">Home</button>
    </section>`);
}

// ---------- board ----------

async function renderBoard() {
  setTab("board");
  if (S.mode === "dev" || !window.Vatar) {
    return screen(`<h1 class="big title">Board</h1>
      <p>The board shows inside Lagos Life. You have ${fmt(S.player.points)} points.</p>`);
  }
  screen(`<h1 class="big title">Board</h1><p>Loading the board…</p>`);
  let data;
  try {
    data = await window.Vatar.leaderboard();
  } catch {
    return S.tab === "board" && screen(`<h1 class="big title">Board</h1><p>The board didn't load. Try again in a moment.</p>
      <button class="btn" data-tab-go="board">Reload the board</button>`);
  }
  if (S.tab !== "board") return;
  const { top, me } = data;
  const mine = me && top.some((t) => t.rank === me.rank);
  screen(`
    <h1 class="big title">Board</h1>
    <p>Everyone's Doingz points, all time. Daily words and scored Quick fire rounds count.</p>
    <ol class="board">
      ${top.length ? top.map((t) => `<li class="${mine && t.rank === me.rank ? "me" : ""}">
        <span class="rank">#${t.rank}</span><span class="name">${esc(t.name)}</span><span class="pts">${fmt(t.score)}</span></li>`).join("")
        : `<li><span></span><span class="name">No scores yet. Solve today's word to get on the board.</span></li>`}
      ${me && !mine ? `<li class="me"><span class="rank">${esc(me.label)}</span><span class="name">You</span><span class="pts">${fmt(me.score)}</span></li>` : ""}
    </ol>`);
}

// ---------- shop ----------

function renderShop() {
  setTab("shop");
  const p = S.player;
  const have = { hints_5: p.hints, hints_25: p.hints, streak_shield: p.shields };
  const theme = document.documentElement.dataset.theme;
  const items = S.config.products.map((it) => {
    let action;
    if (it.kind === "oneoff" && owns(it.id)) {
      action = it.id === "owambe_theme"
        ? `<button class="btn light" data-go="theme">${theme === "owambe" ? "Use danfo" : "Use Owambe"}</button>`
        : `<button class="btn light" disabled>Owned</button>`;
    } else {
      action = `<button class="btn" data-buy="${it.id}">${naira(it.price)}</button>`;
    }
    const count = it.id in have && it.id !== "hints_25" ? ` You have ${have[it.id]}.` : "";
    return `<section class="panel product"><h2>${esc(it.name)}</h2><p>${esc(it.blurb)}${count}</p>${action}</section>`;
  }).join("");
  screen(`
    <h1 class="big title">Shop</h1>
    <p>Hints and extras. Points can't be bought: they only come from playing.</p>
    <div class="stack">${items}</div>
    <p class="muted fine">You pay on Lagos Life's own pay sheet. ${S.mode === "dev" ? "Local test: items are free." : ""}</p>`);
}

// ---------- pause and resume (phone in the background, or the pay sheet is open) ----------

async function onPause() {
  S.paused = true;
  if (S.tab === "arcade-game") arcade.pause();
  if (S.tab === "trivia" && S.round?.question) {
    stopClock();
    $("#paused").hidden = false;
    try { await api("/api/trivia/pause", { roundId: S.round.roundId }); } catch { /* resume sorts it out */ }
  }
}

async function onResume() {
  S.paused = false;
  $("#paused").hidden = true;
  if (S.tab === "arcade-game") arcade.resume();
  if (S.tab === "trivia" && S.round?.question) {
    try {
      S.round = (await api("/api/trivia/resume", { roundId: S.round.roundId })).round;
    } catch { /* draw with what we have */ }
    drawTrivia();
  }
}

// ---------- navigation ----------

document.addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-go],[data-tab],[data-buy],[data-opt],[data-key],[data-tab-go],[data-arcade]");
  if (!t) return;
  if (t.dataset.arcade) return arcade.open(t.dataset.arcade);
  if ((S.tab === "arcade-game" || S.tab === "arcade-wait") && (t.dataset.go || t.dataset.tab)) arcade.leave();
  if (t.dataset.key) return pressKey(t.dataset.key);
  if (t.dataset.opt != null) return answer(Number(t.dataset.opt));
  if (t.dataset.buy) return buy(t.dataset.buy);
  const go = t.dataset.go || t.dataset.tab || t.dataset.tabGo;
  if (S.tab === "trivia" && go !== "fifty") stopClock();
  switch (go) {
    case "home": return renderHome();
    case "word": return openWord();
    case "past": return openWord(Number(t.dataset.day));
    case "archive": return renderArchive();
    case "trivia": return startRound();
    case "arcade": return arcade.renderList();
    case "board": return renderBoard();
    case "shop": return renderShop();
    case "hint": return useHint();
    case "fifty": return useFifty();
    case "theme":
      S.themePref = document.documentElement.dataset.theme === "owambe" ? "danfo" : "owambe";
      writeThemePref(S.themePref);
      applyTheme();
      return renderShop();
    case "reload": return location.reload();
  }
});

document.addEventListener("keydown", (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (S.tab === "word") {
    const k = ev.key === "Enter" || ev.key === "Backspace" ? ev.key : ev.key.length === 1 ? ev.key.toUpperCase() : null;
    if (k) { ev.preventDefault(); pressKey(k); }
  } else if (S.tab === "trivia" && /^[1-4]$/.test(ev.key)) {
    const b = $$(".option")[Number(ev.key) - 1];
    if (b && !b.classList.contains("gone")) answer(Number(ev.key) - 1);
  }
});

// ---------- arcade ----------

const arcade = createArcade({
  api, screen, toast, esc, fmt, plural, setTab,
  getMode: () => S.mode,
  showTabs: (on) => { $("#tabs").hidden = !on; },
});

// ---------- start ----------

const INIT_ERRORS = {
  signed_out: ["Sign in first", "Sign in to Lagos Life, then open Doingz again."],
  off: ["Doingz is resting", "The game is switched off right now. Try again later."],
  not_framed: ["Open Doingz in Lagos Life", "Doingz plays inside Lagos Life. Open the Games app on your in-game phone and tap Doingz."],
  timeout: ["Lagos Life didn't answer", "Close Doingz and open it again."],
};

async function boot() {
  try {
    S.config = await fetch("/api/config").then((r) => r.json());
  } catch {
    return showProblem("No network", "Doingz couldn't load. Check your connection and try again.");
  }

  if (S.framed) {
    if (!window.Vatar) return showProblem("Couldn't load", "Lagos Life's game kit didn't load. Close Doingz and open it again.");
    try {
      const { session, mode } = await window.Vatar.init();
      S.mode = mode;
      S.initSession = session;
      await signIn(false);
    } catch (e) {
      const [title, text] = INIT_ERRORS[e.code] || ["Couldn't sign you in", e.message || "Close Doingz and open it again."];
      return showProblem(title, text, e.code !== "off");
    }
    window.Vatar.onPause(onPause);
    window.Vatar.onResume(onResume);
    window.Vatar.onPurchase(claim);
    window.Vatar.purchases().then((list) => list.forEach(claim)).catch(() => {});
  } else if (S.config.devAuth) {
    S.mode = "dev";
    try { await signIn(false); } catch (e) { return showProblem("Couldn't start", e.message); }
  } else {
    const [title, text] = INIT_ERRORS.not_framed;
    return showProblem(title, text, false);
  }

  $("#tabs").hidden = false;
  renderHome();
  arcade.resumeVatar();
}

boot();
