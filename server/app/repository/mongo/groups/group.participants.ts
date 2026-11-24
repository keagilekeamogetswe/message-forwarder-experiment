import Database from "@/db";
import { ObjectId } from "mongodb";
import GroupRegistry from "./group.registry";
import type { GroupParticipants as ParticipantRecord } from "./models/participants";

export type GroupRole = ParticipantRecord["role"];
export type GroupJoinMethod = ParticipantRecord["join_method"];

export const GroupParticipants = (() => {
  const active_collection_name = "group_participants";
  const passive_collection_name = "group_participants_archive";

  return {
    async addUser(
      user_id: string,
      group_id: ObjectId,
      join_method: GroupJoinMethod = "added",
      role: GroupRole = "member",
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
            role,
            join_method,
            joined_at: Date.now(),
          },
        },
        {
          upsert: true,
        },
      );
      const added = result.upsertedCount > 0 || result.modifiedCount > 0;
      //Maintain group participant count
      if (added) await GroupRegistry.incrementMemberCount(group_id);

      return added;
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
      const removed = archive_result.acknowledged;

      //Maintain group participant count
      if (removed) await GroupRegistry.decrementMemberCount(group_id);
      return removed;
    },

    async updateRole(
      user_id: string,
      role: GroupRole,
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

    async getUser(user_id: string, group_id: ObjectId): Promise<ParticipantRecord | null> {
      const collection = await Database.getMongoCollection<ParticipantRecord>(active_collection_name);
      return collection.findOne({ user_id, group_id });
    },

    async getGroupUsers(group_id: ObjectId): Promise<ParticipantRecord[]> {
      const collection = await Database.getMongoCollection<ParticipantRecord>(active_collection_name);
      return collection.find({ group_id }).sort({ joined_at: 1, _id: 1 }).toArray();
    },
  };
})();

export default GroupParticipants;
