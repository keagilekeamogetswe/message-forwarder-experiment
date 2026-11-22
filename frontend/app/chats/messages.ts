export interface MessageItem {
  caption: string;
  media_uploads: string[];

  // Timestamp when the server confirmed acceptance of the message.
  // Null indicates the message is still pending transmission.
  sent_at: string | null;

  // Timestamp when the recipient's device acknowledged delivery.
  delivered_at: string | null;

  // Timestamp when the recipient read the message.
  read_at: string | null;

  // Client-generated identifier used to correlate a locally-created
  // message with the server "sent" acknowledgement.
  client_id?: string;

  // Server-generated identifier used for all future messaging events.
  uuid: string;
}

export interface MessageEventProps {
  // Lifecycle event being acknowledged by the server.
  type: "sent" | "delivered" | "read";

  // Server message identifier.
  message_uuid: string;

  // User for whom the event occurred.
  recipient_id: string;

  // Event completion timestamp.
  done_at: string;

  // Required only for "sent" acknowledgements so the locally-created
  // message can be correlated with its newly-issued message_uuid.
  client_id?: string;
}

export const MessagesServices = (() => {
  // Conversation store keyed by recipient/user identifier.
  const chats = new Map<string, MessageItem[]>();

  // Fast lookup for locally-created messages awaiting a "sent" ack.
  const messageByClientId = new Map<string, MessageItem>();

  // Fast lookup for server-acknowledged messages.
  const messageByUuid = new Map<string, MessageItem>();

  return {
    getChats() {
      return chats;
    },

    addItem(recipient_id: string, messageItem: MessageItem): MessageItem {
      const currentMessages = chats.get(recipient_id) ?? [];

      currentMessages.push(messageItem);

      chats.set(recipient_id, currentMessages);

      // Register client-side lookup for pending acknowledgements.
      if (messageItem.client_id) {
        messageByClientId.set(messageItem.client_id, messageItem);
      }

      // Register server-side lookup if a server UUID already exists.
      if (messageItem.uuid) {
        messageByUuid.set(messageItem.uuid, messageItem);
      }

      return messageItem;
    },

    getChat(recipient_id: string) {
      return chats.get(recipient_id) ?? [];
    },

    messageEventFeedback(message_event_item: MessageEventProps): MessageItem {
      switch (message_event_item.type) {
        case "sent": {
          const clientId = message_event_item.client_id;

          // A "sent" acknowledgement must provide the originating
          // client_id so the pending message can be located.
          if (!clientId) {
            throw new Error("Sent event requires client_id");
          }

          const message = messageByClientId.get(clientId);

          if (!message) {
            throw new Error(`Message not found for client_id '${clientId}'`);
          }

          // Preserve the previous UUID mapping in case a temporary
          // placeholder UUID was used before acknowledgement.
          const previousUuid = message.uuid;

          // Promote the message to its permanent server identity.
          message.uuid = message_event_item.message_uuid;

          // Mark the message as accepted by the server.
          message.sent_at = message_event_item.done_at;

          if (previousUuid) {
            messageByUuid.delete(previousUuid);
          }

          // Register future event lookups using the server UUID.
          messageByUuid.set(message_event_item.message_uuid, message);

          return message;
        }

        case "delivered": {
          // Delivery events are resolved using the server UUID.
          const message = messageByUuid.get(message_event_item.message_uuid);

          if (!message) {
            throw new Error(
              `Message not found for uuid '${message_event_item.message_uuid}'`,
            );
          }

          // Mark the message as delivered to the recipient.
          message.delivered_at = message_event_item.done_at;

          return message;
        }

        case "read": {
          // Read events are resolved using the server UUID.
          const message = messageByUuid.get(message_event_item.message_uuid);

          if (!message) {
            throw new Error(
              `Message not found for uuid '${message_event_item.message_uuid}'`,
            );
          }

          // Mark the message as read by the recipient.
          message.read_at = message_event_item.done_at;

          return message;
        }

        default:
          throw new Error(
            `Unsupported event type '${(message_event_item as any).type}'`,
          );
      }
    },

    clear() {
      // Reset all in-memory state.
      chats.clear();
      messageByClientId.clear();
      messageByUuid.clear();
    },
  };
})();
