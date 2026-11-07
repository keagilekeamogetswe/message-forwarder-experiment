import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import jwt from "utility/jwt";
import type { WebSocketServer } from "ws";

export async function WSUpgradeEvent(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  wss: WebSocketServer,
) {
  try {
    const auth = req.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
      socket.destroy();
      return;
    }

    const token = auth.substring(7);

    const user = await jwt.verify(
      token,
      process.env.JWT_ACCESS_TOKEN_PUBLIC_KEY!,
    );

    (req as any).user = user;

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } catch {
    socket.destroy();
  }
}
