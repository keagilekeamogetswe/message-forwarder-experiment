import { beforeEach, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";

import { PrimaryMessageActions } from "@/actions/message/primary.action";
import Database from "@/db";
import { COLLECTION_NAMES } from "@/repository/mongo/message";

describe("PrimaryMessageActions", () => {
  beforeEach(async () => {
    const collection = await Database.getMongoCollection(
      COLLECTION_NAMES.primary,
    );

    await collection.deleteMany({});
  });

  it("persists a message", async () => {
    const message = {
      message_uuid: crypto.randomUUID(),
      sender_id: "sender",
      recipient_id: "recipient",
      caption: "hello",
      created_at: new Date().toISOString(),
    };

    const result = await PrimaryMessageActions.persistMessage(message as any);

    expect(result).toBe(true);

    const collection = await Database.getMongoCollection(
      COLLECTION_NAMES.primary,
    );

    const persisted = await collection.findOne({
      message_uuid: message.message_uuid,
    });

    expect(persisted).not.toBeNull();
  });

  it("reads a user's messages", async () => {
    const message = {
      message_uuid: crypto.randomUUID(),
      sender_id: "sender",
      recipient_id: "user-1",
      caption: "hello",
      created_at: new Date().toISOString(),
    };

    await PrimaryMessageActions.persistMessage(message as any);

    const messages = await PrimaryMessageActions.readMessages("user-1");

    expect(messages.length).toBe(1);
    expect(messages[0]?.message_uuid).toBe(message.message_uuid);
  });

  it("acknowledges and deletes messages", async () => {
    const collection = await Database.getMongoCollection(
      COLLECTION_NAMES.primary,
    );

    const insertResult = await collection.insertOne({
      message_uuid: crypto.randomUUID(),
      sender_id: "sender",
      recipient_id: "recipient",
      caption: "hello",
      created_at: new Date().toISOString(),
    });

    const result = await PrimaryMessageActions.acknowledgeMessages([
      insertResult.insertedId,
    ]);

    expect(result).toBe(1);

    const deleted = await collection.findOne({
      _id: insertResult.insertedId,
    });

    expect(deleted).toBeNull();
  });

  it("returns empty array when no messages exist", async () => {
    const messages =
      await PrimaryMessageActions.readMessages("non-existent-user");

    expect(messages).toEqual([]);
  });

  it("deletes multiple messages", async () => {
    const collection = await Database.getMongoCollection(
      COLLECTION_NAMES.primary,
    );

    const insertA = await collection.insertOne({
      message_uuid: crypto.randomUUID(),
      sender_id: "a",
      recipient_id: "user",
      caption: "a",
      created_at: new Date().toISOString(),
    });

    const insertB = await collection.insertOne({
      message_uuid: crypto.randomUUID(),
      sender_id: "b",
      recipient_id: "user",
      caption: "b",
      created_at: new Date().toISOString(),
    });

    const result = await PrimaryMessageActions.acknowledgeMessages([
      insertA.insertedId,
      insertB.insertedId,
    ]);

    expect(result).toBe(2);

    const remaining = await collection.countDocuments();

    expect(remaining).toBe(0);
  });
});
