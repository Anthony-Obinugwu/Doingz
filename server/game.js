// Game rules. Everything that decides points runs here, on the server:
// the phone never sees today's word or a trivia answer before it has played.
import fs from "node:fs";
import crypto from "node:crypto";
import { ANSWERS, EXTRA_GUESSES } from "./content/answers.js";
import { TRIVIA } from "./content/trivia.js";
import { PRODUCTS } from "./products.js";
import { tx } from "./db.js";
import { randomId } from "./config.js";

export class GameError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------- days (Lagos is UTC+1 all year) ----------

const DAY_MS = 86_400_000;
export const lagosDay = (ms) => Math.floor((ms + 3_600_000) / DAY_MS);
export const dayFromDate = (yyyyMmDd) => lagosDay(Date.parse(`${yyyyMmDd}T00:00:00+01:00`));
export const dateOfDay = (day) => new Date(day * DAY_MS).toISOString().slice(0, 10);

// ---------- dictionary ----------

const GUESSES = new Set(
  fs.readFileSync(new URL("./content/guesses.txt", import.meta.url), "utf8").split("\n").map((w) => w.trim()).filter(Boolean),
);
for (const a of ANSWERS) GUESSES.add(a.word);
for (const w of EXTRA_GUESSES) GUESSES.add(w);
export const isWord = (w) => GUESSES.has(w);

// A fixed shuffle so the daily order isn't simply the order of the list.
function seededOrder(n, seed) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
const ORDER = seededOrder(ANSWERS.length, 20261011);

export const answerFor = (day, launchDay) => {
  const n = ANSWERS.length;
  return ANSWERS[ORDER[(((day - launchDay) % n) + n) % n]];
};

/** Wordle marking: "hit" right letter right place, "near" in the word elsewhere, "miss" not in it. */
export function mark(guess, answer) {
  const out = Array(5).fill("miss");
  const left = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) out[i] = "hit";
    else left[answer[i]] = (left[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (out[i] !== "hit" && left[guess[i]]) {
      out[i] = "near";
      left[guess[i]]--;
    }
  }
  return out;
}

const BASE = [100, 80, 60, 45, 30, 20];
/** Points for a solved word: fewer guesses is better, each hint takes 25% off, streak adds up to 50. */
export function wordPoints(guessCount, hintsUsed, streak) {
  const base = BASE[guessCount - 1] || 0;
  const afterHints = Math.max(Math.round(base * 0.25), Math.round(base * (1 - 0.25 * hintsUsed)));
  return afterHints + Math.min(streak, 10) * 5;
}

// ---------- players ----------

const ARCADE_PER_DAY = 10; // matches arcade.js ARCADE_SCORED_PER_DAY

const parse = (s, fallback) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

export function ensurePlayer(db, id, name, now) {
  db.prepare(
    `INSERT INTO players (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = CASE WHEN excluded.name <> '' THEN excluded.name ELSE players.name END,
       updated_at = excluded.updated_at`,
  ).run(id, name || "", now, now);
  return getPlayer(db, id);
}

export function getPlayer(db, id) {
  const p = db.prepare("SELECT * FROM players WHERE id = ?").get(id);
  if (!p) throw new GameError(401, "unknown_player", "Sign in again");
  return p;
}

function savePlayer(db, p, now) {
  db.prepare(
    `UPDATE players SET points = ?, hints = ?, shields = ?, streak = ?, best_streak = ?, last_streak_day = ?,
       owns = ?, trivia_day = ?, trivia_scored = ?, updated_at = ? WHERE id = ?`,
  ).run(p.points, p.hints, p.shields, p.streak, p.best_streak, p.last_streak_day ?? null,
    p.owns, p.trivia_day ?? null, p.trivia_scored, now, p.id);
}

/** Missed days between the last streak day and `day`, covered by shields if there are enough. */
function settleGap(p, day) {
  if (p.last_streak_day == null) { p.streak = 0; return; }
  const gap = day - p.last_streak_day - 1;
  if (gap <= 0) return;
  if (p.shields >= gap) p.shields -= gap;
  else p.streak = 0;
}

