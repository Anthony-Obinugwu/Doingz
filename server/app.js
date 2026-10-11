// HTTP handling: the game's pages, its API, purchase claims and the Vatar webhook.
// createApp() takes its dependencies so tests can run it against a fake Vatar API.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { modeOf } from "./config.js";
import { issueToken, readToken } from "./token.js";
import { VatarError, webhookSigned } from "./vatar.js";
import { PRODUCTS } from "./products.js";
import * as G from "./game.js";

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json",
  ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8",
};
const MAX_BODY = 16 * 1024;

export function createApp({ config, db, vatar, now = () => Date.now(), log = console }) {
  const launchDay = G.dayFromDate(config.launchDate);

  const pageHeaders = {
    // Lets Lagos Life frame the game, and keeps everything else on this server.
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' https://lagoslife.app",
      "style-src 'self'",
      "font-src 'self'",
      "img-src 'self' data:",
      "connect-src 'self'",
      `frame-ancestors ${config.frameAncestors}`,
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };

  // ---------- small helpers ----------

  const send = (res, status, body, headers = {}) => {
    const json = typeof body === "string" ? body : JSON.stringify(body);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
    res.end(json);
  };
  const fail = (res, status, code, message) => send(res, status, { error: code, message: message || code });

  const readBody = (req) =>
    new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on("data", (c) => {
        size += c.length;
        if (size > MAX_BODY) { reject(Object.assign(new Error("too_large"), { status: 413 })); req.destroy(); }
        else chunks.push(c);
      });
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });
  const json = async (req) => {
    const raw = await readBody(req);
    if (!raw.length) return {};
    try { return JSON.parse(raw); } catch { throw Object.assign(new Error("bad_json"), { status: 400, code: "bad_request" }); }
  };

  // Per-key request budget, so one phone can't hammer the game.
  const buckets = new Map();
  const allow = (key, perMinute) => {
    const t = now();
    const b = buckets.get(key) || { n: 0, reset: t + 60_000 };
    if (t > b.reset) { b.n = 0; b.reset = t + 60_000; }
    b.n += 1;
    buckets.set(key, b);
    if (buckets.size > 50_000) for (const [k, v] of buckets) if (t > v.reset) buckets.delete(k);
    return b.n <= perMinute;
  };
  // The client IP is the entry our own proxy appended (TRUST_PROXY_HOPS from the right), never one the phone sent.
  const ipOf = (req) => {
    const hops = config.trustProxyHops ?? 1;
    const chain = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
    return (hops > 0 && chain.length >= hops ? chain[chain.length - hops] : req.socket.remoteAddress) || "unknown";
  };

  const playerFrom = (req) => {
    const auth = String(req.headers.authorization || "");
    const pid = readToken(config.appSecret, auth.startsWith("Bearer ") ? auth.slice(7) : "", now());
    if (!pid) throw new G.GameError(401, "signed_out", "Sign in again");
    if (!allow(`p:${pid}`, 120)) throw new G.GameError(429, "rate_limited", "Slow down a little");
    return pid;
  };

  const today = () => G.lagosDay(now());
  const dayParam = (v) => (v === undefined || v === null || v === "" ? today() : Number(v));

  // ---------- purchases ----------

  async function claim(mode, purchaseId, pid) {
    const p = await vatar.getPurchase(mode, purchaseId);
    if (pid && p.playerId !== pid) throw new G.GameError(403, "not_yours", "That purchase belongs to another player");
    if (p.status === "refunded") throw new G.GameError(409, "refunded", "That purchase was refunded");
    G.grantPurchase(db, { id: p.id, playerId: p.playerId, productId: p.productId, amount: p.amount }, now());
    try {
      await vatar.deliver(mode, p.id);
      G.markDelivered(db, p.id, now());
    } catch (e) {
      // Given but not yet marked: Vatar keeps listing it in purchases(), and the next claim marks it.
      log.warn(`deliver ${p.id} failed: ${e.code || e.message}`);
    }
    return p;
  }

  async function processWebhook(evt) {
    if (evt.type !== "purchase.paid" || !evt.data?.purchaseId) return;
    const mode = evt.mode === "live" ? "live" : "test";
    try {
      await claim(mode, evt.data.purchaseId, null);
    } catch (e) {
      log.warn(`webhook ${evt.id}: ${e.code || e.message}`);
    }
  }

  // ---------- routes ----------

  const routes = {
    "GET /healthz": () => ({ ok: true }),

    "GET /api/config": () => ({
      devAuth: config.devAuth,
      products: Object.entries(PRODUCTS).map(([id, p]) => ({ id, name: p.name, price: p.price, kind: p.kind, blurb: p.blurb })),
      trivia: { questions: G.TRIVIA_QUESTIONS, timeLimitMs: G.TIME_LIMIT_MS, scoredPerDay: G.TRIVIA_SCORED_PER_DAY },
    }),

    // A Vatar session (from Vatar.init / Vatar.session) in, a Doingz token out.
    "POST /api/auth": async (req, body) => {
      if (!allow(`ip:${ipOf(req)}`, 30)) throw new G.GameError(429, "rate_limited", "Slow down a little");
      // Vatar allows 600 API calls a minute per game: keep sign-ins under 450 so purchases always get through.
      if (!allow("all:auth", 450)) throw new G.GameError(503, "busy", "Lots of people are playing. Try again in a minute.");
      const mode = body.mode === "live" ? "live" : body.mode === "test" ? "test" : null;
      if (!mode || typeof body.session !== "string") throw new G.GameError(400, "bad_request", "session and mode are required");
      const who = await vatar.verifySession(mode, body.session);
      if (who.mode !== mode || modeOf(who.playerId) !== mode) throw new G.GameError(403, "wrong_mode", "Session mode mismatch");
      const p = G.ensurePlayer(db, who.playerId, who.name, now());
      return { token: issueToken(config.appSecret, p.id, now()), player: G.publicPlayer(db, p, today()) };
    },

    // Local testing only (DEV_AUTH=1 and not production): a pretend player.
    "POST /api/dev-auth": (req, body) => {
      if (!config.devAuth) throw new G.GameError(404, "not_found", "Not found");
      const id = "d_" + String(body.id || "local").replace(/[^a-z0-9]/gi, "").slice(0, 16);
      const p = G.ensurePlayer(db, id, String(body.name || "Local player").slice(0, 40), now());
      return { token: issueToken(config.appSecret, p.id, now()), player: G.publicPlayer(db, p, today()) };
    },
    "POST /api/dev-grant": (req, body) => {
      if (!config.devAuth) throw new G.GameError(404, "not_found", "Not found");
      const pid = playerFrom(req);
      if (modeOf(pid) !== "dev") throw new G.GameError(403, "dev_only", "Dev players only");
      if (!PRODUCTS[body.productId]) throw new G.GameError(400, "bad_product", "Unknown product");
      G.grantPurchase(db, { id: `dev_${now()}_${Math.random()}`, playerId: pid, productId: body.productId }, now());
      return { player: G.publicPlayer(db, G.getPlayer(db, pid), today()) };
    },

    "GET /api/me": (req) => {
      const pid = playerFrom(req);
      return { player: G.publicPlayer(db, G.getPlayer(db, pid), today()), today: today(), launchDay };
    },

    "GET /api/word": (req, body, url) => G.getWord(db, playerFrom(req), dayParam(url.searchParams.get("day")), now(), launchDay),
    "POST /api/word/guess": (req, body) => G.guessWord(db, playerFrom(req), dayParam(body.day), body.word, now(), launchDay),
    "POST /api/word/hint": (req, body) => G.hintWord(db, playerFrom(req), dayParam(body.day), now(), launchDay),
    "GET /api/word/archive": (req) => G.wordArchive(db, playerFrom(req), now(), launchDay),

    "POST /api/trivia/start": (req) => G.startTrivia(db, playerFrom(req), now()),
    "POST /api/trivia/answer": (req, body) => G.answerTrivia(db, playerFrom(req), body.roundId, body.choice ?? null, now()),
    "POST /api/trivia/fifty": (req, body) => G.fiftyTrivia(db, playerFrom(req), body.roundId, now()),
    "POST /api/trivia/pause": (req, body) => G.pauseTrivia(db, playerFrom(req), body.roundId, now()),
    "POST /api/trivia/resume": (req, body) => G.resumeTrivia(db, playerFrom(req), body.roundId, now()),

    // The phone says "I paid for this": we check it with Vatar before giving anything.
    "POST /api/claim": async (req, body) => {
      const pid = playerFrom(req);
      const mode = modeOf(pid);
      if (mode !== "live" && mode !== "test") throw new G.GameError(403, "no_purchases", "Purchases work inside Lagos Life only");
      if (typeof body.purchaseId !== "string" || !body.purchaseId) throw new G.GameError(400, "bad_request", "purchaseId is required");
      await claim(mode, body.purchaseId, pid);
      return { player: G.publicPlayer(db, G.getPlayer(db, pid), today()) };
    },
  };

  async function webhook(req, res) {
    const raw = await readBody(req);
    let evt;
    try { evt = JSON.parse(raw); } catch { return fail(res, 400, "bad_request"); }
    const mode = evt.mode === "live" ? "live" : "test";
    if (!webhookSigned(raw, req.headers["x-vatar-signature"], config.webhookSecrets[mode])) return fail(res, 401, "bad_signature");
    const fresh = db.prepare("INSERT OR IGNORE INTO webhook_events (id, received_at) VALUES (?, ?)").run(String(evt.id), now()).changes;
    send(res, 200, { ok: true }); // answer fast; the purchase is checked with the API next
    if (fresh) await processWebhook(evt);
  }

  function serveStatic(req, res, pathname) {
    const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
    const file = path.normalize(path.join(PUBLIC, rel));
    const ext = path.extname(file);
    if (!file.startsWith(PUBLIC + path.sep) || !TYPES[ext] || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const headers = { "Content-Type": TYPES[ext], "X-Content-Type-Options": "nosniff" };
    if (ext === ".html") Object.assign(headers, pageHeaders, { "Cache-Control": "no-cache" });
    else headers["Cache-Control"] = "public, max-age=300";
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  }

  return async function handle(req, res) {
    const url = new URL(req.url, "http://doingz.local");
    try {
      if (req.method === "POST" && url.pathname === "/api/vatar-webhook") return await webhook(req, res);
      const route = routes[`${req.method} ${url.pathname}`];
      if (route) {
        const body = req.method === "POST" ? await json(req) : {};
        return send(res, 200, await route(req, body, url));
      }
      if ((req.method === "GET" || req.method === "HEAD") && !url.pathname.startsWith("/api/")) return serveStatic(req, res, url.pathname);
      return fail(res, 404, "not_found", "Not found");
    } catch (e) {
      if (res.headersSent) return;
      if (e instanceof G.GameError) return fail(res, e.status, e.code, e.message);
      if (e instanceof VatarError) {
        // Vatar said no: pass on the useful part, never our secret or its details.
        const status = e.status === 404 ? 404 : e.status === 409 ? 409 : e.status >= 500 || e.code === "no_secret" ? 502 : 401;
        return fail(res, status, e.code, e.status >= 500 ? "Lagos Life didn't answer. Try again." : e.message);
      }
      if (e.status) return fail(res, e.status, e.code || "bad_request", e.message);
      log.error(e);
      return fail(res, 500, "error", "Something went wrong on our side");
    }
  };
}
