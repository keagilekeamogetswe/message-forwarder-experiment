import { WebSocketServer } from "ws";
import { WSClient } from "@/websocket/types/ws.client";

export function startHeartbeat(wss: WebSocketServer): void {
  const timeout = parseInt(
    process.env.WEBSOCKET_HEARTBEAT_TIMEOUT ?? "30000",
    10,
  );

  const interval = setInterval(() => {
    for (const client of wss.clients) {
      const ws = client as WSClient;

      if (!ws.isAlive) {
        console.log(`Heartbeat timeout. Closing user ${ws.user.user_id}`);

        ws.terminate();
        continue;
      }

      ws.isAlive = false;
      ws.ping();
    }
  }, timeout);

  wss.on("close", () => {
    clearInterval(interval);
  });
}
