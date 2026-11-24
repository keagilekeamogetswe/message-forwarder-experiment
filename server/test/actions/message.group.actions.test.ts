import { describe, it, expect, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

import Database from "@/db";
import { GroupMessageActions } from "@/actions/message/group.action";
import { GroupProgress } from "@/repository/mongo/groups/user.progress";
import MessageRepository, {
  COLLECTION_NAMES,
} from "@/repository/mongo/message";

describe("GroupMessageActions", () => {
  beforeEach(async () => {
    const groupCollection = await Database.getMongoCollection(
      COLLECTION_NAMES.group,
    );

    const progressCollection = await Database.getMongoCollection(
      "user_progression",
    );

    await groupCollection.deleteMany({});
    await progressCollection.deleteMany({});
  });

  it("persists a message when sender belongs to the group", async () => {
    const user_id = "user-1";
    const group_id = new ObjectId();

    await GroupProgress.addGroup(user_id, group_id);

    const message = {
      message_uuid: crypto.randomUUID(),
      sender_id: user_id,
      recipient_id: group_id.toString(),
      caption: "Hello group",
      media_uploads: [],
      client_id: "client-1",
    };

    const result = await GroupMessageActions.persistMessage(message);

    expect(result).toBe(true);

    const stored = await MessageRepository.readMessages(
      COLLECTION_NAMES.group,
      group_id.toString(),
    );

    expect(stored).toHaveLength(1);
    expect(stored[0]?.caption).toBe("Hello group");
  });

  it("rejects a message when sender is not a group member", async () => {
    const group_id = new ObjectId();

    const message = {
      message_uuid: crypto.randomUUID(),
      sender_id: "user-1",
      recipient_id: group_id.toString(),
      caption: "Hello group",
      media_uploads: [],
      client_id: "client-1",
    };

    await expect(GroupMessageActions.persistMessage(message)).rejects.toThrow(
      "User is not part of the specified group",
    );
  });

  it("persists valid group recipients while reporting invalid memberships", async () => {
    const user_id = "bulk-group-sender";
    const valid_group_id = new ObjectId();
    const invalid_group_id = new ObjectId();
    await GroupProgress.addGroup(user_id, valid_group_id);

    const valid_message = {
      message_uuid: crypto.randomUUID(),
      sender_id: user_id,
      recipient_id: valid_group_id.toString(),
      caption: "valid group message",
      media_uploads: [],
      client_id: "bulk-client",
    };
    const invalid_message = {
      ...valid_message,
      message_uuid: crypto.randomUUID(),
      recipient_id: invalid_group_id.toString(),
    };

    const results = await GroupMessageActions.persistMessages([
      valid_message,
      invalid_message,
    ]);

    expect(results.get(valid_message.message_uuid)).toBeNull();
    expect(results.get(invalid_message.message_uuid)).toBe(
      "User is not part of the specified group",
    );
    const stored = await MessageRepository.readMessages(
      COLLECTION_NAMES.group,
      valid_group_id.toString(),
    );
    expect(stored.map((message) => message.message_uuid)).toContain(
      valid_message.message_uuid,
    );
  });

  it("acknowledges no messages when array is empty", async () => {
    const result = await GroupMessageActions.acknowledgeMessages("user-1", []);

    expect(result).toBe(0);
  });

  it("updates user progress with the latest acknowledged message", async () => {
    const user_id = "user-1";

    const id1 = new ObjectId();
    const id2 = new ObjectId();

    const acknowledged = await GroupMessageActions.acknowledgeMessages(
      user_id,
      [id1, id2],
    );

    expect(acknowledged).toBe(2);

    const stored = await GroupProgress.getLastMessageMessageID(user_id);

    const expected = id1.toHexString() > id2.toHexString() ? id1 : id2;

    expect(stored).toEqual(expected);
  });

  it("returns an empty array when user belongs to no groups", async () => {
    const messages = await GroupMessageActions.readMessages("missing-user");

    expect(messages).toEqual([]);
  });

  it("returns messages from groups the user belongs to", async () => {
    const user_id = "user-1";
    const group_id = new ObjectId();

    await GroupProgress.addGroup(user_id, group_id);

    await MessageRepository.persistMessage(COLLECTION_NAMES.group, {
      message_uuid: crypto.randomUUID(),
      sender_id: user_id,
      recipient_id: group_id.toString(),
      caption: "message one",
      media_uploads: [],
      client_id: "client-1",
    });

    const messages = await GroupMessageActions.readMessages(user_id);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.recipient_id).toBe(group_id.toString());
    expect(messages[0]?.caption).toBe("message one");
  });
});
