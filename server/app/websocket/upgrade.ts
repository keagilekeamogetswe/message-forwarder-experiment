import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import jwt from "utility/jwt";
import type { WebSocketServer } from "ws";
import { WSClient } from "./types/ws.client";
import {
  ACCESS_TOKEN_LOCK_RENEW_INTERVAL_MS,
  AccessTokenRepository,
} from "../repository/redis/access.token";

export async function WSUpgradeEvent(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  wss: WebSocketServer,
) {
  let lockJti: string | undefined;
  let lockOwner: string | undefined;
  let lockUserId: string | undefined;

  try {
    const authorization = req.headers.authorization;
    const cookieToken = req.headers.cookie
      ?.split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("ws_access="))
      ?.slice("ws_access=".length);

    const token = authorization?.startsWith("Bearer ")
      ? authorization.substring(7)
      : cookieToken
        ? decodeURIComponent(cookieToken)
        : null;

    if (!token) {
      socket.destroy();
      return;
    }

    const user = await jwt.verify(
      token,
      process.env.JWT_ACCESS_TOKEN_PUBLIC_KEY!,
    );

    if (!user.jti) {
      socket.destroy();
      return;
    }

    lockUserId = user.user_id;
    lockJti = user.jti;
    lockOwner = await AccessTokenRepository.lock(lockUserId, lockJti);

    if (!lockOwner) {
      socket.destroy();
      return;
    }

    (req as any).user = user;

    wss.handleUpgrade(req, socket, head, (ws) => {
      const client = ws as WSClient;
      let released = false;
      let renewTimer: NodeJS.Timeout;

      const releaseLock = async () => {
        if (released) return;
        released = true;
        clearInterval(renewTimer);
        try {
          await AccessTokenRepository.unlock(lockUserId!, lockJti!, lockOwner!);
        } catch (error) {
          console.error("Failed to release WebSocket cookie lock:", error);
        }
      };

      renewTimer = setInterval(() => {
        void AccessTokenRepository.renewLock(lockUserId!, lockJti!, lockOwner!)
          .then((renewed) => {
            if (!renewed) client.terminate();
          })
          .catch((error) => {
            console.error("Failed to renew WebSocket cookie lock:", error);
            client.terminate();
          });
      }, ACCESS_TOKEN_LOCK_RENEW_INTERVAL_MS);
      renewTimer.unref();
      client.once("close", () => void releaseLock());

      client.user = user;
      client.isAlive = true;

      wss.emit("connection", client, req);
    });
  } catch (error) {
    if (lockUserId && lockJti && lockOwner) {
      try {
        await AccessTokenRepository.unlock(lockUserId, lockJti, lockOwner);
      } catch (releaseError) {
        console.error("Failed to release WebSocket cookie lock:", releaseError);
      }
    }
    console.error("WebSocket upgrade rejected:", error);
    socket.destroy();
  }
}
