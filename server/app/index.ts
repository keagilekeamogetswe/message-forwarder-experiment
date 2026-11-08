import express from "express";
import http from "node:http";
import { WebSocketServer } from "ws";

import { AuthMiddleware } from "./middleware/authentication";
import { WSUpgradeEvent } from "./websocket/upgrade";
import { WSConnectionEvent } from "./websocket/connection";
import { startHeartbeat } from "./websocket/heartbeat";

const app = express();

app.use(express.json());
app.use(AuthMiddleware);

const server = http.createServer(app);

const wss = new WebSocketServer({
  noServer: true,
});

server.on("upgrade", (req, socket, head) => {
  WSUpgradeEvent(req, socket, head, wss);
});
// Start heartbeat
startHeartbeat(wss);
wss.on("connection", WSConnectionEvent);

const HTTP_PORT = Number(process.env.HTTP_PORT ?? 3000);

server.listen(HTTP_PORT, () => {
  console.log(`HTTP + WS listening on :${HTTP_PORT}`);
});
