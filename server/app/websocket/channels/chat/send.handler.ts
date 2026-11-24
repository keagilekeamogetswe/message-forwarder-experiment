import { randomUUID } from "node:crypto";

import type { WSClient } from "@/websocket/types/ws.client";
import type { WSMessage } from "@/websocket/types/ws.router";

import { CreateMessageForwarder } from "@/websocket/services/message.forwarder";

import {
  ClientInitialMessagePayload,
  type MessageStruct,
} from "@/model/message";
import { SendItemForwarder } from "./forwarders/sentItems";
import { DeliveredItemForwarder } from "./forwarders/deliveredItems";
import { SendMessageAction, type RoutedMessage } from "@/actions/send.message";

function isInitialMessagePayload(
  payload: unknown,
): payload is ClientInitialMessagePayload {
  if (typeof payload !== "object" || payload === null) return false;

  const candidate = payload as Record<string, unknown>;
  return (
    typeof candidate.recipient_id === "string" &&
    typeof candidate.caption === "string" &&
    Array.isArray(candidate.media_uploads) &&
    candidate.media_uploads.every((item) => typeof item === "string") &&
    typeof candidate.client_id === "string" &&
    candidate.client_id.length > 0 &&
    (candidate.reply_to === undefined || typeof candidate.reply_to === "string")
  );
}

function sendError(ws: WSClient, message: string, client_id?: string) {
  return CreateMessageForwarder(
    ws.user.user_id,
    { success: false, message, ...(client_id ? { client_id } : {}) },
    () => undefined,
  )();
}

function getPersistenceError(error: unknown): string {
  if (
    error instanceof Error &&
    (error.message === "User is not part of the specified group" ||
      error.message === "Invalid group recipient ID")
  ) {
    return error.message;
  }

  return "Message could not be persisted";
}

const ChatSendEventHandler = async (
  data: WSMessage,
  ws: WSClient,
): Promise<void> => {
  if (!isInitialMessagePayload(data.payload)) {
    await sendError(ws, "Invalid send payload");
    return;
  }

  const message_uuid = randomUUID();
  const chat_message: MessageStruct = {
    ...data.payload,
    message_uuid,
    sender_id: ws.user.user_id,
  };

  let routed: RoutedMessage;
  try {
    routed = SendMessageAction.route(chat_message);
  } catch (error) {
    await sendError(
      ws,
      error instanceof Error ? error.message : "Invalid message recipient",
      chat_message.client_id,
    );
    return;
  }

  if (routed.type === "primary") {
    const sendToRecipient = CreateMessageForwarder(
      routed.recipient_id,
      routed.message,
      async () => {
        await DeliveredItemForwarder(ws.user.user_id, [routed.message])();
      },
      async () => {
        try {
          await SendMessageAction.persist(routed);
          await SendItemForwarder(ws.user.user_id, [routed.message])();
        } catch (error) {
          await sendError(
            ws,
            getPersistenceError(error),
            chat_message.client_id,
          );
        }
      },
    );

    await sendToRecipient();
    return;
  }

  try {
    await SendMessageAction.persist(routed);
    await SendItemForwarder(ws.user.user_id, [routed.message])();
  } catch (error) {
    await sendError(ws, getPersistenceError(error), chat_message.client_id);
  }
};

export default ChatSendEventHandler;
