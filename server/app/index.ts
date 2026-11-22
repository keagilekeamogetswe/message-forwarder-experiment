import express from "express";
import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";

import { AuthMiddleware } from "./middleware/authentication";
import { WSUpgradeEvent } from "./websocket/upgrade";
import { WSConnectionEvent } from "./websocket/connection";
import { WSClient } from "./websocket/types/ws.client";
import { startHeartbeat } from "./websocket/heartbeat";
import { WSAccessRoute } from "./ws.access.token.route";
import { connectRedis } from "./redis";

const app = express();

app.use(express.json());
app.use(AuthMiddleware);
app.use(WSAccessRoute);

const useHttps = process.env.HTTPS_ENABLED === "true";
const tlsDirectory = path.join(
  process.cwd(),
  "server",
  "app",
  "config",
  "tls",
  "certs",
);
const server = useHttps
  ? https.createServer(
      {
        key: readFileSync(path.join(tlsDirectory, "dev-key.pem")),
        cert: readFileSync(path.join(tlsDirectory, "dev-cert.pem")),
      },
      app,
    )
  : http.createServer(app);

const wss = new WebSocketServer({
  noServer: true,
});

server.on("upgrade", (req, socket, head) => {
  WSUpgradeEvent(req, socket, head, wss);
});
wss.on("connection", (ws) => WSConnectionEvent(ws as WSClient));

const HTTP_PORT = Number(process.env.HTTP_PORT ?? 3000);

try {
  await connectRedis();
} catch (error) {
  console.error("Unable to connect to Redis; server startup aborted:", error);
  process.exit(1);
}

startHeartbeat();
server.listen(HTTP_PORT, () => {
  console.log(
    `${useHttps ? "HTTPS + WSS" : "HTTP + WS"} listening on :${HTTP_PORT}`,
  );
});
