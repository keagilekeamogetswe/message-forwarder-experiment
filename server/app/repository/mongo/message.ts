import Database from "@/db";
import { MessageStruct } from "@/model/message";
import { ObjectId, UpdateFilter } from "mongodb";
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
    ): Promise<void> {
      const collection =
        await Database.getMongoCollection<MessageStruct>(collection_name);

      await collection.insertOne(message);
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
