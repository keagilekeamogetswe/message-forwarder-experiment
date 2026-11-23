import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../app/index.ts",
);

export async function startWebSocketTestServer(
  port = 3000,
  extraEnv: Partial<NodeJS.ProcessEnv> = {},
): Promise<ChildProcess> {
  const child = fork(serverPath, [], {
    env: { ...process.env, ...extraEnv, HTTP_PORT: String(port) },
    stdio: "inherit",
    execArgv: ["--import=tsx", "--import=extensionless/register"],
  });

  const deadline = Date.now() + 20_000;
  let lastError: unknown;
  let startupError: Error | undefined;
  child.once("error", (error) => {
    startupError = error;
  });

  while (Date.now() < deadline) {
    if (startupError) throw startupError;
    if (child.exitCode !== null) {
      throw new Error(
        `Test server exited before becoming ready (${child.exitCode})`,
      );
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/wsaccess`);
      if (response.status === 401) return child;
      lastError = new Error(
        `Unexpected server readiness status: ${response.status}`,
      );
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  child.kill("SIGTERM");
  throw new Error("Timed out waiting for the WebSocket test server", {
    cause: lastError,
  });
}

export async function stopWebSocketTestServer(
  child: ChildProcess | undefined,
): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, 5000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill("SIGTERM");
  });
}
