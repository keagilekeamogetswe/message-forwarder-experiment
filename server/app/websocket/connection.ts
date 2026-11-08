import { WSMessageEventHandler } from "./massage";
import { WebSocket } from "ws";
import { IncomingMessage } from "http";

export function WSConnectionEvent(ws: WebSocket, req: IncomingMessage) {
  const user = (req as any).user;

  if (!user) {
    ws.close();
    return;
  }

  console.log("Connected:", user.user_id);

  ws.on("message", (data) => {
    WSMessageEventHandler(data, ws);
  });
}
