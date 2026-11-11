import { describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

import Database from "@/db";
import { GroupProgress } from "@/repository/mongo/groups/user.progress";
import { UserGroupProgress } from "@/repository/mongo/groups/models/user.progress";

describe("Testing the use cases in Group Progress", () => {
  const COLLECTION = "user_group_progress";

  beforeEach(async () => {
    const collection =
      await Database.getMongoCollection<UserGroupProgress>(COLLECTION);

    await collection.deleteMany({});
  });

  it("adds a group to a user", async () => {
    const user_id = "test-user";
    const group_id = new ObjectId();

    const result = await GroupProgress.addGroup(user_id, group_id);

    expect(result).toBe(true);

    const collection =
      await Database.getMongoCollection<UserGroupProgress>(COLLECTION);

    const document = await collection.findOne({ user_id });

    expect(document).not.toBeNull();
    expect(document?.groups).toContainEqual(group_id);
  });

  it("does not create duplicate groups", async () => {
    const user_id = "test-user";
    const group_id = new ObjectId();

    await GroupProgress.addGroup(user_id, group_id);
    await GroupProgress.addGroup(user_id, group_id);

    const collection =
      await Database.getMongoCollection<UserGroupProgress>(COLLECTION);

    const document = await collection.findOne({ user_id });

    expect(document).not.toBeNull();
    expect(document?.groups.length).toBe(1);
  });

  it("removes a group", async () => {
    const user_id = "test-user";
    const group_id = new ObjectId();

    await GroupProgress.addGroup(user_id, group_id);

    const result = await GroupProgress.removeGroup(user_id, group_id);

    expect(result).toBe(true);

    const collection =
      await Database.getMongoCollection<UserGroupProgress>(COLLECTION);

    const document = await collection.findOne({ user_id });

    expect(document?.groups).toHaveLength(0);
  });

  it("returns false when removing a missing group", async () => {
    const result = await GroupProgress.removeGroup("test-user", new ObjectId());

    expect(result).toBe(false);
  });

  it("stores the last message id", async () => {
    const user_id = "test-user";
    const message_id = new ObjectId();

    const result = await GroupProgress.setLastMessageMesssageID(
      user_id,
      message_id,
    );

    expect(result).toBe(true);

    const stored = await GroupProgress.getLastMessageMessageID(user_id);

    expect(stored).toEqual(message_id);
  });

  it("updates the last message id", async () => {
    const user_id = "test-user";

    const first_id = new ObjectId();
    const second_id = new ObjectId();

    await GroupProgress.setLastMessageMesssageID(user_id, first_id);

    await GroupProgress.setLastMessageMesssageID(user_id, second_id);

    const stored = await GroupProgress.getLastMessageMessageID(user_id);

    expect(stored).toEqual(second_id);
  });

  it("returns null when user progress does not exist", async () => {
    const result = await GroupProgress.getLastMessageMessageID("missing-user");

    expect(result).toBeNull();
  });
});
