// Builds the word-game dictionaries in server/content from npm word lists.
//   npm i --no-save wordlist-english naughty-words && node scripts/build-words.mjs
// valid.txt  – words players may score (3–8 letters, SCOWL size 60 and below)
// common.txt – everyday words the computer plays (SCOWL size 35 and below)
// Offensive words are removed from both.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const list = (name) => { try { return require(`wordlist-english/${name}.json`); } catch { return []; } };
const ok = (w) => /^[a-z]{3,8}$/.test(w);

const bad = new Set(require("naughty-words/en.json").map((w) => w.toLowerCase()));
const STEMS = ["fuck", "shit", "cunt", "nigg", "fagg", "whore", "slut", "bitch", "wank", "porn", "jizz", "twat", "pussy", "dick", "cock", "bastard", "retard", "nazi", "dildo", "boob", "penis", "vagin", "rapist", "orgasm", "horny"];
const clean = (w) => !bad.has(w) && !STEMS.some((s) => w.includes(s));

const valid = new Set(), common = new Set();
for (const t of ["10", "20", "35", "40", "50", "55", "60"]) for (const v of ["english", "british", "american"]) list(`${v}-words-${t}`).filter(ok).filter(clean).forEach((w) => valid.add(w));
for (const t of ["10", "20", "35"]) for (const v of ["english", "british"]) list(`${v}-words-${t}`).filter(ok).filter(clean).forEach((w) => common.add(w));
fs.writeFileSync(new URL("../server/content/valid.txt", import.meta.url), [...valid].sort().join("\n") + "\n");
fs.writeFileSync(new URL("../server/content/common.txt", import.meta.url), [...common].sort().join("\n") + "\n");
console.log(`valid ${valid.size}, common ${common.size}`);
