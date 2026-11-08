import { WebSocket } from "ws";
import { IncomingMessage } from "http";
export interface WSMessage {
  channel: string;
  action: string;
  payload?: unknown;
}

export type IChannel = {
  actions: Record<string, MessageHandler>;
};

export type MessageHandler = (
  message: WSMessage,
  ws: WebSocket,
) => void | Promise<void>;
