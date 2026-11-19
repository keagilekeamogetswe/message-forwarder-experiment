import { fork, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import jwt from "../../utility/jwt";
import Database from "@/db";
import { MessageEventsRepository } from "@/repository/mongo/message.items.event";
import { WSMessage } from "@/websocket/types/ws.router";

let server: ChildProcess;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.resolve(__dirname, "../app/index.ts");
let collection;

beforeAll(async () => {
  server = fork(serverPath, [], {
    env: {
      ...process.env,
      HTTP_PORT: "3000",
    },
    stdio: "inherit",
    execArgv: ["--import=tsx", "--import=extensionless/register"],
  });

  server.on("error", console.error);

  server.on("exit", (code) => {
    console.log("server exited:", code);
  });
  collection = await Database.getMongoCollection("message_events");
  await collection.deleteMany({});

  await new Promise((resolve) => setTimeout(resolve, 8000));
}, 20000);

afterAll(() => {
  if (!server.killed) {
    server.kill("SIGTERM");
  }
});

async function createToken(user_id = "123") {
  return jwt.sign(
    {
      user_id: user_id,
    },
    "15m",
    process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY!,
  );
}

describe("Message evnets testing", () => {
  it("Retrives pending message evnets and acknowledges them", async () => {
    const author_user_id = "test-client";
    const recipient_user_id = "recipient";

    await MessageEventsRepository.deliveredItems.persist(
      author_user_id,
      ["message-id-1", "message-id-2"],
      recipient_user_id,
    );
    await MessageEventsRepository.sentItems.persist(author_user_id, [
      {
        client_id: "client side uuid for the message",
        message_uuid: "message-id-1",
      },
    ]);
    const author_user = await createToken(author_user_id);

    const ws_client_author = new WebSocket("ws://127.0.0.1:3000/ws", {
      headers: {
        Authorization: `Bearer ${author_user}`,
      },
    });
    const retrived = new Promise<WSMessage>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("event retrieval timeout")), 3000);
      ws_client_author.on("message", (data) => {
        const event = JSON.parse(data.toString()) as WSMessage;
        if (event.channel === "message_events" && event.action === "retrive") {
          clearTimeout(timeout);
          resolve(event);
        }
      });
      ws_client_author.once("error", reject);
    });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        ws_client_author.once("open", resolve);
        ws_client_author.once("error", reject);
      }),
    ]);
    const retrieved_message_events = await retrived;
    const payload = retrieved_message_events.payload! as Record<string, unknown[]>;
    expect(payload).toHaveProperty("delivered_items");
    expect(payload).toHaveProperty("sent_items");
    expect(payload).toHaveProperty("read_items");
    expect(payload.delivered_items).toHaveLength(2);
    expect(payload.sent_items).toHaveLength(1);
    Object.values(payload).flat().forEach((item) => {
      expect(item).not.toHaveProperty("_id");
    });

    let currect_events = await MessageEventsRepository.get(author_user_id);
    const acknowledge_deadline = Date.now() + 3000;
    while (
      (currect_events.sent_items.length || currect_events.delivered_items.length) &&
      Date.now() < acknowledge_deadline
    ) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      currect_events = await MessageEventsRepository.get(author_user_id);
    }
    expect(currect_events).toHaveProperty("delivered_items");
    expect(currect_events).toHaveProperty("sent_items");
    expect(currect_events.sent_items).toHaveLength(0);
    expect(currect_events.delivered_items).toHaveLength(0);
    ws_client_author.close();
  }, 20000);
}, 20000);
