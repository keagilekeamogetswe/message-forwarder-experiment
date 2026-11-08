import { WSClient } from "@/websocket/types/ws.client";

export const ClientRegistry = (() => {
  const clients = new Map<string, WSClient>();

  return {
    add(ws: WSClient) {
      if (!ws.user) return;

      clients.set(ws.user.user_id, ws);
    },

    remove(ws: WSClient) {
      if (!ws.user) return;

      clients.delete(ws.user.user_id);
    },

    get(userId: string) {
      return clients.get(userId);
    },

    all() {
      return clients;
    },

    size() {
      return clients.size;
    },
  };
})();
