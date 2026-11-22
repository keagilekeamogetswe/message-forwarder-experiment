import { randomUUID } from "node:crypto";

import type { WSClient } from "@/websocket/types/ws.client";
import type { WSMessage } from "@/websocket/types/ws.router";

import { CreateMessageForwarder } from "@/websocket/services/message.forwarder";

import {
  ClientInitialMessagePayload,
  type MessageStruct,
  type SentItem,
} from "@/model/message";
import { SendItemForwarder } from "./forwarders/sentItems";
import { DeliveredItemForwarder } from "./forwarders/deliveredItems";
import { PrimaryMessageActions } from "@/actions/message/primary.action";

const ChatSendEventHandler = async (
  data: WSMessage,
  ws: WSClient,
): Promise<void> => {
  const message_uuid = randomUUID();
  const payload = data.payload as ClientInitialMessagePayload;
  const recipient_id = payload.recipient_id;
  const chat_message: MessageStruct = {
    message_uuid,
    sender_id: ws.user.user_id,
    ...payload,
  };
  const message_sent_feedback_dispatch = DeliveredItemForwarder(
    ws.user.user_id,
    [chat_message],
  );
  const sendToClient = CreateMessageForwarder(
    recipient_id,
    chat_message,
    async () => {
      void message_sent_feedback_dispatch();
    },
    async () => {
      await PrimaryMessageActions.persistMessage(chat_message);
      // infor the that the message haxs been sent to the server
      void SendItemForwarder(chat_message.sender_id, [chat_message])();
    },
  );

  await sendToClient();
};

export default ChatSendEventHandler;
