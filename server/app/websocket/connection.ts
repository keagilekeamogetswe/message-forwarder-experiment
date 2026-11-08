import { WSMessageEventHandler } from "./massage";
import { WSClient } from "./types/ws.client";
import { ClientRegistry } from "./services/client.registry";

export function WSConnectionEvent(ws: WSClient) {
  const user = ws.user;

  if (!user) {
    ws.close();
    return;
  }

  ws.isAlive = true;
  ClientRegistry.add(ws);

  ws.on("pong", () => {
    ws.isAlive = true;
  });
  console.log("Connected:", user.user_id);

  ws.on("message", (data) => {
    WSMessageEventHandler(data, ws);
  });

  ws.on("close", () => {
    ws.close();
    ClientRegistry.remove(ws);
  });
}
