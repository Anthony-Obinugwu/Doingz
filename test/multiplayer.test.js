// Friend games: two real players through the API, in dev pairing and through a fake Lagos Life.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { makeVatar } from "../server/vatar.js";
import { IDLE_CLAIM_MS, WIN_POINTS } from "../server/arcade.js";

let clock = Date.parse("2026-10-12T12:00:00+01:00");
const RESULTS_SECRET = "vtr_results_test_abc";
const API = "https://lagoslife.app/api/games/v1";

// ---- a fake Lagos Life behind the real Vatar client ----
const vMatches = {};
const posted = [];
async function fakeFetch(url, init) {
  const u = new URL(url);
  const path = u.pathname.replace("/api/games/v1", "");
  const body = init.body ? JSON.parse(init.body) : null;
  const json = (status, data) => ({ ok: status < 300, status, json: async () => data });
  if (path === "/session/verify") {
    const who = { "s-ada": "t_ada", "s-bayo": "t_bayo", "s-chi": "t_chi" }[body.session];
    return who ? json(200, { playerId: who, name: who.slice(2), mode: "test", exp: clock + 9e5 }) : json(401, { error: "invalid_token" });
  }
  let m = path.match(/^\/matches\/([^/]+)$/);
  if (m) return vMatches[m[1]] ? json(200, vMatches[m[1]]) : json(404, { error: "not_found" });
  m = path.match(/^\/matches\/([^/]+)\/result$/);
  if (m) {
    const vm = vMatches[m[1]];
    // Check the signature exactly as the Vatar docs describe it.
    const ts = init.headers["X-Vatar-Timestamp"];
    const sha = crypto.createHash("sha256").update(init.body).digest("hex");
    const want = "v1=" + crypto.createHmac("sha256", RESULTS_SECRET).update(["POST", u.pathname, ts, vm.nonce, sha].join("\n")).digest("hex");
    if (init.headers["X-Vatar-Signature"] !== want) return json(401, { error: "bad_signature" });
    if (vm.status === "done") return json(409, { error: "already_settled" });
    vm.status = "done";
    vm.winner = body.winner;
    posted.push({ id: m[1], winner: body.winner });
    return json(200, vm);
  }
  return json(404, { error: "not_found" });
}