function streakOnWin(p, day) {
  settleGap(p, day);
  p.streak += 1;
  p.best_streak = Math.max(p.best_streak, p.streak);
  p.last_streak_day = day;
}

function streakOnLoss(p, day) {
  settleGap(p, day);
  if (p.streak > 0 && p.shields > 0) p.shields -= 1; // a shield covers today's loss
  else p.streak = 0;
  p.last_streak_day = day;
}

/** The streak as it stands today (shields that would cover missed days count). */
function shownStreak(p, today) {
  if (p.last_streak_day == null) return 0;
  const gap = today - p.last_streak_day - 1;
  if (gap <= 0) return p.streak;
  return p.shields >= gap ? p.streak : 0;
}

export function publicPlayer(db, p, today) {
  if (p.trivia_day !== today) { p.trivia_day = today; p.trivia_scored = 0; }
  return {
    id: p.id,
    name: p.name,
    points: p.points,
    hints: p.hints,
    shields: p.shields,
    streak: shownStreak(p, today),
    bestStreak: p.best_streak,
    owns: parse(p.owns, []),
    triviaScoredLeft: Math.max(0, TRIVIA_SCORED_PER_DAY - p.trivia_scored),
    arcadeScoredLeft: Math.max(0, ARCADE_PER_DAY - (p.arcade_day === today ? p.arcade_scored || 0 : 0)),
  };
}

// ---------- daily word ----------

const MAX_GUESSES = 6;

function wordRow(db, pid, day) {
  return db.prepare("SELECT * FROM word_games WHERE player_id = ? AND day = ?").get(pid, day);
}

function checkWordDay(p, day, today, launchDay) {
  if (!Number.isInteger(day) || day > today || day < launchDay) throw new GameError(400, "bad_day", "No puzzle for that day");
  if (day < today && !parse(p.owns, []).includes("archive_pass")) {
    throw new GameError(403, "archive_locked", "Past words need the word archive");
  }
}

function wordView(row, day, today, launchDay) {
  const ans = answerFor(day, launchDay);
  const guesses = row ? parse(row.guesses, []) : [];
  const status = row?.status || "playing";
  const done = status !== "playing";
  return {
    day,
    number: day - launchDay + 1,
    date: dateOfDay(day),
    practice: day < today || !!row?.practice,
    category: ans.cat,
    guesses: guesses.map((g) => ({ word: g, marks: mark(g, ans.word) })),
    revealed: row ? parse(row.revealed, []) : [],
    hintsUsed: row?.hints || 0,
    maxGuesses: MAX_GUESSES,
    status,
    points: row?.points || 0,
    answer: done ? ans.word : null,
    meaning: done ? ans.meaning : null,
  };
}

export function getWord(db, pid, day, now, launchDay) {
  const today = lagosDay(now);
  const p = getPlayer(db, pid);
  checkWordDay(p, day, today, launchDay);
  return { word: wordView(wordRow(db, pid, day), day, today, launchDay), player: publicPlayer(db, p, today) };
}

export function guessWord(db, pid, day, raw, now, launchDay) {
  const today = lagosDay(now);
  const word = String(raw || "").toUpperCase();
  if (!/^[A-Z]{5}$/.test(word)) throw new GameError(400, "bad_word", "Five letters, please");
  if (!isWord(word)) throw new GameError(400, "not_a_word", "Not in the word list");

  return tx(db, () => {
    const p = getPlayer(db, pid);
    checkWordDay(p, day, today, launchDay);
    const practice = day < today;
    let row = wordRow(db, pid, day);
    if (!row) {
      db.prepare("INSERT INTO word_games (player_id, day, practice, updated_at) VALUES (?, ?, ?, ?)").run(pid, day, practice ? 1 : 0, now);
      row = wordRow(db, pid, day);
    }
    if (row.status !== "playing") throw new GameError(409, "word_done", "This puzzle is finished");
    const guesses = parse(row.guesses, []);
    if (guesses.includes(word)) throw new GameError(400, "repeat", "You tried that word already");
    guesses.push(word);

    const ans = answerFor(day, launchDay).word;
    let status = "playing";
    let points = 0;
    if (word === ans) status = "won";
    else if (guesses.length >= MAX_GUESSES) status = "lost";

    if (!row.practice && status !== "playing") {
      if (status === "won") {
        streakOnWin(p, day);
        points = wordPoints(guesses.length, row.hints, p.streak);
        p.points += points;
      } else {
        streakOnLoss(p, day);
      }
      savePlayer(db, p, now);
    }
    db.prepare("UPDATE word_games SET guesses = ?, status = ?, points = ?, updated_at = ? WHERE player_id = ? AND day = ?")
      .run(JSON.stringify(guesses), status, points, now, pid, day);
    return { word: wordView(wordRow(db, pid, day), day, today, launchDay), player: publicPlayer(db, p, today) };
  });
}

