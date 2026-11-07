import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import { generateKeyPairSync } from "node:crypto";

dotenv.config({ path: ".test.env" });

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
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

process.env.JWT_ACCESS_TOKEN_PUBLIC_KEY = publicKey;
process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY = privateKey;

export default defineConfig({});
