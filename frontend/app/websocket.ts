import {
  dispatchWebSocketMessage,
  registerWebSocketHandler,
  type WebSocketMessageHandler,
} from "./websocket.channels";

export const ClientWebsocketDaemon = (() => {
  const websocketUrl = "ws://localhost:4000/ws";

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let connecting = false;
  let connectionAttempt = 0;
  let requestedUserId: string | null = null;

  function emitConnectionStatus(state: string, userId = requestedUserId) {
    dispatchWebSocketMessage({
      channel: "system",
      action: "connection",
      payload: { state, user_id: userId },
    });
  }

  async function connect() {
    if (typeof window === "undefined") {
      return;
    }

    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (connecting) return;
    const userId = requestedUserId;
    if (!userId) return;
    connecting = true;
    const attempt = ++connectionAttempt;

    try {
      const tokenResponse = await fetch("/ws-access-token.json", {
        cache: "no-store",
      });
      if (!tokenResponse.ok) {
        throw new Error(
          `Test access token request failed (${tokenResponse.status})`,
        );
      }
      const { token } = (await tokenResponse.json()) as { token: string };

      const accessUrl = new URL("/wsaccess", window.location.origin);
      accessUrl.searchParams.set("test_user_id", userId);
      const cookieResponse = await fetch(accessUrl, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!cookieResponse.ok) {
        const details = (await cookieResponse.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          details?.error ??
            `WebSocket access cookie request failed (${cookieResponse.status})`,
        );
      }

      if (stopped || attempt !== connectionAttempt) return;

      const socket = new WebSocket(websocketUrl);
      ws = socket;

      let ready = false;
      let readyTimeout: ReturnType<typeof setTimeout> | null = null;

      socket.onopen = () => {
        connecting = false;
        console.log("[WS] Connected as", userId);
        emitConnectionStatus("connected", userId);
        readyTimeout = setTimeout(() => {
          if (!ready) {
            console.error("[WS] Timed out waiting for message_events retrive");
          }
        }, 5000);
      };

      socket.onmessage = (event) => {
        let payload: unknown;
        try {
          payload = JSON.parse(String(event.data));
        } catch (error) {
          console.error("[WS] Received invalid JSON", event.data, error);
          return;
        }

        const message = dispatchWebSocketMessage(payload);
        if (
          message?.channel === "message_events" &&
          message.action === "retrive"
        ) {
          ready = true;
          if (readyTimeout) clearTimeout(readyTimeout);
          emitConnectionStatus("ready", userId);
          console.log("[WS] Ready to receive messages");
        }
      };

      socket.onerror = (error) => {
        console.error("[WS] Error", error);
        dispatchWebSocketMessage({
          channel: "system",
          action: "error",
          payload: { message: "WebSocket transport error" },
        });
      };

      socket.onclose = () => {
        if (readyTimeout) clearTimeout(readyTimeout);
        if (ws !== socket) return;
        connecting = false;
        ws = null;
        console.log("[WS] Disconnected");
        emitConnectionStatus("disconnected", userId);
        scheduleReconnect();
      };
    } catch (error) {
      if (attempt !== connectionAttempt) return;
      connecting = false;
      console.error("[WS] Could not prepare authenticated connection", error);
      dispatchWebSocketMessage({
        channel: "system",
        action: "error",
        payload: {
          message:
            error instanceof Error
              ? error.message
              : "WebSocket connection failed",
        },
      });
      emitConnectionStatus("error", userId);
      scheduleReconnect();
      return;
    }
  }

  function scheduleReconnect() {
    if (!stopped && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, 3000);
    }
  }

  function stopConnection() {
    stopped = true;
    requestedUserId = null;

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    connectionAttempt += 1;
    const currentSocket = ws;
    ws = null;
    currentSocket?.close();
    connecting = false;
    emitConnectionStatus("disconnected");
  }

  return {
    start(userId: string) {
      const normalizedUserId = userId.trim();
      if (!normalizedUserId) {
        throw new Error("Enter a user ID before connecting");
      }
      if (requestedUserId && requestedUserId !== normalizedUserId) {
        stopConnection();
      }
      requestedUserId = normalizedUserId;
      stopped = false;
      emitConnectionStatus("connecting", normalizedUserId);
      void connect();
    },

    stop() {
      stopConnection();
    },

    send(data: unknown) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
      }

      ws.send(JSON.stringify(data));
    },

    on(channel: string, action: string, handler: WebSocketMessageHandler) {
      return registerWebSocketHandler(channel, action, handler);
    },

    getSocket() {
      return ws;
    },
  };
})();
