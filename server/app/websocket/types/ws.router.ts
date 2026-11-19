import { IncomingMessage } from "http";
import { WSClient } from "./ws.client";
export interface WSMessage {
  channel: string;
  action: string;
  payload?: Record<string, unknown>;
}

export type IChannel = {
  actions: Record<string, MessageHandler>;
};

export type MessageHandler = (
  message: WSMessage,
  ws: WSClient,
) => void | Promise<void>;
