import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(
  projectRoot,
  "server",
  "app",
  "config",
  "tls",
  "certs",
);
const certificatePath = path.join(outputDirectory, "dev-cert.pem");
const privateKeyPath = path.join(outputDirectory, "dev-key.pem");
const hostname = process.argv[2] ?? "localhost";
const hosts = [...new Set([hostname, "localhost", "127.0.0.1", "::1"])];

function runMkcert(args) {
  const result = spawnSync("mkcert", args, { stdio: "inherit" });

  if (result.error?.code === "ENOENT") {
    console.error("mkcert was not found. Install it and make sure it is on PATH.");
    process.exit(1);
  }

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

mkdirSync(outputDirectory, { recursive: true });

// Install mkcert's local development CA into the current user's trust store.
runMkcert(["-install"]);
runMkcert([
  "-cert-file",
  certificatePath,
  "-key-file",
  privateKeyPath,
  ...hosts,
]);

console.log(`Created a trusted development certificate for: ${hosts.join(", ")}`);
console.log(`Certificate: ${certificatePath}`);
console.log(`Private key: ${privateKeyPath}`);
