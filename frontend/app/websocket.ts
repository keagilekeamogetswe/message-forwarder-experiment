export const ClientWebsocketDaemon = (() => {
  const websocketUrl = "ws://localhost:4000/ws";

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let connecting = false;
  let connectionAttempt = 0;

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
    connecting = true;
    const attempt = ++connectionAttempt;

    try {
      const tokenResponse = await fetch("/ws-access-token.json", {
        cache: "no-store",
      });
      if (!tokenResponse.ok) {
        throw new Error(`Test access token request failed (${tokenResponse.status})`);
      }
      const { token } = (await tokenResponse.json()) as { token: string };

      const cookieResponse = await fetch("/wsaccess", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!cookieResponse.ok) {
        const details = (await cookieResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          details?.error ??
            `WebSocket access cookie request failed (${cookieResponse.status})`,
        );
      }

      if (stopped || attempt !== connectionAttempt) return;

      ws = new WebSocket(websocketUrl);
    } catch (error) {
      connecting = false;
      console.error("[WS] Could not prepare authenticated connection", error);
      scheduleReconnect();
      return;
    }

    let ready = false;
    let readyTimeout: ReturnType<typeof setTimeout> | null = null;

    ws.onopen = () => {
      connecting = false;
      console.log("[WS] Connected");
      readyTimeout = setTimeout(() => {
        if (!ready) {
          console.error("[WS] Timed out waiting for message_events retrive");
        }
      }, 5000);
    };

    ws.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(String(event.data));
      } catch (error) {
        console.error("[WS] Received invalid JSON", event.data, error);
        return;
      }

      console.log("[WS] Message", payload);

      if (
        typeof payload === "object" &&
        payload !== null &&
        "channel" in payload &&
        payload.channel === "message_events" &&
        "action" in payload &&
        payload.action === "retrive"
      ) {
        ready = true;
        if (readyTimeout) clearTimeout(readyTimeout);
        console.log("[WS] Ready to receive messages");
      }
    };

    ws.onerror = (error) => {
      console.error("[WS] Error", error);
    };

    ws.onclose = () => {
      connecting = false;
      console.log("[WS] Disconnected");
      if (readyTimeout) clearTimeout(readyTimeout);
      ws = null;
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (!stopped && !reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, 3000);
    }
  }

  return {
    start() {
      stopped = false;
      void connect();
    },

    stop() {
      stopped = true;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      connectionAttempt += 1;
      ws?.close();
      ws = null;
      connecting = false;
    },

    send(data: unknown) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket not connected");
      }

      ws.send(JSON.stringify(data));
    },

    getSocket() {
      return ws;
    },
  };
})();
