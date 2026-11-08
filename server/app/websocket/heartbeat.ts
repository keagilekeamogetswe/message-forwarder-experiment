import { ClientRegistry } from "./services/client.registry";

export function startHeartbeat() {
  const timeout = parseInt(
    process.env.WEBSOCKET_HEARTBEAT_TIMEOUT ?? "30000",
    10,
  );

  setInterval(() => {
    for (const ws of ClientRegistry.all().values()) {
      if (!ws.isAlive) {
        console.log(`Heartbeat timeout. Closing user ${ws.user.user_id}`);

        ClientRegistry.remove(ws);
        ws.terminate();

        continue;
      }

      ws.isAlive = false;
      ws.ping();
    }
  }, timeout);
}
