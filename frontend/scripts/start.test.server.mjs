import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import dotenv from "dotenv";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

dotenv.config({
  path: path.join(repoRoot, ".test.env"),
  override: true,
});

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

process.env.JWT_ACCESS_TOKEN_PUBLIC_KEY = publicKey;
process.env.JWT_ACCESS_TOKEN_PRIVATE_KEY = privateKey;

const { default: jwt } = await import(
  pathToFileURL(path.join(repoRoot, "utility", "jwt.ts"))
);
const testToken = await jwt.sign(
  { user_id: process.env.WS_TEST_USER_ID ?? "test-user" },
  "1h",
  privateKey,
);

const publicDirectory = path.join(repoRoot, "frontend", "public");
const tokenFile = path.join(publicDirectory, "ws-access-token.json");
mkdirSync(publicDirectory, { recursive: true });
writeFileSync(tokenFile, JSON.stringify({ token: testToken }), {
  mode: 0o600,
});

const backendPort = "4000";
const frontendPort = process.env.TEST_FRONTEND_PORT ?? "3000";
const childEnv = {
  ...process.env,
  HTTP_PORT: backendPort,
  HTTPS_ENABLED: "false",
  NODE_ENV: "development",
  WS_TEST_AUTH_ENABLED: "true",
  NEXT_TELEMETRY_DISABLED: "1",
};
const frontendEnv = {};
for (const key of [
  "PATH",
  "Path",
  "SystemRoot",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "LANG",
  "TERM",
]) {
  if (process.env[key]) frontendEnv[key] = process.env[key];
}
frontendEnv.NODE_ENV = "development";
frontendEnv.NEXT_TELEMETRY_DISABLED = "1";

const children = [];
const backend = spawn(
  process.execPath,
  [
    "--import=tsx",
    "--import=extensionless/register",
    path.join(repoRoot, "server", "app", "index.ts"),
  ],
  { cwd: repoRoot, env: childEnv, stdio: "inherit" },
);
children.push(backend);

const frontend = spawn(
  process.execPath,
  [
    path.join(
      repoRoot,
      "frontend",
      "node_modules",
      "next",
      "dist",
      "bin",
      "next",
    ),
    "dev",
    "--hostname",
    "localhost",
    "--port",
    frontendPort,
  ],
  { cwd: path.join(repoRoot, "frontend"), env: frontendEnv, stdio: "inherit" },
);
children.push(frontend);

let stopping = false;
function stop(exitCode, signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  rmSync(tokenFile, { force: true });

  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null)
      child.kill(signal);
  }

  process.exitCode = exitCode;
  const forceStop = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
      }
    }
  }, 5000);
  forceStop.unref();
}

for (const child of children) {
  child.once("error", (error) => {
    console.error("Failed to start a test service:", error);
    stop(1);
  });
  child.once("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });
}

process.once("SIGINT", () => stop(130, "SIGINT"));
process.once("SIGTERM", () => stop(143, "SIGTERM"));

console.log(
  `Test stack: frontend http://localhost:${frontendPort}, backend http://localhost:${backendPort}`,
);
