# Doingz

The daily Naija word and quick-fire trivia game for Lagos Life, built on the Vatar Games SDK.

- **Today's word.** Guess the five-letter Naija word in six tries: food, Lagos places, cities, slang and culture. A free clue says what kind of word it is, and the meaning shows when you finish.
- **Quick fire.** Ten questions, fifteen seconds each, on slang, languages, food, Lagos, states and culture. The first three rounds a day earn points; answer fast for a bonus.
- **Board.** Points from both modes add up on the Lagos Life leaderboard. Points can't be bought.

Every answer is checked on the server, so today's word and the trivia answers never reach the phone before they're played.

## Run it locally

Needs Node 22.13 or newer. There's nothing to install.

```sh
npm run dev      # http://localhost:8080 with a pretend local player (DEV_AUTH=1)
npm test         # 17 tests against a fake Vatar API
```

Outside Lagos Life the game uses a local test player, and shop items are free. That mode is switched off whenever `NODE_ENV=production`.

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
| Description | Guess the daily Naija word and race the clock in quick-fire trivia. |

Copy the **test secret** and **test webhook signing secret** (shown once) into your host as `VATAR_SECRET_TEST` and `VATAR_WEBHOOK_SECRET_TEST`, then redeploy.

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

Doingz doesn't use multiplayer matches yet, so that item doesn't apply.

### 5. Submit

Upload the files in `listing/` and the text below, agree to the Developer Agreement, and submit.

- **Icon:** `listing/icon-512.png`
- **Screenshots:** `listing/screenshot-1-home.png` to `screenshot-4-shop.png` (750 × 1624)
- **Category:** Word or Puzzle (whichever the dashboard offers)
- **Short description** (97 characters): Guess the daily Naija word and race the clock in quick-fire trivia. Climb the board, sharp sharp.
- **Long description:**
  > Doingz is two games in one. Every day there's a new five-letter Naija word to guess in six tries, from amala to Ikeja to awoof. A free clue tells you what kind of word it is, and when you finish you learn what it means. Then test yourself in Quick fire: ten questions in fifteen seconds each on slang, languages, food, Lagos, states and culture.
  >
  > Points from both add up on the board. Your first three Quick fire rounds each day count, and a daily streak adds a bonus to your word score.
  >
  > The shop sells hints (₦100 for 5), streak shields, a word archive and an Owambe colour theme. Hints help you finish a puzzle but take points off it, so the board can't be bought.

### 6. When Vatar approves

Add `VATAR_SECRET_LIVE` and `VATAR_WEBHOOK_SECRET_LIVE` and redeploy. Keep the test pair so your sandbox keeps working. Code you deploy to the same address updates the live game straight away.

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
- **Pause.** When the phone backgrounds or the pay sheet opens, the Quick fire clock stops. A round can claim back at most 45 seconds, so pausing can't be used to look answers up.
- **Days.** A new word arrives at midnight Lagos time. Puzzle 1 is 11 October 2026 (`LAUNCH_DATE`).

## Adding content

- **Words:** `server/content/answers.js`. Add new words at the **end** of the list, since the daily order is a fixed shuffle and reordering changes which word falls on which day. Sixty words last two months before repeating.
- **Questions:** `server/content/trivia.js`. Keep facts stable: no current office holders, prices or "latest" anything.
- **Guess list:** `server/content/guesses.txt`, 12,595 English five-letter words from [word-list](https://github.com/sindresorhus/word-list) (MIT, see `guesses.LICENSE`). Every answer is also accepted as a guess.

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
  content/        answers, trivia, guess list
public/           the game: index.html, app.js, styles.css, Archivo font (OFL)
listing/          icon and screenshots for the Vatar listing
test/             npm test
```
