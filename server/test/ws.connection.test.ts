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

async function createToken() {
  return jwt.sign(
    {
      user_id: "123",
    },
    "15m",
    process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY!,
  );
}

function waitForErrorResponse(ws: WebSocket, expectedMessage: string) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${expectedMessage}`)),
      3000,
    );
    ws.on("message", (data) => {
      const response = JSON.parse(data.toString());
      if (response.success === false && response.message === expectedMessage) {
        clearTimeout(timeout);
        resolve();
      }
    });
    ws.once("error", reject);
  });
}

describe("WebSocket", () => {
  it("should connect successfully", async () => {
    const token = await createToken();

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

  it("should reject unknown channels", async () => {
    const token = await createToken();

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket("ws://127.0.0.1:3000/ws", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const response = waitForErrorResponse(ws, "Channel not found");

      ws.once("open", () => {
        ws.send(
          JSON.stringify({
            channel: "unknown",
            action: "send",
          }),
        );
      });

      response.then(() => {
        ws.close();
        resolve();
      }, reject);

      ws.once("error", reject);
    });
  });

  it("should reject unknown actions", async () => {
    const token = await createToken();

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket("ws://127.0.0.1:3000/ws", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const response = waitForErrorResponse(ws, "Action not found");

      ws.once("open", () => {
        ws.send(
          JSON.stringify({
            channel: "chat",
            action: "unknown",
          }),
        );
      });

      response.then(() => {
        ws.close();
        resolve();
      }, reject);

      ws.once("error", reject);
    });
  });

  it("should reject invalid json", async () => {
    const token = await createToken();

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket("ws://127.0.0.1:3000/ws", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const response = waitForErrorResponse(ws, "Invalid JSON");

      ws.once("open", () => {
        ws.send("{invalid json");
      });

      response.then(() => {
        ws.close();
        resolve();
      }, reject);

      ws.once("error", reject);
    });
  });
});
