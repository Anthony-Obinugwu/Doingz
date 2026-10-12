// Doingz server: `npm start` (Node 22.13 or newer, no packages to install).
import http from "node:http";
import { config } from "./config.js";
import { openDb } from "./db.js";
import { makeVatar } from "./vatar.js";
import { createApp } from "./app.js";

const db = openDb(config.dataDir);
const vatar = makeVatar({ api: config.vatarApi, secrets: config.secrets, resultsSecrets: config.resultsSecrets });
const handle = createApp({ config, db, vatar });

const server = http.createServer(handle);
server.listen(config.port, () => {
  const modes = ["test", "live"].filter((m) => config.secrets[m]).join(" + ") || "none (set VATAR_SECRET_TEST)";
  console.log(`Doingz on :${config.port} · Vatar keys: ${modes}${config.devAuth ? " · DEV_AUTH on" : ""}`);
});

const stop = () => server.close(() => { db.close(); process.exit(0); });
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
