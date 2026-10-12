// Arcade tests: every game plays to the end, the API keeps turns and points honest,
// and every physics result can be replayed exactly from its inputs (what the phones do).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { GAMES, ARCADE_SCORED_PER_DAY, WIN_POINTS } from "../server/arcade.js";
import { THINGS } from "../public/shared/twenty-kb.js";
import * as basketball from "../public/shared/basketball.js";
import * as golf from "../public/shared/golf.js";
import * as shuffle from "../public/shared/shuffle.js";
import * as knockout from "../public/shared/knockout.js";
import * as tanks from "../public/shared/tanks.js";

let clock = Date.parse("2026-10-12T10:00:00+01:00");
let server, base;
const config = {
  production: false, appSecret: "test-secret", devAuth: true, launchDate: "2026-10-11",
  frameAncestors: "https://lagoslife.app", webhookSecrets: { test: "", live: "" }, secrets: { test: "", live: "" },
};

before(async () => {
  const db = openDb(":memory:");
  server = http.createServer(createApp({ config, db, vatar: {}, now: () => clock, log: { warn() {}, error() {} } }));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(path, body, token) {
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
const devPlayer = async (id) => (await call("/api/dev-auth", { id, name: id })).data.token;

// Plays our seat with the computer's own strategy, through the real API.
async function playOut(token, gameId) {
  let { match } = (await call("/api/arcade/start", { game: gameId }, token)).data;
  const game = GAMES[gameId];
  const events = [];
  for (let k = 0; k < 400 && match.status === "playing"; k++) {
    const viewOnly = ["seabattle", "crazy8", "wordhunt", "anagrams", "twenty"].includes(gameId);
    let move = viewOnly ? null : game.cpu({ g: match.view }, match.seat, Math.random);
    if (gameId === "seabattle") move = { i: match.view.myShots.findIndex((v) => !v) };
    if (gameId === "crazy8") {
      const v = match.view;
      const ok = v.hand.find((c) => c % 13 === 7 || Math.floor(c / 13) === v.suit || c % 13 === v.top % 13);
      move = ok !== undefined ? { card: ok, suit: 0 } : v.drawsThisTurn < 3 && v.deck > 0 ? { draw: true } : { pass: true };
    }
    if (gameId === "wordhunt" || gameId === "anagrams") {
      if (!match.view.board) move = { start: true };
      else { clock += 81_000; move = { words: ["zzz", "the", "and", "tea"] }; }
    }
    if (gameId === "twenty") {
      const v = match.view;
      const order = THINGS.map((t) => t.id);
      if (v.phase === "pick") move = { pick: "suya" };
      else if (v.pending) move = { answer: "y" };
      else move = { guess: order.find((id) => !v.log[v.round].some((e) => e.kind === "guess" && e.id === id)) };
    }
    if (gameId === "paintball") {
      if (!match.view.live) move = { start: true };
      else {
        clock += 31_000; // the round has to last its 30 seconds
        move = { hits: match.view.live.pops.filter((p) => !p.friend).slice(0, 8).map((p) => ({ id: p.id, t: p.t + 200 })) };
      }
    }
    clock += 600; // people take time over moves (and the API allows 120 requests a minute)
    const r = await call("/api/arcade/move", { matchId: match.id, move }, token);
    assert.equal(r.status, 200, `${gameId}: ${JSON.stringify(r.data)}`);
    events.push(...r.data.events);
    match = r.data.match;
  }
  return { match, events };
}

test("every arcade game plays to a finish through the API", async () => {
  const token = await devPlayer("allgames");
  for (const id of Object.keys(GAMES)) {
    const { match } = await playOut(token, id);
    assert.equal(match.status, "done", `${id} didn't finish`);
    assert.ok(match.result && "winner" in match.result, `${id} has no result`);
  }
});

test("physics results replay exactly from their inputs", async () => {
  const token = await devPlayer("replay");
  const check = {
    basketball: (e) => assert.equal(basketball.simulate(e.spot, e.vx, e.vy).scored, e.scored),
    golf: (e) => {
      const r = golf.simulate(e.hole, e.from[0], e.from[1], e.vx, e.vy);
      assert.deepEqual([r.x, r.y, r.holed, r.splash], [e.x, e.y, e.holed, e.splash]);
    },
    shuffle: (e) => {
      const pucks = e.before.map((p) => ({ ...p }));
      pucks.push({ seat: e.seat, x: shuffle.START[0], y: shuffle.START[1], vx: e.vx, vy: e.vy, r: shuffle.PUCK_R, alive: true });
      shuffle.simulate(pucks);
      assert.deepEqual(pucks.map((p) => [p.x, p.y, p.alive]), e.after.map((p) => [p.x, p.y, p.alive]));
    },
    knockout: (e) => {
      if (e.type !== "round") return;
      const pieces = e.before.map((p) => ({ ...p }));
      for (const list of e.shots) for (const s of list) { pieces[s.i].vx = s.vx; pieces[s.i].vy = s.vy; }
      knockout.simulate(pieces, e.halfBefore);
      assert.deepEqual(pieces.map((p) => [p.x, p.y]), e.afterSlide.map((p) => [p.x, p.y]));
    },
    tanks: (e) => {
      const hit = tanks.simulate(e.before.h.slice(), e.before.tanks.map((t) => ({ ...t })), e.seat, e.vx, e.vy, e.wind);
      assert.deepEqual(hit, e.hit);
    },
  };
  let replayed = 0;
  for (const id of Object.keys(check)) {
    const { events } = await playOut(token, id);
    for (const e of events) if (e.seat !== undefined || e.type === "round") { check[id](e); replayed++; }
  }
  assert.ok(replayed > 50, `only ${replayed} events replayed`);
});

test("a win pays points, the daily cap stops scoring, and turns are enforced", async () => {
  const token = await devPlayer("rules");
  const me0 = (await call("/api/me", undefined, token)).data.player.points;
  // Forfeit games until the scored allowance is used up.
  const scored = [];
  for (let i = 0; i < ARCADE_SCORED_PER_DAY + 1; i++) {
    const { match } = (await call("/api/arcade/start", { game: "darts" }, token)).data;
    scored.push(match.scored);
    const f = await call("/api/arcade/forfeit", { matchId: match.id }, token);
    assert.equal(f.data.match.status, "done");
    assert.equal((await call("/api/arcade/move", { matchId: match.id, move: { x: 0, y: 0 } }, token)).status, 409);
  }
  assert.equal(scored.filter(Boolean).length, ARCADE_SCORED_PER_DAY);
  assert.equal(scored.at(-1), false);
  assert.equal((await call("/api/me", undefined, token)).data.player.points, me0, "forfeits pay nothing");

  // Next day: a fresh allowance, and a win pays WIN_POINTS.
  clock += 86_400_000;
  const t2 = await devPlayer("rules");
  for (let tries = 0; tries < 30; tries++) {
    const before = (await call("/api/me", undefined, t2)).data.player.points;
    const { match } = await playOut(t2, "archery");
    const after = (await call("/api/me", undefined, t2)).data.player.points;
    if (match.result.winner === match.seat) { assert.equal(after - before, match.scored ? WIN_POINTS : 0); break; }
  }
});

test("you can't move in someone else's game", async () => {
  const a = await devPlayer("alice");
  const b = await devPlayer("bola");
  const { match } = (await call("/api/arcade/start", { game: "tanks" }, a)).data;
  const r = await call("/api/arcade/move", { matchId: match.id, move: { vx: 100, vy: -200 } }, b);
  assert.equal(r.status, 403);
  const bad = await call("/api/arcade/move", { matchId: match.id, move: { vx: "lots", vy: -200 } }, a);
  assert.equal(bad.status, 400);
});

test("paintball refuses hits on targets that weren't up, and rounds that end early", async () => {
  const t = await devPlayer("painter");
  let { match } = (await call("/api/arcade/start", { game: "paintball" }, t)).data;
  match = (await call("/api/arcade/move", { matchId: match.id, move: { start: true } }, t)).data.match;
  const pops = match.view.live.pops;
  const early = await call("/api/arcade/move", { matchId: match.id, move: { hits: [] } }, t);
  assert.equal(early.status, 409);
  clock += 31_000;
  const fake = pops.filter((p) => !p.friend).map((p) => ({ id: p.id, t: p.t + p.dur + 2000 })); // all too late
  const r = await call("/api/arcade/move", { matchId: match.id, move: { hits: fake } }, t);
  const mine = r.data.events.find((e) => e.type === "round_end" && e.seat === match.seat);
  assert.equal(mine.score, 0);
});

test("hidden information stays hidden: no computer ships or cards reach the phone", async () => {
  const token = await devPlayer("spy");
  // Sea Battle: the computer's fleet isn't in the view until sunk.
  let { match } = (await call("/api/arcade/start", { game: "seabattle" }, token)).data;
  assert.equal(match.view.theirs.length, 0);
  assert.equal(JSON.stringify(match).includes("fleets"), false);
  const r = await call("/api/arcade/move", { matchId: match.id, move: { i: 0 } }, token);
  assert.equal(JSON.stringify(r.data).includes("fleets"), false);
  // Crazy 8: we see our hand and their count, never their cards or the deck order.
  ({ match } = (await call("/api/arcade/start", { game: "crazy8" }, token)).data);
  assert.equal(typeof match.view.theirs, "number");
  assert.equal("hands" in match.view || "deck" in match.view && Array.isArray(match.view.deck), false);
  const d = await call("/api/arcade/move", { matchId: match.id, move: { draw: true } }, token);
  const text = JSON.stringify(d.data);
  assert.equal(text.includes('"hands"'), false);
  for (const e of d.data.events) if (e.seat !== match.seat && e.type === "draw") assert.equal(e.card, null);
});
