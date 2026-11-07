import { WSMessageEventHandler } from "./massage";

import { WebSocket } from "ws";
import { IncomingMessage } from "http";

export function WSConnectionEvent(ws: WebSocket, req: IncomingMessage) {
  const user = (req as any).user;

  console.log("Connected:", user.user_id);

  ws.on("message", (data) => {
    WSMessageEventHandler(data, ws);
  });
}
