// Rule checks for the board and card games.
import { test } from "node:test";
import assert from "node:assert/strict";
import { legalMoves, makeMove } from "../public/shared/chess.js";
import draughts, { legalMoves as draughtsMoves } from "../public/shared/draughts.js";
import { sow, legalPits } from "../public/shared/ayo.js";
import four from "../public/shared/four.js";
import reversi from "../public/shared/reversi.js";
import dots from "../public/shared/dots.js";

// ---------- chess: perft against published node counts ----------

function fromFen(fen) {
  const [placement, turn, castle, ep] = fen.split(" ");
  const b = [];
  for (const ch of placement.replace(/\//g, "")) {
    if (/\d/.test(ch)) for (let k = 0; k < Number(ch); k++) b.push("");
    else b.push(ch);
  }
  const epIdx = ep === "-" ? -1 : (8 - Number(ep[1])) * 8 + "abcdefgh".indexOf(ep[0]);
  return { b, turn: turn === "w" ? 0 : 1, castle: castle === "-" ? "" : castle, ep: epIdx, half: 0 };
}
const perft = (g, d) => {
  if (!d) return 1;
  let n = 0;
  for (const m of legalMoves(g)) n += perft(makeMove(g, m), d - 1);
  return n;
};

test("chess move generation matches perft counts", () => {
  const start = fromFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  assert.equal(perft(start, 1), 20);
  assert.equal(perft(start, 3), 8902);
  // "Kiwipete": castling, pins, en passant, promotions all at once
  const kiwi = fromFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
  assert.equal(perft(kiwi, 1), 48);
  assert.equal(perft(kiwi, 2), 2039);
  assert.equal(perft(kiwi, 3), 97862);
  // en passant and discovered checks along a rank
  const p3 = fromFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1");
  assert.equal(perft(p3, 4), 43238);
  // promotions and castling rights after captures
  const p4 = fromFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1");
  assert.equal(perft(p4, 3), 9467);
});

// ---------- draughts ----------

function emptyDraughts() {
  const st = {};
  draughts.init(st);
  st.g.b = Array(64).fill(0);
  return st;
}

test("draughts: captures are compulsory and jumps chain", () => {
  const st = emptyDraughts();
  const put = (r, c, s, k = false) => (st.g.b[r * 8 + c] = { s, k });
  put(5, 0, 0);         // our man
  put(4, 1, 1);         // their man to jump
  put(2, 3, 1);         // and another one after it
  put(6, 7, 0);         // a man with only a quiet move
  const moves = draughtsMoves(st.g.b, 0);
  assert.equal(moves.length, 1, "only the capture is allowed");
  assert.deepEqual(moves[0].path, [3 * 8 + 2, 1 * 8 + 4], "and it must continue to the second jump");
  assert.deepEqual(moves[0].caps.sort(), [4 * 8 + 1, 2 * 8 + 3].sort());
});

test("draughts: reaching the far row crowns and ends the move", () => {
  const st = emptyDraughts();
  st.g.b[2 * 8 + 1] = { s: 0, k: false };
  st.g.b[1 * 8 + 2] = { s: 1, k: false };
  st.g.b[7 * 8 + 6] = { s: 1, k: false };
  const [mv] = draughtsMoves(st.g.b, 0);
  assert.deepEqual(mv.path, [0 * 8 + 3]);
  const evs = draughts.apply(st, 0, { from: mv.from, path: mv.path });
  assert.equal(evs[0].crowned, true);
  assert.equal(st.g.b[3].k, true);
});

// ---------- ayo ----------

test("ayo: twos and threes are captured backwards along their row", () => {
  // seat 0 sows 2 seeds from pit 4 into 5 and 6; pit 6 (theirs) goes 2 -> 3? set it up:
  const pits = [0, 0, 0, 0, 3, 1, 1, 2, 0, 0, 0, 5];
  const r = sow(pits, 4, 0); // lands in 5, 6, 7: pit 7 becomes 3, pit 6 becomes 2
  assert.deepEqual(r.taken, [7, 6]);
  assert.equal(r.captured, 5);
});

test("ayo: you can't take every seed they have (grand slam)", () => {
  const pits = [0, 0, 0, 0, 0, 2, 1, 0, 0, 0, 0, 0];
  const r = sow(pits, 5, 0); // last seed lands in pit 7 making... pit 6 -> 2 and 7 -> 1
  assert.equal(r.captured, 0);
  const slam = sow([0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0], 5, 0); // pit 6 becomes 3: their only seeds
  assert.equal(slam.captured, 0, "taking all their seeds isn't allowed");
});

test("ayo: if they have no seeds you must feed them", () => {
  const pits = [3, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0];
  assert.deepEqual(legalPits(pits, 0), [5], "only the pit that reaches their side");
});

// ---------- grid games ----------

test("four in a row finds a vertical four and stops", () => {
  const st = {};
  four.init(st);
  for (let k = 0; k < 3; k++) { four.apply(st, 0, { col: 0 }); four.apply(st, 1, { col: 1 }); }
  four.apply(st, 0, { col: 0 });
  assert.equal(four.result(st).winner, 0);
});

test("reversi passes the turn back when the other side can't move", () => {
  const st = {};
  reversi.init(st);
  // Fill so that only black can move.
  st.g.b = Array(64).fill(1);
  st.g.b[0] = 0; st.g.b[1] = 2;
  st.g.turn = 0;
  assert.ok(reversi.toMove(st).includes(0));
  reversi.apply(st, 0, { i: 0 });
  assert.equal(reversi.result(st).winner, 0);
});

test("dots and boxes: closing a box keeps your turn", () => {
  const st = {};
  dots.init(st);
  // box (0,0): top 0, bottom 4, left 20, right 21
  dots.apply(st, 0, { line: 0 });
  dots.apply(st, 1, { line: 4 });
  dots.apply(st, 0, { line: 20 });
  const ev = dots.apply(st, 1, { line: 21 });
  assert.deepEqual(ev[0].closed, [0]);
  assert.equal(st.g.turn, 1, "the closer goes again");
});

test("20 Questions: every thing can be told apart, and every question matters", async () => {
  const { THINGS, QUESTIONS, truth } = await import("../public/shared/twenty-kb.js");
  const sig = (t) => QUESTIONS.map((q) => (truth(t.id, q.id) ? 1 : 0)).join("");
  const seen = new Map();
  for (const t of THINGS) {
    const s = sig(t);
    assert.ok(!seen.has(s), `${t.id} and ${seen.get(s)} answer every question the same way`);
    seen.set(s, t.id);
    for (const qid of t.yes) assert.ok(QUESTIONS.some((q) => q.id === qid), `${t.id} uses unknown question ${qid}`);
  }
  assert.equal(new Set(THINGS.map((t) => t.id)).size, THINGS.length, "ids are unique");
  for (const q of QUESTIONS) {
    const yes = THINGS.filter((t) => truth(t.id, q.id)).length;
    assert.ok(yes > 0 && yes < THINGS.length, `"${q.id}" splits nothing`);
  }
});
