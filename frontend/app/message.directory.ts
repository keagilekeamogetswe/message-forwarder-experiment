export type MessageState =
  "sending" | "sent" | "delivered" | "read" | "received" | "failed";

export type MessageRecipientType = "primary" | "group" | "room";

export type MessageDirectoryItem = {
  key: string;
  message_uuid?: string;
  client_id: string;
  bulk_id?: string;
  conversation_id: string;
  recipient_id: string;
  recipient_type: MessageRecipientType;
  sender_id: string;
  caption: string;
  media_uploads: string[];
  reply_to?: string;
  direction: "incoming" | "outgoing";
  state: MessageState;
  state_at: string;
  error?: string;
  created_at: number;
};

export type ChatSummary = {
  id: string;
  title: string;
  recipient_type: MessageRecipientType;
  last_message?: MessageDirectoryItem;
  message_count: number;
};

type MessageStateListener = (message: MessageDirectoryItem) => void;

export type IncomingChatMessage = {
  message_uuid: string;
  sender_id: string;
  recipient_id: string;
  recipient_type?: MessageRecipientType;
  client_id?: string;
  bulk_id?: string;
  caption?: string;
  media_uploads?: string[];
  reply_to?: string;
};

type OutgoingMessage = {
  recipient_id: string;
  caption: string;
  media_uploads: string[];
  client_id: string;
  reply_to?: string;
};

const messagesByConversation = new Map<
  string,
  Map<string, MessageDirectoryItem>
>();
const messagesByKey = new Map<string, MessageDirectoryItem>();
const keyByMessageUuid = new Map<string, string>();
const keyByClientId = new Map<string, string>();
const repliesByMessageUuid = new Map<string, Set<string>>();
const inboxListeners = new Set<() => void>();
const messageEventListeners = new Set<MessageStateListener>();
const messageListeners = new Map<string, Set<MessageStateListener>>();
let currentUserId: string | null = null;
let sequence = 0;

function recipientPrefix(type: MessageRecipientType): string {
  switch (type) {
    case "room":
      return "@";
    case "group":
      return "$";
    default:
      return "#";
  }
}

function parseRecipient(value: string): {
  type: MessageRecipientType;
  id: string;
  prefixed: string;
} {
  const prefix = value.charAt(0);
  const type: MessageRecipientType =
    prefix === "@" ? "room" : prefix === "$" ? "group" : "primary";
  const id = value.slice(1).trim();
  if (!id || !["@", "#", "$"].includes(prefix)) {
    throw new Error("Recipient must start with @, #, or $ and include an ID");
  }
  return { type, id, prefixed: `${recipientPrefix(type)}${id}` };
}

function conversationForIncoming(message: IncomingChatMessage) {
  const type = message.recipient_type ?? "primary";
  const peerId =
    type === "primary" && message.sender_id !== currentUserId
      ? message.sender_id
      : message.recipient_id;
  const id = `${recipientPrefix(type)}${peerId}`;
  return { id, type };
}

function addItem(item: MessageDirectoryItem): void {
  const conversation =
    messagesByConversation.get(item.conversation_id) ??
    new Map<string, MessageDirectoryItem>();
  conversation.set(item.key, item);
  messagesByConversation.set(item.conversation_id, conversation);
  messagesByKey.set(item.key, item);
  keyByClientId.set(item.client_id, item.key);
  if (item.message_uuid) keyByMessageUuid.set(item.message_uuid, item.key);
  if (item.reply_to) {
    const children =
      repliesByMessageUuid.get(item.reply_to) ?? new Set<string>();
    children.add(item.key);
    repliesByMessageUuid.set(item.reply_to, children);
  }
  notifyItem(item, false);
  notifyInbox();
}

function notifyItem(item: MessageDirectoryItem, isMessageEvent: boolean): void {
  messageListeners.get(item.key)?.forEach((listener) => listener(item));
  if (isMessageEvent) {
    messageEventListeners.forEach((listener) => listener(item));
  }
}

function notifyInbox(): void {
  inboxListeners.forEach((listener) => listener());
}

function setCurrentUser(userId: string): void {
  if (currentUserId === userId) return;
  currentUserId = userId;
  sequence = 0;
  messagesByConversation.clear();
  messagesByKey.clear();
  keyByMessageUuid.clear();
  keyByClientId.clear();
  repliesByMessageUuid.clear();
  messageListeners.clear();
  notifyInbox();
}

function linkMessageUuid(
  clientId: string | undefined,
  messageUuid: string,
): void {
  const key = clientId ? keyByClientId.get(clientId) : undefined;
  const message = key ? messagesByKey.get(key) : undefined;
  if (!message) return;
  message.message_uuid = messageUuid;
  keyByMessageUuid.set(messageUuid, key!);
}

