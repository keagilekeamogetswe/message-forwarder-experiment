import { ObjectId } from "mongodb";
import Database from "@/db";

export type MessageEventType = "sent" | "delivered" | "read";

export interface MessageEvent {
  _id?: ObjectId;
  user_id: string;
  recipient_id: string;
  type: Exclude<MessageEventType, "sent">;
  message_uuid: string;
  client_id?: string;
  created_at: number;
}

export interface SendMessageEvent {
  _id?: ObjectId;
  user_id: string;
  type: "sent";
  message_uuid: string;
  client_id?: string; // the id which the client locally generates and assigns to the mess
  created_at: number;
}

export interface ReceiptEvent {
  recipient_id: string;
  message_uuid: string;
  client_id?: string;
}

export interface SentEvent {
  client_id?: string;
  message_uuid: string;
}

export interface MessageEventsPartition {
  sent_items: SentEvent[];
  delivered_items: ReceiptEvent[];
  read_items: ReceiptEvent[];
}

export const MessageEventsRepository = (() => {
  const collection_name = "message_events";

  const getCollection = () =>
    Database.getMongoCollection<MessageEvent | SendMessageEvent>(
      collection_name,
    );

  const persistEvents = async (
    type: Exclude<MessageEventType, "sent">,
    user_id: string,
    message_ids: string[],
    recipient_id: string | null = null,
    client_ids: (string | undefined)[] = [],
  ): Promise<boolean> => {
    if (!message_ids.length) return true;
    if (!recipient_id) return false;

    const collection = await getCollection();

    const result = await collection.insertMany(
      message_ids.map((message_uuid, index) => ({
        user_id,
        recipient_id,
        type,
        message_uuid,
        ...(client_ids[index] ? { client_id: client_ids[index] } : {}),
        created_at: Date.now(),
      })),
    );

    return result.insertedCount === message_ids.length;
  };

  const getAllEvents = async (
    user_id: string,
    limit = 500,
  ): Promise<MessageEventsPartition> => {
    const collection = await getCollection();

    const events = await collection
      .find({
        user_id,
      })
      .sort({
        _id: 1,
      })
      .limit(limit)
      .toArray();

    const result: MessageEventsPartition = {
      sent_items: [],
      delivered_items: [],
      read_items: [],
    };

    for (const event of events) {
      switch (event.type) {
        case "sent":
          result.sent_items.push({
            client_id: event.client_id,
            message_uuid: event.message_uuid,
          });
          break;

        case "delivered":
          result.delivered_items.push({
            recipient_id: event.recipient_id,
            message_uuid: event.message_uuid,
            ...(event.client_id ? { client_id: event.client_id } : {}),
          });
          break;

        case "read":
          result.read_items.push({
            recipient_id: event.recipient_id,
            message_uuid: event.message_uuid,
          });
          break;
      }
    }

    return result;
  };

  return {
    sentItems: {
      async persist(
        user_id: string,
        items: {
          client_id: string;
          message_uuid: string;
        }[],
      ): Promise<boolean> {
        if (!items.length) return true;

        const collection = await getCollection();

        const result = await collection.insertMany(
          items.map((item) => ({
            user_id,
            type: "sent" as const,
            client_id: item.client_id,
            message_uuid: item.message_uuid,
            created_at: Date.now(),
          })),
        );

        return result.insertedCount === items.length;
      },
    },

    deliveredItems: {
      async persist(
        user_id: string,
        message_ids: string[],
        recipient_id: string,
        client_ids?: (string | undefined)[],
      ): Promise<boolean> {
        return persistEvents("delivered", user_id, message_ids, recipient_id, client_ids);
      },
    },

    readItems: {
      async persist(
        user_id: string,
        message_ids: string[],
        recipient_id: string,
      ): Promise<boolean> {
        return persistEvents("read", user_id, message_ids, recipient_id);
      },
    },

    async get(user_id: string, limit = 500): Promise<MessageEventsPartition> {
      return getAllEvents(user_id, limit);
    },

    async acknowledge(event_ids: ObjectId[]): Promise<boolean> {
      if (!event_ids.length) return true;

      const collection = await getCollection();

      const result = await collection.deleteMany({
        _id: {
          $in: event_ids,
        },
      });

      return result.deletedCount === event_ids.length;
    },

    async acknowledgePartition(user_id: string, partition: MessageEventsPartition): Promise<void> {
      const collection = await getCollection();
      const filters = [
        ...partition.sent_items.map((item) => ({ type: "sent", message_uuid: item.message_uuid, client_id: item.client_id })),
        ...partition.delivered_items.map((item) => ({ type: "delivered", message_uuid: item.message_uuid, recipient_id: item.recipient_id, client_id: item.client_id })),
        ...partition.read_items.map((item) => ({ type: "read", message_uuid: item.message_uuid, recipient_id: item.recipient_id })),
      ];
      for (const filter of filters) {
        await collection.deleteOne({ user_id, ...filter } as any);
      }
    },
  };
})();
