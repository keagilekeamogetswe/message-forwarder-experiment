import { CreateMessageForwarder } from "@/websocket/services/message.forwarder";
import { MessageEventsRepository } from "@/repository/mongo/message.items.event";
import { MessageStruct, DeliveredItem } from "@/model/message";

export const DeliveredItemForwarder = (
  sender_id: string,
  messages: MessageStruct[],
) => {
  const delivered_items: DeliveredItem[] = messages.map((delivered_item) => {
    const client_id = delivered_item.client_id;
    const delivered_at = new Date().toISOString();
    const recipient_id = delivered_item.recipient_id;
    const message_uuid = delivered_item.message_uuid;
    return { client_id, recipient_id, message_uuid, delivered_at, sender_id };
  });
  return CreateMessageForwarder(
    sender_id, // The client we wish to inform
    {
      channel: "chat",
      action: "delivered_items",
      payload: delivered_items,
    }, // The information we was to send
    () => console.log("Messages arrived at destination..."), //Means client is live on the websocket to have recieved this
    async () => {
      const message_saved =
        await MessageEventsRepository.deliveredItems.persist(
          sender_id,
          delivered_items.map((item) => item.message_uuid),
          delivered_items[0]?.recipient_id,
          messages.map((item) => item.client_id),
        );
      if (!message_saved) {
        console.error("Read items could not be saved to server");
        return;
      }
    },
  );
};
