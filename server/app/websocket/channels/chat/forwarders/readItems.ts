import { CreateMessageForwarder } from "@/websocket/services/message.forwarder";
import { MessageEventsRepository } from "@/repository/mongo/message.items.event";
import { ReadItem } from "@/model/message";

export const ReadItemForwarder = (
  sender_id: string,
  recipient_id: string,
  message_ids: string[],
) => {
  const read_items: ReadItem[] = message_ids.map((message_uuid) => {
    const read_at = new Date().toISOString();
    return { recipient_id, message_uuid, read_at };
  });
  return CreateMessageForwarder(
    sender_id, // The author of the message to inform about the delivery
    {
      channel: "chat",
      action: "read_items",
      payload: read_items,
    }, // The information we was to send
    () => console.log("Messages arrived at destination..."), //Means client is live on the websocket to have recieved this
    async () => {
      const message_saved = await MessageEventsRepository.readItems.persist(
        sender_id,
        message_ids,
        recipient_id,
      );
      if (!message_saved) {
        console.error("Read items could not be saved to server");
        return;
      }
    },
  );
};
