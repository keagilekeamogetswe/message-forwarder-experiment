import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import type {
  BulkSendResult,
  ClientBulkMessagePayload,
  MessageStruct,
} from "@/model/message";
import { SendMessageAction, type RoutedMessage } from "@/actions/send.message";
import { GroupMessageActions } from "@/actions/message/group.action";
import { COLLECTION_NAMES } from "@/repository/mongo/message";
import { CreateMessageForwarder } from "@/websocket/services/message.forwarder";
import { DeliveredItemForwarder } from "./forwarders/deliveredItems";
import type { WSClient } from "@/websocket/types/ws.client";
import type { WSMessage } from "@/websocket/types/ws.router";

function isBulkPayload(payload: unknown): payload is ClientBulkMessagePayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return Array.isArray(value.recipients) &&
    value.recipients.length > 0 &&
    value.recipients.every((item) => typeof item === "string" && item.length > 0) &&
    typeof value.caption === "string" &&
    Array.isArray(value.media_uploads) &&
    value.media_uploads.every((item) => typeof item === "string") &&
    typeof value.client_id === "string" &&
    value.client_id.length > 0 &&
    (value.reply_to === undefined || typeof value.reply_to === "string");
}

function sendBulkResults(ws: WSClient, bulk_id: string, results: BulkSendResult[]) {
  return CreateMessageForwarder(
    ws.user.user_id,
    { channel: "chat", action: "bulk_sent", payload: { bulk_id, results } },
    () => undefined,
  )();
}

const ChatBulkSendEventHandler = async (
  data: WSMessage,
  ws: WSClient,
): Promise<void> => {
  if (!isBulkPayload(data.payload)) {
    await CreateMessageForwarder(
      ws.user.user_id,
      { success: false, message: "Invalid bulk send payload" },
      () => undefined,
    )();
    return;
  }

  const payload = data.payload as unknown as ClientBulkMessagePayload;
  const bulk_id = randomUUID();
  const results: BulkSendResult[] = payload.recipients.map((recipient) => ({
    recipient,
    status: "failed",
  }));
  const routed: Array<{ index: number; message: RoutedMessage }> = [];

  payload.recipients.forEach((recipient, index) => {
    const message: MessageStruct = {
      recipient_id: recipient,
      caption: payload.caption,
      media_uploads: payload.media_uploads,
      client_id: payload.client_id,
      reply_to: payload.reply_to,
      sender_id: ws.user.user_id,
      message_uuid: randomUUID(),
      bulk_id,
    };
    try {
      const route = SendMessageAction.route(message);
      route.message._id = new ObjectId();
      routed.push({ index, message: route });
      results[index].message_uuid = route.message.message_uuid;
    } catch (error) {
      results[index].error = error instanceof Error ? error.message : "Invalid recipient";
    }
  });

  // Group membership is checked per recipient so a bad group does not block
  // other recipients in this bulk request.
  const groupMessages = routed.filter(({ message }) => message.type === "group");
  const groupPersistence = await GroupMessageActions.persistMessages(
    groupMessages.map(({ message }) => message.message),
  );
  for (const entry of groupMessages) {
    const failure = groupPersistence.get(entry.message.message.message_uuid);
    if (failure === null) results[entry.index].status = "sent";
    else results[entry.index].error = failure ?? "Message could not be persisted";
  }

  for (const type of ["primary", "room"] as const) {
    const entries = routed.filter(({ message }) => message.type === type);
    if (!entries.length) continue;
    try {
      await SendMessageAction.persistMany(entries.map(({ message }) => message));
      for (const entry of entries) results[entry.index].status = "sent";
    } catch {
      for (const entry of entries) {
        results[entry.index].error = "Message could not be persisted";
      }
    }
  }

  // Primary copies are persisted first, then delivered live when possible.
  // Failed/offline sends remain available to connection-time restoration.
  const deliverablePrimaryMessages: Array<{ index: number; message: RoutedMessage }> =
    routed.filter(
      ({ index, message }) =>
        message.type === "primary" && results[index].status === "sent",
    );
  for (const entry of deliverablePrimaryMessages) {
    const message = entry.message.message;
    await CreateMessageForwarder(
      entry.message.recipient_id,
      message,
      async () => {
        await SendMessageAction.acknowledgePrimary(ws.user.user_id, message._id!);
        await DeliveredItemForwarder(ws.user.user_id, [message])();
      },
      () => undefined,
    )();
  }

  await sendBulkResults(ws, bulk_id, results);
};

export default ChatBulkSendEventHandler;
