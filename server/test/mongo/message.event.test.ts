import { describe, beforeEach, it, expect } from "vitest";

import Database from "@/db";
import { MessageEventsRepository } from "@/repository/mongo/message.items.event";

describe("MessageEventsRepository", () => {
  beforeEach(async () => {
    const collection = await Database.getMongoCollection("message_events");

    await collection.deleteMany({});
  });

  it("should persist sent items", async () => {
    const result = await MessageEventsRepository.sentItems.persist("user-1", [
      {
        client_id: "client-1",
        message_uuid: "message-1",
      },
      {
        client_id: "client-2",
        message_uuid: "message-2",
      },
    ]);

    expect(result).toBe(true);

    const events = await MessageEventsRepository.get("user-1");

    expect(events.sent_items).toHaveLength(2);
    expect(events.delivered_items).toHaveLength(0);
    expect(events.read_items).toHaveLength(0);

    expect(events.sent_items[0].type).toBe("sent");
    expect(events.sent_items[1].type).toBe("sent");
  });

  it("should persist delivered items", async () => {
    const result = await MessageEventsRepository.deliveredItems.persist(
      "user-1",
      ["message-1", "message-2"],
    );

    expect(result).toBe(true);

    const events = await MessageEventsRepository.get("user-1");

    expect(events.sent_items).toHaveLength(0);
    expect(events.delivered_items).toHaveLength(2);
    expect(events.read_items).toHaveLength(0);

    expect(events.delivered_items[0].type).toBe("delivered");
  });

  it("should persist read items", async () => {
    const result = await MessageEventsRepository.readItems.persist("user-1", [
      "message-1",
      "message-2",
    ]);

    expect(result).toBe(true);

    const events = await MessageEventsRepository.get("user-1");

    expect(events.sent_items).toHaveLength(0);
    expect(events.delivered_items).toHaveLength(0);
    expect(events.read_items).toHaveLength(2);

    expect(events.read_items[0].type).toBe("read");
  });

  it("should partition multiple event types correctly", async () => {
    await MessageEventsRepository.sentItems.persist("user-1", [
      {
        client_id: "client-1",
        message_uuid: "message-1",
      },
    ]);

    await MessageEventsRepository.deliveredItems.persist("user-1", [
      "message-2",
      "message-3",
    ]);

    await MessageEventsRepository.readItems.persist("user-1", ["message-4"]);

    const events = await MessageEventsRepository.get("user-1");

    expect(events.sent_items).toHaveLength(1);
    expect(events.delivered_items).toHaveLength(2);
    expect(events.read_items).toHaveLength(1);
  });

  it("should only return events for requested user", async () => {
    await MessageEventsRepository.sentItems.persist("user-1", [
      {
        client_id: "client-1",
        message_uuid: "message-1",
      },
    ]);

    await MessageEventsRepository.readItems.persist("user-2", ["message-2"]);

    const user1 = await MessageEventsRepository.get("user-1");

    const user2 = await MessageEventsRepository.get("user-2");

    expect(user1.sent_items).toHaveLength(1);
    expect(user1.read_items).toHaveLength(0);

    expect(user2.sent_items).toHaveLength(0);
    expect(user2.read_items).toHaveLength(1);
  });

  it("should acknowledge single event", async () => {
    await MessageEventsRepository.deliveredItems.persist("user-1", [
      "message-1",
    ]);

    const before = await MessageEventsRepository.get("user-1");

    expect(before.delivered_items).toHaveLength(1);

    const result = await MessageEventsRepository.acknowledge([
      before.delivered_items[0]._id,
    ]);

    expect(result).toBe(true);

    const after = await MessageEventsRepository.get("user-1");

    expect(after.delivered_items).toHaveLength(0);
  });

  it("should acknowledge multiple event types", async () => {
    await MessageEventsRepository.sentItems.persist("user-1", [
      {
        client_id: "client-1",
        message_uuid: "message-1",
      },
    ]);

    await MessageEventsRepository.deliveredItems.persist("user-1", [
      "message-2",
    ]);

    await MessageEventsRepository.readItems.persist("user-1", ["message-3"]);

    const events = await MessageEventsRepository.get("user-1");

    const ids = [
      ...events.sent_items.map((event) => event._id),
      ...events.delivered_items.map((event) => event._id),
      ...events.read_items.map((event) => event._id),
    ];

    const result = await MessageEventsRepository.acknowledge(ids);

    expect(result).toBe(true);

    const remaining = await MessageEventsRepository.get("user-1");

    expect(remaining.sent_items).toHaveLength(0);

    expect(remaining.delivered_items).toHaveLength(0);

    expect(remaining.read_items).toHaveLength(0);
  });

  it("should return empty partitions when user has no events", async () => {
    const events = await MessageEventsRepository.get("unknown-user");

    expect(events.sent_items).toEqual([]);
    expect(events.delivered_items).toEqual([]);
    expect(events.read_items).toEqual([]);
  });

  it("should allow acknowledging empty ids", async () => {
    const result = await MessageEventsRepository.acknowledge([]);

    expect(result).toBe(true);
  });

  it("should preserve insertion order", async () => {
    await MessageEventsRepository.deliveredItems.persist("user-1", [
      "message-1",
      "message-2",
      "message-3",
    ]);

    const events = await MessageEventsRepository.get("user-1");

    expect(events.delivered_items.map((item) => item.message_uuid)).toEqual([
      "message-1",
      "message-2",
      "message-3",
    ]);
  });
});
