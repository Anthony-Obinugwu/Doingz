// The arcade: seat-based matches for every skill game.
//
// Each match has seats. Today seat 0 is the player and seat 1 is the computer. The rules only
// see seats, and the computer's turns run through the same apply() a person's do, so friend
// matches later mean putting a second person in seat 1 (see README, "Friend matches").
import crypto from "node:crypto";
import { tx } from "./db.js";
import { randomId } from "./config.js";
import { GameError, getPlayer, publicPlayer, lagosDay } from "./game.js";

import darts from "../public/shared/darts.js";
import archery from "../public/shared/archery.js";
import pong from "../public/shared/pong.js";
import basketball from "../public/shared/basketball.js";
import golf from "../public/shared/golf.js";
import shuffle from "../public/shared/shuffle.js";
import knockout from "../public/shared/knockout.js";
import tanks from "../public/shared/tanks.js";
import paintball from "../public/shared/paintball.js";
import four from "../public/shared/four.js";
import draughts from "../public/shared/draughts.js";
import chess from "../public/shared/chess.js";
import reversi from "../public/shared/reversi.js";
import gomoku from "../public/shared/gomoku.js";
import ayo from "../public/shared/ayo.js";
import dots from "../public/shared/dots.js";
import seabattle from "../public/shared/seabattle.js";
import filler from "../public/shared/filler.js";
import crazy8 from "../public/shared/crazy8.js";
import wordhunt from "../public/shared/wordhunt.js";
import anagrams from "../public/shared/anagrams.js";
import twenty from "../public/shared/twenty.js";
import { loadWordEngine } from "./words.js";

// The word games check words against a dictionary that only lives on the server.
wordhunt.engine = anagrams.engine = loadWordEngine();

export const GAMES = Object.fromEntries(
  [darts, archery, basketball, pong, golf, shuffle, knockout, tanks, paintball,
    four, draughts, chess, reversi, gomoku, ayo, dots, seabattle, filler, crazy8,
    wordhunt, anagrams, twenty].map((g) => [g.id, g]),
);

const WORDS = new Set(["wordhunt", "anagrams", "twenty"]);
export const ARCADE_SCORED_PER_DAY = 10;
export const WIN_POINTS = 25;
export const DRAW_POINTS = 10;
export const IDLE_CLAIM_MS = 2 * 60 * 1000; // a friend who goes quiet this long can lose by timeout
const STALE_MS = 2 * 60 * 60 * 1000;
const MAX_CPU_STEPS = 200;
const LOBBY_MS = 15 * 60 * 1000;

const parse = (s) => JSON.parse(s);
const clone = (x) => JSON.parse(JSON.stringify(x));

export function listGames() {
  return Object.values(GAMES).map((g) => ({
    id: g.id, title: g.title, blurb: g.blurb, how: g.how,
    kind: WORDS.has(g.id) ? "words" : g.snapshots ? "board" : "skill",
  }));
}

function load(db, id) {
  const m = db.prepare("SELECT * FROM arcade_matches WHERE id = ?").get(String(id || ""));
  if (!m) throw new GameError(404, "no_match", "That game isn't running");
  return {
    ...m,
    seats: parse(m.seats),
    state: parse(m.state),
    result: m.result ? parse(m.result) : null,
    scoredSeats: m.scored_seats ? parse(m.scored_seats) : [m.scored, 0],
  };
}

function save(db, m, now) {
  db.prepare("UPDATE arcade_matches SET state = ?, status = ?, result = ?, updated_at = ?, turn_at = ? WHERE id = ?")
    .run(JSON.stringify(m.state), m.status, m.result ? JSON.stringify(m.result) : null, now, m.turn_at ?? now, m.id);
}

const seatOf = (m, pid) => m.seats.findIndex((s) => s.kind === "human" && s.pid === pid);
const humanSeats = (m) => m.seats.map((s, i) => (s.kind === "human" ? i : -1)).filter((i) => i >= 0);
const isMulti = (m) => m.mode !== "cpu";

