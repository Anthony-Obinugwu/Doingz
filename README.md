# Doingz

The daily Naija word, quick-fire trivia and a 22-game arcade for Lagos Life, built on the Vatar Games SDK. Play the computer or a friend.

- **Today's word.** Guess the five-letter Naija word in six tries: food, Lagos places, cities, slang and culture. A free clue says what kind of word it is, and the meaning shows when you finish.
- **Quick fire.** Ten questions, fifteen seconds each, on slang, languages, food, Lagos, states and culture. The first three rounds a day earn points; answer fast for a bonus.
- **Arcade: skill and aim.** Darts, Archery (at the Durbar), Basketball (street court), Zobo Pong, Lagos Mini Golf, Shuffleboard (with bottle covers), Knockout (on a lagoon raft), Tanks (over Olumo Rock) and Paintball (in a vulcanizer's tyre yard).
- **Arcade: board and cards.** Four in a Row, Draughts, Chess, Reversi, Gomoku, Ayo, Dots & Boxes, Sea Battle, Filler and Crazy 8.
- **Arcade: words and party.** Word Hunt (swipe words on a 4 × 4 grid), Anagrams (six letters, one minute) and 20 Questions (Naija food, places, animals and things). Naija words score double in Word Hunt and Anagrams.
- **Play the computer or a friend.** Invite a friend with a six-letter code, or use Quick match to play whoever's waiting. Inside Lagos Life, friend games run through Vatar matches, and can carry a Lagos Life game-money stake once Vatar allows stakes for Doingz. The first ten arcade games a day earn points: 25 for a win, 10 for a draw.
- **Board.** Points from every mode add up on the Lagos Life leaderboard. Points can't be bought.

Every answer and every shot is decided on the server, so today's word and the trivia answers never reach the phone before they're played, and arcade results can't be faked by editing the page.

## Run it locally

Needs Node 22.13 or newer. There's nothing to install.

```sh
npm run dev      # http://localhost:8080 with a pretend local player (DEV_AUTH=1)
npm test         # 38 tests: the API against a fake Vatar, chess perft, rule checks, every arcade game played to the end, friend games
```

Outside Lagos Life the game uses a local test player, and shop items are free. That mode is switched off whenever `NODE_ENV=production`.

To try friend games locally, open two windows as two different players: `http://localhost:8080/?dev=ada` and `http://localhost:8080/?dev=bayo`. In one, tap **Arcade → Invite a friend**, pick a game and read out the code; type it into **Got a code?** in the other.

## Go live

Vatar reviews every game before it reaches players, so "live tonight" means: deployed, sandbox checklist ticked, and submitted tonight. Players see it once Vatar approves.

### 1. Deploy (about 10 minutes)

Any host that runs Docker or Node 22 and gives you **a persistent disk** and **your own HTTPS domain** works. On Render:

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. `render.yaml` sets up the service, a 1 GB disk at `/data` and a random `APP_SECRET`.
3. Add your own domain (for example `doingz.yourdomain.com`). Vatar's webhook rules refuse IP addresses, `localhost`, `*.workers.dev` and load-balancer addresses, so use your own domain.
4. Open `https://<your domain>/healthz`. It should say `{"ok":true}`.

On Railway or Fly, deploy the `Dockerfile`, attach a volume at `/data`, and set the variables from `.env.example`.

The database is SQLite, so run **one instance**. Don't scale horizontally.

### 2. Get your Vatar keys

At [lagoslife.app/developers/keys](https://lagoslife.app/developers/keys):

| Field | Value |
| --- | --- |
| Game name | Doingz |
| HTTPS address | `https://<your domain>/` |
| Webhook | `https://<your domain>/api/vatar-webhook` |
| Description | The daily Naija word, quick-fire trivia and 22 arcade games. |

Copy the **test secret** and **test webhook signing secret** (shown once) into your host as `VATAR_SECRET_TEST` and `VATAR_WEBHOOK_SECRET_TEST`. For friend games, also copy the **results secret** into `VATAR_RESULTS_SECRET_TEST`: Doingz signs each finished friend game's winner with it. Then redeploy.

### 3. Create the products in the dashboard

The ids must match exactly. Prices are in naira and must match too, because the shop labels come from `server/products.js` while the pay sheet uses Vatar's records.

| Product id | Name | Price | Type |
| --- | --- | --- | --- |
| `hints_5` | 5 hints | ₦100 | Consumable |
| `hints_25` | 25 hints | ₦400 | Consumable |
| `streak_shield` | Streak shield | ₦200 | Consumable |
| `archive_pass` | Word archive | ₦500 | One-off |
| `owambe_theme` | Owambe theme | ₦300 | One-off |

### 4. Tick the sandbox checklist

Open your sandbox at `lagoslife.app/developers/sandbox/<draft>`, then:

1. Let the game load. This ticks **SDK init**.
2. Go to **Shop** and buy 5 hints with **Pay (test)**. This ticks **test purchase**, **verified by your server** and **marked delivered**.
3. Press **Send test webhook** in the dashboard. Optional, but it confirms the webhook works.

4. For the multiplayer item: open the sandbox in two windows (or on two test accounts), tap **Arcade → Invite a friend** and pick Four in a Row in one, then type the code into **Got a code?** in the other. Play it out, or press **Resign**. Doingz reports the winner to `POST /matches/{id}/result`, signed with your results secret.

Friend games depend on Vatar switching matches on for Doingz. Until then the Lagos Life SDK answers `not_available`, and Doingz tells the player that friend games aren't open yet; games against the computer are unaffected. Stakes are a separate approval: until Vatar allows them, only **Friendly** works (`friendly_only`). Stakes are always Lagos Life game money, never real money.

### 5. Submit

Upload the files in `listing/` and the text below, agree to the Developer Agreement, and submit.

- **Icon:** `listing/icon-512.png`
- **Screenshots:** the five `listing/screenshot-*.png` files (750 × 1624)
- **Category:** Word or Puzzle (whichever the dashboard offers)
- **Short description** (93 characters): The daily Naija word, quick-fire trivia and 22 arcade games. Beat a friend, climb the board.
- **Long description:**
  > Doingz is two games in one. Every day there's a new five-letter Naija word to guess in six tries, from amala to Ikeja to awoof. A free clue tells you what kind of word it is, and when you finish you learn what it means. Then test yourself in Quick fire: ten questions in fifteen seconds each on slang, languages, food, Lagos, states and culture.
  >
  > Then hit the Arcade: darts, archery at the Durbar, street-court basketball, zobo pong, mini golf around Lagos, bottle-cover shuffleboard, knockout on a lagoon raft, tanks over Olumo Rock and paintball in a vulcanizer's tyre yard. Or sit down for chess, draughts, Ayo, reversi, gomoku, four in a row, dots and boxes, sea battle, filler and Crazy 8. Word people get Word Hunt, Anagrams and 20 Questions, where Naija words score double. Play the computer, or send a friend a code and play each other.
  >
  > Points from everything add up on the board. Your first three Quick fire rounds and first ten arcade games each day count, and a daily streak adds a bonus to your word score.
  >
  > The shop sells hints (₦100 for 5), streak shields, a word archive and an Owambe colour theme. Hints help you finish a puzzle but take points off it, so the board can't be bought.

### 6. When Vatar approves

Add `VATAR_SECRET_LIVE`, `VATAR_WEBHOOK_SECRET_LIVE` and `VATAR_RESULTS_SECRET_LIVE` and redeploy. Keep the test pair so your sandbox keeps working. Code you deploy to the same address updates the live game straight away.

## How it fits together

```
Phone (Lagos Life frame)            Doingz server (this repo)              Vatar API
public/app.js ── Vatar.init() ──▶  POST /api/auth ── /session/verify ──▶  who is playing
              ◀── Doingz token ──  (one Vatar call per game open)
              ── guesses, answers ─▶ /api/word/*, /api/trivia/*  (no Vatar calls)
Vatar.purchase() ─ pay sheet ─▶    POST /api/claim ── GET /purchases/{id} ─▶ paid? whose?
                                   give it once ───── POST /deliver ───────▶
                                   POST /api/vatar-webhook ◀── purchase.paid (signed)
Vatar.submitScore(total points), Vatar.leaderboard()
```

- **Sign-in.** A Vatar session is checked once, then the phone gets a 12-hour Doingz token. Vatar allows 600 API calls a minute per game, so guesses never spend one. Sign-ins are capped at 450 a minute to leave room for purchases. If Doingz takes off, ask Vatar for a higher limit.
- **Purchases.** Every claim is checked with Vatar: it must be paid, belong to the player asking, and not be refunded. Each purchase id is granted once, even if the phone, the webhook and a reload all claim it.
- **Pause.** When the phone backgrounds or the pay sheet opens, the Quick fire clock stops. A round can claim back at most 45 seconds, so pausing can't be used to look answers up. A paintball round that gets interrupted restarts with fresh pop-ups (three restarts a match).
- **Days.** A new word arrives at midnight Lagos time. Puzzle 1 is 11 October 2026 (`LAUNCH_DATE`).

## The arcade

```
Phone                                  Server
drag / flick ──── move {vx, vy} ────▶  rules.apply(): validate, simulate, score
                                       computer's turn: rules.cpu() → rules.apply()
replay each event with the same   ◀──  events [{ inputs, outcome }] + new state
shared simulation, then show state
```

- **Rules live in `public/shared/`**, one file per game, and run in both places: the server decides, the phone replays the same simulation to animate it. The simulations only use `+ − × ÷` and `Math.sqrt`, which JavaScript requires to be exact on every engine, so an iPhone, an Android phone and the server agree to the last digit. (`sin`, `cos` and `pow` aren't exact across engines, so they only appear in server-side setup and computer aiming, never inside a simulation.) Anything random, like the wind in Archery or dart wobble, is rolled by the server and sent as data. After every animation the phone snaps to the server's state anyway.
- **The computer** aims like a person: it solves the shot, then adds human-sized error. Its accuracy was tuned so it wins and loses about evenly against itself, and the basketball computer makes about 59% of shots. In the board games it searches a few moves ahead with a little randomness, so it's a fair club-level opponent rather than unbeatable: chess looks two moves deep plus captures, draughts four, Ayo six.
- **Board and card games** send a snapshot of what you're allowed to see after every move, so the phone can step through the computer's reply. The computer's ships in Sea Battle and its hand in Crazy 8 never leave the server; a test checks this.
- **Chess** has the full rules (castling, en passant, promotion to queen, checkmate, stalemate, fifty moves, threefold repetition, insufficient material) and its move generator matches the standard perft counts. Each computer move is capped at a fixed search budget (about 0.1 s) so one chess game can't slow the server for everyone else.
- **House rules worth knowing:** Draughts is 8 × 8 English rules (compulsory captures, crowning ends the move); after 60 moves with no capture or crowning, more pieces wins. Ayo uses the common "twos and threes" capture rule shared with Oware, with no grand slams and compulsory feeding; first to 25 seeds. Crazy 8 lets you draw up to three cards before passing.
- **Paintball** is the only real-time game. The server writes each round's pop-up schedule, and only accepts hits on targets that were actually up at that moment, in rounds that lasted their full 30 seconds. Six-shot magazines stop spray-tapping.
- **Points:** 25 for a win and 10 for a draw, in your first ten arcade games each Lagos day (`ARCADE_SCORED_PER_DAY`). Later games are practice. In a friend game each person's own daily allowance decides whether it scores for them.
- **Word Hunt and Anagrams** check words on the server against a 40,536-word list (`server/content/valid.txt`); the phone only gets salted fingerprints of the words on its board, so it can say "not a word" instantly without being able to list the answers. The computer plays its round on the server and finds a share of the words a decent player would. Missed words show after the game.
- **20 Questions** has 86 things and 85 yes/no questions (`public/shared/twenty-kb.js`), every thing distinguishable from every other. Answers are checked against the facts, so nobody can lie their way out; the computer asks the question that splits the remaining things best, with a little randomness.

### How it feels to play

The arcade borrows the habits of iMessage games, so it feels familiar to anyone who has played GamePigeon:

- **Throw games are flicks, not sliders.** Basketball, Zobo Pong and Shuffleboard: put your finger on the ball or cover, swipe it where you want it to go, and let go. It follows your finger, leaves a streak, and flies from where you released it. Darts: hold to pick up a dart, slide to aim (the sight sways), flick up to throw. Mini Golf, Knockout and Tanks keep pull-back aiming, which is how those games work in Messages too.
- **Friend games look like a message thread.** Each game is a bubble: "bayo played · Your move" with a red badge when it's your turn, or a green "Sent · waiting for bayo" when it isn't. After your move a "Sent to bayo ✓" bubble flies off, and when their move arrives a **Your turn** banner drops in.
- **Juice.** Every game has synthesised sound (no audio files), short vibrations on Android phones, screen shake on big hits, particle bursts (zobo splashes, sparks off the dartboard, paint splats), rising notes as you build a word, a ticking clock in the last ten seconds, and confetti when you win. The 🔊 button in a game turns sound and vibration off; the choice is remembered on that phone. Everything respects "reduce motion".
- **The game opens like a sheet** sliding up over the arcade, with you and your opponent at the top and a glow on whoever's turn it is.

### Friend games

```
Phone A                         Doingz server                         Vatar
Vatar.match.create({stake}) ───────────────────────────────────────▶  match (code, nonce)
POST /api/arcade/lobby ───────▶ checks A is in it, saves the game
Phone B: Vatar.match.join(code) ───────────────────────────────────▶  status: playing
both: POST /api/arcade/pair ──▶ checks both players, creates one
                                arcade match with two human seats
moves: POST /api/arcade/move    same rules as computer games
poll:  GET /api/arcade/match?since=seq   each phone gets only its own view
game over ─────────────────────────────── POST /matches/{id}/result ─▶ winner (signed)
```

- **Seats.** The same match code runs computer and friend games; the rules never know which seats are people. The person who invited plays first.
- **Seeing their move.** The phone checks every two seconds while it's the other person's turn (and every five on your own turn, to catch a resign). Every event is stored per seat with hidden information stripped, so in Crazy 8 your friend sees that you drew a card, not which one.
- **Going quiet.** If the other person doesn't move for two minutes (`IDLE_CLAIM_MS`), you can claim the win. **Resign** ends it straight away.
- **Settling.** When a friend game ends, the server posts the winner (or `"draw"`) to Vatar, signed with `VATAR_RESULTS_SECRET_*` and the match's nonce. If the post fails, the next request for that match tries again; `already_settled` counts as done.
- **Quick match** uses `Vatar.match.quick`. If nobody's waiting, you wait with the game you picked; whoever joins plays that game.
- **Locally** (`DEV_AUTH=1`) the same flow runs without Vatar: `/api/arcade/dev-lobby`, `dev-join` and `dev-quick` stand in for the Vatar calls. They're switched off in production.

## Adding a game

1. Write `public/shared/<id>.js` with the rules contract described at the top of `public/shared/rules.js`.
2. Write `public/arcade/<id>.js`: a canvas client exporting `W`, `H`, `scoreOf`, and a default function returning `render`, `play` and `destroy` (copy the closest existing game).
3. Register it in `server/arcade.js` and give it an icon in `public/arcade/arcade.js`.
4. `npm test` plays it to the end automatically.

## Adding content

- **Words:** `server/content/answers.js`. Add new words at the **end** of the list, since the daily order is a fixed shuffle and reordering changes which word falls on which day. Sixty words last two months before repeating.
- **Questions:** `server/content/trivia.js`. Keep facts stable: no current office holders, prices or "latest" anything.
- **Guess list:** `server/content/guesses.txt`, 12,595 English five-letter words from [word-list](https://github.com/sindresorhus/word-list) (MIT, see `guesses.LICENSE`). Every answer is also accepted as a guess.
- **Word game lists:** `server/content/valid.txt` (any word accepted) and `common.txt` (words the computer knows and Anagrams racks come from), built from [SCOWL](http://wordlist.aspell.net/) via `wordlist-english` with rude words filtered out using [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) (CC BY 4.0). See `words.LICENSE`. Rebuild with `scripts/build-words.mjs`.
- **20 Questions:** `public/shared/twenty-kb.js`. A test checks every thing can still be told apart after you add one.

## Project layout

```
server/
  index.js        starts the HTTP server
  app.js          routes, security headers, purchase claims, webhook
  game.js         daily word, streaks, Quick fire, granting purchases
  vatar.js        Vatar API client and webhook signature check
  token.js        Doingz player tokens
  db.js           SQLite schema (node:sqlite)
  products.js     shop catalogue
  content/        answers, trivia, guess list, word game lists
  words.js        Word Hunt and Anagrams dictionary (server only)
  arcade.js       arcade matches: seats, computer turns, friend games, daily scoring
public/           the game: index.html, app.js, styles.css, Archivo font (OFL)
  shared/         arcade rules and physics, shared by the server and the phone
  arcade/         arcade screens: the canvas kit and one client per game
listing/          icon and screenshots for the Vatar listing
scripts/          rebuilds the word game lists
test/             npm test
```
