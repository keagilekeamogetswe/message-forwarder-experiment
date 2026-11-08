import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import type { WSMessage } from "@/websocket/types/ws.router";

const ChatSendEventHandler = (data: WSMessage, ws: WebSocket): void => {
  const message_uuid = randomUUID();

  ws.send(
    JSON.stringify({
      success: true,
      intrinsic: {
        message_uuid,
        ...data,
      },
      message: "message sent",
    }),
  );
};

export default ChatSendEventHandler;
