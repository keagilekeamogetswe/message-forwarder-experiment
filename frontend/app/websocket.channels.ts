import {
  MessageDirectoryService,
  type IncomingChatMessage,
} from "./message.directory";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMessageEvent(value: unknown): value is {
  message_uuid: string;
  client_id?: string;
  sent_at?: string | null;
  delivered_at?: string | null;
  read_at?: string | null;
} {
  return isRecord(value) && typeof value.message_uuid === "string";
}

function normalizeMessage(value: unknown): IncomingWebSocketMessage | null {
  if (!value || typeof value !== "object") return null;

  const message = value as Record<string, unknown>;
  if (
    typeof message.channel === "string" &&
    typeof message.action === "string"
  ) {
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
    if (Object.keys(channelEntry.actions).length === 0)
      delete ChannelRegistry[channel];
  };
}

registerWebSocketHandler("chat", "message", ({ payload }) => {
  if (
    isRecord(payload) &&
    typeof payload.message_uuid === "string" &&
    typeof payload.sender_id === "string" &&
    typeof payload.recipient_id === "string"
  ) {
    MessageDirectoryService.addIncomingMessage(
      payload as unknown as IncomingChatMessage,
    );
  }
});

registerWebSocketHandler("chat", "sent_items", ({ payload }) => {
  if (!Array.isArray(payload)) return;
  for (const item of payload) {
    if (isMessageEvent(item)) MessageDirectoryService.updateSentItem(item);
  }
});

registerWebSocketHandler("chat", "delivered_items", ({ payload }) => {
  if (!Array.isArray(payload)) return;
  for (const item of payload) {
    if (isMessageEvent(item)) {
      MessageDirectoryService.updateDeliveredItem(item);
    }
  }
});

registerWebSocketHandler("chat", "read_items", ({ payload }) => {
  if (!Array.isArray(payload)) return;
  for (const item of payload) {
    if (isMessageEvent(item)) {
      MessageDirectoryService.updateMessageState(
        item.message_uuid,
        "read",
        item.read_at,
      );
    }
  }
});

registerWebSocketHandler("message_events", "retrive", ({ payload }) => {
  if (!isRecord(payload)) return;
  const sentItems = payload.sent_items;
  if (Array.isArray(sentItems)) {
    for (const item of sentItems) {
      if (isMessageEvent(item)) MessageDirectoryService.updateSentItem(item);
    }
  }
  const deliveredItems = payload.delivered_items;
  if (Array.isArray(deliveredItems)) {
    for (const item of deliveredItems) {
      if (isMessageEvent(item)) {
        MessageDirectoryService.updateDeliveredItem(item);
      }
    }
  }
  const readItems = payload.read_items;
  if (Array.isArray(readItems)) {
    for (const item of readItems) {
      if (isMessageEvent(item)) {
        MessageDirectoryService.updateMessageState(
          item.message_uuid,
          "read",
          item.read_at,
        );
      }
    }
  }
});

registerWebSocketHandler("chat", "bulk_sent", ({ payload }) => {
  if (!isRecord(payload) || !Array.isArray(payload.results)) return;
  for (const result of payload.results) {
    if (!isRecord(result) || typeof result.message_uuid !== "string") continue;
    MessageDirectoryService.updateMessageState(
      result.message_uuid,
      result.status === "failed" ? "failed" : "sent",
    );
  }
});

registerWebSocketHandler("system", "error", ({ payload }) => {
  if (!isRecord(payload) || typeof payload.client_id !== "string") return;
  MessageDirectoryService.updateMessageState(
    payload.client_id,
    "failed",
    new Date().toISOString(),
    typeof payload.message === "string" ? payload.message : "Message failed",
  );
});

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