let server, base;
before(async () => {
  const db = openDb(":memory:");
  const config = {
    production: false, appSecret: "test-secret", devAuth: true, launchDate: "2026-10-11",
    frameAncestors: "https://lagoslife.app", webhookSecrets: { test: "", live: "" }, secrets: { test: "vtr_test_x", live: "" },
  };
  const vatar = makeVatar({ api: API, secrets: config.secrets, resultsSecrets: { test: RESULTS_SECRET }, fetchImpl: fakeFetch });
  server = http.createServer(createApp({ config, db, vatar, now: () => clock, log: { warn() {}, error() {} } }));
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(path, body, token) {
  clock += 500;
  const r = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
const dev = async (id) => (await call("/api/dev-auth", { id, name: id })).data.token;
const lagos = async (session) => (await call("/api/auth", { session, mode: "test" })).data.token;

test("dev pairing: a code joins two players into one game, and turns alternate", async () => {
  const ada = await dev("ada"), bayo = await dev("bayo");
  const { code } = (await call("/api/arcade/dev-lobby", { game: "four" }, ada)).data;
  assert.match(code, /^[A-Z]{6}$/);
  assert.equal((await call("/api/arcade/dev-join", { code }, ada)).status, 409, "can't join your own code");
  const joined = await call("/api/arcade/dev-join", { code }, bayo);
  assert.equal(joined.status, 200);
  const m = joined.data.match;
  assert.equal(m.multi, true);
  assert.equal(m.seat, 1);
  assert.deepEqual(m.names, ["ada", "You"]);
  const status = await call(`/api/arcade/dev-lobby?code=${code}`, undefined, ada);
  assert.equal(status.data.matchId, m.id);

  // Bayo can't move first; Ada can.
  assert.equal((await call("/api/arcade/move", { matchId: m.id, move: { col: 0 } }, bayo)).status, 409);
  let seqBayo = (await call(`/api/arcade/match?id=${m.id}`, undefined, bayo)).data.seq;
  // Ada builds a vertical four, Bayo plays next to it.
  for (let k = 0; k < 4; k++) {
    const a = await call("/api/arcade/move", { matchId: m.id, move: { col: 0 } }, ada);
    assert.equal(a.status, 200);
    const poll = await call(`/api/arcade/match?id=${m.id}&since=${seqBayo}`, undefined, bayo);
    assert.equal(poll.data.events.length, 1, "Bayo sees Ada's move");
    assert.ok(poll.data.events[0].snap, "with Bayo's own snapshot");
    seqBayo = poll.data.seq;
    if (k < 3) {
      const b = await call("/api/arcade/move", { matchId: m.id, move: { col: 1 } }, bayo);
      assert.equal(b.status, 200);
      seqBayo = b.data.match.seq; // our own moves come back in the reply, so poll from here
    }
  }
  const end = await call(`/api/arcade/match?id=${m.id}`, undefined, bayo);
  assert.equal(end.data.match.status, "done");
  assert.equal(end.data.match.result.winner, 0);
  assert.equal(end.data.match.result.points[0], WIN_POINTS);
});

test("crazy 8: the other player sees that you drew, not what you drew", async () => {
  const ada = await dev("ada2"), bayo = await dev("bayo2");
  const { code } = (await call("/api/arcade/dev-lobby", { game: "crazy8" }, ada)).data;
  const m = (await call("/api/arcade/dev-join", { code }, bayo)).data.match;
  const seq = (await call(`/api/arcade/match?id=${m.id}`, undefined, bayo)).data.seq;
  const mine = await call("/api/arcade/move", { matchId: m.id, move: { draw: true } }, ada);
  assert.equal(typeof mine.data.events[0].card, "number", "Ada sees her card");
  const theirs = await call(`/api/arcade/match?id=${m.id}&since=${seq}`, undefined, bayo);
  assert.equal(theirs.data.events[0].card, null, "Bayo doesn't");
  assert.equal(JSON.stringify(theirs.data).includes('"hands"'), false);
});

test("a friend who goes quiet can be beaten by timeout, but not too early", async () => {
  const ada = await dev("ada3"), bayo = await dev("bayo3");
  const { code } = (await call("/api/arcade/dev-lobby", { game: "dots" }, ada)).data;
  const m = (await call("/api/arcade/dev-join", { code }, bayo)).data.match;
  assert.equal((await call("/api/arcade/claim", { matchId: m.id }, bayo)).status, 409, "too soon");
  assert.equal((await call("/api/arcade/claim", { matchId: m.id }, ada)).status, 409, "it's your own turn");
  clock += IDLE_CLAIM_MS + 1000;
  const c = await call("/api/arcade/claim", { matchId: m.id }, bayo);
  assert.equal(c.status, 200);
  assert.equal(c.data.match.result.winner, 1);
  assert.equal(c.data.match.result.timeout, 0);
});

test("dev quick match pairs two people looking for a game", async () => {
  const ada = await dev("ada4"), bayo = await dev("bayo4");
  const first = await call("/api/arcade/dev-quick", { game: "reversi" }, ada);
  assert.ok(first.data.code, "the first person waits with a code");
  const second = await call("/api/arcade/dev-quick", { game: "chess" }, bayo);
  assert.equal(second.data.match.game, "reversi", "the second plays whatever the first picked");
});

test("Lagos Life friend game: lobby, pairing, and a signed result when it ends", async () => {
  const ada = await lagos("s-ada"), chi = await lagos("s-chi");
  vMatches.vm1 = { id: "vm1", code: "QWERTY", status: "open", stake: 0, seats: 2, nonce: "n0nce-123", players: [{ playerId: "t_ada", name: "ada" }] };
  const lobby = await call("/api/arcade/lobby", { vatarMatchId: "vm1", game: "four" }, ada);
  assert.equal(lobby.status, 200);
  assert.equal((await call("/api/arcade/pair", { vatarMatchId: "vm1" }, ada)).status, 409, "not started yet");
  // Chi joins on Lagos Life: the match starts.
  vMatches.vm1.players.push({ playerId: "t_chi", name: "chi" });
  vMatches.vm1.status = "playing";
  const a = await call("/api/arcade/pair", { vatarMatchId: "vm1" }, ada);
  const c = await call("/api/arcade/pair", { vatarMatchId: "vm1" }, chi);
  assert.equal(a.data.match.id, c.data.match.id, "both phones land in the same game");
  assert.equal(c.data.match.seat, 1);
  const outsider = await lagos("s-bayo");
  assert.equal((await call("/api/arcade/pair", { vatarMatchId: "vm1" }, outsider)).status, 403);

  // Chi resigns; Ada wins; the result goes to Lagos Life signed with the results secret.
  const f = await call("/api/arcade/forfeit", { matchId: c.data.match.id }, chi);
  assert.equal(f.data.match.result.winner, 0);
  assert.deepEqual(posted.at(-1), { id: "vm1", winner: "t_ada" });
  // A second report is harmless.
  await call(`/api/arcade/match?id=${c.data.match.id}`, undefined, ada);
  assert.equal(posted.filter((p) => p.id === "vm1").length, 1);
});
