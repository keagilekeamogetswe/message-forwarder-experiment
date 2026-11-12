import { randomUUID } from "node:crypto";

import type { WSClient } from "@/websocket/types/ws.client";
import type { WSMessage } from "@/websocket/types/ws.router";

import { CreateMessageDelivery } from "@/websocket/services/message.forwarder";

import {
  ClientInitialMessagePayload,
  type DeliveredItem,
  type MessageStruct,
  type SentItem,
} from "@/model/message";

function notifyDeliveredItem(ws: WSClient, item: DeliveredItem) {
  ws.send(
    JSON.stringify({
      channel: "chat",
      action: "delivery",
      payload: item,
    }),
  );
}

function notifySentItem(ws: WSClient, item: SentItem) {
  ws.send(
    JSON.stringify({
      channel: "chat",
      action: "sent",
      payload: item,
    }),
  );
}

const ChatSendEventHandler = (data: WSMessage, ws: WSClient): void => {
  const message_uuid = randomUUID();
  const payload = data.payload as ClientInitialMessagePayload;
  const recipient_id = payload.recipient_id;
  const chat_message: MessageStruct = {
    message_uuid,
    sender_id: ws.user.user_id,
    ...payload,
  };

  notifySentItem(ws, {
    message_uuid,
    client_id: chat_message.client_id,
    sent_at: new Date().toISOString(),
  });

  const sendToClient = CreateMessageDelivery(
    recipient_id,
    chat_message,
    () =>
      notifyDeliveredItem(ws, {
        message_uuid,
        client_id: chat_message.client_id,
        delivered_at: new Date().toISOString(),
      }),
    () => {
      //Signifying they will be delivered once the client becomes online
      notifySentItem(ws, {
        message_uuid,
        client_id: chat_message.client_id,
        sent_at: new Date().toISOString(),
      });
    },
  );

  sendToClient();
};

export default ChatSendEventHandler;
