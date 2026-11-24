import Database from "@/db";
import { ObjectId } from "mongodb";

import { GroupRecord } from "./models/groups";

const GroupRegistry = (() => {
  const collection_name = "groups";

  return {
    async createGroup(
      user_id: string,
      group_name: string,
      invite_token: string,
      context?: string,
    ): Promise<ObjectId | null> {
      const collection =
        await Database.getMongoCollection<GroupRecord>(collection_name);

      const result = await collection.insertOne({
        created_at: Date.now(),

        name: group_name,

        started_by: {
          user_id,
          context,
        },

        invite_token,

        active_member_count: 1,
      });

      return result.acknowledged ? result.insertedId : null;
    },

    async deleteGroup(user_id: string, group_id: ObjectId): Promise<boolean> {
      const collection =
        await Database.getMongoCollection<GroupRecord>(collection_name);

      const result = await collection.deleteOne({
        _id: group_id,
        "started_by.user_id": user_id,
      });

      return result.deletedCount > 0;
    },

    async getGroup(group_id: ObjectId): Promise<GroupRecord | null> {
      const collection =
        await Database.getMongoCollection<GroupRecord>(collection_name);

      return await collection.findOne({
        _id: group_id,
      });
    },

    async update(
      group_id: ObjectId,
      changes: Partial<GroupRecord>,
    ): Promise<boolean> {
      const collection =
        await Database.getMongoCollection<GroupRecord>(collection_name);

      const result = await collection.updateOne(
        {
          _id: group_id,
        },
        {
          $set: changes,
        },
      );

      return result.modifiedCount > 0;
    },

    async incrementMemberCount(
      group_id: ObjectId,
      amount = 1,
    ): Promise<boolean> {
      const collection =
        await Database.getMongoCollection<GroupRecord>(collection_name);

      const result = await collection.updateOne(
        {
          _id: group_id,
        },
        {
          $inc: {
            active_member_count: amount,
          },
        },
      );

      return result.modifiedCount > 0;
    },

    async decrementMemberCount(
      group_id: ObjectId,
      amount = 1,
    ): Promise<boolean> {
      return this.incrementMemberCount(group_id, -amount);
    },
  };
})();

export default GroupRegistry;
