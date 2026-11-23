export type IncomingWebSocketMessage = {
  channel: string;
  action: string;
  payload?: unknown;
};

export type WebSocketMessageHandler = (
  message: IncomingWebSocketMessage,
) => void;

type ClientChannel = {
  actions: Record<string, Set<WebSocketMessageHandler>>;
};

// Mirrors the server's channel -> actions dispatch table. Components can
// register handlers without coupling themselves to the socket implementation.
const ChannelRegistry: Record<string, ClientChannel> = Object.create(null);

function normalizeMessage(value: unknown): IncomingWebSocketMessage | null {
  if (!value || typeof value !== "object") return null;

  const message = value as Record<string, unknown>;
  if (typeof message.channel === "string" && typeof message.action === "string") {
    return message as IncomingWebSocketMessage;
  }

  // The server forwards chat messages as MessageStruct objects rather than
  // wrapping them in a channel/action envelope.
  if (
    typeof message.message_uuid === "string" &&
    typeof message.sender_id === "string"
  ) {
    return { channel: "chat", action: "message", payload: message };
  }

  if (message.success === false && typeof message.message === "string") {
    return { channel: "system", action: "error", payload: message };
  }

  return null;
}

export function registerWebSocketHandler(
  channel: string,
  action: string,
  handler: WebSocketMessageHandler,
): () => void {
  const channelEntry = (ChannelRegistry[channel] ??= {
    actions: Object.create(null),
  });
  const handlers = (channelEntry.actions[action] ??= new Set());
  handlers.add(handler);

  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) delete channelEntry.actions[action];
    if (Object.keys(channelEntry.actions).length === 0) delete ChannelRegistry[channel];
  };
}

export function dispatchWebSocketMessage(
  value: unknown,
): IncomingWebSocketMessage | null {
  const message = normalizeMessage(value);
  if (!message) {
    console.warn("[WS] Received a message without a channel/action", value);
    return null;
  }

  const handlers = ChannelRegistry[message.channel]?.actions[message.action];
  if (!handlers) return message;

  for (const handler of [...handlers]) {
    try {
      handler(message);
    } catch (error) {
      console.error(
        `[WS] Handler failed for ${message.channel}.${message.action}`,
        error,
      );
    }
  }

  return message;
}
