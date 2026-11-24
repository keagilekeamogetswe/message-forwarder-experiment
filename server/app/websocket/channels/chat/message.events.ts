import { CreateMessageForwarder } from "@/websocket/services/message.forwarder";
import {
  MessageEventsPartition,
  MessageEventsRepository,
} from "@/repository/mongo/message.items.event";
import { WSMessage } from "@/websocket/types/ws.router";
import { WSClient } from "@/websocket/types/ws.client";
import { ReadItemForwarder } from "./forwarders/readItems";
import { ClientReadItemsPayload } from "@/model/message";

export const MessageEventRetriveEventHandler = (
  sender_id: string,
  partitions: MessageEventsPartition,
) => {
  const data = {
    channel: "message_events",
    action: "retrive",
    payload: partitions,
  };
  const sendToClient = CreateMessageForwarder(
    sender_id, // The client we wish to inform
    data, // The information we was to send
    async () =>
      MessageEventsRepository.acknowledgePartition(sender_id, partitions),
    () => console.log("Client failed to send message"),
  );
  sendToClient();
};

interface NotifySenderMessageSenderStruct {
  sender_id: string;
  message_id: string;
}
export const MessageEventNotifySenderEventHandler = (
  sender_id: string,
  items: NotifySenderMessageSenderStruct,
) => {
  const data = {
    channel: "message_events",
    action: "recipient_acknoledgement",
    payload: items,
  };
  const sendToClient = CreateMessageForwarder(
    sender_id, // The client we wish to inform
    data, // The information we was to send
    () => undefined,
    () => console.log("Client failed to send message"),
  );
  sendToClient();
};

export const MessageReadItemsEventHandler = async (
  data: WSMessage,
  ws: WSClient,
): Promise<void> => {
  const payload = data.payload as
    | Partial<ClientReadItemsPayload>
    | undefined;
  if (
    !payload ||
    typeof payload.sender_id !== "string" ||
    !Array.isArray(payload.message_ids) ||
    payload.message_ids.length === 0 ||
    !payload.message_ids.every((message_id) => typeof message_id === "string")
  ) {
    await CreateMessageForwarder(
      ws.user.user_id,
      { success: false, message: "Invalid read_items payload" },
      () => undefined,
    )();
    return;
  }

  await ReadItemForwarder(
    payload.sender_id,
    ws.user.user_id,
    payload.message_ids,
  )();
};