function matchView(m, seat, now) {
  const game = GAMES[m.game];
  const names = m.seats.map((s, i) => (s.kind === "cpu" ? "Computer" : i === seat ? "You" : s.name || "Player"));
  const toMove = m.status === "playing" ? game.toMove(m.state) : [];
  const idle = now - (m.turn_at ?? m.updated_at);
  return {
    id: m.id,
    game: m.game,
    seat,
    names,
    multi: isMulti(m),
    status: m.status,
    scored: !!m.scoredSeats[seat],
    toMove,
    view: game.view ? game.view(m.state, seat) : m.state.g,
    result: m.result,
    seq: m.seq ?? null,
    // In a friend game, if they've been quiet on their turn for a while, you can claim it.
    canClaim: isMulti(m) && m.status === "playing" && !toMove.includes(seat) && idle >= IDLE_CLAIM_MS,
    claimIn: isMulti(m) && m.status === "playing" && !toMove.includes(seat) ? Math.max(0, IDLE_CLAIM_MS - idle) : null,
  };
}

function award(db, m, winner, now) {
  const points = m.seats.map((s, i) => (winner === null ? DRAW_POINTS : winner === i ? WIN_POINTS : 0));
  const paid = points.map((p, i) => (m.scoredSeats[i] ? p : 0));
  m.seats.forEach((s, i) => {
    if (s.kind === "human" && paid[i]) db.prepare("UPDATE players SET points = points + ?, updated_at = ? WHERE id = ?").run(paid[i], now, s.pid);
  });
  return paid;
}

/** Ends the match if the rules say it's over, and pays points to the scored seats. */
function settle(db, m, now) {
  const r = GAMES[m.game].result(m.state);
  if (!r || m.status !== "playing") return;
  m.status = "done";
  m.result = { ...r, points: award(db, m, r.winner, now) };
}

/**
 * Applies one move. Turn-based games (game.snapshots) attach, for every person in the match, what
 * they may see right after it, so phones step through moves without learning hidden cards or ships.
 */
function applyMove(game, st, seat, move, ctx, viewers, events) {
  const evs = game.apply(st, seat, move, ctx);
  if (game.snapshots && evs.length) {
    const last = evs[evs.length - 1];
    last.snaps = {};
    for (const v of viewers) last.snaps[v] = clone(game.view ? game.view(st, v) : st.g);
  }
  events.push(...evs);
}

/** The events as one seat should see them: their own snapshot, anything private redacted. */
function personal(game, events, seat) {
  return events.map((ev) => {
    const { snaps, ...rest } = ev;
    const out = snaps ? { ...rest, snap: snaps[seat] } : rest;
    return game.redact ? game.redact(out, seat) : out;
  });
}

/** Runs computer seats until a person has to move or the match ends. */
function runCpu(m, now, events) {
  const game = GAMES[m.game];
  const viewers = humanSeats(m);
  for (let step = 0; step < MAX_CPU_STEPS && !game.result(m.state); step++) {
    const cpuSeats = game.toMove(m.state).filter((s) => m.seats[s].kind === "cpu");
    if (!cpuSeats.length) break;
    for (const s of cpuSeats) applyMove(game, m.state, s, game.cpu(m.state, s, Math.random), { now, cpu: true }, viewers, events);
  }
}

/** In friend games, stores each person's copy of the events so the other phone can catch up. */
function logEvents(db, m, events) {
  if (!isMulti(m) || !events.length) return;
  const game = GAMES[m.game];
  const seq = (db.prepare("SELECT MAX(seq) AS s FROM arcade_events WHERE match_id = ?").get(m.id).s ?? 0) + 1;
  for (const seat of humanSeats(m)) {
    db.prepare("INSERT INTO arcade_events (match_id, seq, seat, data) VALUES (?, ?, ?, ?)").run(m.id, seq, seat, JSON.stringify(personal(game, events, seat)));
  }
  m.seq = seq;
}
const lastSeq = (db, id) => db.prepare("SELECT MAX(seq) AS s FROM arcade_events WHERE match_id = ?").get(id).s ?? 0;

