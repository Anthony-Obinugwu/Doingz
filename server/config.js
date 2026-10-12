// All settings come from environment variables. See .env.example.
import crypto from "node:crypto";

const env = process.env;
const production = env.NODE_ENV === "production";

const appSecret = env.APP_SECRET || (production ? "" : "dev-only-app-secret-change-me");
if (production && appSecret.length < 32) {
  throw new Error("APP_SECRET must be set to a random string of at least 32 characters in production.");
}

export const config = {
  production,
  port: Number(env.PORT || 8080),
  dataDir: env.DATA_DIR || "./data",
  appSecret,
  vatarApi: (env.VATAR_API || "https://lagoslife.app/api/games/v1").replace(/\/$/, ""),
  secrets: {
    test: env.VATAR_SECRET_TEST || "",
    live: env.VATAR_SECRET_LIVE || "",
  },
  // Signs friend-game results sent to Lagos Life (shown with your keys as the results secret).
  resultsSecrets: {
    test: env.VATAR_RESULTS_SECRET_TEST || "",
    live: env.VATAR_RESULTS_SECRET_LIVE || "",
  },
  webhookSecrets: {
    test: env.VATAR_WEBHOOK_SECRET_TEST || "",
    live: env.VATAR_WEBHOOK_SECRET_LIVE || "",
  },
  // A local player for testing outside Lagos Life. Never allowed in production.
  devAuth: !production && env.DEV_AUTH === "1",
  frameAncestors: (env.FRAME_ANCESTORS ||
    "https://lagoslife.app https://www.lagoslife.app https://naijalife.app https://www.naijalife.app https://lagoslife.eliysites.com").trim(),
  // How many proxies sit in front of this server (1 on Render, Railway, Fly). 0 = use the socket address.
  trustProxyHops: Number(env.TRUST_PROXY_HOPS ?? 1),
  // Day 1 of Doingz, as a Lagos calendar date.
  launchDate: env.LAUNCH_DATE || "2026-10-11",
};

// Which Vatar mode a per-game player id belongs to.
export const modeOf = (playerId) =>
  playerId.startsWith("p_") ? "live" : playerId.startsWith("t_") ? "test" : playerId.startsWith("d_") ? "dev" : null;

export const randomId = (n = 12) => crypto.randomBytes(n).toString("base64url");
