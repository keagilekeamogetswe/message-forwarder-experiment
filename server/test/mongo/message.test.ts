import MessageRepository from "@/repository/mongo/message";
import { MessageStruct } from "@/model/message";
import Database from "@/db";
import { ObjectId } from "mongodb";
import { afterEach, describe, expect, it } from "vitest";

describe("MessageRepository", () => {
  const collection = "primary_messages";

  afterEach(async () => {
    const messageCollection =
      await Database.getMongoCollection<MessageStruct>(collection);

    await messageCollection.deleteMany({});
  });

  it("persists a message", async () => {
    const message: MessageStruct = {
      message_uuid: crypto.randomUUID(),
      sender_id: "sender-1",
      recipient_id: "recipient-1",
      caption: "hello",
      client_id: new Date().toISOString(),
    };

    await MessageRepository.persistMessage(collection, message);

    const messageCollection =
      await Database.getMongoCollection<MessageStruct>(collection);

    const stored = await messageCollection.findOne({
      message_uuid: message.message_uuid,
    });

    expect(stored).not.toBeNull();
    expect(stored?.sender_id).toBe(message.sender_id);
    expect(stored?.recipient_id).toBe(message.recipient_id);
  });

  it("flags messages", async () => {
    const messageCollection =
      await Database.getMongoCollection<MessageStruct>(collection);

    const result = await messageCollection.insertOne({
      message_uuid: crypto.randomUUID(),
      sender_id: "sender-1",
      recipient_id: "recipient-1",
      caption: "hello",
      client_id: new Date().toISOString(),
    } as MessageStruct);

    const modifiedCount = await MessageRepository.flagMessages(
      collection,
      [result.insertedId],
      {
        delivered: true,
      },
    );

    expect(modifiedCount).toBe(1);

    const stored = await messageCollection.findOne({
      _id: result.insertedId,
    });

    expect(stored?.delivered).toBe(true);
  });

  it("removes messages", async () => {
    const messageCollection =
      await Database.getMongoCollection<MessageStruct>(collection);

    const result = await messageCollection.insertOne({
      message_uuid: crypto.randomUUID(),
      sender_id: "sender-1",
      recipient_id: "recipient-1",
      caption: "hello",
      client_id: new Date().toISOString(),
    } as MessageStruct);

    const deletedCount = await MessageRepository.removeMessages(collection, [
      result.insertedId,
    ]);

    expect(deletedCount).toBe(1);

    const stored = await messageCollection.findOne({
      _id: result.insertedId,
    });

    expect(stored).toBeNull();
  });

  it("returns 0 when flagging an empty list", async () => {
    const modifiedCount = await MessageRepository.flagMessages(collection, [], {
      delivered: true,
    });

    expect(modifiedCount).toBe(0);
  });

  it("returns 0 when removing an empty list", async () => {
    const deletedCount = await MessageRepository.removeMessages(collection, []);

    expect(deletedCount).toBe(0);
  });
});
