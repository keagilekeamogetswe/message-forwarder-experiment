import Database from "@/db";
import { ObjectId } from "mongodb";
import { UserGroupProgress } from "./models/user.progress";

export const GroupProgress = (() => {
  const user_progress_collection = "user_group_progress";

  return {
    async setLastMessageMesssageID(
      user_id: string,
      message_id: ObjectId,
    ): Promise<boolean> {
      const collection = await Database.getMongoCollection<UserGroupProgress>(
        user_progress_collection,
      );

      const result = await collection.updateOne(
        { user_id },
        {
          $set: {
            last_message_id: message_id,
          },
        },
        {
          upsert: true,
        },
      );

      return result.modifiedCount > 0 || result.upsertedCount > 0;
    },

    async getLastMessageMessageID(user_id: string): Promise<ObjectId | null> {
      const collection = await Database.getMongoCollection<UserGroupProgress>(
        user_progress_collection,
      );

      const result = await collection.findOne(
        { user_id },
        {
          projection: {
            last_message_id: 1,
          },
        },
      );

      return result?.last_message_id ?? null;
    },

    async removeGroup(user_id: string, group_id: ObjectId): Promise<boolean> {
      const collection = await Database.getMongoCollection<UserGroupProgress>(
        user_progress_collection,
      );

      const result = await collection.updateOne(
        { user_id },
        {
          $pull: {
            groups: group_id,
          },
        },
      );

      return result.modifiedCount > 0;
    },

    async addGroup(user_id: string, group_id: ObjectId): Promise<boolean> {
      const collection = await Database.getMongoCollection<UserGroupProgress>(
        user_progress_collection,
      );

      const result = await collection.updateOne(
        { user_id },
        {
          $addToSet: {
            groups: group_id,
          },
        },
        {
          upsert: true,
        },
      );

      return result.modifiedCount > 0 || result.upsertedCount > 0;
    },
  };
})();
