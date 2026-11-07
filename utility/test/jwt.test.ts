// tests/jwt.test.ts

import { describe, expect, it } from "vitest";
import jwt from "../jwt";

describe("JWT Utility", () => {
  const publicKey = process.env.JWT_ACCESS_TOKEN_PUBLIC_KEY!;
  const privateKey = process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY!;

  it("should sign a token", async () => {
    const token = await jwt.sign(
      {
        user_id: "user-123",
      },
      "15m",
      privateKey,
    );

    expect(token).toBeTypeOf("string");
    expect(token.split(".")).toHaveLength(3);
  });

  it("should verify a valid token", async () => {
    const token = await jwt.sign(
      {
        user_id: "user-123",
      },
      "15m",
      privateKey,
    );

    const payload = await jwt.verify(token, publicKey);

    expect(payload.user_id).toBe("user-123");
  });

  it("should preserve additional claims", async () => {
    const token = await jwt.sign(
      {
        user_id: "user-123",
        role: "admin",
        tenant_id: "tenant-1",
      },
      "15m",
      privateKey,
    );

    const payload = await jwt.verify(token, publicKey);

    expect(payload.user_id).toBe("user-123");
    expect(payload.role).toBe("admin");
    expect(payload.tenant_id).toBe("tenant-1");
  });

  it("should reject an invalid token", async () => {
    await expect(jwt.verify("not-a-jwt", publicKey)).rejects.toThrow();
  });

  it("should reject a tampered token", async () => {
    const token = await jwt.sign(
      {
        user_id: "user-123",
      },
      "15m",
      privateKey,
    );

    const tampered = token.slice(0, -5) + "abcde";

    await expect(jwt.verify(tampered, publicKey)).rejects.toThrow();
  });

  it("should reject verification with the wrong public key", async () => {
    const { generateKeyPairSync } = await import("node:crypto");

    const { publicKey: otherPublicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    const token = await jwt.sign(
      {
        user_id: "user-123",
      },
      "15m",
      privateKey,
    );

    await expect(jwt.verify(token, otherPublicKey)).rejects.toThrow();
  });

  it("should reject an expired token", async () => {
    const token = await jwt.sign(
      {
        user_id: "user-123",
      },
      "1s",
      privateKey,
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));

    await expect(jwt.verify(token, publicKey)).rejects.toThrow();
  });
});
