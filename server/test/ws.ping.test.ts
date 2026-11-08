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
process.env.WEBSOCKET_HEARTBEAT_TIMEOUT = "200";

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
  it("should ping the 5 times websocket", async () => {
    const token = await createToken();
    let ping_count = 0;
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket("ws://127.0.0.1:3000/ws", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      ws.on("ping", () => {
        ping_count += 1;
      });
      ws.on("open", () => {
        setTimeout(resolve, 1000);
      });

      ws.on("error", reject);
      // ws.close();
    });
    expect(ping_count).toBeGreaterThanOrEqual(4);
  });
  it("should ping all connected clients", async () => {
    const clientCount = 10;
    const pingCounts = Array(clientCount).fill(0);

    const clients = await Promise.all(
      Array.from(
        { length: clientCount },
        (_, index: number) =>
          new Promise<WebSocket>(async (resolve, reject) => {
            const token = await createToken(`${index}`);

            const ws = new WebSocket("ws://127.0.0.1:3000/ws", {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            ws.on("open", () => resolve(ws));
            ws.on("error", reject);
          }),
      ),
    );

    clients.forEach((ws, index) => {
      ws.on("ping", () => {
        pingCounts[index]++;
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await Promise.all(
      clients.map(
        (ws) =>
          new Promise<void>((resolve) => {
            ws.once("close", () => resolve());
            ws.close();
          }),
      ),
    );

    for (const count of pingCounts) {
      expect(count).toBeGreaterThan(2);
    }
  });
  it("should terminate stale clients that do not respond with pong", async () => {
    const token = await createToken("terminate");

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket("ws://127.0.0.1:3000/ws", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      ws.on("open", () => {
        // Sabotage automatic pong responses
        ws.pong = (() => {}) as typeof ws.pong;
      });

      ws.on("close", () => {
        resolve();
      });

      ws.on("error", reject);
    });
  });
});