export function hintWord(db, pid, day, now, launchDay) {
  const today = lagosDay(now);
  return tx(db, () => {
    const p = getPlayer(db, pid);
    checkWordDay(p, day, today, launchDay);
    if (p.hints < 1) throw new GameError(402, "no_hints", "You're out of hints");
    let row = wordRow(db, pid, day);
    if (!row) {
      db.prepare("INSERT INTO word_games (player_id, day, practice, updated_at) VALUES (?, ?, ?, ?)").run(pid, day, day < today ? 1 : 0, now);
      row = wordRow(db, pid, day);
    }
    if (row.status !== "playing") throw new GameError(409, "word_done", "This puzzle is finished");
    const ans = answerFor(day, launchDay).word;
    const revealed = parse(row.revealed, []);
    const known = new Set(revealed.map((r) => r.pos));
    for (const g of parse(row.guesses, [])) mark(g, ans).forEach((m, i) => m === "hit" && known.add(i));
    const open = [0, 1, 2, 3, 4].filter((i) => !known.has(i));
    if (open.length <= 1) throw new GameError(409, "hint_not_needed", "You know enough letters already");
    const pos = open[crypto.randomInt(open.length)];
    revealed.push({ pos, letter: ans[pos] });
    p.hints -= 1;
    savePlayer(db, p, now);
    db.prepare("UPDATE word_games SET revealed = ?, hints = hints + 1, updated_at = ? WHERE player_id = ? AND day = ?")
      .run(JSON.stringify(revealed), now, pid, day);
    return { word: wordView(wordRow(db, pid, day), day, today, launchDay), player: publicPlayer(db, p, today) };
  });
}

export function wordArchive(db, pid, now, launchDay) {
  const today = lagosDay(now);
  const rows = db.prepare("SELECT day, status FROM word_games WHERE player_id = ? AND day < ?").all(pid, today);
  const status = Object.fromEntries(rows.map((r) => [r.day, r.status]));
  const days = [];
  for (let d = today - 1; d >= launchDay && days.length < 120; d--) {
    days.push({ day: d, number: d - launchDay + 1, date: dateOfDay(d), status: status[d] || "new" });
  }
  return { days };
}

// ---------- Quick fire trivia ----------

export const TRIVIA_SCORED_PER_DAY = 3;
export const TRIVIA_QUESTIONS = 10;
export const TIME_LIMIT_MS = 15_000;
const GRACE_MS = 2_500;              // network time on a slow connection
const PAUSE_CAP_MS = 45_000;         // most pause time one round can claim back
const ROUND_STALE_MS = 15 * 60_000;

const BY_ID = new Map(TRIVIA.map((t) => [t.id, t]));

function pickQuestions(n) {
  const pool = [...TRIVIA];
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const t = pool.splice(crypto.randomInt(pool.length), 1)[0];
    const order = [0, 1, 2, 3];
    for (let k = 3; k > 0; k--) {
      const j = crypto.randomInt(k + 1);
      [order[k], order[j]] = [order[j], order[k]];
    }
    out.push({ id: t.id, order }); // option position -> 0 is the right answer, 1..3 the wrong ones
  }
  return out;
}

const optionText = (t, i) => (i === 0 ? t.a : t.w[i - 1]);

