import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import jwt from "../../utility/jwt";
import Database from "@/db";
import { DeliveredItem, MessageStruct, SentItem } from "@/model/message";
import {
  startWebSocketTestServer,
  stopWebSocketTestServer,
} from "./ws.test.helpers";

let server: Awaited<ReturnType<typeof startWebSocketTestServer>>;

beforeAll(async () => {
  const messages = await Database.getMongoCollection("primary_messages");
  await messages.deleteMany({});

  server = await startWebSocketTestServer();
}, 25_000);

afterAll(async () => {
  await stopWebSocketTestServer(server);
});

async function createToken(user_id = "123") {
  const token = await jwt.sign(
    {
      user_id: user_id,
    },
    "365d",
    process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY!,
  );
  console.log({ token });
  return token;
}

function waitForConnectionReady(client: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("connection readiness timeout")),
      5000,
    );
    client.on("message", (data) => {
      const response = JSON.parse(data.toString());
      if (
        response.channel === "message_events" &&
        response.action === "retrive"
      ) {
        clearTimeout(timeout);
        resolve();
      }
    });
    client.once("error", reject);
  });
}

describe("WebSocket ping", () => {
  it("delivers message to recipient", async () => {
    const client_a_id = "A as Identified";
    const client_b_id = "B as identified";

    const client_a_token = await createToken(client_a_id);
    const client_b_token = await createToken(client_b_id);

    const message_payload = {
      recipient_id: client_b_id,
      caption: "testing message",
      media_uploads: [],
      client_id: "client-assigned-message-id",
    };

    const client_a = new WebSocket("ws://127.0.0.1:3000/ws", {
      headers: { Authorization: `Bearer ${client_a_token}` },
    });

    const client_b = new WebSocket("ws://127.0.0.1:3000/ws", {
      headers: { Authorization: `Bearer ${client_b_token}` },
    });

    const client_a_ready = waitForConnectionReady(client_a);
    const client_a_open = new Promise<void>((resolve, reject) => {
      client_a.once("open", resolve);
      client_a.once("error", reject);
    });
    const client_b_ready = waitForConnectionReady(client_b);
    const client_b_open = new Promise<void>((resolve, reject) => {
      client_b.once("open", resolve);
      client_b.once("error", reject);
    });
    await Promise.all([
      client_a_open,
      client_a_ready,
      client_b_open,
      client_b_ready,
    ]);

    const received_message = new Promise<MessageStruct>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("message delivery timeout")),
        3000,
      );
      client_b.on("message", (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (
            response.message_uuid &&
            response.caption === message_payload.caption
          ) {
            clearTimeout(timeout);
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      });

      client_b.once("error", reject);
    });
    const delivered_feedback = new Promise<DeliveredItem>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("delivery feedback timeout")),
        3000,
      );
      client_a.on("message", (data) => {
        const response = JSON.parse(data.toString());
        if (
          response.channel === "chat" &&
          response.action === "delivered_items"
        ) {
          clearTimeout(timeout);
          resolve(response.payload[0]);
        }
      });
      client_a.once("error", reject);
    });

    client_a.send(
      JSON.stringify({
        channel: "chat",
        action: "send",
        payload: message_payload,
      }),
    );
    const message = await received_message;
    const delivered = await delivered_feedback;
    expect(message.caption).toBe(message_payload.caption);
    expect(message.recipient_id).toBe(client_b_id);
    expect(delivered.client_id).toBe(message_payload.client_id);
    expect(delivered.message_uuid).toBe(message.message_uuid);

    client_a.close();
    client_a.close();
    client_a.close();
    client_b.close();
  });
  it("handles recipient offline", async () => {
    const client_a_id = "A as Identified";
    const offline_user_id = `offline-user-${crypto.randomUUID()}`;

    const client_a_token = await createToken(client_a_id);

    const message_payload = {
      recipient_id: offline_user_id,
      caption: "recipient is offline",
      media_uploads: [],
      client_id: "offline-test-client-id",
    };

    const client_a = new WebSocket("ws://127.0.0.1:3000/ws", {
      headers: { Authorization: `Bearer ${client_a_token}` },
    });

    const client_a_ready = waitForConnectionReady(client_a);
    await new Promise<void>((resolve, reject) => {
      client_a.once("open", resolve);
      client_a.once("error", reject);
    });
    await client_a_ready;

    const sent_feedback = new Promise<SentItem>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("sent feedback timeout")),
        3000,
      );
      client_a.on("message", (data) => {
        const response = JSON.parse(data.toString());
        if (response.channel === "chat" && response.action === "sent_items") {
          clearTimeout(timeout);
          resolve(response.payload[0]);
        }
      });
      client_a.once("error", reject);
    });

    client_a.send(
      JSON.stringify({
        channel: "chat",
        action: "send",
        payload: message_payload,
      }),
    );

    const sent = await sent_feedback;
    expect(sent.client_id).toBe(message_payload.client_id);
    expect(sent.message_uuid).toBeDefined();

    const recipient_token = await createToken(offline_user_id);
    const recipient = new WebSocket("ws://127.0.0.1:3000/ws", {
      headers: { Authorization: `Bearer ${recipient_token}` },
    });
    const recipient_ready = waitForConnectionReady(recipient);
    await new Promise<void>((resolve, reject) => {
      recipient.once("open", resolve);
      recipient.once("error", reject);
    });
    await recipient_ready;

    const queued_message = new Promise<MessageStruct>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("queued message timeout")),
        3000,
      );
      recipient.on("message", (data) => {
        const response = JSON.parse(data.toString());
        if (response.message_uuid === sent.message_uuid) {
          clearTimeout(timeout);
          resolve(response);
        }
      });
      recipient.once("error", reject);
    });
    const delivered_after_reconnect = new Promise<DeliveredItem>(
      (resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("delivery feedback timeout")),
          3000,
        );
        client_a.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (
            response.action === "delivered_items" &&
            response.payload[0].message_uuid === sent.message_uuid
          ) {
            clearTimeout(timeout);
            resolve(response.payload[0]);
          }
        });
        client_a.once("error", reject);
      },
    );

    const received = await queued_message;
    const delivered = await delivered_after_reconnect;
    expect(received.client_id).toBe(message_payload.client_id);
    expect(delivered.client_id).toBe(message_payload.client_id);
    expect(delivered.message_uuid).toBe(sent.message_uuid);

    recipient.close();
    client_a.close();
  });
}, 20000);
