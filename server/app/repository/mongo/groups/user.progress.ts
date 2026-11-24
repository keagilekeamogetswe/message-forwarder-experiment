import Database from "@/db";
import { ObjectId, type Collection } from "mongodb";
import type {
  GroupInviteProgress,
  UserProgression as UserProgressionRecord,
} from "./models/user.progress";

export const USER_PROGRESSION_COLLECTION = "user_progression";
const LEGACY_PROGRESS_COLLECTION = "user_group_progress";

let migrationPromise: Promise<void> | undefined;

async function migrateLegacyProgress(
  target: Collection<UserProgressionRecord>,
): Promise<void> {
  const database = target.db;
  const legacyExists = await database
    .listCollections({ name: LEGACY_PROGRESS_COLLECTION }, { nameOnly: true })
    .hasNext();
  if (!legacyExists) return;

  const legacy = database.collection<{
    _id?: ObjectId;
    user_id: string;
    groups?: ObjectId[];
    last_message_id?: ObjectId;
  }>(LEGACY_PROGRESS_COLLECTION);

  for await (const oldProgress of legacy.find()) {
    const groups = oldProgress.groups ?? [];
    const legacyLastMessageId = oldProgress.last_message_id;
    const group_message_cursors: Record<string, ObjectId> = {};
    if (legacyLastMessageId) {
      for (const groupId of groups) {
        group_message_cursors[groupId.toHexString()] = legacyLastMessageId;
      }
    }

    await target.updateOne(
      { user_id: oldProgress.user_id },
      {
        $setOnInsert: {
          user_id: oldProgress.user_id,
          groups,
          group_message_cursors,
          group_invites: {},
        },
      },
      { upsert: true },
    );
  }
}

async function getProgressCollection(): Promise<
  Collection<UserProgressionRecord>
> {
  const collection = await Database.getMongoCollection<UserProgressionRecord>(
    USER_PROGRESSION_COLLECTION,
  );

  migrationPromise ??= migrateLegacyProgress(collection).catch((error) => {
    migrationPromise = undefined;
    throw error;
  });
  await migrationPromise;
  return collection;
}

function groupKey(groupId: ObjectId): string {
  return groupId.toHexString();
}