function questionView(r, now) {
  const qs = parse(r.questions, []);
  if (r.idx >= qs.length) return null;
  const { id, order } = qs[r.idx];
  const t = BY_ID.get(id);
  const clock = r.paused_at ?? now;
  return {
    index: r.idx,
    total: qs.length,
    category: t.cat,
    text: t.q,
    options: order.map((i) => optionText(t, i)),
    removed: parse(r.fifty, []) || [],
    timeLimitMs: TIME_LIMIT_MS,
    timeLeftMs: Math.max(0, TIME_LIMIT_MS - (clock - r.served_at)),
    paused: r.paused_at != null,
  };
}

function roundView(r, now) {
  return {
    roundId: r.id,
    scored: !!r.scored,
    status: r.status,
    points: r.points,
    correct: r.correct,
    total: parse(r.questions, []).length,
    question: r.status === "playing" ? questionView(r, now) : null,
  };
}

function activeRound(db, pid) {
  return db.prepare("SELECT * FROM trivia_rounds WHERE player_id = ? AND status = 'playing' ORDER BY created_at DESC LIMIT 1").get(pid);
}

function ownRound(db, pid, roundId) {
  const r = db.prepare("SELECT * FROM trivia_rounds WHERE id = ? AND player_id = ?").get(String(roundId || ""), pid);
  if (!r) throw new GameError(404, "no_round", "That round isn't running");
  if (r.status !== "playing") throw new GameError(409, "round_over", "That round is over");
  return r;
}

