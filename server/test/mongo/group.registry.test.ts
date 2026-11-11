import { beforeEach, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";

import Database from "@/db";
import GroupRegistry from "@/repository/mongo/groups/group.registry";
import { GroupRecord } from "@/repository/mongo/groups/models/groups";

describe("GroupRegistry", () => {
  const COLLECTION = "groups";

  beforeEach(async () => {
    const collection =
      await Database.getMongoCollection<GroupRecord>(COLLECTION);

    await collection.deleteMany({});
  });

  it("should create a group", async () => {
    const group_id = await GroupRegistry.createGroup(
      "user_a",
      "Developers",
      "dev-token",
    );

    expect(group_id).toBeInstanceOf(ObjectId);

    const collection =
      await Database.getMongoCollection<GroupRecord>(COLLECTION);

    const group = await collection.findOne({
      _id: group_id!,
    });

    expect(group).not.toBeNull();
    expect(group?.name).toBe("Developers");
    expect(group?.invite_token).toBe("dev-token");
    expect(group?.started_by.user_id).toBe("user_a");
    expect(group?.active_member_count).toBe(1);
  });

  it("should get a group by id", async () => {
    const group_id = await GroupRegistry.createGroup(
      "user_a",
      "Developers",
      "dev-token",
    );

    const group = await GroupRegistry.getGroup(group_id!);

    expect(group).not.toBeNull();
    expect(group?.name).toBe("Developers");
  });

  it("should update a group", async () => {
    const group_id = await GroupRegistry.createGroup(
      "user_a",
      "Developers",
      "dev-token",
    );

    const result = await GroupRegistry.update(group_id!, {
      name: "Backend Team",
    });

    expect(result).toBe(true);

    const updated = await GroupRegistry.getGroup(group_id!);

    expect(updated?.name).toBe("Backend Team");
  });

  it("should increment member count", async () => {
    const group_id = await GroupRegistry.createGroup(
      "user_a",
      "Developers",
      "dev-token",
    );

    const result = await GroupRegistry.incrementMemberCount(group_id!);

    expect(result).toBe(true);

    const group = await GroupRegistry.getGroup(group_id!);

    expect(group?.active_member_count).toBe(2);
  });

  it("should increment member count by a custom value", async () => {
    const group_id = await GroupRegistry.createGroup(
      "user_a",
      "Developers",
      "dev-token",
    );

    await GroupRegistry.incrementMemberCount(group_id!, 5);

    const group = await GroupRegistry.getGroup(group_id!);

    expect(group?.active_member_count).toBe(6);
  });

  it("should decrement member count", async () => {
    const group_id = await GroupRegistry.createGroup(
      "user_a",
      "Developers",
      "dev-token",
    );

    await GroupRegistry.incrementMemberCount(group_id!, 3);

    const result = await GroupRegistry.decrementMemberCount(group_id!);

    expect(result).toBe(true);

    const group = await GroupRegistry.getGroup(group_id!);

    expect(group?.active_member_count).toBe(3);
  });

  it("should delete a group owned by the user", async () => {
    const group_id = await GroupRegistry.createGroup(
      "user_a",
      "Developers",
      "dev-token",
    );

    const result = await GroupRegistry.deleteGroup("user_a", group_id!);

    expect(result).toBe(true);

    const group = await GroupRegistry.getGroup(group_id!);

    expect(group).toBeNull();
  });

  it("should not delete a group owned by another user", async () => {
    const group_id = await GroupRegistry.createGroup(
      "user_a",
      "Developers",
      "dev-token",
    );

    const result = await GroupRegistry.deleteGroup("user_b", group_id!);

    expect(result).toBe(false);

    const group = await GroupRegistry.getGroup(group_id!);

    expect(group).not.toBeNull();
  });

  it("should return null for a missing group", async () => {
    const group = await GroupRegistry.getGroup(new ObjectId());

    expect(group).toBeNull();
  });
});
