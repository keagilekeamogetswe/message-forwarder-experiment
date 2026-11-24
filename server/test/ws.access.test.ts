import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { WebSocket } from "ws";
import jwt from "../../utility/jwt";
import {
  startWebSocketTestServer,
  stopWebSocketTestServer,
} from "./ws.test.helpers";

let server: Awaited<ReturnType<typeof startWebSocketTestServer>>;

beforeAll(async () => {
  server = await startWebSocketTestServer(3000, {
    NODE_ENV: "test",
    WS_TEST_AUTH_ENABLED: "true",
  });
}, 25_000);

afterAll(async () => {
  await stopWebSocketTestServer(server);
});

describe("WebSocket access cookie", () => {
  it("issues a cookie that authenticates a WebSocket upgrade and rejects reuse", async () => {
    const userId = `ws-access-${crypto.randomUUID()}`;
    const authToken = await jwt.sign(
      { user_id: userId },
      "2m",
      process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY!,
    );

    const response = await fetch("http://127.0.0.1:3000/wsaccess", {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });

    const setCookie = response.headers.getSetCookie()[0];
    expect(setCookie).toBeDefined();
    const cookie = setCookie!.split(";", 1)[0];
    expect(cookie).toMatch(/^ws_access=/);

    const connectWithCookie = () =>
      new WebSocket("ws://127.0.0.1:3000/ws", {
        headers: { Cookie: cookie },
      });

    const firstConnection = connectWithCookie();
    await new Promise<void>((resolve, reject) => {
      firstConnection.once("open", resolve);
      firstConnection.once("error", reject);
    });

    const reusedCookieConnection = connectWithCookie();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(new Error("Expected reuse of a locked cookie to be rejected")),
        3000,
      );
      reusedCookieConnection.once("open", () => {
        clearTimeout(timeout);
        reject(
          new Error("A second connection with the locked cookie was accepted"),
        );
      });
      reusedCookieConnection.once("error", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      firstConnection.once("close", () => resolve());
      firstConnection.close();
    });

    const reconnected = await new Promise<WebSocket>((resolve, reject) => {
      const deadline = Date.now() + 3000;
      const attempt = () => {
        const client = connectWithCookie();
        client.once("open", () => resolve(client));
        client.once("error", () => {
          if (Date.now() >= deadline) {
            reject(
              new Error("Cookie lock was not released after socket close"),
            );
            return;
          }
          setTimeout(attempt, 50);
        });
      };
      attempt();
    });
    await new Promise<void>((resolve) => {
      reconnected.once("close", () => resolve());
      reconnected.close();
    });
  });

  it("rejects access-token requests without a valid bearer token", async () => {
    const response = await fetch("http://127.0.0.1:3000/wsaccess");
    expect(response.status).toBe(401);
  });

  it("issues a test-stack cookie for the requested browser user ID", async () => {
    const authenticatedToken = await jwt.sign(
      { user_id: "test-bootstrap-user" },
      "2m",
      process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY!,
    );
    const requestedUserId = `browser-user-${crypto.randomUUID()}`;
    const response = await fetch(
      `http://127.0.0.1:3000/wsaccess?test_user_id=${encodeURIComponent(requestedUserId)}`,
      { headers: { Authorization: `Bearer ${authenticatedToken}` } },
    );

    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie()[0]?.split(";", 1)[0];
    expect(cookie).toBeDefined();
    const token = cookie!.slice("ws_access=".length);
    const claims = await jwt.verify(
      token,
      process.env.JWT_ACCESS_TOKEN_PUBLIC_KEY!,
    );
    expect(claims.user_id).toBe(requestedUserId);
  });
});
