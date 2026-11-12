import { fork, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import jwt from "../../utility/jwt";
import {
  ClientInitialMessagePayload,
  DeliveredItem,
  MessageStruct,
  SentItem,
} from "@/model/message";

let server: ChildProcess;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverPath = path.resolve(__dirname, "../app/index.ts");

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

  await new Promise((resolve) => setTimeout(resolve, 2000));
});

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
      headers: {
        Authorization: `Bearer ${client_a_token}`,
      },
    });

    const client_b = new WebSocket("ws://127.0.0.1:3000/ws", {
      headers: {
        Authorization: `Bearer ${client_b_token}`,
      },
    });

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        client_a.once("open", resolve);
        client_a.once("error", reject);
      }),
      new Promise<void>((resolve, reject) => {
        client_b.once("open", resolve);
        client_b.once("error", reject);
      }),
    ]);

    const received_message = new Promise<MessageStruct>((resolve, reject) => {
      client_b.once("message", (data) => {
        try {
          resolve(JSON.parse(data.toString()));
        } catch (error) {
          reject(error);
        }
      });

      client_b.once("error", reject);
    });
    let sentItemsFeedback: SentItem;

    client_a.on("message", (data) => {
      const json_data = JSON.parse(data.toString());
      sentItemsFeedback = (json_data.payload! as SentItem[])[0];
      console.log("--------------", json_data);
      console.log(sentItemsFeedback);
    });

    client_a.send(
      JSON.stringify({
        channel: "chat",
        action: "send",
        payload: message_payload,
      }),
    );
    // wait for the
    await new Promise((resolve) => {
      setTimeout(resolve, 60);
    });

    const message = await received_message;
    expect(message.caption).toBe(message_payload.caption);
    expect(message.recipient_id).toBe(client_b_id);
    expect(sentItemsFeedback!).toBeDefined();
    expect(sentItemsFeedback!.client_id).toBe(message_payload.client_id);
    expect(sentItemsFeedback!.message_uuid).toBe(message!.message_uuid);

    client_a.close();
    client_a.close();
    client_a.close();
    client_b.close();
  });
  it("handles recipient offline", async () => {
    const client_a_id = "A as Identified";
    const offline_user_id = "offline-user";

    const client_a_token = await createToken(client_a_id);

    const message_payload = {
      recipient_id: offline_user_id,
      caption: "recipient is offline",
      media_uploads: [],
      client_id: "offline-test-client-id",
    };

    const client_a = new WebSocket("ws://127.0.0.1:3000/ws", {
      headers: {
        Authorization: `Bearer ${client_a_token}`,
      },
    });

    await new Promise<void>((resolve, reject) => {
      client_a.once("open", resolve);
      client_a.once("error", reject);
    });

    let receivedDelivery = false;

    client_a.on("message", (data) => {
      const message = JSON.parse(data.toString());

      if (message.channel === "chat" && message.action === "delivery") {
        receivedDelivery = true;
      }
    });

    client_a.send(
      JSON.stringify({
        channel: "chat",
        action: "send",
        payload: message_payload,
      }),
    );

    // Giving the server a moment to process
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(receivedDelivery).toBe(false);

    client_a.close();
  });
}, 20000);
