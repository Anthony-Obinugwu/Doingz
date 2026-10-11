// npm test — runs the whole server against a fake Vatar API, no network needed.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { openDb } from "../server/db.js";
import { createApp } from "../server/app.js";
import { VatarError } from "../server/vatar.js";
import { mark, wordPoints, answerFor, dayFromDate, lagosDay, answerPoints, TIME_LIMIT_MS } from "../server/game.js";

const LAUNCH = "2026-10-11";
const launchDay = dayFromDate(LAUNCH);
let clock = Date.parse("2026-10-11T10:00:00+01:00");
const WHSEC = "vtr_whsec_test_abc";

// ---- a fake Vatar: sessions and purchases we control ----
const sessions = { "sess-tolu": { playerId: "t_tolu", name: "Tolu", mode: "test" }, "sess-ada": { playerId: "t_ada", name: "Ada", mode: "test" } };
const purchases = {};
const delivered = [];
const fakeVatar = {
  async verifySession(mode, session) {
    const s = sessions[session];
    if (!s) throw new VatarError(401, "invalid_token");
    if (s.mode !== mode) throw new VatarError(403, "wrong_mode");
    return { ...s, gameId: "g1", exp: clock + 900_000 };
  },
  async getPurchase(mode, id) {
    const p = purchases[id];
    if (!p) throw new VatarError(404, "not_found");
    return p;
  },
  async deliver(mode, id) {
    delivered.push(id);
    purchases[id].status = "delivered";
    return { id, status: "delivered" };
  },
};

let server, base;
const config = {
  production: false, appSecret: "test-secret", devAuth: true, launchDate: LAUNCH,
  frameAncestors: "https://lagoslife.app", webhookSecrets: { test: WHSEC, live: "" }, secrets: { test: "x", live: "" },
};

