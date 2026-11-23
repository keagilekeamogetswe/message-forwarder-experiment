import { WSMessageEventHandler } from "./massage";
import { WSClient } from "./types/ws.client";
import { ClientRegistry } from "./services/client.registry";
import { MessageEventsRepository } from "@/repository/mongo/message.items.event";
import { MessageEventRetriveEventHandler } from "./channels/chat/message.events";
import { PrimaryMessageActions } from "@/actions/message/primary.action";
import { GroupMessageActions } from "@/actions/message/group.action";
import { CreateMessageForwarder } from "./services/message.forwarder";
import { DeliveredItemForwarder } from "./channels/chat/forwarders/deliveredItems";

export function WSConnectionEvent(ws: WSClient) {
  const user = ws.user;

  if (!user) {
    ws.close();
    return;
  }
  ws.isAlive = true;
  ClientRegistry.add(ws);

  ws.on("pong", () => {
    ws.isAlive = true;
  });
  console.log("Connected:", user.user_id);

  ws.on("message", (data) => {
    WSMessageEventHandler(data, ws);
  });

  ws.on("close", () => {
    ws.close();
    ClientRegistry.remove(ws);
  });

  void restorePendingItems(ws).catch((error) => {
    console.error(`Failed to restore pending items for ${user.user_id}:`, error);
  });
}

async function restorePendingItems(ws: WSClient): Promise<void> {
  const user_id = ws.user.user_id;
  const message_events = await MessageEventsRepository.get(user_id);
  MessageEventRetriveEventHandler(user_id, message_events);

  const [pending_messages, pending_group_messages] = await Promise.all([
    PrimaryMessageActions.readMessages(user_id),
    GroupMessageActions.readMessages(user_id),
  ]);
  for (const message of pending_messages) {
    const pendingMessageId = message._id;
    if (!pendingMessageId) continue;
    await CreateMessageForwarder(
      user_id,
      message,
      async () => {
        await PrimaryMessageActions.acknowledgeMessages(user_id, [pendingMessageId]);
        await DeliveredItemForwarder(message.sender_id, [message])();
      },
      () => undefined,
    )();
  }

  for (const message of pending_group_messages) {
    const pendingMessageId = message._id;
    if (!pendingMessageId) continue;
    await CreateMessageForwarder(
      user_id,
      message,
      async () => {
        await GroupMessageActions.acknowledgeMessages(user_id, [pendingMessageId]);
        await DeliveredItemForwarder(message.sender_id, [message])();
      },
      () => undefined,
    )();
  }
}