function updateState(
  identifier: string,
  state: MessageState,
  at = new Date().toISOString(),
  error?: string,
): void {
  const key = keyByMessageUuid.get(identifier) ?? keyByClientId.get(identifier);
  const item = key ? messagesByKey.get(key) : undefined;
  if (!item) return;

  const rank: Record<MessageState, number> = {
    sending: 0,
    sent: 1,
    received: 1,
    delivered: 2,
    read: 3,
    failed: 4,
  };
  if (
    item.state === "failed" ||
    item.state === "read" ||
    rank[state] < rank[item.state]
  ) {
    return;
  }

  item.state = state;
  item.state_at = at;
  if (state === "failed") item.error = error;
  notifyItem(item, true);
}

export const MessageDirectoryService = {
  setCurrentUser(userId: string): void {
    setCurrentUser(userId);
  },

  addIncomingMessage(message: IncomingChatMessage): void {
    if (!currentUserId || keyByMessageUuid.has(message.message_uuid)) return;
    const { id, type } = conversationForIncoming(message);
    sequence += 1;
    const now = Date.now();
    const key = message.message_uuid;
    addItem({
      key,
      message_uuid: message.message_uuid,
      client_id: message.client_id ?? message.message_uuid,
      bulk_id: message.bulk_id,
      conversation_id: id,
      recipient_id: id,
      recipient_type: type,
      sender_id: message.sender_id,
      caption: message.caption ?? "",
      media_uploads: message.media_uploads ?? [],
      reply_to: message.reply_to,
      direction: "incoming",
      state: "received",
      state_at: new Date(now).toISOString(),
      created_at: now + sequence / 1_000_000,
    });
  },

  addOutgoingMessage(
    userId: string,
    message: OutgoingMessage,
  ): MessageDirectoryItem {
    setCurrentUser(userId);
    const recipient = parseRecipient(message.recipient_id);
    sequence += 1;
    const now = Date.now();
    const item: MessageDirectoryItem = {
      key: message.client_id,
      client_id: message.client_id,
      conversation_id: recipient.prefixed,
      recipient_id: recipient.prefixed,
      recipient_type: recipient.type,
      sender_id: userId,
      caption: message.caption,
      media_uploads: message.media_uploads,
      reply_to: message.reply_to,
      direction: "outgoing",
      state: "sending",
      state_at: new Date(now).toISOString(),
      created_at: now + sequence / 1_000_000,
    };
    addItem(item);
    return item;
  },

  updateMessageState(
    identifier: string,
    state: MessageState,
    at?: string | null,
    error?: string,
  ): void {
    updateState(identifier, state, at ?? new Date().toISOString(), error);
  },

  updateSentItem(item: {
    client_id?: string;
    message_uuid: string;
    sent_at?: string | null;
  }): void {
    linkMessageUuid(item.client_id, item.message_uuid);
    updateState(item.message_uuid, "sent", item.sent_at ?? undefined);
  },

  updateDeliveredItem(item: {
    client_id?: string;
    message_uuid: string;
    delivered_at?: string | null;
  }): void {
    linkMessageUuid(item.client_id, item.message_uuid);
    updateState(item.message_uuid, "delivered", item.delivered_at ?? undefined);
  },

  subscribeToMessageEvent(listener: MessageStateListener): () => void {
    messageEventListeners.add(listener);
    return () => messageEventListeners.delete(listener);
  },

  subscribeToMessageInbox(listener: () => void): () => void {
    inboxListeners.add(listener);
    return () => inboxListeners.delete(listener);
  },

  subscribeToMessageItem(
    keyOrUuid: string,
    listener: MessageStateListener,
  ): () => void {
    const key = keyByMessageUuid.get(keyOrUuid) ?? keyOrUuid;
    const listeners =
      messageListeners.get(key) ?? new Set<MessageStateListener>();
    listeners.add(listener);
    messageListeners.set(key, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) messageListeners.delete(key);
    };
  },

  getChats(): ChatSummary[] {
    return [...messagesByConversation.entries()]
      .map(([id, messages]) => {
        const items = [...messages.values()].sort(
          (a, b) => a.created_at - b.created_at,
        );
        const last_message = items.at(-1);
        return {
          id,
          title: id.slice(1),
          recipient_type: last_message?.recipient_type ?? "primary",
          last_message,
          message_count: items.length,
        };
      })
      .sort(
        (a, b) =>
          (b.last_message?.created_at ?? 0) - (a.last_message?.created_at ?? 0),
      );
  },

  getMessages(conversationId: string): MessageDirectoryItem[] {
    return [
      ...(messagesByConversation.get(conversationId)?.values() ?? []),
    ].sort((a, b) => a.created_at - b.created_at);
  },

  getMessage(keyOrUuid: string): MessageDirectoryItem | undefined {
    const key = keyByMessageUuid.get(keyOrUuid) ?? keyOrUuid;
    return messagesByKey.get(key);
  },

  getReplies(messageUuid: string): MessageDirectoryItem[] {
    return [...(repliesByMessageUuid.get(messageUuid) ?? [])]
      .map((key) => messagesByKey.get(key))
      .filter((message): message is MessageDirectoryItem => Boolean(message));
  },
};