before(async () => {
  const db = openDb(":memory:");
  const handle = createApp({ config, db, vatar: fakeVatar, now: () => clock, log: { warn() {}, error() {} } });
  server = http.createServer(handle);
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

async function call(path, { body, token, headers = {}, raw } = {}) {
  const r = await fetch(base + path, {
    method: body !== undefined || raw !== undefined ? "POST" : "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  return { status: r.status, headers: r.headers, data: await r.json().catch(() => null) };
}
const signIn = async (session) => (await call("/api/auth", { body: { session, mode: "test" } })).data;

// ---- pure rules ----

test("marks handle repeated letters like Wordle", () => {
  assert.deepEqual(mark("AKARA", "AMALA"), ["hit", "miss", "hit", "miss", "hit"]);
  assert.deepEqual(mark("LLAMA", "AMALA"), ["near", "miss", "hit", "near", "hit"]);
  assert.deepEqual(mark("EEEEE", "GOMBE"), ["miss", "miss", "miss", "miss", "hit"]);
});

test("word points reward fewer guesses, hints cost, streak adds", () => {
  assert.equal(wordPoints(1, 0, 0), 100);
  assert.equal(wordPoints(6, 0, 0), 20);
  assert.equal(wordPoints(1, 2, 0), 50);
  assert.equal(wordPoints(1, 9, 0), 25); // never below a quarter
  assert.equal(wordPoints(3, 0, 20), 60 + 50); // streak bonus caps at 50
});

test("trivia points: 10 for right, up to 10 more for speed, 50:50 halves", () => {
  assert.equal(answerPoints(0, false), 20);
  assert.equal(answerPoints(TIME_LIMIT_MS, false), 10);
  assert.equal(answerPoints(0, true), 10);
});

test("Lagos day rolls over at midnight Lagos time, not UTC", () => {
  assert.equal(lagosDay(Date.parse("2026-10-11T23:59:00+01:00")), launchDay);
  assert.equal(lagosDay(Date.parse("2026-10-12T00:01:00+01:00")), launchDay + 1);
});

// ---- pages and auth ----

test("the page can be framed by Lagos Life and nothing else", async () => {
  const r = await fetch(base + "/");
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-security-policy"), /frame-ancestors https:\/\/lagoslife\.app/);
  assert.equal(r.headers.get("x-frame-options"), null);
});

test("static files can't escape the public folder", async () => {
  const r = await fetch(base + "/..%2Fserver%2Fconfig.js");
  assert.equal(r.status, 404);
});

test("a Vatar session becomes a Doingz token; bad sessions are refused", async () => {
  const ok = await signIn("sess-tolu");
  assert.ok(ok.token);
  assert.equal(ok.player.name, "Tolu");
  assert.equal(ok.player.hints, 3);
  const bad = await call("/api/auth", { body: { session: "forged", mode: "test" } });
  assert.equal(bad.status, 401);
  const wrong = await call("/api/auth", { body: { session: "sess-tolu", mode: "live" } });
  assert.equal(wrong.status, 401);
  const none = await call("/api/me");
  assert.equal(none.status, 401);
});

// ---- the daily word ----

test("daily word: answer stays hidden until the end, a win scores and starts a streak", async () => {
  const { token } = await signIn("sess-tolu");
  const ans = answerFor(launchDay, launchDay).word;
  let r = await call("/api/word", { token });
  assert.equal(r.data.word.answer, null);
  r = await call("/api/word/guess", { token, body: { word: "QQQQQ" } });
  assert.equal(r.data.error, "not_a_word");
  r = await call("/api/word/guess", { token, body: { word: "crane" } });
  assert.equal(r.status, 200);
  if (ans !== "CRANE") assert.equal(r.data.word.answer, null);
  r = await call("/api/word/guess", { token, body: { word: ans } });
  assert.equal(r.data.word.status, "won");
  assert.equal(r.data.word.answer, ans);
  assert.equal(r.data.player.streak, 1);
  assert.equal(r.data.player.points, wordPoints(2, 0, 1));
  r = await call("/api/word/guess", { token, body: { word: ans } });
  assert.equal(r.status, 409);
});

test("hints reveal a letter, cost a hint, and past days need the archive", async () => {
  const { token } = await signIn("sess-ada");
  let r = await call("/api/word/hint", { token, body: {} });
  assert.equal(r.data.word.revealed.length, 1);
  assert.equal(r.data.player.hints, 2);
  const { pos, letter } = r.data.word.revealed[0];
  assert.equal(answerFor(launchDay, launchDay).word[pos], letter);
  clock += 86_400_000; // next day (tokens last 12 hours, so sign in again)
  r = await call(`/api/word?day=${launchDay}`, { token: (await signIn("sess-ada")).token });
  assert.equal(r.data.error, "archive_locked");
  clock -= 86_400_000;
});

test("a streak shield covers a missed day", async () => {
  const sess = "sess-sh";
  sessions[sess] = { playerId: "t_shield", name: "Shield", mode: "test" };
  const day0 = clock;
  let { token } = await signIn(sess);
  const win = async () => call("/api/word/guess", { token, body: { word: answerFor(lagosDay(clock), launchDay).word } });
  await win();                                  // day 1: streak 1
  purchases.pshield = { id: "pshield", productId: "streak_shield", playerId: "t_shield", amount: 200, status: "paid", mode: "test" };
  await call("/api/claim", { token, body: { purchaseId: "pshield" } });
  clock += 2 * 86_400_000;                      // skip day 2, play day 3
  ({ token } = await signIn(sess));
  const r = await win();
  assert.equal(r.data.player.streak, 2);
  assert.equal(r.data.player.shields, 0);
  clock = day0;
});

// ---- purchases ----

test("a paid purchase is checked with Vatar, given once and marked delivered", async () => {
  const { token } = await signIn("sess-tolu");
  purchases.p1 = { id: "p1", productId: "hints_5", playerId: "t_tolu", amount: 100, currency: "NGN", status: "paid", mode: "test" };
  let r = await call("/api/claim", { token, body: { purchaseId: "p1" } });
  assert.equal(r.status, 200);
  const hints = r.data.player.hints;
  assert.ok(delivered.includes("p1"));
  r = await call("/api/claim", { token, body: { purchaseId: "p1" } }); // replay: nothing more
  assert.equal(r.data.player.hints, hints);
});

test("you can't claim someone else's purchase, a refund, or one that doesn't exist", async () => {
  const { token } = await signIn("sess-ada");
  purchases.p2 = { id: "p2", productId: "hints_25", playerId: "t_tolu", amount: 400, status: "paid", mode: "test" };
  assert.equal((await call("/api/claim", { token, body: { purchaseId: "p2" } })).status, 403);
  purchases.p3 = { id: "p3", productId: "hints_25", playerId: "t_ada", amount: 400, status: "refunded", mode: "test" };
  assert.equal((await call("/api/claim", { token, body: { purchaseId: "p3" } })).status, 409);
  assert.equal((await call("/api/claim", { token, body: { purchaseId: "nope" } })).status, 404);
});

test("one-off products unlock: the archive opens past days", async () => {
  const { token } = await signIn("sess-ada");
  purchases.p4 = { id: "p4", productId: "archive_pass", playerId: "t_ada", amount: 500, status: "paid", mode: "test" };
  const r = await call("/api/claim", { token, body: { purchaseId: "p4" } });
  assert.ok(r.data.player.owns.includes("archive_pass"));
  clock += 86_400_000;
  const past = await call(`/api/word?day=${launchDay}`, { token: (await signIn("sess-ada")).token });
  assert.equal(past.status, 200);
  assert.equal(past.data.word.practice, true);
  clock -= 86_400_000;
});

test("webhook: bad signatures are refused, good ones grant the purchase once", async () => {
  purchases.p5 = { id: "p5", productId: "hints_5", playerId: "t_ada", amount: 100, status: "paid", mode: "test" };
  const body = JSON.stringify({ id: "evt_1", type: "purchase.paid", mode: "test", createdAt: clock, data: { purchaseId: "p5", productId: "hints_5", playerId: "t_ada" } });
  const bad = await call("/api/vatar-webhook", { raw: body, headers: { "X-Vatar-Signature": "sha256=00" } });
  assert.equal(bad.status, 401);
  const sig = "sha256=" + crypto.createHmac("sha256", WHSEC).update(body).digest("hex");
  const { token } = await signIn("sess-ada");
  const before = (await call("/api/me", { token })).data.player.hints;
  const ok = await call("/api/vatar-webhook", { raw: body, headers: { "X-Vatar-Signature": sig } });
  assert.equal(ok.status, 200);
  await new Promise((r) => setTimeout(r, 50));
  await call("/api/vatar-webhook", { raw: body, headers: { "X-Vatar-Signature": sig } }); // redelivery
  await new Promise((r) => setTimeout(r, 50));
  assert.equal((await call("/api/me", { token })).data.player.hints, before + 5);
  assert.ok(delivered.includes("p5"));
});

// ---- Quick fire ----

test("quick fire: answers are scored on the server, slow answers time out", async () => {
  sessions["sess-q"] = { playerId: "t_quiz", name: "Quiz", mode: "test" };
  const { token } = await signIn("sess-q");
  let r = await call("/api/trivia/start", { token, body: {} });
  const id = r.data.round.roundId;
  assert.equal(r.data.round.scored, true);
  assert.equal(r.data.round.question.options.length, 4);
  assert.equal(JSON.stringify(r.data).includes('"a"'), false);
  // Try every option on question 1 is impossible (one answer per question), so just answer and check consistency.
  r = await call("/api/trivia/answer", { token, body: { roundId: id, choice: 0 } });
  const first = r.data.result;
  assert.equal(first.correct, first.answer === 0);
  assert.equal(r.data.player.points, first.points);
  clock += TIME_LIMIT_MS + 5_000; // far too slow
  r = await call("/api/trivia/answer", { token, body: { roundId: id, choice: r.data.result.answer } });
  assert.equal(r.data.result.correct, false);
  assert.equal(r.data.result.timedOut, true);
});

test("quick fire: pausing stops the clock, but only up to 45 seconds a round", async () => {
  sessions["sess-p"] = { playerId: "t_pause", name: "Pause", mode: "test" };
  const { token } = await signIn("sess-p");
  const id = (await call("/api/trivia/start", { token, body: {} })).data.round.roundId;
  clock += 5_000;
  await call("/api/trivia/pause", { token, body: { roundId: id } });
  clock += 30_000;
  let r = await call("/api/trivia/resume", { token, body: { roundId: id } });
  assert.equal(r.data.round.question.timeLeftMs, 10_000);
  await call("/api/trivia/pause", { token, body: { roundId: id } });
  clock += 60_000; // only 15 s of this is given back
  r = await call("/api/trivia/resume", { token, body: { roundId: id } });
  assert.equal(r.data.round.question.timeLeftMs, 0);
});

test("only the first three rounds a day score", async () => {
  sessions["sess-r"] = { playerId: "t_rounds", name: "Rounds", mode: "test" };
  const { token } = await signIn("sess-r");
  const scored = [];
  for (let i = 0; i < 4; i++) {
    const r = await call("/api/trivia/start", { token, body: {} });
    scored.push(r.data.round.scored);
    for (let q = 0; q < 10; q++) await call("/api/trivia/answer", { token, body: { roundId: r.data.round.roundId, choice: null } });
  }
  assert.deepEqual(scored, [true, true, true, false]);
});