export function startTrivia(db, pid, now) {
  const today = lagosDay(now);
  return tx(db, () => {
    const p = getPlayer(db, pid);
    const pub = publicPlayer(db, p, today); // also resets the daily count
    const live = activeRound(db, pid);
    if (live && now - live.created_at < ROUND_STALE_MS) {
      return { round: roundView(live, now), player: pub };
    }
    if (live) db.prepare("UPDATE trivia_rounds SET status = 'abandoned' WHERE id = ?").run(live.id);

    const scored = p.trivia_scored < TRIVIA_SCORED_PER_DAY;
    if (scored) p.trivia_scored += 1;
    savePlayer(db, p, now);
    const id = randomId(9);
    db.prepare(
      "INSERT INTO trivia_rounds (id, player_id, day, scored, questions, served_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(id, pid, today, scored ? 1 : 0, JSON.stringify(pickQuestions(TRIVIA_QUESTIONS)), now, now);
    const r = db.prepare("SELECT * FROM trivia_rounds WHERE id = ?").get(id);
    return { round: roundView(r, now), player: publicPlayer(db, p, today) };
  });
}

/** Points for a right answer: 10, plus up to 10 for speed. Halved if 50:50 was used. */
export function answerPoints(elapsedMs, usedFifty) {
  const speed = Math.min(10, Math.ceil(Math.max(0, TIME_LIMIT_MS - elapsedMs) / 1500));
  const pts = 10 + speed;
  return usedFifty ? Math.floor(pts / 2) : pts;
}

export function answerTrivia(db, pid, roundId, choice, now) {
  const today = lagosDay(now);
  return tx(db, () => {
    const r = ownRound(db, pid, roundId);
    if (r.paused_at != null) { // answering un-pauses
      const back = Math.min(now - r.paused_at, Math.max(0, PAUSE_CAP_MS - r.pause_ms));
      r.served_at += back;
      r.pause_ms += back;
      r.paused_at = null;
    }
    const qs = parse(r.questions, []);
    const { id, order } = qs[r.idx];
    const t = BY_ID.get(id);
    const rightPos = order.indexOf(0);
    const elapsed = now - r.served_at;
    const inTime = elapsed <= TIME_LIMIT_MS + GRACE_MS;
    const picked = Number.isInteger(choice) && choice >= 0 && choice < 4 ? choice : null;
    const correct = inTime && picked === rightPos;
    const usedFifty = !!r.fifty;
    const pts = correct ? answerPoints(elapsed, usedFifty) : 0;

    const results = parse(r.results, []);
    results.push({ id, picked, correct, points: pts });
    r.idx += 1;
    r.points += pts;
    r.correct += correct ? 1 : 0;
    r.status = r.idx >= qs.length ? "done" : "playing";

    const p = getPlayer(db, pid);
    if (r.scored && pts) {
      p.points += pts;
      savePlayer(db, p, now);
    }
    db.prepare(
      `UPDATE trivia_rounds SET idx = ?, served_at = ?, paused_at = NULL, pause_ms = ?, fifty = NULL, results = ?, points = ?,
         correct = ?, status = ? WHERE id = ?`,
    ).run(r.idx, now, r.pause_ms, JSON.stringify(results), r.points, r.correct, r.status, r.id);
    const fresh = db.prepare("SELECT * FROM trivia_rounds WHERE id = ?").get(r.id);
    return {
      result: { correct, timedOut: !inTime || picked == null, answer: rightPos, answerText: t.a, points: pts },
      round: roundView(fresh, now),
      player: publicPlayer(db, p, today),
    };
  });
}

export function fiftyTrivia(db, pid, roundId, now) {
  const today = lagosDay(now);
  return tx(db, () => {
    const r = ownRound(db, pid, roundId);
    if (r.fifty) throw new GameError(409, "fifty_used", "Already used on this question");
    const p = getPlayer(db, pid);
    if (p.hints < 1) throw new GameError(402, "no_hints", "You're out of hints");
    const { order } = parse(r.questions, [])[r.idx];
    const wrong = [0, 1, 2, 3].filter((pos) => order[pos] !== 0);
    const keep = wrong[crypto.randomInt(wrong.length)];
    const removed = wrong.filter((pos) => pos !== keep);
    p.hints -= 1;
    savePlayer(db, p, now);
    db.prepare("UPDATE trivia_rounds SET fifty = ? WHERE id = ?").run(JSON.stringify(removed), r.id);
    const fresh = db.prepare("SELECT * FROM trivia_rounds WHERE id = ?").get(r.id);
    return { round: roundView(fresh, now), player: publicPlayer(db, p, today) };
  });
}

/** The phone went to the background: the clock stops (up to PAUSE_CAP_MS per round). */
export function pauseTrivia(db, pid, roundId, now) {
  const r = ownRound(db, pid, roundId);
  if (r.paused_at == null) db.prepare("UPDATE trivia_rounds SET paused_at = ? WHERE id = ?").run(now, r.id);
  return { round: roundView(db.prepare("SELECT * FROM trivia_rounds WHERE id = ?").get(r.id), now) };
}

export function resumeTrivia(db, pid, roundId, now) {
  const r = ownRound(db, pid, roundId);
  if (r.paused_at != null) {
    const back = Math.min(now - r.paused_at, Math.max(0, PAUSE_CAP_MS - r.pause_ms));
    db.prepare("UPDATE trivia_rounds SET served_at = served_at + ?, pause_ms = pause_ms + ?, paused_at = NULL WHERE id = ?")
      .run(back, back, r.id);
  }
  return { round: roundView(db.prepare("SELECT * FROM trivia_rounds WHERE id = ?").get(r.id), now) };
}

// ---------- purchases ----------

/** Gives a paid purchase once. Returns false if this purchase id was already given. */
export function grantPurchase(db, { id, playerId, productId, amount }, now) {
  return tx(db, () => {
    const seen = db.prepare("SELECT id FROM purchases WHERE id = ?").get(id);
    if (seen) return false;
    db.prepare("INSERT INTO purchases (id, player_id, product_id, amount, granted_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, playerId, productId, amount ?? null, now);
    const product = PRODUCTS[productId];
    if (!product) {
      console.warn(`purchase ${id}: unknown product ${productId}, recorded without granting`);
      return true;
    }
    const p = ensurePlayer(db, playerId, "", now);
    const g = product.grant;
    if (g.hints) p.hints += g.hints;
    if (g.shields) p.shields += g.shields;
    if (g.own) {
      const owns = new Set(parse(p.owns, []));
      owns.add(g.own);
      p.owns = JSON.stringify([...owns]);
    }
    savePlayer(db, p, now);
    return true;
  });
}

export function markDelivered(db, id, now) {
  db.prepare("UPDATE purchases SET delivered_at = ? WHERE id = ?").run(now, id);
}
