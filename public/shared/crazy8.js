// Crazy 8: match the top card by suit or number. Eights are wild: play one and name the suit.
// Can't (or won't) play? Draw. First to empty their hand wins.
import { bad } from "./rules.js";
import { randInt } from "./phys.js";

export const SUITS = ["♠", "♥", "♦", "♣"];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const HAND = 7;
const MAX_TURNS = 300;

export const cardSuit = (c) => Math.floor(c / 13);
export const cardRank = (c) => c % 13;
export const isEight = (c) => cardRank(c) === 7;
export const cardText = (c) => RANKS[cardRank(c)] + SUITS[cardSuit(c)];

function shuffle(st, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(st, 0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const playable = (g, c) => isEight(c) || cardSuit(c) === g.suit || cardRank(c) === cardRank(g.top);

function drawOne(st, g, seat) {
  if (!g.deck.length) {
    // reshuffle everything under the top card back into the deck
    g.deck = shuffle(st, g.pile.slice());
    g.pile = [];
  }
  if (!g.deck.length) return null;
  const c = g.deck.pop();
  g.hands[seat].push(c);
  return c;
}

const game = {
  id: "crazy8",
  title: "Crazy 8",
  blurb: "Match suit or number. Eights are wild.",
  how: "Tap a card to play it, or draw. Play an 8 to change the suit.",
  W: 360,
  H: 560,
  snapshots: true,

  init(st) {
    const deck = shuffle(st, [...Array(52).keys()]);
    const hands = [deck.splice(0, HAND), deck.splice(0, HAND)];
    let top = deck.pop();
    while (isEight(top)) { deck.unshift(top); top = deck.pop(); } // don't start on a wild
    st.g = { deck, pile: [], top, suit: cardSuit(top), hands, turn: 0, turns: 0, drawsThisTurn: 0, last: null };
  },

  toMove: (st) => (game.result(st) ? [] : [st.g.turn]),

  apply(st, seat, move, ctx) {
    const g = st.g;
    const hand = g.hands[seat];
    if (move.draw) {
      if (g.drawsThisTurn >= 3) bad("draw_limit", "You've drawn three: play a card or pass");
      const c = drawOne(st, g, seat);
      g.drawsThisTurn += 1;
      if (c === null) { g.turn = 1 - seat; g.drawsThisTurn = 0; g.turns++; }
      return [{ type: "draw", seat, card: ctx?.cpu ? null : c, count: hand.length }];
    }
    if (move.pass) {
      if (g.drawsThisTurn < 3 && g.deck.length + g.pile.length > 0) bad("must_draw", "Draw first (up to three) before you pass");
      g.turn = 1 - seat;
      g.drawsThisTurn = 0;
      g.turns++;
      return [{ type: "pass", seat }];
    }
    const c = Number(move.card);
    const at = hand.indexOf(c);
    if (at < 0) bad("bad_move", "That card isn't in your hand");
    if (!playable(g, c)) bad("bad_move", "That card doesn't match");
    hand.splice(at, 1);
    g.pile.push(g.top);
    g.top = c;
    g.suit = isEight(c) ? (SUITS.includes(move.suit) ? SUITS.indexOf(move.suit) : Number.isInteger(move.suit) && move.suit >= 0 && move.suit < 4 ? move.suit : cardSuit(c)) : cardSuit(c);
    g.last = { seat, card: c };
    g.turn = 1 - seat;
    g.drawsThisTurn = 0;
    g.turns++;
    return [{ type: "play", seat, card: c, suit: g.suit, left: hand.length }];
  },

  cpu(st, seat) {
    const g = st.g;
    const hand = g.hands[seat];
    const counts = [0, 0, 0, 0];
    hand.forEach((c) => !isEight(c) && counts[cardSuit(c)]++);
    const options = hand.filter((c) => playable(g, c));
    const plain = options.filter((c) => !isEight(c));
    if (plain.length) {
      // keep suits we're long in; play the card whose suit we hold most of
      plain.sort((a, b) => counts[cardSuit(b)] - counts[cardSuit(a)] || cardRank(b) - cardRank(a));
      return { card: plain[0] };
    }
    const eight = options.find(isEight);
    if (eight !== undefined && (g.drawsThisTurn >= 1 || hand.length <= 3)) {
      return { card: eight, suit: counts.indexOf(Math.max(...counts)) };
    }
    if (g.drawsThisTurn < 3 && g.deck.length + g.pile.length > 0) return { draw: true };
    if (eight !== undefined) return { card: eight, suit: counts.indexOf(Math.max(...counts)) };
    return { pass: true };
  },

  result(st) {
    const g = st.g;
    const score = [g.hands[0].length, g.hands[1].length];
    if (!score[0]) return { winner: 0, score };
    if (!score[1]) return { winner: 1, score };
    if (g.turns >= MAX_TURNS) return { winner: score[0] === score[1] ? null : score[0] < score[1] ? 0 : 1, score };
    return null;
  },

  // Your hand, their card count, the top card. Never their cards or the deck order.
  view(st, seat) {
    const g = st.g;
    return {
      hand: g.hands[seat].slice().sort((a, b) => cardSuit(a) - cardSuit(b) || cardRank(a) - cardRank(b)),
      theirs: g.hands[1 - seat].length,
      top: g.top,
      suit: g.suit,
      deck: g.deck.length + g.pile.length,
      turn: g.turn,
      drawsThisTurn: g.drawsThisTurn,
      last: g.last,
      seat,
    };
  },
};
export default game;
