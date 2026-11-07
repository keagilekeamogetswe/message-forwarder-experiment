import express from "express";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import jwt from "utility/jwt";
import { AuthMiddleware } from "../authentication";

describe("auth middleware integration", () => {
  const app = express();

  let server: http.Server;
  let baseUrl: string;

  app.get("/protected", AuthMiddleware, (req, res) => {
    res.status(200).json({
      user: req.user,
    });
  });

  beforeAll(async () => {
    server = app.listen(0);

    await new Promise<void>((resolve) => {
      server.once("listening", resolve);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Could not determine port");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  it("returns 401 without auth header", async () => {
    const response = await fetch(`${baseUrl}/protected`);

    expect(response.status).toBe(401);

    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
  });

  it("returns 401 for malformed header", async () => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: "invalid",
      },
    });

    expect(response.status).toBe(401);

    expect(await response.json()).toEqual({
      error: "Invalid authorization header",
    });
  });

  it("accepts a valid token", async () => {
    const token = await jwt.sign(
      {
        user_id: "123",
      },
      "15m",
      process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY!,
    );

    const response = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.user.user_id).toBe("123");
  });

  it("rejects an invalid token", async () => {
    const response = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });

    expect(response.status).toBe(401);

    expect(await response.json()).toEqual({
      error: "Invalid token",
    });
  });
});
