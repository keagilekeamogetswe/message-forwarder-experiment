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
  it("reads messages for a recipient", async () => {
    const messageCollection =
      await Database.getMongoCollection<MessageStruct>(collection);

    await messageCollection.insertMany([
      {
        message_uuid: crypto.randomUUID(),
        sender_id: "sender-1",
        recipient_id: "recipient-1",
        caption: "message-1",
        client_id: new Date().toISOString(),
      } as MessageStruct,
      {
        message_uuid: crypto.randomUUID(),
        sender_id: "sender-2",
        recipient_id: "recipient-2",
        caption: "message-2",
        client_id: new Date().toISOString(),
      } as MessageStruct,
    ]);

    const messages = await MessageRepository.readMessages(
      collection,
      "recipient-1",
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.recipient_id).toBe("recipient-1");
    expect(messages[0]?.caption).toBe("message-1");
  });

  it("respects the limit parameter", async () => {
    const messageCollection =
      await Database.getMongoCollection<MessageStruct>(collection);

    await messageCollection.insertMany([
      {
        message_uuid: crypto.randomUUID(),
        sender_id: "sender-1",
        recipient_id: "recipient-1",
        caption: "message-1",
        client_id: new Date().toISOString(),
      } as MessageStruct,
      {
        message_uuid: crypto.randomUUID(),
        sender_id: "sender-2",
        recipient_id: "recipient-1",
        caption: "message-2",
        client_id: new Date().toISOString(),
      } as MessageStruct,
    ]);

    const messages = await MessageRepository.readMessages(
      collection,
      "recipient-1",
      {},
      1,
    );

    expect(messages).toHaveLength(1);
  });

  it("ignores flagged messages", async () => {
    const messageCollection =
      await Database.getMongoCollection<MessageStruct>(collection);

    await messageCollection.insertMany([
      {
        message_uuid: crypto.randomUUID(),
        sender_id: "sender-1",
        recipient_id: "recipient-1",
        caption: "visible",
        delivered: false,
        client_id: new Date().toISOString(),
      } as MessageStruct,
      {
        message_uuid: crypto.randomUUID(),
        sender_id: "sender-2",
        recipient_id: "recipient-1",
        caption: "ignored",
        delivered: true,
        client_id: new Date().toISOString(),
      } as MessageStruct,
    ]);

    const messages = await MessageRepository.readMessages(
      collection,
      "recipient-1",
      {
        delivered: true,
      },
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.caption).toBe("visible");
  });

  it("returns messages after the offset id", async () => {
    const messageCollection =
      await Database.getMongoCollection<MessageStruct>(collection);

    const first = await messageCollection.insertOne({
      message_uuid: crypto.randomUUID(),
      sender_id: "sender-1",
      recipient_id: "recipient-1",
      caption: "first",
      client_id: new Date().toISOString(),
    } as MessageStruct);

    const second = await messageCollection.insertOne({
      message_uuid: crypto.randomUUID(),
      sender_id: "sender-2",
      recipient_id: "recipient-1",
      caption: "second",
      client_id: new Date().toISOString(),
    } as MessageStruct);

    const messages = await MessageRepository.readMessages(
      collection,
      "recipient-1",
      {},
      0,
      first.insertedId,
    );

    expect(messages).toHaveLength(1);
    expect(
      (messages[0] as MessageStruct & { _id: ObjectId })._id.equals(
        second.insertedId,
      ),
    ).toBe(true);
  });

  it("returns an empty array when no messages exist", async () => {
    const messages = await MessageRepository.readMessages(
      collection,
      "recipient-1",
    );

    expect(messages).toEqual([]);
  });
});