export const UserProgression = (() => {
  return {
    async setLastMessageMesssageID(
      user_id: string,
      message_id: ObjectId,
    ): Promise<boolean> {
      const collection = await getProgressCollection();
      const result = await collection.updateOne(
        { user_id },
        { $set: { last_message_id: message_id } },
        { upsert: true },
      );
      return result.modifiedCount > 0 || result.upsertedCount > 0;
    },

    async getLastMessageMessageID(user_id: string): Promise<ObjectId | null> {
      const collection = await getProgressCollection();
      const result = await collection.findOne(
        { user_id },
        { projection: { last_message_id: 1 } },
      );
      return result?.last_message_id ?? null;
    },

    async setGroupMessageCursor(
      user_id: string,
      group_id: ObjectId,
      message_id: ObjectId,
    ): Promise<boolean> {
      const collection = await getProgressCollection();
      const result = await collection.updateOne(
        { user_id },
        {
          $max: {
            [`group_message_cursors.${groupKey(group_id)}`]: message_id,
          },
        },
        { upsert: true },
      );
      return result.matchedCount > 0 || result.upsertedCount > 0;
    },

    async getGroupMessageCursor(
      user_id: string,
      group_id: ObjectId,
    ): Promise<ObjectId | null> {
      const collection = await getProgressCollection();
      const result = await collection.findOne(
        { user_id },
        {
          projection: {
            [`group_message_cursors.${groupKey(group_id)}`]: 1,
          },
        },
      );
      return result?.group_message_cursors?.[groupKey(group_id)] ?? null;
    },

    async removeGroup(user_id: string, group_id: ObjectId): Promise<boolean> {
      const collection = await getProgressCollection();
      const result = await collection.updateOne(
        { user_id },
        {
          $pull: { groups: group_id },
          $unset: {
            [`group_message_cursors.${groupKey(group_id)}`]: "",
            [`group_invites.${groupKey(group_id)}`]: "",
          },
        },
      );
      return result.modifiedCount > 0;
    },

    async addGroup(user_id: string, group_id: ObjectId): Promise<boolean> {
      const collection = await getProgressCollection();
      const result = await collection.updateOne(
        { user_id },
        { $addToSet: { groups: group_id } },
        { upsert: true },
      );
      return result.modifiedCount > 0 || result.upsertedCount > 0;
    },

    async getGroups(user_id: string): Promise<ObjectId[]> {
      const collection = await getProgressCollection();
      const result = await collection.findOne(
        { user_id },
        { projection: { groups: 1 } },
      );
      return result?.groups ?? [];
    },

    async hasGroup(user_id: string, group_id: ObjectId): Promise<boolean> {
      const collection = await getProgressCollection();
      const result = await collection.findOne(
        { user_id, groups: group_id },
        { projection: { _id: 1 } },
      );
      return result !== null;
    },

    async createGroupInvite(
      user_id: string,
      group_id: ObjectId,
      offset: ObjectId,
    ): Promise<boolean> {
      const collection = await getProgressCollection();
      const key = groupKey(group_id);
      const result = await collection.updateOne(
        { user_id },
        {
          $set: {
            [`group_invites.${key}`]: { offset, coverage: offset },
          },
          $setOnInsert: { groups: [] },
        },
        { upsert: true },
      );
      return result.matchedCount > 0 || result.upsertedCount > 0;
    },

    async getGroupInvite(
      user_id: string,
      group_id: ObjectId,
    ): Promise<GroupInviteProgress | null> {
      const collection = await getProgressCollection();
      const result = await collection.findOne(
        { user_id },
        {
          projection: {
            [`group_invites.${groupKey(group_id)}`]: 1,
          },
        },
      );
      return result?.group_invites?.[groupKey(group_id)] ?? null;
    },

    async getGroupInvites(
      user_id: string,
    ): Promise<Map<ObjectId, GroupInviteProgress>> {
      const collection = await getProgressCollection();
      const result = await collection.findOne(
        { user_id },
        { projection: { group_invites: 1 } },
      );
      const invites = new Map<ObjectId, GroupInviteProgress>();
      for (const [id, invite] of Object.entries(result?.group_invites ?? {})) {
        if (ObjectId.isValid(id) && invite?.offset && invite?.coverage) {
          invites.set(new ObjectId(id), invite);
        }
      }
      return invites;
    },

    async advanceGroupInviteCoverage(
      user_id: string,
      group_id: ObjectId,
      message_id: ObjectId,
    ): Promise<boolean> {
      const collection = await getProgressCollection();
      const path = `group_invites.${groupKey(group_id)}.coverage`;
      const result = await collection.updateOne(
        { user_id, [`group_invites.${groupKey(group_id)}`]: { $exists: true } },
        { $max: { [path]: message_id } },
      );
      return result.matchedCount > 0;
    },

    async removeGroupInvite(
      user_id: string,
      group_id: ObjectId,
    ): Promise<boolean> {
      const collection = await getProgressCollection();
      const result = await collection.updateOne(
        { user_id },
        { $unset: { [`group_invites.${groupKey(group_id)}`]: "" } },
      );
      return result.modifiedCount > 0;
    },

    async acceptGroupInvite(
      user_id: string,
      group_id: ObjectId,
      invite: GroupInviteProgress,
      through: ObjectId,
    ): Promise<boolean> {
      const collection = await getProgressCollection();
      const key = groupKey(group_id);
      const result = await collection.updateOne(
        {
          user_id,
          [`group_invites.${key}.offset`]: invite.offset,
          [`group_invites.${key}.coverage`]: { $gte: through },
        },
        {
          $addToSet: { groups: group_id },
          $max: { [`group_message_cursors.${key}`]: invite.coverage },
          $unset: { [`group_invites.${key}`]: "" },
        },
      );
      return result.modifiedCount > 0;
    },
  };
})();

// Backward-compatible symbol for current message action call sites.
export const GroupProgress = UserProgression;
