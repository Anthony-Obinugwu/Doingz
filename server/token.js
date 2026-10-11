// Doingz's own player token. We check a Vatar session once (POST /session/verify),
// then hand the phone this signed token, so every guess doesn't spend a Vatar API call
// (the API allows 600 calls a minute per game). Cookies don't work inside the frame.
import crypto from "node:crypto";

const TTL = 12 * 60 * 60 * 1000;

const sign = (secret, body) => crypto.createHmac("sha256", secret).update(body).digest("base64url");

export function issueToken(secret, playerId, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ pid: playerId, exp: now + TTL })).toString("base64url");
  return `${body}.${sign(secret, body)}`;
}

export function readToken(secret, token, now = Date.now()) {
  if (typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = Buffer.from(sign(secret, body));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const { pid, exp } = JSON.parse(Buffer.from(body, "base64url").toString());
    return typeof pid === "string" && exp > now ? pid : null;
  } catch {
    return null;
  }
}
