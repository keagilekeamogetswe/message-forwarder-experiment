import Database from "@/db";
import { MessageStruct } from "@/model/message";
import { ObjectId, UpdateFilter, Filter } from "mongodb";

//Expose message collection to the this scope
type MessageCollection =
  "primary_messages" | "group_messages" | "room_messages";

const MessageRepository = (() => {
  type MessageFlagValue = string | number | boolean | null | Date;

  type MessageFlags = Record<string, MessageFlagValue>;

  return {
    async persistMessage(
      collection_name: MessageCollection,
      message: MessageStruct,
    ): Promise<boolean> {
      const collection =
        await Database.getMongoCollection<MessageStruct>(collection_name);

      const result = await collection.insertOne(message);
      return result.acknowledged;
    },
    async readMessages(
      collection_name: MessageCollection,
      user_id: string,
      ignore: MessageFlags = {},
      limit = 0,
      offset_id?: ObjectId,
    ): Promise<MessageStruct[]> {
      const collection =
        await Database.getMongoCollection<MessageStruct>(collection_name);

      const query: Filter<MessageStruct> = {
        recipient_id: user_id,

        ...(Object.keys(ignore).length > 0
          ? {
              $nor: [ignore],
            }
          : {}),

        ...(offset_id
          ? {
              _id: { $gt: offset_id },
            }
          : {}),
      };

      return await collection
        .find(query)
        .sort({ _id: 1 })
        .limit(limit)
        .toArray();
    },
    async readMessages(
      collection_name: MessageCollection,
      user_id: string,
      ignore: MessageFlags = {},
      limit = 0,
      offset_id?: ObjectId,
    ): Promise<MessageStruct[]> {
      const collection =
        await Database.getMongoCollection<MessageStruct>(collection_name);

      const query: Filter<MessageStruct> = {
        recipient_id: user_id,

        ...(Object.keys(ignore).length > 0
          ? {
              $nor: [ignore],
            }
          : {}),

        ...(offset_id
          ? {
              _id: { $gt: offset_id },
            }
          : {}),
      };

      return await collection
        .find(query)
        .sort({ _id: 1 })
        .limit(limit)
        .toArray();
    },

    async flagMessages(
      collection_name: MessageCollection,
      message_ids: ObjectId[],
      flags: MessageFlags,
    ): Promise<number> {
      if (message_ids.length === 0) {
        return 0;
      }

      const collection =
        await Database.getMongoCollection<MessageStruct>(collection_name);

      const result = await collection.updateMany(
        {
          _id: { $in: message_ids },
        },
        {
          $set: flags,
        } as UpdateFilter<MessageStruct>,
      );

      return result.modifiedCount;
    },

    async removeMessages(
      collection_name: MessageCollection,
      message_ids: ObjectId[],
    ): Promise<number> {
      if (message_ids.length === 0) {
        return 0;
      }

      const collection =
        await Database.getMongoCollection<MessageStruct>(collection_name);

      const result = await collection.deleteMany({
        _id: { $in: message_ids },
      });

      return result.deletedCount;
    },
  };
})();

export default MessageRepository;
export const COLLECTION_NAMES: Record<string, MessageCollection> = {
  room: "room_messages",
  primary: "primary_messages",
  group: "group_messages",
};
