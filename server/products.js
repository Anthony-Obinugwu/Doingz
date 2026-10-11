// Products for sale. Create each one in the Vatar dashboard with EXACTLY this id and price.
// The pay sheet always shows Vatar's records; `price` here is only for our shop labels,
// so keep the two in step.
//
// Nothing here buys leaderboard points: hints cut a puzzle's points, shields only protect a streak.

export const PRODUCTS = {
  hints_5: { name: "5 hints", price: 100, kind: "consumable", grant: { hints: 5 },
    blurb: "Reveal a letter in the daily word, or knock out two wrong answers in Quick fire." },
  hints_25: { name: "25 hints", price: 400, kind: "consumable", grant: { hints: 25 },
    blurb: "The same hints, in a bigger bundle." },
  streak_shield: { name: "Streak shield", price: 200, kind: "consumable", grant: { shields: 1 },
    blurb: "Covers one missed or lost day so your daily streak carries on." },
  archive_pass: { name: "Word archive", price: 500, kind: "oneoff", grant: { own: "archive_pass" },
    blurb: "Play every past daily word for fun. Archive games don't earn points." },
  owambe_theme: { name: "Owambe theme", price: 300, kind: "oneoff", grant: { own: "owambe_theme" },
    blurb: "Dress the whole game in aso-ebi purple and gold." },
};
