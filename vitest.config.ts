import { defineConfig } from "vitest/config";
import dotenv from "dotenv";
import { generateKeyPairSync } from "node:crypto";
import tsconfigPaths from "vite-tsconfig-paths";

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

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // Disable parallel execution of different test files
    fileParallelism: false,

    // Force Vitest to use a single worker thread/process
    maxWorkers: 1,
    minWorkers: 1,

    // Run tests inside a single file sequentially (enabled by default)
    sequence: {
      concurrent: false,
    },
  },
});
