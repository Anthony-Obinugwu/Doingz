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

export const GAMES = Object.fromEntries(
  [darts, archery, basketball, pong, golf, shuffle, knockout, tanks, paintball,
    four, draughts, chess, reversi, gomoku, ayo, dots, seabattle, filler, crazy8].map((g) => [g.id, g]),
);

export const ARCADE_SCORED_PER_DAY = 10;
export const WIN_POINTS = 25;
export const DRAW_POINTS = 10;
const STALE_MS = 2 * 60 * 60 * 1000;
const MAX_CPU_STEPS = 200;

const parse = (s) => JSON.parse(s);

export function listGames() {
  return Object.values(GAMES).map((g) => ({ id: g.id, title: g.title, blurb: g.blurb, how: g.how, kind: g.snapshots ? "board" : "skill" }));
}

function load(db, id) {
  const m = db.prepare("SELECT * FROM arcade_matches WHERE id = ?").get(String(id || ""));
  if (!m) throw new GameError(404, "no_match", "That game isn't running");
  return { ...m, seats: parse(m.seats), state: parse(m.state), result: m.result ? parse(m.result) : null };
}

function save(db, m, now) {
  db.prepare("UPDATE arcade_matches SET state = ?, status = ?, result = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(m.state), m.status, m.result ? JSON.stringify(m.result) : null, now, m.id);
}

const seatOf = (m, pid) => m.seats.findIndex((s) => s.kind === "human" && s.pid === pid);

function matchView(m, seat) {
  const game = GAMES[m.game];
  const names = m.seats.map((s, i) => (s.kind === "cpu" ? "Computer" : i === seat ? "You" : s.name || "Player"));
  return {
    id: m.id,
    game: m.game,
    seat,
    names,
    status: m.status,
    scored: !!m.scored,
    toMove: m.status === "playing" ? game.toMove(m.state) : [],
    view: game.view ? game.view(m.state, seat) : m.state.g,
    result: m.result,
  };
}

/** Points for the people in a finished match, if it was a scored one. */
function settle(db, m, now) {
  const game = GAMES[m.game];
  const r = game.result(m.state);
  if (!r) return;
  m.status = "done";
  const points = m.seats.map((s, i) => (r.winner === null ? DRAW_POINTS : r.winner === i ? WIN_POINTS : 0));
  m.result = { ...r, points: m.scored ? points : [0, 0] };
  if (m.scored) {
    m.seats.forEach((s, i) => {
      if (s.kind === "human" && points[i]) db.prepare("UPDATE players SET points = points + ?, updated_at = ? WHERE id = ?").run(points[i], now, s.pid);
    });
  }
}

/**
 * Applies one move. Turn-based games (game.snapshots) also attach what `viewer` may see right after
 * it, so the phone can step through the computer's moves without learning hidden cards or ships.
 */
function applyMove(game, st, seat, move, ctx, viewer, events) {
  const evs = game.apply(st, seat, move, ctx);
  if (game.snapshots && evs.length) {
    evs[evs.length - 1].snap = JSON.parse(JSON.stringify(game.view ? game.view(st, viewer) : st.g));
  }
  events.push(...evs);
}

/** Runs computer seats until a person has to move or the match ends. */
function runCpu(db, m, now, events, viewer = 0) {
  const game = GAMES[m.game];
  for (let step = 0; step < MAX_CPU_STEPS && !game.result(m.state); step++) {
    const cpuSeats = game.toMove(m.state).filter((s) => m.seats[s].kind === "cpu");
    if (!cpuSeats.length) break;
    for (const s of cpuSeats) {
      const move = game.cpu(m.state, s, Math.random);
      applyMove(game, m.state, s, move, { now, cpu: true }, viewer, events);
    }
  }
}

export function startMatch(db, pid, gameId, now) {
  const game = GAMES[gameId];
  if (!game) throw new GameError(404, "no_game", "No such game");
  const today = lagosDay(now);
  return tx(db, () => {
    const p = getPlayer(db, pid);
    const live = db.prepare(
      `SELECT m.id, m.updated_at FROM arcade_matches m JOIN arcade_seats s ON s.match_id = m.id
       WHERE s.player_id = ? AND m.game = ? AND m.status = 'playing' ORDER BY m.created_at DESC LIMIT 1`,
    ).get(pid, gameId);
    if (live && now - live.updated_at < STALE_MS) {
      const m = load(db, live.id);
      return { match: matchView(m, seatOf(m, pid)), player: publicPlayer(db, getPlayer(db, pid), today), events: [] };
    }
    if (live) db.prepare("UPDATE arcade_matches SET status = 'abandoned', updated_at = ? WHERE id = ?").run(now, live.id);

    const usedToday = p.arcade_day === today ? p.arcade_scored : 0;
    const scored = usedToday < ARCADE_SCORED_PER_DAY;
    db.prepare("UPDATE players SET arcade_day = ?, arcade_scored = ? WHERE id = ?").run(today, usedToday + (scored ? 1 : 0), pid);

    const seats = [{ kind: "human", pid, name: p.name }, { kind: "cpu" }];
    const state = { rng: crypto.randomInt(0, 2 ** 32 - 1) };
    game.init(state);
    const m = { id: randomId(9), game: gameId, seats, state, status: "playing", scored: scored ? 1 : 0, result: null };
    db.prepare(
      "INSERT INTO arcade_matches (id, game, seats, state, status, scored, created_at, updated_at) VALUES (?, ?, ?, ?, 'playing', ?, ?, ?)",
    ).run(m.id, gameId, JSON.stringify(seats), JSON.stringify(state), m.scored, now, now);
    seats.forEach((s, i) => s.kind === "human" && db.prepare("INSERT INTO arcade_seats (match_id, player_id, seat) VALUES (?, ?, ?)").run(m.id, s.pid, i));
    const events = [];
    runCpu(db, m, now, events); // in case the computer moves first
    settle(db, m, now);
    save(db, m, now);
    return { match: matchView(m, 0), player: publicPlayer(db, getPlayer(db, pid), today), events };
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
    const events = [];
    applyMove(game, m.state, seat, move, { now, cpu: false }, seat, events);
    runCpu(db, m, now, events, seat);
    settle(db, m, now);
    save(db, m, now);
    return { events, match: matchView(m, seat), player: publicPlayer(db, getPlayer(db, pid), today) };
  });
}

export function getMatch(db, pid, matchId) {
  const m = load(db, matchId);
  const seat = seatOf(m, pid);
  if (seat < 0) throw new GameError(403, "not_your_match", "You're not in this game");
  return { match: matchView(m, seat) };
}

export function forfeitMatch(db, pid, matchId, now) {
  return tx(db, () => {
    const m = load(db, matchId);
    const seat = seatOf(m, pid);
    if (seat < 0) throw new GameError(403, "not_your_match", "You're not in this game");
    if (m.status === "playing") {
      m.status = "done";
      m.result = { winner: 1 - seat, score: null, points: [0, 0], forfeit: seat };
      save(db, m, now);
    }
    return { match: matchView(m, seat) };
  });
}

export function liveMatches(db, pid, now) {
  const rows = db.prepare(
    `SELECT m.id, m.game FROM arcade_matches m JOIN arcade_seats s ON s.match_id = m.id
     WHERE s.player_id = ? AND m.status = 'playing' AND m.updated_at > ?`,
  ).all(pid, now - STALE_MS);
  return Object.fromEntries(rows.map((r) => [r.game, r.id]));
}
