import Database from "@/db";
import { ObjectId } from "mongodb";

export const GroupParticipants = (() => {
  const active_collection_name = "group_participants";
  const passive_collection_name = "group_participants_archive";

  return {
    async addUser(
      user_id: string,
      group_id: ObjectId,
      join_method = "added",
    ): Promise<boolean> {
      const active_collection = await Database.getMongoCollection(
        active_collection_name,
      );

      const result = await active_collection.updateOne(
        {
          user_id,
          group_id,
        },
        {
          $setOnInsert: {
            user_id,
            group_id,
            role: "member",
            join_method,
            joined_at: new Date().toISOString(),
          },
        },
        {
          upsert: true,
        },
      );

      return result.upsertedCount > 0 || result.modifiedCount > 0;
    },

    async removeUser(user_id: string, group_id: ObjectId): Promise<boolean> {
      const active_collection = await Database.getMongoCollection(
        active_collection_name,
      );

      const passive_collection = await Database.getMongoCollection(
        passive_collection_name,
      );

      const membership = await active_collection.findOneAndDelete({
        user_id,
        group_id,
      });

      if (!membership) {
        return false;
      }

      const archive_result = await passive_collection.insertOne({
        ...membership,
        left_at: new Date().toISOString(),
      });

      return archive_result.acknowledged;
    },

    async updateRole(
      user_id: string,
      role: string,
      group_id: ObjectId,
    ): Promise<boolean> {
      const active_collection = await Database.getMongoCollection(
        active_collection_name,
      );

      const result = await active_collection.updateOne(
        {
          user_id,
          group_id,
        },
        {
          $set: {
            role,
          },
        },
      );

      return result.modifiedCount > 0;
    },
  };
})();

export default GroupParticipants;
