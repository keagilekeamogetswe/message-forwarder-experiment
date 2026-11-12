import { ObjectId } from "mongodb";
import Database from "@/db";

export type MessageEventType = "sent" | "delivered" | "read";

export interface MessageEvent {
  _id?: ObjectId;
  user_id: string;
  type: MessageEventType;
  message_uuid: string;
  client_id?: string;
  created_at: number;
}

export interface MessageEventsPartition {
  sent_items: (MessageEvent & {
    _id: ObjectId;
  })[];

  delivered_items: (MessageEvent & {
    _id: ObjectId;
  })[];

  read_items: (MessageEvent & {
    _id: ObjectId;
  })[];
}

export const MessageEventsRepository = (() => {
  const collection_name = "message_events";

  const getCollection = () =>
    Database.getMongoCollection<MessageEvent>(collection_name);

  const persistEvents = async (
    type: Exclude<MessageEventType, "sent">,
    user_id: string,
    message_ids: string[],
  ): Promise<boolean> => {
    if (!message_ids.length) return true;

    const collection = await getCollection();

    const result = await collection.insertMany(
      message_ids.map((message_uuid) => ({
        user_id,
        type,
        message_uuid,
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

    const events = (await collection
      .find({
        user_id,
      })
      .sort({
        _id: 1,
      })
      .limit(limit)
      .toArray()) as (MessageEvent & {
      _id: ObjectId;
    })[];

    const result: MessageEventsPartition = {
      sent_items: [],
      delivered_items: [],
      read_items: [],
    };

    for (const event of events) {
      switch (event.type) {
        case "sent":
          result.sent_items.push(event);
          break;

        case "delivered":
          result.delivered_items.push(event);
          break;

        case "read":
          result.read_items.push(event);
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
      async persist(user_id: string, message_ids: string[]): Promise<boolean> {
        return persistEvents("delivered", user_id, message_ids);
      },
    },

    readItems: {
      async persist(user_id: string, message_ids: string[]): Promise<boolean> {
        return persistEvents("read", user_id, message_ids);
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

      return result.deletedCount > 0;
    },
  };
})();
