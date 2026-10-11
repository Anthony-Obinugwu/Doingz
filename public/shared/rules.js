// Helpers shared by every arcade game's rules (browser and server).
//
// A game module exports a default object:
//   id, title, blurb, how         names and one-line instructions
//   W, H                          the playfield size in logical units (the client scales it)
//   init(st)                      sets up st.g for a new match (server only; may use st.rng)
//   toMove(st) -> [seat...]       seats that must send a move now ([] when the match is over)
//   apply(st, seat, move, ctx)    validates and applies one move, returns events for the phones
//                                 ctx = { now, cpu } where cpu says the seat is the computer
//   cpu(st, seat, R) -> move      the computer's move (server only; R() is a uniform random)
//   result(st) -> null | { winner: seat|null, score: [a, b] }   (winner null = draw)
//   view(st, seat) (optional)     what a seat may see; defaults to st.g
//
// Seats are numbered 0 and 1. The rules never know whether a seat is a person or the
// computer except through ctx.cpu, so a friend can take the computer's seat later.

export function bad(code, message, status = 400) {
  throw Object.assign(new Error(message || code), { status, code });
}

/** Standard alternating-turn helper. */
export const turnOf = (game, st) => (game.result(st) ? [] : [st.g.turn]);

/** Normal-ish random from a uniform source R (server-side CPU noise only). */
export const normalR = (R) => (R() + R() + R() + R() - 2) * 1.7320508075688772;
