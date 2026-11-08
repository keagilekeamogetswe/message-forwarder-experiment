import { WSMessageEventHandler } from "./massage";
import { WSClient } from "./types/ws.client";

export function WSConnectionEvent(ws: WSClient) {
  const user = ws.user;

  if (!user) {
    ws.close();
    return;
  }

  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });
  console.log("Connected:", user.user_id);

  ws.on("message", (data) => {
    WSMessageEventHandler(data, ws);
  });
}
