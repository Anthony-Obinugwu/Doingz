// Talks to the Vatar Games server API. Secrets stay on this server.
import crypto from "node:crypto";

export class VatarError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export function makeVatar({ api, secrets, resultsSecrets = {}, fetchImpl = fetch }) {
  const call = async (mode, path, body, extraHeaders = {}) => {
    const secret = secrets[mode];
    if (!secret) throw new VatarError(500, "no_secret", `No Vatar ${mode} secret is configured`);
    let res;
    try {
      res = await fetchImpl(api + path, {
        method: body ? "POST" : "GET",
        body: body ? JSON.stringify(body) : undefined,
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...extraHeaders },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new VatarError(502, "vatar_unreachable", "Could not reach the Vatar API");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new VatarError(res.status, data.error || "error", data.message);
    return data;
  };

  return {
    verifySession: (mode, session) => call(mode, "/session/verify", { session }),
    getPurchase: (mode, id) => call(mode, `/purchases/${encodeURIComponent(id)}`),
    deliver: (mode, id) => call(mode, `/purchases/${encodeURIComponent(id)}/deliver`, {}),
    getMatch: (mode, id) => call(mode, `/matches/${encodeURIComponent(id)}`),
    /** Posts a friend game's result, signed with the results secret (see the Vatar docs). */
    postResult: (mode, id, nonce, winner, now = Date.now()) => {
      const rs = resultsSecrets[mode];
      if (!rs) throw new VatarError(500, "no_results_secret", `No Vatar ${mode} results secret is configured`);
      const path = `${new URL(api).pathname.replace(/\/$/, "")}/matches/${encodeURIComponent(id)}/result`;
      const body = { winner };
      const raw = JSON.stringify(body);
      const ts = String(Math.floor(now / 1000));
      const sha = crypto.createHash("sha256").update(raw).digest("hex");
      const sig = "v1=" + crypto.createHmac("sha256", rs).update(["POST", path, ts, nonce, sha].join("\n")).digest("hex");
      return call(mode, `/matches/${encodeURIComponent(id)}/result`, body, { "X-Vatar-Timestamp": ts, "X-Vatar-Signature": sig });
    },
  };
}

/** X-Vatar-Signature: "sha256=" + hex HMAC-SHA256 of the raw body, keyed with the webhook signing secret. */
export function webhookSigned(raw, header, secret) {
  if (!secret) return false;
  const want = Buffer.from("sha256=" + crypto.createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(String(header ?? ""));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
