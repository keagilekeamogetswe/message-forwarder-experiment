// server/test/ws.connection.test.ts

import { fork, ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { WebSocket } from "ws";

import jwt from "../../utility/jwt";

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

describe("WebSocket", () => {
  it("should connect successfully", async () => {
    const token = await jwt.sign(
      {
        user_id: "123",
      },
      "15m",
      process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY!,
    );

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket("ws://127.0.0.1:3000/ws", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      ws.on("open", () => {
        ws.close();
        resolve();
      });

      ws.on("error", reject);
    });
  });

  it("should send and receive messages", async () => {
    const token = await jwt.sign(
      {
        user_id: "123",
      },
      "15m",
      process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY!,
    );

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket("ws://127.0.0.1:3000/ws", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      ws.on("open", () => {
        ws.send("hello");
      });

      ws.on("message", (data) => {
        expect(data.toString()).toBe("hello");

        ws.close();
        resolve();
      });

      ws.on("error", reject);
    });
  });

  it("should reject unauthenticated connections", async () => {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket("ws://127.0.0.1:3000/ws");

      ws.on("close", () => {
        resolve();
      });

      ws.on("open", () => {
        reject(new Error("Connection should not be accepted"));
      });

      ws.on("error", () => {
        resolve();
      });
    });
  });
});
