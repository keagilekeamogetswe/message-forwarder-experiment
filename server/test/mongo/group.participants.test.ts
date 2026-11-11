import { beforeEach, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";

import Database from "@/db";
import GroupParticipants from "@/repository/mongo/groups/group.participants";

describe("Group participants test cases", () => {
  const MEMBERS_COLLECTION = "group_participants";
  const ARCHIVE_COLLECTION = "group_participants_archive";

  beforeEach(async () => {
    const memberships = await Database.getMongoCollection(MEMBERS_COLLECTION);

    const archive = await Database.getMongoCollection(ARCHIVE_COLLECTION);

    await memberships.deleteMany({});
    await archive.deleteMany({});
  });

  it("should add a user to a group", async () => {
    const user_id = "user_a";
    const group_id = new ObjectId();

    const result = await GroupParticipants.addUser(user_id, group_id);

    expect(result).toBe(true);

    const collection = await Database.getMongoCollection(MEMBERS_COLLECTION);

    const membership = await collection.findOne({
      user_id,
      group_id,
    });

    expect(membership).not.toBeNull();
    expect(membership?.user_id).toBe(user_id);
    expect(membership?.group_id).toEqual(group_id);
    expect(membership?.role).toBe("member");
  });

  it("should not create duplicate memberships", async () => {
    const user_id = "user_a";
    const group_id = new ObjectId();
    await GroupParticipants.addUser(user_id, group_id);
    await GroupParticipants.addUser(user_id, group_id);
    const collection = await Database.getMongoCollection(MEMBERS_COLLECTION);

    const memberships = await collection
      .find({
        user_id,
        group_id,
      })
      .toArray();

    expect(memberships).toHaveLength(1);
  });

  it("should update a participant role", async () => {
    const user_id = "user_a";
    const group_id = new ObjectId();

    await GroupParticipants.addUser(user_id, group_id);

    const result = await GroupParticipants.updateRole(
      user_id,
      "admin",
      group_id,
    );

    expect(result).toBe(true);

    const collection = await Database.getMongoCollection(MEMBERS_COLLECTION);

    const membership = await collection.findOne({
      user_id,
      group_id,
    });

    expect(membership?.role).toBe("admin");
  });

  it("should archive user when removed", async () => {
    const user_id = "user_a";
    const group_id = new ObjectId();

    await GroupParticipants.addUser(user_id, group_id);

    const result = await GroupParticipants.removeUser(user_id, group_id);

    expect(result).toBe(true);

    const memberships = await Database.getMongoCollection(MEMBERS_COLLECTION);

    const archive = await Database.getMongoCollection(ARCHIVE_COLLECTION);

    const activeMembership = await memberships.findOne({
      user_id,
      group_id,
    });

    const archivedMembership = await archive.findOne({
      user_id,
      group_id,
    });

    expect(activeMembership).toBeNull();
    expect(archivedMembership).not.toBeNull();
  });

  it("should return false when removing unknown membership", async () => {
    const result = await GroupParticipants.removeUser(
      "missing-user",
      new ObjectId(),
    );

    expect(result).toBe(false);
  });
});
