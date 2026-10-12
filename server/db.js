// SQLite storage using Node's built-in driver (Node 22.13+), so there is nothing to install.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export function openDb(dataDir) {
  let file = ":memory:";
  if (dataDir !== ":memory:") {
    fs.mkdirSync(dataDir, { recursive: true });
    file = path.join(dataDir, "doingz.sqlite");
  }
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,               -- Vatar per-game id: p_… live, t_… test, d_… local dev
      name TEXT NOT NULL DEFAULT '',
      points INTEGER NOT NULL DEFAULT 0,
      hints INTEGER NOT NULL DEFAULT 3,  -- starter hints
      shields INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      best_streak INTEGER NOT NULL DEFAULT 0,
      last_streak_day INTEGER,           -- last day the streak was solved or shielded
      owns TEXT NOT NULL DEFAULT '[]',   -- one-off products
      trivia_day INTEGER,
      trivia_scored INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS word_games (
      player_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      practice INTEGER NOT NULL DEFAULT 0,
      guesses TEXT NOT NULL DEFAULT '[]',
      revealed TEXT NOT NULL DEFAULT '[]',
      hints INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'playing',  -- playing | won | lost
      points INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (player_id, day)
    );

    CREATE TABLE IF NOT EXISTS trivia_rounds (
      id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      day INTEGER NOT NULL,
      scored INTEGER NOT NULL,
      questions TEXT NOT NULL,           -- [{ id, order: [option indexes] }]
      idx INTEGER NOT NULL DEFAULT 0,
      served_at INTEGER NOT NULL,
      paused_at INTEGER,
      pause_ms INTEGER NOT NULL DEFAULT 0,
      fifty TEXT,                        -- removed option positions for the current question
      results TEXT NOT NULL DEFAULT '[]',
      points INTEGER NOT NULL DEFAULT 0,
      correct INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'playing',  -- playing | done | abandoned
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS trivia_player ON trivia_rounds (player_id, status);

    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,               -- Vatar purchaseId: we grant each one once
      player_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      amount INTEGER,
      granted_at INTEGER NOT NULL,
      delivered_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS arcade_matches (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      seats TEXT NOT NULL,               -- [{ kind: "human", pid } | { kind: "cpu" }]
      state TEXT NOT NULL,               -- the game's state, including its rng
      status TEXT NOT NULL DEFAULT 'playing',  -- playing | done | abandoned
      scored INTEGER NOT NULL DEFAULT 0,
      result TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS arcade_by_owner ON arcade_matches (status, game);

    CREATE TABLE IF NOT EXISTS arcade_seats (
      match_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      seat INTEGER NOT NULL,
      PRIMARY KEY (match_id, seat)
    );
    CREATE INDEX IF NOT EXISTS arcade_seats_player ON arcade_seats (player_id);

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      received_at INTEGER NOT NULL
    );
  `);
  // Columns added after launch: add them to databases created before they existed.
  const addColumns = (table, defs) => {
    const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const [name, def] of defs) if (!have.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`);
  };
  addColumns("players", [["arcade_day", "INTEGER"], ["arcade_scored", "INTEGER NOT NULL DEFAULT 0"]]);
  addColumns("arcade_matches", [
    ["mode", "TEXT NOT NULL DEFAULT 'cpu'"],   // cpu | dev | test | live
    ["vatar_id", "TEXT"],                      // the Lagos Life match, for friend games
    ["nonce", "TEXT"],                         // Vatar's value we sign the result with
    ["scored_seats", "TEXT"],                  // which seats earn points, e.g. [1, 0]
    ["turn_at", "INTEGER"],                    // when the current turn began (for timeouts)
    ["reported", "INTEGER NOT NULL DEFAULT 0"],// result sent to Lagos Life
  ]);
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS arcade_vatar ON arcade_matches (vatar_id) WHERE vatar_id IS NOT NULL;

    -- What each person in a friend game should replay, move by move (already redacted for them).
    CREATE TABLE IF NOT EXISTS arcade_events (
      match_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      seat INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (match_id, seq, seat)
    );

    -- Friend-game lobbies: a Lagos Life match waiting for its game, or a local code in dev.
    CREATE TABLE IF NOT EXISTS lobbies (
      key TEXT PRIMARY KEY,                    -- "v:<vatar match id>" or "d:<code>"
      game TEXT NOT NULL,
      creator TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',     -- open | paired | closed
      match_id TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  return db;
}

// Runs fn inside a transaction; rolls back if it throws.
export function tx(db, fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