/** Uses up one of a player's scored games for today, if they have any left. */
function takeAllowance(db, pid, now) {
  const today = lagosDay(now);
  const p = getPlayer(db, pid);
  const used = p.arcade_day === today ? p.arcade_scored : 0;
  const scored = used < ARCADE_SCORED_PER_DAY;
  db.prepare("UPDATE players SET arcade_day = ?, arcade_scored = ? WHERE id = ?").run(today, used + (scored ? 1 : 0), pid);
  return scored ? 1 : 0;
}

function createMatch(db, { game: gameId, seats, mode, vatarId = null, nonce = null }, now) {
  const game = GAMES[gameId];
  const state = { rng: crypto.randomInt(0, 2 ** 32 - 1) };
  game.init(state);
  const scoredSeats = seats.map((s) => (s.kind === "human" ? takeAllowance(db, s.pid, now) : 0));
  const m = { id: randomId(9), game: gameId, seats, state, status: "playing", scored: scoredSeats[0], scoredSeats, result: null, mode, turn_at: now };
  db.prepare(
    `INSERT INTO arcade_matches (id, game, seats, state, status, scored, created_at, updated_at, mode, vatar_id, nonce, scored_seats, turn_at)
     VALUES (?, ?, ?, ?, 'playing', ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(m.id, gameId, JSON.stringify(seats), JSON.stringify(state), m.scored, now, now, mode, vatarId, nonce, JSON.stringify(scoredSeats), now);
  seats.forEach((s, i) => s.kind === "human" && db.prepare("INSERT INTO arcade_seats (match_id, player_id, seat) VALUES (?, ?, ?)").run(m.id, s.pid, i));
  return m;
}

export function startMatch(db, pid, gameId, now) {
  if (!GAMES[gameId]) throw new GameError(404, "no_game", "No such game");
  const today = lagosDay(now);
  return tx(db, () => {
    const p = getPlayer(db, pid);
    const live = db.prepare(
      `SELECT m.id, m.updated_at FROM arcade_matches m JOIN arcade_seats s ON s.match_id = m.id
       WHERE s.player_id = ? AND m.game = ? AND m.status = 'playing' AND m.mode = 'cpu' ORDER BY m.created_at DESC LIMIT 1`,
    ).get(pid, gameId);
    if (live && now - live.updated_at < STALE_MS) {
      const m = load(db, live.id);
      return { match: matchView(m, seatOf(m, pid), now), player: publicPlayer(db, getPlayer(db, pid), today), events: [] };
    }
    if (live) db.prepare("UPDATE arcade_matches SET status = 'abandoned', updated_at = ? WHERE id = ?").run(now, live.id);
    const m = createMatch(db, { game: gameId, seats: [{ kind: "human", pid, name: p.name }, { kind: "cpu" }], mode: "cpu" }, now);
    const events = [];
    runCpu(m, now, events); // in case the computer moves first
    settle(db, m, now);
    save(db, m, now);
    return { match: matchView(m, 0, now), player: publicPlayer(db, getPlayer(db, pid), today), events: personal(GAMES[gameId], events, 0) };
  });
}

export function moveMatch(db, pid, matchId, move, now) {
  const today = lagosDay(now);
  return tx(db, () => {
    const m = load(db, matchId);
    const seat = seatOf(m, pid);
    if (seat < 0) throw new GameError(403, "not_your_match", "You're not in this game");
    if (m.status !== "playing") throw new GameError(409, "match_over", "This game is over");
    const game = GAMES[m.game];
    if (!game.toMove(m.state).includes(seat)) throw new GameError(409, "not_your_turn", "It's not your turn");
    if (!move || typeof move !== "object") throw new GameError(400, "bad_move", "Missing move");
    const before = game.toMove(m.state).join();
    const events = [];
    applyMove(game, m.state, seat, move, { now, cpu: false }, humanSeats(m), events);
    runCpu(m, now, events);
    settle(db, m, now);
    if (game.toMove(m.state).join() !== before) m.turn_at = now;
    logEvents(db, m, events);
    save(db, m, now);
    return { events: personal(game, events, seat), match: matchView(m, seat, now), player: publicPlayer(db, getPlayer(db, pid), today) };
  });
}

/** The match as this person sees it, plus (for friend games) the moves since `since`. */
export function getMatch(db, pid, matchId, since, now) {
  const m = load(db, matchId);
  const seat = seatOf(m, pid);
  if (seat < 0) throw new GameError(403, "not_your_match", "You're not in this game");
  m.seq = lastSeq(db, m.id);
  const after = Number.isInteger(since) ? since : m.seq;
  const rows = db.prepare("SELECT seq, data FROM arcade_events WHERE match_id = ? AND seat = ? AND seq > ? ORDER BY seq").all(m.id, seat, after);
  return { match: matchView(m, seat, now), events: rows.flatMap((r) => parse(r.data)), seq: m.seq };
}

function endEarly(db, m, winner, extra, now) {
  m.status = "done";
  m.result = { winner, score: null, ...extra, points: isMulti(m) ? award(db, m, winner, now) : [0, 0] };
  m.turn_at = now;
  logEvents(db, m, [{ type: "ended", ...extra, winner }]);
  save(db, m, now);
}

export function forfeitMatch(db, pid, matchId, now) {
  return tx(db, () => {
    const m = load(db, matchId);
    const seat = seatOf(m, pid);
    if (seat < 0) throw new GameError(403, "not_your_match", "You're not in this game");
    if (m.status === "playing") endEarly(db, m, 1 - seat, { forfeit: seat }, now);
    return { match: matchView(m, seat, now) };
  });
}

/** In a friend game: they've gone quiet on their turn for too long, so you win. */
export function claimMatch(db, pid, matchId, now) {
  return tx(db, () => {
    const m = load(db, matchId);
    const seat = seatOf(m, pid);
    if (seat < 0) throw new GameError(403, "not_your_match", "You're not in this game");
    const v = matchView(m, seat, now);
    if (!v.canClaim) throw new GameError(409, "too_soon", "Give them a bit longer");
    endEarly(db, m, seat, { timeout: 1 - seat }, now);
    return { match: matchView(m, seat, now) };
  });
}

export function liveMatches(db, pid, now) {
  const rows = db.prepare(
    `SELECT m.id, m.game FROM arcade_matches m JOIN arcade_seats s ON s.match_id = m.id
     WHERE s.player_id = ? AND m.status = 'playing' AND m.mode = 'cpu' AND m.updated_at > ?`,
  ).all(pid, now - STALE_MS);
  return Object.fromEntries(rows.map((r) => [r.game, r.id]));
}

/** Friend games still running for this player (so the app can offer to go back to them). */
/** Friend games still going, newest first, with who they're against and whose move it is (for the chat bubbles). */
export function liveFriendMatches(db, pid, now) {
  const rows = db.prepare(
    `SELECT m.id FROM arcade_matches m JOIN arcade_seats s ON s.match_id = m.id
     WHERE s.player_id = ? AND m.status = 'playing' AND m.mode <> 'cpu' AND m.updated_at > ?
     ORDER BY m.updated_at DESC LIMIT 10`,
  ).all(pid, now - STALE_MS);
  return rows.map(({ id }) => {
    const m = load(db, id);
    const seat = seatOf(m, pid);
    const them = m.seats[1 - seat];
    return {
      id: m.id,
      game: m.game,
      them: them?.name || "Player",
      yourMove: GAMES[m.game].toMove(m.state).includes(seat),
      at: m.updated_at,
    };
  });
}

// ---------- pairing friend games ----------

const playerName = (db, pid) => db.prepare("SELECT name FROM players WHERE id = ?").get(pid)?.name || "Player";

/** Lagos Life match → our lobby: the creator tells us which game the match is for. */
export function registerLobby(db, pid, key, gameId, now) {
  if (!GAMES[gameId]) throw new GameError(404, "no_game", "No such game");
  db.prepare("INSERT INTO lobbies (key, game, creator, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO NOTHING").run(key, gameId, pid, now);
  return db.prepare("SELECT * FROM lobbies WHERE key = ?").get(key);
}

/** Both players are in: make (or fetch) the arcade match for this pairing. */
export function pairMatch(db, { key, players, mode, vatarId = null, nonce = null }, pid, now) {
  return tx(db, () => {
    const lobby = db.prepare("SELECT * FROM lobbies WHERE key = ?").get(key);
    if (!lobby) throw new GameError(409, "lobby_pending", "Setting up the game, one moment");
    if (lobby.match_id) {
      const m = load(db, lobby.match_id);
      return { match: matchView(m, seatOf(m, pid), now) };
    }
    const seats = players.map((p) => ({ kind: "human", pid: p, name: playerName(db, p) }));
    const m = createMatch(db, { game: lobby.game, seats, mode, vatarId, nonce }, now);
    save(db, m, now);
    db.prepare("UPDATE lobbies SET status = 'paired', match_id = ? WHERE key = ?").run(m.id, key);
    return { match: matchView(m, seatOf(m, pid), now) };
  });
}

// Local development pairing (no Lagos Life): six-letter codes.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
export function devLobby(db, pid, gameId, now) {
  if (!GAMES[gameId]) throw new GameError(404, "no_game", "No such game");
  let code;
  do code = Array.from({ length: 6 }, () => CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]).join("");
  while (db.prepare("SELECT 1 FROM lobbies WHERE key = ?").get("d:" + code));
  registerLobby(db, pid, "d:" + code, gameId, now);
  return { code, game: gameId, status: "open" };
}
export function devLobbyStatus(db, pid, code) {
  const l = db.prepare("SELECT * FROM lobbies WHERE key = ?").get("d:" + String(code || "").toUpperCase());
  if (!l) throw new GameError(404, "not_found", "No game with that code");
  return { code: String(code).toUpperCase(), game: l.game, status: l.status, matchId: l.match_id };
}
export function devJoin(db, pid, code, now) {
  const key = "d:" + String(code || "").toUpperCase();
  const l = db.prepare("SELECT * FROM lobbies WHERE key = ?").get(key);
  if (!l || l.status === "closed" || now - l.created_at > LOBBY_MS) throw new GameError(404, "not_found", "No open game with that code");
  if (l.creator === pid) throw new GameError(409, "own_game", "That's your own code: share it with a friend");
  if (l.match_id) throw new GameError(409, "not_open", "That game has already started");
  return pairMatch(db, { key, players: [l.creator, pid], mode: "dev" }, pid, now);
}
export function devQuick(db, pid, gameId, now) {
  const open = db.prepare("SELECT key FROM lobbies WHERE key LIKE 'd:%' AND status = 'open' AND creator <> ? AND created_at > ? ORDER BY created_at LIMIT 1").get(pid, now - LOBBY_MS);
  if (open) return devJoin(db, pid, open.key.slice(2), now);
  return devLobby(db, pid, gameId, now);
}
export function closeLobby(db, pid, key) {
  db.prepare("UPDATE lobbies SET status = 'closed' WHERE key = ? AND creator = ? AND match_id IS NULL").run(key, pid);
}

/** Friend games that have finished but haven't been reported to Lagos Life yet. */
export function unreported(db, matchId) {
  const m = db.prepare("SELECT * FROM arcade_matches WHERE id = ? AND status = 'done' AND reported = 0 AND vatar_id IS NOT NULL").get(matchId);
  if (!m) return null;
  const seats = parse(m.seats);
  const result = parse(m.result);
  return { id: m.id, mode: m.mode, vatarId: m.vatar_id, nonce: m.nonce, winner: result.winner === null ? "draw" : seats[result.winner].pid };
}
export const markReported = (db, id) => db.prepare("UPDATE arcade_matches SET reported = 1 WHERE id = ?").run(id);
